import { FacilityCanonicalRedirect } from '../../../../components/clinical/FacilityCanonicalRedirect'

export default function DeptOpdQueueRedirectPage() {
  return (
    <FacilityCanonicalRedirect
      label="OPD queue"
      fallbackHref="/doctor"
      pathForSlug={(slug) => `/os/${slug}/clinical/queue`}
    />
  )
}
