import type { CapacitorConfig } from '@capacitor/cli';

const label = process.env.VITE_LABEL || 'receipt-cash';

const labels: Record<string, { appId: string; appName: string }> = {
  'receipt-cash': {
    appId: 'cash.receipt.app',
    appName: 'Receipt.Cash',
  },
  'sugardaddy-cash': {
    appId: 'cash.sugardaddy.app',
    appName: 'SugarDaddy.Cash',
  },
};

const { appId, appName } = labels[label] ?? labels['receipt-cash'];

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      overlaysWebView: true,
    },
  },
};

export default config;
