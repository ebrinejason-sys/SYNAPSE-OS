'use client'

import type { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type RevealProps = {
  children: ReactNode
  /** Vertical travel distance in px */
  y?: number
  /** Animation delay in seconds */
  delay?: number
  /** Animation duration in seconds */
  duration?: number
  className?: string
  style?: CSSProperties
  /** Render as a list item, section, etc. Defaults to div. */
  as?: 'div' | 'li' | 'section' | 'article'
}

export function Reveal({
  children,
  y = 24,
  delay = 0,
  duration = 0.55,
  className,
  style,
  as = 'div',
}: RevealProps) {
  const reduceMotion = useReducedMotion()
  const MotionTag = motion[as] as typeof motion.div

  return (
    <MotionTag
      className={className}
      style={style}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -10% 0px' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  )
}
