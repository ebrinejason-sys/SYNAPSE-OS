'use client'
import { useEffect, useState } from 'react'

export function AndroidBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent)
    const dismissed = sessionStorage.getItem('apk-dismissed')
    setShow(isAndroid && !dismissed)
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 py-3"
         style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
      <span className="text-sm font-medium">
        📱 Get the Synapse Android app for full wearable support
      </span>
      <div className="flex gap-3 items-center">
        <a href="/download" className="text-sm font-bold underline">Download</a>
        <button
          onClick={() => {
            sessionStorage.setItem('apk-dismissed', '1')
            setShow(false)
          }}
          className="font-bold text-lg leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
