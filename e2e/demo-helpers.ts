import { expect, type Page, type Request } from "playwright/test"

export const FORBIDDEN_WRITE = /\/rest\/v1\/(persons|patients|encounters|triage|observations|lab_|prescriptions|inventory|billing|payments|referrals)/i

export async function resetDemo(page: Page) {
  await page.goto("/demo")
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("synapse-demo-playground")
      req.onsuccess = () => resolve()
      req.onblocked = () => resolve()
      req.onerror = () => reject(req.error)
    })
    sessionStorage.clear()
  })
  await page.reload()
  await expect(page.getByRole("heading", { name: /SYNAPSE Test Drive/i })).toBeVisible()
}

export async function readDemoStore(page: Page, store: string) {
  return page.evaluate(async (storeName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("synapse-demo-playground")
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (!db.objectStoreNames.contains(storeName)) {
      db.close()
      return []
    }
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const r = db.transaction(storeName).objectStore(storeName).getAll()
      r.onsuccess = () => resolve(r.result as unknown[])
      r.onerror = () => reject(r.error)
    })
    db.close()
    return rows
  }, store)
}

export function attachWriteGuard(page: Page) {
  const blocked: string[] = []
  const onRequest = (request: Request) => {
    const method = request.method()
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return
    const url = request.url()
    if (FORBIDDEN_WRITE.test(url)) blocked.push(`${method} ${url}`)
  }
  page.on("request", onRequest)
  return {
    blocked,
    detach() {
      page.off("request", onRequest)
    },
  }
}

export async function startReceptionVisit(page: Page) {
  await page.getByRole("link", { name: "Start Test Drive" }).click()
  await expect(page.getByRole("heading", { name: "Take a station" })).toBeVisible()
  await page.getByRole("link", { name: "Recommended start: Reception" }).click()
  await expect(page.getByRole("heading", { name: "Reception" })).toBeVisible()
  await page.getByRole("button", { name: /Amina Demo/ }).first().click()
  await page.getByLabel("Chief Complaint").fill("Fever and headache for 3 days")
  await page.getByRole("button", { name: "Start Visit & Send to Triage" }).click()
  await expect(page.getByRole("heading", { name: /Visit Started/i })).toBeVisible()
}
