"use client"

import * as React from "react"
import { CLINICAL_STATE_COPY, type ClinicalState } from "./tokens"
import { cn } from "./utils"

export function StatusIndicator({
  state,
  children,
  className,
}: {
  state: ClinicalState
  children?: React.ReactNode
  className?: string
}) {
  const copy = CLINICAL_STATE_COPY[state]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        state === "CRITICAL" && "border-current",
        className,
      )}
      role="status"
      aria-label={`${copy.label}${children ? `: ${String(children)}` : ""}`}
    >
      <span aria-hidden="true">{copy.icon}</span>
      <span>{copy.label}</span>
      {children ? <span>{children}</span> : null}
    </span>
  )
}

export function LiveRegion({
  message,
  politeness = "polite",
}: {
  message: string
  politeness?: "polite" | "assertive"
}) {
  return (
    <div className="sr-only" aria-live={politeness} aria-atomic="true">
      {message}
    </div>
  )
}

export function SkipLink({ href = "#main", children = "Skip to main content" }: { href?: string; children?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow"
    >
      {children}
    </a>
  )
}

export function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? (
          <span className="text-destructive">
            {" "}
            *<span className="sr-only"> required</span>
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean }>, {
            id,
            "aria-describedby": describedBy,
            "aria-invalid": Boolean(error) || undefined,
            required,
          })
        : children}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
