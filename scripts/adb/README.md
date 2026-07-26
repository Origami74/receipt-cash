# scripts/adb — automated D-01 fund-safety exit gate over `adb`

Plan `01-06` (phase `01-upgrade-applesauce-v5-6-2-x`). Replaces the manual real-device
checkpoint plan `01-05` could not satisfy (the operator cannot perform manual device passes)
with a scripted `adb` + Chrome DevTools Protocol harness that drives a real Android phone.

This automates *who drives the phone*, not *what counts as a pass*. D-01 is unchanged: a live
receipt keeps collecting incoming payments and settlements after (a) backgrounding and (b) a
network drop, with no manual page refresh.

## One-time host setup

1. **Install Android platform-tools** (provides `adb`):
   - Debian/Ubuntu: `sudo apt install android-tools-adb`
   - macOS: `brew install android-platform-tools`
   - Or download the SDK platform-tools zip from https://developer.android.com/tools/releases/platform-tools
     and put the extracted `platform-tools/` directory on `PATH`.
   - Confirm: `adb version` prints a version string.

2. **Enable USB debugging on the phone.**
   - Settings → About phone → tap "Build number" 7 times to unlock Developer options.
   - Settings → Developer options → enable "USB debugging".
   - Also enable "Stay awake while charging" — the backgrounding/network-drop cycles run for
     minutes at a time and the harness cannot progress past a locked screen.

3. **Connect over USB** (not adb-over-wifi). Run B in the gate toggles the phone's radios
   (wifi/data/airplane mode) to force a real socket death — an adb-over-wifi connection would be
   severed by the very toggle being tested, aborting the run mid-cycle. `requireUsbDevice()`
   in `device.ts` rejects a TCP transport for exactly this reason.

4. **Authorise the host key.** The phone shows an "Allow USB debugging?" dialog the first time a
   new host connects — accept it (optionally checking "Always allow from this computer").

5. **Confirm exactly one authorised device:**
   ```bash
   adb devices -l
   ```
   Expected output: exactly one line ending in `device` (not `unauthorized`, not `offline`), and
   the entry should NOT show a `<ip>:<port>` style serial (that indicates a TCP/wifi connection —
   see step 3).

6. **Install Chrome on the phone** (for the Android Chrome scenario) and open it once so the
   `chrome_devtools_remote` abstract socket exists for `forwardCdp()` to find.

7. **For the native-build scenario (Task 4)**, build and install the Capacitor debug APK:
   ```bash
   npm run cap:android   # builds web assets, syncs, opens Android Studio
   # then, from Android Studio or the CLI: build + `adb install -r` the debug APK
   ```
   `capacitor.config.ts` has `android.webContentsDebuggingEnabled: true`, so the WebView exposes
   a `webview_devtools_remote_<pid>` socket once the app is running — `forwardCdp()` discovers it
   by reading `/proc/net/unix` on the device.

## Modules

| File | Exports | Purpose |
|------|---------|---------|
| `device.ts` | `requireUsbDevice`, `forwardCdp`, `background`, `foreground`, `setNetwork` | `adb` device control |
| `cdp.ts` | `attachAndroidChrome`, `attachCapacitorWebView`, `readLoadId`, `readDebugLogs` | CDP attachment + reload/log inspection |
| `redact.ts` | `redact`, `RedactionError` | Fail-closed secret-material scrubber |
| `evidence.ts` | `writeD01Result`, `writeNativeResumeResult`, `writeReproResult` | Fills existing evidence-document result blocks |
| `run-d01-gate.ts` | (executable) | Orchestrates the full D-01 exit-gate run |

## Running the gate

```bash
npx tsx scripts/adb/run-d01-gate.ts
```

Requires: a USB-connected, authorised Android phone (step 5 above); the app served at a host
reachable from the phone (`npm run dev` with the phone on the same network, or a deployed URL)
open in Chrome on the phone; and a payer wallet seeded with a small amount of real ecash (D-05 —
real sats, immaterial amounts).

The script prints per-cycle PASS/FAIL/INVALID/INCONCLUSIVE verdicts and, at the end, writes the
measured result into `.planning/phases/01-upgrade-applesauce-v5-6-2-x/01-FUND-SAFETY-EVIDENCE.md`
via `writeD01Result` — never a value that was not measured in that run.

## Self-checks that do not require a phone

Two of the four modules can be proven without any hardware attached, and should be run first:

```bash
npx tsx scripts/adb/redact.ts --self-check
```

This is intentionally kept out of `npm run build`'s type-check surface and out of any `test`
script — this milestone has no test framework by design (see `01-VALIDATION.md`'s Test
Infrastructure table); these are plain executable fixtures in the same style as
`scripts/verify-nostr-fundpath.ts`.
