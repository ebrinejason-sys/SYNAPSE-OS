"use client"

import { useEffect, useState } from "react"
import { DEMO_THEME_STORAGE_KEY } from "../../lib/demo/stations"

type DemoTheme = "light" | "dark" | "system"

function resolveTheme(choice: DemoTheme): "light" | "dark" {
  if (choice === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"
  }
  return choice === "dark" ? "dark" : "light"
}

function readChoice(): DemoTheme {
  if (typeof window === "undefined") return "light"
  const stored = localStorage.getItem(DEMO_THEME_STORAGE_KEY)
  if (stored === "dark" || stored === "light" || stored === "system") return stored
  return "light"
}

function applyResolved(choice: DemoTheme) {
  const resolved = resolveTheme(choice)
  document.documentElement.setAttribute("data-theme", resolved)
  localStorage.setItem(DEMO_THEME_STORAGE_KEY, choice)
  localStorage.setItem("synapse-theme", resolved)
}

export function DemoThemeControl() {
  const [choice, setChoice] = useState<DemoTheme>("light")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const next = readChoice()
    setChoice(next)
    applyResolved(next)
    const id = window.setTimeout(() => applyResolved(next), 50)
    return () => window.clearTimeout(id)
  }, [])

  function apply(next: DemoTheme) {
    setChoice(next)
    applyResolved(next)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="demo-icon-btn"
        aria-label="Change color theme"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {resolveTheme(choice) === "dark" ? "Dark" : "Light"}
      </button>
      {open ? (
        <div className="demo-menu" role="menu">
          {(["light", "dark", "system"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={choice === option}
              className={choice === option ? "is-active" : undefined}
              onClick={() => apply(option)}
            >
              {option === "system" ? "System" : option === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
