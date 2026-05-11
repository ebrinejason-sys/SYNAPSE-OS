import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServerClientInstance(
  cookieStore: { get: (name: string) => { value: string } | undefined }
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.keys(cookieStore).map((name) => ({
            name,
            value: cookieStore.get(name)?.value ?? "",
          }));
        },
        setAll() {},
      },
    }
  );
}
