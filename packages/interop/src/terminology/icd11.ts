/**
 * Synapse Terminology Service — WHO ICD-11 MMS 2026-01.
 *
 * AI never persists an ICD code. It proposes a clinical term. This module
 * searches a local cache (and optionally the official WHO API) and returns
 * verified candidates. A clinician must select before persist.
 */

export const ICD11_RELEASE = "2026-01"
export const ICD11_LINEARIZATION = "mms"
export const ICD11_CLASSIFICATION = "ICD-11 MMS"
export const ICD11_API_BASE = "https://id.who.int/icd/release/11/2026-01/mms"
export const ICD11_TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token"

export type Icd11Entity = {
  stemCode: string
  title: string
  foundationUri: string
  linearizationUri: string
  classification: typeof ICD11_CLASSIFICATION
  release: typeof ICD11_RELEASE
  extensionCodes?: string[]
}

export type VerifiedIcd11Coding = Icd11Entity & {
  selectedBy: "clinician"
  suggestedBy: "synapse_intelligence" | "clinician" | "import"
  confirmedAt: string
}

export type Icd11SearchHit = Icd11Entity & { score: number }

/** Curated 2026-01 MMS subset for tests and WHO-API outage fallback. */
export const ICD11_SEED_CACHE: Icd11Entity[] = [
  entity("1G40", "Sepsis without septic shock", "1435254666"),
  entity("1G41", "Septic shock", "1445432654"),
  entity("1F40", "Malaria due to Plasmodium falciparum", "585833267"),
  entity("1F41", "Malaria due to Plasmodium vivax", "1445432001"),
  entity("CA40", "Pneumonia", "1420522198"),
  entity("CA40.0", "Bacterial pneumonia", "1420522199"),
  entity("5A21", "Diabetic ketoacidosis", "129607455"),
  entity("BA00", "Essential hypertension", "163930425"),
  entity("BA03", "Hypertensive crisis", "163930499"),
  entity("GB60", "Acute kidney failure", "774206215"),
  entity("CA23", "Asthma", "136010214"),
  entity("JA24", "Pre-eclampsia", "1137162418"),
  entity("JA25", "Eclampsia", "1137162419"),
  entity("JA43", "Postpartum haemorrhage", "1137162500"),
  entity("1C62", "HIV disease", "151662322"),
  entity("1B10", "Tuberculosis", "1435254001"),
  entity("1A07", "Typhoid fever", "1435254111"),
]

function entity(stemCode: string, title: string, foundationId: string): Icd11Entity {
  return {
    stemCode,
    title,
    foundationUri: `https://id.who.int/icd/entity/${foundationId}`,
    linearizationUri: `${ICD11_API_BASE}/${stemCode}`,
    classification: ICD11_CLASSIFICATION,
    release: ICD11_RELEASE,
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function searchIcd11(query: string, cache: Icd11Entity[] = ICD11_SEED_CACHE): Icd11SearchHit[] {
  const needle = normalize(query)
  if (!needle) return []
  return cache
    .map((item) => {
      const hay = normalize(`${item.title} ${item.stemCode}`)
      let score = 0
      if (hay === needle || item.stemCode.toLowerCase() === needle) score = 1
      else if (hay.startsWith(needle) || item.title.toLowerCase().startsWith(query.toLowerCase())) score = 0.85
      else if (hay.includes(needle)) score = 0.7
      else if (needle.split(" ").every((part) => hay.includes(part))) score = 0.55
      return { ...item, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.stemCode.localeCompare(b.stemCode))
}

export function lookupStem(code: string, cache: Icd11Entity[] = ICD11_SEED_CACHE): Icd11Entity | null {
  const stem = code.trim()
  return cache.find((item) => item.stemCode === stem) ?? null
}

/** True only when the stem exists in the terminology cache — never invent codes. */
export function isKnownIcd11Stem(code: string, cache: Icd11Entity[] = ICD11_SEED_CACHE): boolean {
  return lookupStem(code, cache) != null
}

export function confirmIcd11Selection(params: {
  entity: Icd11Entity
  selectedBy: "clinician"
  suggestedBy?: VerifiedIcd11Coding["suggestedBy"]
  confirmedAt?: string
}): VerifiedIcd11Coding {
  if (params.selectedBy !== "clinician") {
    throw new Error("ICD11_CLINICIAN_CONFIRMATION_REQUIRED")
  }
  return {
    ...params.entity,
    selectedBy: "clinician",
    suggestedBy: params.suggestedBy ?? "clinician",
    confirmedAt: params.confirmedAt ?? new Date().toISOString(),
  }
}

export function whoApiConfigured(env: NodeJS.Dict<string> = process.env): boolean {
  return Boolean(env.WHO_ICD_CLIENT_ID && env.WHO_ICD_CLIENT_SECRET)
}

export async function searchWhoIcd11(
  query: string,
  options: {
    fetchImpl?: typeof fetch
    env?: NodeJS.Dict<string>
    cache?: Icd11Entity[]
  } = {},
): Promise<{ hits: Icd11SearchHit[]; source: "who" | "cache"; degraded: boolean }> {
  const cache = options.cache ?? ICD11_SEED_CACHE
  const local = searchIcd11(query, cache)
  const env = options.env ?? process.env
  if (!whoApiConfigured(env)) {
    return { hits: local, source: "cache", degraded: true }
  }

  try {
    const fetchImpl = options.fetchImpl ?? fetch
    const tokenRes = await fetchImpl(ICD11_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.WHO_ICD_CLIENT_ID ?? "",
        client_secret: env.WHO_ICD_CLIENT_SECRET ?? "",
        scope: "icdapi_access",
      }),
    })
    if (!tokenRes.ok) throw new Error(`WHO_TOKEN_${tokenRes.status}`)
    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    const token = tokenJson.access_token
    if (!token) throw new Error("WHO_TOKEN_MISSING")

    const searchUrl = `${ICD11_API_BASE}/search?q=${encodeURIComponent(query)}&useFlexisearch=true&flatResults=true`
    const searchRes = await fetchImpl(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "API-Version": "v2",
        "Accept-Language": "en",
      },
    })
    if (!searchRes.ok) throw new Error(`WHO_SEARCH_${searchRes.status}`)
    const body = (await searchRes.json()) as {
      destinationEntities?: Array<{ theCode?: string; title?: string; id?: string; stemId?: string }>
    }
    const hits: Icd11SearchHit[] = (body.destinationEntities ?? [])
      .filter((row) => row.theCode)
      .slice(0, 10)
      .map((row, index) => ({
        stemCode: String(row.theCode),
        title: String(row.title ?? "").replace(/<[^>]+>/g, ""),
        foundationUri: String(row.stemId ?? row.id ?? ""),
        linearizationUri: String(row.id ?? `${ICD11_API_BASE}/${row.theCode}`),
        classification: ICD11_CLASSIFICATION,
        release: ICD11_RELEASE,
        score: Math.max(0.5, 1 - index * 0.05),
      }))
    return { hits: hits.length ? hits : local, source: hits.length ? "who" : "cache", degraded: hits.length === 0 }
  } catch {
    return { hits: local, source: "cache", degraded: true }
  }
}
