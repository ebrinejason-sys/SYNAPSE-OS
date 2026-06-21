import { ComingSoon } from '../../components/ComingSoon'

export const metadata = { title: 'Pricing · SynapseOS' }

export default function PricingPage() {
  return (
    <ComingSoon
      title="Pricing"
      subtitle="A detailed pricing page with plan comparisons is on the way. Current plans and rates are summarised on our home page. Confirm final rates with sales before procurement."
      backHref="/#pricing"
      backLabel="View plans"
    />
  )
}
