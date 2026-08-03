/**
 * Network helper for portal pages.
 * Mutations never fake success when offline — that previously cleared carts / wrote stock UI as if persisted.
 */
export async function resilientFetch(url: string, options: RequestInit = {}) {
  const method = (options.method || "GET").toUpperCase()
  const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method)

  if (typeof navigator !== "undefined" && !navigator.onLine && isMutation) {
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        error: "You are offline. Changes were not saved. Reconnect and retry.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }

  try {
    return await fetch(url, options)
  } catch (err) {
    if (isMutation) {
      return new Response(
        JSON.stringify({
          success: false,
          offline: true,
          error: "Network error. Changes were not saved. Retry when connected.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      )
    }
    throw err
  }
}
