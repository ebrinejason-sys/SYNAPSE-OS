/** Guard destructive smoke tests before creating clients or obtaining credentials. */
export function disposableOnboardingTarget(env, args = []) {
  if (env.SYNAPSE_DISPOSABLE_DB_TEST !== 'true' || args.includes('--project-ref')) {
    throw new Error('Requires SYNAPSE_DISPOSABLE_DB_TEST=true and an explicit local disposable URL; remote projects are forbidden')
  }
  const url = new URL(env.SUPABASE_URL || '')
  if (!['http:', 'https:'].includes(url.protocol) ||
      !['127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Only a literal loopback disposable Supabase URL is allowed')
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw new Error('Provide an explicit disposable service-role key')
  return { url: url.origin, key: env.SUPABASE_SERVICE_ROLE_KEY.trim() }
}
