import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createNoticeBus } from './notice-bus'

describe('platform notice bus (restore confirmation must outlive the row)', () => {
  it('delivers notices to page-level subscribers and supports unsubscribe', () => {
    const bus = createNoticeBus()
    const seen = vi.fn()
    const off = bus.subscribe(seen)
    bus.publish('Identity restored. (a@x.invalid)')
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ text: 'Identity restored. (a@x.invalid)', kind: 'success' }))
    off()
    bus.publish('ignored')
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('row actions publish to the bus and the page renders the region outside the user list', () => {
    const actions = readFileSync(join(__dirname, 'UserActions.tsx'), 'utf8')
    expect(actions).toMatch(/platformNotices\.publish\(`\$\{success\}/)
    const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8')
    const region = page.indexOf('<PlatformNoticeRegion />')
    expect(region).toBeGreaterThan(-1)
    expect(region).toBeLessThan(page.indexOf('<UserActions'))
    const comp = readFileSync(join(__dirname, 'PlatformNoticeRegion.tsx'), 'utf8')
    expect(comp).toMatch(/tabIndex=\{-1\}/)
    expect(comp).toMatch(/ref\.current\?\.focus\(\)/)
  })
})
