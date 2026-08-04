/**
 * Android preview APK for public download CTAs (pharmacy landing).
 */
export const ANDROID_APK_FALLBACK_URL =
  'https://expo.dev/artifacts/eas/mW7WeJ9BmeIvRLEGjeXFKSLURcIGi07lHwolp-g-HlA.apk'

export const ANDROID_BUILDS_URL =
  'https://expo.dev/accounts/ebrinejason/projects/synapse-app/builds'

export function androidApkUrl(): string {
  const fromEnv =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim()
      : undefined
  return fromEnv || ANDROID_APK_FALLBACK_URL
}
