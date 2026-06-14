'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

export function DomainCell({
  displayDomain,
  isVerified,
  hasCustom,
}: {
  displayDomain: string
  isVerified: boolean
  hasCustom: boolean
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(displayDomain).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const href = displayDomain.startsWith('http') ? displayDomain : `https://${displayDomain}`

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={displayDomain}
          className="max-w-[160px] truncate font-mono text-xs text-[#E8B84B] hover:underline"
        >
          {displayDomain}
        </a>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open pharmacy site"
          className="shrink-0 text-muted-color hover:text-[#E8B84B] transition"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <button
          type="button"
          aria-label="Copy domain"
          onClick={copy}
          className="shrink-0 text-muted-color hover:text-primary-color transition"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <span
        className={`inline-block rounded-full border px-1.5 py-px text-[9px] ${
          isVerified
            ? 'border-green-500/25 bg-green-500/10 text-green-300'
            : 'border-subtle text-muted-color'
        }`}
      >
        {isVerified ? 'custom ✓' : hasCustom ? 'DNS pending' : 'default'}
      </span>
    </div>
  )
}
