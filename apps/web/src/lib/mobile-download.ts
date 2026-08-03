/**
 * Android preview APK for public download CTAs.
 * Prefer NEXT_PUBLIC_ANDROID_APK_URL so landings stay current without code edits.
 * Fallback is the latest finished EAS preview artifact we know about.
 */
export const ANDROID_APK_FALLBACK_URL =
  'https://expo.dev/artifacts/eas/f8XcgQHdtt77d6vBvZTrJRAJ3lvCsFlv1t80tnkKZQ0.apk'

export const ANDROID_BUILDS_URL =
  'https://expo.dev/accounts/ebrinejason/projects/synapse-app/builds'

export function androidApkUrl(): string {
  const fromEnv =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim()
      : undefined
  return fromEnv || ANDROID_APK_FALLBACK_URL
}
