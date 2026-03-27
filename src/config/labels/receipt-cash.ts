import type { LabelConfig } from '../label'

const config: LabelConfig = {
  appName: 'Receipt.Cash',
  shareTitle: 'Split the bill with me',
  getShareText: (amount, title, url) =>
    `Hey! I paid for ${title} (${amount}) — want to split it?\n\nPay your share here: ${url}`,
  credentialName: 'Receipt.Cash Wallet Recovery Phrase',
}

export default config
