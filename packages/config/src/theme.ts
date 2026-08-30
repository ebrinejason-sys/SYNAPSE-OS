/** Shared theme contract across Synapse web + pharmacy apps. */

export const SYNAPSE_THEME_STORAGE_KEY = 'synapse-theme'
export const LEGACY_PHARM_THEME_STORAGE_KEY = 'pharm-theme'

/** Inline FOUC script — sets data-theme (+ optional dark/light class) before first paint. */
export function synapseThemeFoucScript(options?: { syncDarkLightClass?: boolean }): string {
  const syncClass = options?.syncDarkLightClass ?? false
  const classSync = syncClass
    ? `if(t==='dark'){d.classList.add('dark');d.classList.remove('light');}else if(t==='light'){d.classList.remove('dark');d.classList.add('light');}`
    : ''
  return `(function(){try{var d=document.documentElement,k='${SYNAPSE_THEME_STORAGE_KEY}',legacy='${LEGACY_PHARM_THEME_STORAGE_KEY}';var legacyVal=localStorage.getItem(legacy);if(legacyVal&&!localStorage.getItem(k)){localStorage.setItem(k,legacyVal==='dark'||legacyVal==='light'?legacyVal:'dark');localStorage.removeItem(legacy);}var t=localStorage.getItem(k);if(!t||t==='system'){t=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';}d.setAttribute('data-theme',t);${classSync}}catch(e){}})();`
}

export type SynapseTheme = 'light' | 'dark' | 'system'
