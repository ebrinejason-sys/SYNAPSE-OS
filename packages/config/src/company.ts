/** Canonical public company / contact configuration for SYNAPSE. */

export const COMPANY = {
  legalName: 'Synapse Health Technologies Ltd',
  brandName: 'SYNAPSE',
  tagline: 'Connected healthcare infrastructure for African healthcare environments.',
  location: 'Kampala, Uganda',
  publicEmail: 'synapseostech@gmail.com',
  domains: {
    apex: 'https://synapseos.tech',
    www: 'https://www.synapseos.tech',
    admin: 'https://admin.synapseos.tech',
    pharmacy: 'https://pharm.synapseos.tech',
    lab: 'https://lab.synapseos.tech',
    demo: 'https://demo.synapseos.tech',
  },
} as const

export type CompanyConfig = typeof COMPANY

export const PUBLIC_CONTACT_EMAIL = COMPANY.publicEmail
export const PUBLIC_MAILTO = `mailto:${COMPANY.publicEmail}`
