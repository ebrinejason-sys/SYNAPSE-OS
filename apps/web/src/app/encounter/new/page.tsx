import { FacilityCanonicalRedirect } from '../../../components/clinical/FacilityCanonicalRedirect'

export default function NewEncounterRedirectPage() {
  return (
    <FacilityCanonicalRedirect
      label="new encounter"
      fallbackHref="/os"
      pathTemplate="/os/[slug]/encounters/new"
    />
  )
}
