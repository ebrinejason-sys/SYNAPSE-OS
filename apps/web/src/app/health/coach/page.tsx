'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, User } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const STARTERS = [
  'What should I know about my latest lab results?',
  'Give me a healthy meal plan for this week',
  'How can I improve my sleep quality?',
  'What are warning signs I should watch for given my conditions?',
]

export default function HealthCoachPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('ai_health_chats')
        .select('id, role, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(40) as { data: Message[] | null }
      setMessages(data ?? [])
    }
    init()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading || !userId) return
    setInput('')
    setLoading(true)

    const userMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetch('/api/health/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, userId }),
      })
      const data = await res.json() as { reply: string }
      const assistantMsg: Message = {
        id: `tmp-ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? 'I had trouble responding. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I could not respond right now. Please try again.',
        created_at: new Date().toISOString(),
      }])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>AI Health Coach</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your personal health assistant — powered by Gemini AI</p>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="py-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}>
                <Bot className="h-7 w-7" />
              </div>
            </div>
            <p className="text-center text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Hello! I&apos;m your Synapse AI Health Coach. I can answer questions about your health, help you understand your results, and give personalised wellness advice.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {STARTERS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-2xl p-3 text-sm text-left transition-all hover:border-orange-500/30"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-1"
                style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}
              >
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={{
                background: m.role === 'user' ? 'var(--brand-orange)' : 'var(--bg-surface)',
                color: m.role === 'user' ? '#07070A' : 'var(--text-primary)',
                border: m.role === 'assistant' ? '1px solid var(--border-edge)' : 'none',
              }}
            >
              {m.content}
            </div>
            {m.role === 'user' && (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-1"
                style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--brand-orange)' }}
              >
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-7 w-7 items-center justify-center rounded-full shrink-0" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}>
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask your health coach…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all disabled:opacity-40"
          style={{ background: 'var(--brand-orange)', color: '#07070A' }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
