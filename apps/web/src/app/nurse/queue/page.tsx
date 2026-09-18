import { FacilityCanonicalRedirect } from '../../../components/clinical/FacilityCanonicalRedirect'

export default function NurseQueueRedirectPage() {
  return (
    <FacilityCanonicalRedirect
      label="Nursing workspace"
      fallbackHref="/nurse"
      pathTemplate="/os/[slug]/clinical/nursing"
    />
  )
}
