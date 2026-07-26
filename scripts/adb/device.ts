/**
 * `adb` device control for the D-01 fund-safety exit-gate harness (plan 01-06).
 *
 * Every function here shells out to `adb`. Nothing in this file touches app source or
 * app storage — it only drives the phone (foreground/background, radios, port forwarding).
 *
 * Run with: npx tsx scripts/adb/device.ts (no CLI surface of its own beyond being imported
 * by run-d01-gate.ts; import the exports directly for scripted use).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { attachAndroidChrome, readLoadId } from "./cdp.ts";

const execFileAsync = promisify(execFile);

/** Android Chrome's package id — used only by this file's smoke check to bring Chrome back to
 * the foreground; the actual D-01 gate run targets whatever page is already open. */
const ANDROID_CHROME_PACKAGE = "com.android.chrome";

/** A physical USB adb serial never contains ':' (that shape is reserved for adb-over-TCP,
 * e.g. `192.168.1.5:5555` or `emulator-host:port`). This is the whole basis of the TCP
 * rejection in requireUsbDevice() below. */
const TCP_SERIAL_SHAPE = /^[^\s]+:\d+$/;

export interface AdbDeviceEntry {
  serial: string;
  state: string;
  isTcp: boolean;
}

async function runAdb(args: string[], serial?: string): Promise<string> {
  const fullArgs = serial ? ["-s", serial, ...args] : args;
  try {
    const { stdout } = await execFileAsync("adb", fullArgs, { timeout: 30_000 });
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`adb ${fullArgs.join(" ")} failed: ${message}`);
  }
}

/** Parses `adb devices -l` output into structured entries, skipping the header line. */
function parseDevicesList(raw: string): AdbDeviceEntry[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("List of devices attached"));

  return lines.map((line) => {
    const [serial, state] = line.split(/\s+/, 2);
    return { serial, state, isTcp: TCP_SERIAL_SHAPE.test(serial) };
  });
}

/**
 * Resolves the single connected, USB-attached, authorised device serial.
 *
 * Throws with an actionable message if: zero devices are attached; more than one device is
 * attached (ambiguous — which one is under test?); the device is `unauthorized` (host key not
 * accepted yet); or the transport is TCP rather than USB. The TCP rejection matters because
 * Run B (network-drop scenario) disables wifi/data — an adb-over-wifi connection would be
 * severed by the exact disruption being measured, aborting the run mid-cycle.
 */
export async function requireUsbDevice(): Promise<string> {
  const raw = await runAdb(["devices", "-l"]);
  const entries = parseDevicesList(raw);

  if (entries.length === 0) {
    throw new Error(
      "requireUsbDevice: no adb devices found. Connect an Android phone over USB, enable USB " +
        "debugging (Settings -> Developer options), and accept the host-authorisation dialog on " +
        "the phone. See scripts/adb/README.md for full setup steps.",
    );
  }

  // An explicit serial resolves the ambiguity the multi-device guard below exists to prevent,
  // so it is honoured rather than overridden — but it must still name a device that is actually
  // attached. Silently falling back to "the only other one" would reintroduce exactly the
  // wrong-phone-under-test risk this function is here to eliminate.
  const requested = process.env.ADB_DEVICE_SERIAL?.trim();
  if (requested) {
    const picked = entries.find((e) => e.serial === requested);
    if (!picked) {
      const list = entries.map((e) => `${e.serial} (${e.state})`).join(", ");
      throw new Error(
        `requireUsbDevice: ADB_DEVICE_SERIAL="${requested}" is not attached. Attached: ${list}.`,
      );
    }
    return assertUsableDevice(picked);
  }

  if (entries.length > 1) {
    const list = entries.map((e) => `${e.serial} (${e.state})`).join(", ");
    throw new Error(
      `requireUsbDevice: ${entries.length} devices attached (${list}) — exactly one device must ` +
        "be connected so the harness is unambiguous about which phone is under test. Disconnect " +
        "the others, or set ADB_DEVICE_SERIAL to name the one under test.",
    );
  }

  return assertUsableDevice(entries[0]);
}

/** Shared state/transport validation, so an explicitly-selected device is held to exactly the
 * same bar as an auto-selected one. */
function assertUsableDevice(device: AdbDeviceEntry): string {
  if (device.state === "unauthorized") {
    throw new Error(
      `requireUsbDevice: device ${device.serial} is unauthorized. Accept the "Allow USB ` +
        "debugging?" +
        ' dialog on the phone screen, then re-run.',
    );
  }

  if (device.state !== "device") {
    throw new Error(
      `requireUsbDevice: device ${device.serial} is in state "${device.state}" (expected ` +
        '"device"). Check the phone screen for an unlock prompt or USB-mode dialog.',
    );
  }

  if (device.isTcp) {
    throw new Error(
      `requireUsbDevice: device ${device.serial} is connected over TCP/wifi, not USB. This ` +
        "harness requires a USB connection because the network-drop scenario disables wifi and " +
        "mobile data on the phone — an adb-over-wifi session would be severed by that exact " +
        "disruption, aborting the cycle under test. Reconnect over USB and run " +
        "`adb usb` if a stale TCP session persists.",
    );
  }

  return device.serial;
}

async function getFreeLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close();
        reject(new Error("getFreeLocalPort: could not determine an allocated port"));
      }
    });
  });
}

/** Reads /proc/net/unix on-device and returns the abstract socket name for the Capacitor
 * WebView's devtools socket (`webview_devtools_remote_<pid>`), or null if none is found. */
async function findWebViewDevtoolsSocket(serial: string): Promise<string | null> {
  const raw = await runAdb(["shell", "cat", "/proc/net/unix"], serial);
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(/(webview_devtools_remote_\d+)/);
    if (match) return match[1];
  }
  return null;
}

export type CdpTarget = "chrome" | "capacitor";

export interface ForwardHandle {
  port: number;
  dispose: () => Promise<void>;
}

/**
 * Sets up `adb forward tcp:<port> localabstract:<socket>` for either Chrome
 * (`chrome_devtools_remote`) or the Capacitor WebView (discovered dynamically, since its
 * abstract socket name is PID-suffixed and changes on every app relaunch).
 */
export async function forwardCdp(serial: string, target: CdpTarget): Promise<ForwardHandle> {
  let socketName: string;

  if (target === "chrome") {
    socketName = "chrome_devtools_remote";
  } else {
    const discovered = await findWebViewDevtoolsSocket(serial);
    if (!discovered) {
      throw new Error(
        "forwardCdp: no webview_devtools_remote_<pid> socket found on device. Confirm the " +
          "Capacitor app is running and capacitor.config.ts has " +
          "android.webContentsDebuggingEnabled: true.",
      );
    }
    socketName = discovered;
  }

  const port = await getFreeLocalPort();
  await runAdb(["forward", `tcp:${port}`, `localabstract:${socketName}`], serial);

  return {
    port,
    dispose: async () => {
      await runAdb(["forward", "--remove", `tcp:${port}`], serial).catch(() => {
        // Best-effort teardown — a forward that's already gone is not an error.
      });
    },
  };
}

/** Sends the phone to the launcher (home screen). This must genuinely background the app —
 * it does not merely blur the WebView, it sends the whole task to the background, which is
 * the real-world scenario D-01 exists to survive. */
export async function background(serial: string): Promise<void> {
  await runAdb(["shell", "input", "keyevent", "KEYCODE_HOME"], serial);
}

/**
 * Returns to the app WITHOUT navigating — resumes the existing task rather than starting a
 * fresh instance. `packageOrActivity` may be a bare package id (`cash.receipt.app`, uses
 * `monkey -p <pkg> -c android.intent.category.LAUNCHER 1`, which brings the existing task to
 * the front if one exists) or an explicit `package/.Activity` component (uses
 * `am start -n`, which Android resumes onto the existing task by default when the activity is
 * already in the recents stack and no `FLAG_ACTIVITY_NEW_TASK`-style intent is issued).
 *
 * If this actually restarts a fresh instance instead of resuming, that is itself a page
 * reload — the harness's `readLoadId()` check in cdp.ts is what catches that regardless of
 * which of these two paths was taken.
 */
export async function foreground(serial: string, packageOrActivity: string): Promise<void> {
  if (packageOrActivity.includes("/")) {
    await runAdb(["shell", "am", "start", "-n", packageOrActivity], serial);
  } else {
    await runAdb(
      ["shell", "monkey", "-p", packageOrActivity, "-c", "android.intent.category.LAUNCHER", "1"],
      serial,
    );
  }
}

async function getSdkVersion(serial: string): Promise<number> {
  const raw = await runAdb(["shell", "getprop", "ro.build.version.sdk"], serial);
  const parsed = parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readWifiEnabled(serial: string): Promise<boolean> {
  const raw = await runAdb(["shell", "dumpsys", "wifi"], serial);
  const match = raw.match(/Wi-Fi is (enabled|disabled)/i);
  if (!match) {
    throw new Error("readWifiEnabled: could not parse Wi-Fi state from `dumpsys wifi` output");
  }
  return match[1].toLowerCase() === "enabled";
}

async function readAirplaneModeOn(serial: string): Promise<boolean> {
  const raw = await runAdb(["shell", "settings", "get", "global", "airplane_mode_on"], serial);
  return raw.trim() === "1";
}

/**
 * Toggles connectivity via `svc wifi`/`svc data`, preferring `cmd connectivity airplane-mode`
 * on API levels that support it (30+). Verifies the requested state actually took effect
 * before returning — this must not assume the shell command worked, because a false "network
 * is down" belief here would silently invalidate the entire network-drop scenario.
 */
export async function setNetwork(serial: string, enabled: boolean): Promise<void> {
  const sdk = await getSdkVersion(serial);
  const desiredEnabledWord = enabled ? "enable" : "disable";

  if (sdk >= 30) {
    await runAdb(["shell", "cmd", "connectivity", "airplane-mode", enabled ? "disable" : "enable"], serial);
  } else {
    await runAdb(["shell", "svc", "wifi", desiredEnabledWord], serial);
    await runAdb(["shell", "svc", "data", desiredEnabledWord], serial);
  }

  // Verify — poll briefly, since the radio state change is not always instantaneous.
  const deadline = Date.now() + 10_000;
  let verified = false;
  while (Date.now() < deadline) {
    try {
      if (sdk >= 30) {
        const airplaneOn = await readAirplaneModeOn(serial);
        verified = airplaneOn === !enabled;
      } else {
        const wifiEnabled = await readWifiEnabled(serial);
        verified = wifiEnabled === enabled;
      }
    } catch {
      verified = false;
    }
    if (verified) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!verified) {
    throw new Error(
      `setNetwork: requested ${enabled ? "enable" : "disable"} but could not confirm the state ` +
        "took effect within 10s. Do not proceed — a disruption that never actually happened " +
        "invalidates the cycle under test.",
    );
  }
}

/**
 * End-to-end smoke check: attach to Chrome on the phone, open any page, read the load id,
 * background the phone for 5 seconds, foreground it, read the load id again, and confirm it
 * is unchanged. A harness that cannot demonstrate "backgrounded and came back without a
 * reload" on a trivial page has no business reporting on a fund-safety gate.
 *
 * Run directly with: npx tsx scripts/adb/device.ts
 */
async function runSmokeCheck(): Promise<void> {
  console.log("D-01 harness smoke check: proving background -> foreground survives without a page reload...");

  const serial = await requireUsbDevice();
  console.log(`Using device: ${serial}`);

  const forward = await forwardCdp(serial, "chrome");
  console.log(`Forwarded chrome_devtools_remote to localhost:${forward.port}`);

  try {
    const page = await attachAndroidChrome(forward.port);
    console.log(`Attached to page: ${page.url()}`);

    const before = await readLoadId(page);
    console.log(`Initial load id: ${before}`);

    await background(serial);
    console.log("Backgrounded phone, holding for 5s...");
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    await foreground(serial, ANDROID_CHROME_PACKAGE);
    console.log("Foregrounded phone");

    const after = await readLoadId(page);
    console.log(`Load id after resume: ${after}`);

    if (after === before) {
      console.log("PASS: load id unchanged across background/foreground cycle — bridge is proven");
    } else {
      console.error(`FAIL: load id changed (${before} -> ${after}) — page reloaded on resume`);
      process.exitCode = 1;
    }
  } finally {
    await forward.dispose();
  }
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  runSmokeCheck().catch((error) => {
    console.error("Smoke check failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
