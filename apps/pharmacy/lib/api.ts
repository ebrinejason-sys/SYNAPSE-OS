import { queueMutation } from "./offlineStorage";

export async function resilientFetch(url: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());

  // Use navigator.onLine as a fast check, but also handle actual fetch failure
  if (!navigator.onLine && isMutation) {
    console.log(`[Offline] Queueing mutation: ${method} ${url}`);
    let body = options.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // keep as string
      }
    }

    await queueMutation(url, method, body, (options.headers as any) || {});

    // Return a fake successful response
    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message: 'Action queued for sync'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch(url, options);
    return response;
  } catch (err) {
    // If fetch failed and it's a mutation, queue it
    if (isMutation) {
      console.log(`[Offline] Fetch failed, queueing mutation: ${method} ${url}`);
      let body = options.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) { /* ignore */ }
      }
      await queueMutation(url, method, body, (options.headers as any) || {});
      return new Response(JSON.stringify({
        success: true,
        offline: true,
        message: 'Action queued for sync'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw err;
  }
}
