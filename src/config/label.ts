import receiptCash from './labels/receipt-cash'
import sugardaddyCash from './labels/sugardaddy-cash'

export interface LabelConfig {
  appName: string
  host: string
  shareTitle: string
  getShareText: (amount: string, title: string, url: string) => string
  credentialName: string
}

const configs: Record<string, LabelConfig> = {
  'receipt-cash': receiptCash,
  'sugardaddy-cash': sugardaddyCash,
}

export const labelConfig: LabelConfig = configs[import.meta.env.VITE_LABEL] ?? receiptCash

/**
 * Returns the canonical origin for building share URLs.
 * On web, uses the current origin (works for dev/preview).
 * On native (Capacitor), uses the label's configured host since
 * window.location.origin would be localhost.
 */
export function getAppOrigin(): string {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'capacitor:') {
    return `https://${labelConfig.host}`
  }
  return window.location.origin
}
