# Landing APK CTAs + particle atmosphere

**Date:** 2026-08-03

## Shipped
- Stable download: `/download/android` on web + pharmacy → redirects to `NEXT_PUBLIC_ANDROID_APK_URL` or EAS artifact fallback.
- **synapseos.tech** hero: Download Android APK CTA, nav “Get the app”, footer link, live chip.
- **pharm.synapseos.tech** hero + header: Download Android APK CTA.
- Particle field (canvas) on both landings — brand orange/gold/teal, reduced-motion safe.
  Inspired by swarm aesthetics ([particles.casberry.in](https://particles.casberry.in/)); not a full WebGL import.
- Originkit ([originkit.dev](https://www.originkit.dev/)): kept existing Framer Motion / shimmer language; full MCP component pull needs an Originkit API key when you want specific catalog pieces.

## Env
```
NEXT_PUBLIC_ANDROID_APK_URL=https://expo.dev/artifacts/eas/<latest>.apk
```

## Deploy
- Web READY: `dpl_41KKBnFUfrGAk5BMu3DGAjZYUD5T` → https://www.synapseos.tech
- Pharmacy READY: `dpl_7A3EMFL8Pna8s1C5aPZE7TtmP4z1` → https://pharm.synapseos.tech
- Download: https://www.synapseos.tech/download/android · https://pharm.synapseos.tech/download/android
- Git: no commit
