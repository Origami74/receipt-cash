import type { LabelConfig } from '../label'

const config: LabelConfig = {
  appName: 'SugarDaddy.Cash',
  shareTitle: 'Help me out? 💅🥺',
  getShareText: (amount, title, url) =>
    `Hey sugar! 💅\n\nI just spent ${amount} at ${title} and I'm feeling a little... broke.\n\nWould you help me out? Pretty please? 🥺\n\nYou can pay your share here: ${url}`,
  credentialName: 'SugarDaddy.Cash Wallet Recovery Phrase',
}

export default config
