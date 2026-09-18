import { FacilityCanonicalRedirect } from '../../../components/clinical/FacilityCanonicalRedirect'

export default function NewEncounterRedirectPage() {
  return (
    <FacilityCanonicalRedirect
      label="new encounter"
      fallbackHref="/os"
      pathForSlug={(slug) => `/os/${slug}/encounters/new`}
    />
  )
}
