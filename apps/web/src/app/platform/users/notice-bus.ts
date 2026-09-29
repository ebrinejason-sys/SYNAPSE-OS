export type PlatformNotice = { id: number; text: string; kind: 'success' | 'error' }
type Listener = (notice: PlatformNotice) => void

/**
 * Page-level notice bus. Row actions (restore/archive/suspend…) can remove
 * their own row from a filtered list after revalidation, which unmounts the
 * row's local status message. Publishing here keeps the confirmation visible
 * in a region that is not part of the filtered list.
 */
export function createNoticeBus() {
  const listeners = new Set<Listener>()
  let seq = 0
  return {
    publish(text: string, kind: PlatformNotice['kind'] = 'success') {
      const notice = { id: ++seq, text, kind }
      for (const l of listeners) l(notice)
      return notice
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const platformNotices = createNoticeBus()
