import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null;

function makeRatelimit(requests: number, window: `${number} ${"s" | "m" | "h"}`, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix });
}

export const rateLimiters = {
  ai: makeRatelimit(30, "1 m", "rl:ai"),
  demoAi: makeRatelimit(20, "1 h", "rl:demo-ai"),
  auth: makeRatelimit(10, "1 m", "rl:auth"),
  api: makeRatelimit(120, "1 m", "rl:api"),
  import: makeRatelimit(5, "1 m", "rl:import"),
};

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining: number }> {
  if (!limiter) {
    console.warn("[RateLimit] Redis not configured — failing open");
    return { success: true, remaining: 999 };
  }
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
