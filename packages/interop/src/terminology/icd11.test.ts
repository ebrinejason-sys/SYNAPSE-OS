import { describe, expect, it } from "vitest"
import { lookupStem, searchIcd11, searchWhoIcd11, whoApiConfigured } from "./icd11"

describe("ICD-11 terminology survival", () => {
  it("searches and looks up the seed cache without WHO", () => {
    const hits = searchIcd11("malaria")
    expect(hits[0]?.stemCode).toBeTruthy()
    expect(lookupStem(hits[0]!.stemCode)?.title).toMatch(/Malaria/i)
  })

  it("falls back to cache when credentials are missing", async () => {
    const result = await searchWhoIcd11("pneumonia", { env: {} })
    expect(result.source).toBe("cache")
    expect(result.degraded).toBe(true)
    expect(result.hits.length).toBeGreaterThan(0)
    expect(whoApiConfigured({})).toBe(false)
  })

  it("falls back to cache when the WHO provider fails", async () => {
    const result = await searchWhoIcd11("sepsis", {
      env: { WHO_ICD11_CLIENT_ID: "id", WHO_ICD11_CLIENT_SECRET: "secret" },
      fetchImpl: async () => new Response("nope", { status: 503 }),
    })
    expect(result.source).toBe("cache")
    expect(result.degraded).toBe(true)
    expect(result.hits.some((hit) => hit.stemCode === "1G40")).toBe(true)
  })
})
