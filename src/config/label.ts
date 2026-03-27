import receiptCash from './labels/receipt-cash'
import sugardaddyCash from './labels/sugardaddy-cash'

export interface LabelConfig {
  appName: string
  shareTitle: string
  getShareText: (amount: string, title: string, url: string) => string
  credentialName: string
}

const configs: Record<string, LabelConfig> = {
  'receipt-cash': receiptCash,
  'sugardaddy-cash': sugardaddyCash,
}

export const labelConfig: LabelConfig = configs[import.meta.env.VITE_LABEL] ?? receiptCash
