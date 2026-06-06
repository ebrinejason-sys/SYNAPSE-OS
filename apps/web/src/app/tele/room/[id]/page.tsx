'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, FileText, X } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'

interface Appointment {
  id: string
  status: string
  scheduled_for: string | null
  chief_complaint: string | null
  provider_id: string | null
  patient_id: string | null
}

interface Note {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export default function TeleRoomPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [panel, setPanel] = useState<'none' | 'chat' | 'notes'>('none')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [note, setNote] = useState<Note>({ subjective: '', objective: '', assessment: '', plan: '' })
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('telemedicine_appointments')
        .select('id, status, scheduled_for, chief_complaint, provider_id, patient_id')
        .eq('id', id)
        .single() as { data: Appointment | null }
      setAppt(data)
      setLoading(false)
    }
    load()
  }, [id])

  async function saveNote() {
    if (!appt) return
    setSavingNote(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('telemedicine_soap_notes').upsert({
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      provider_id: appt.provider_id,
      ...note,
    })
    setSavingNote(false)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 3000)
  }

  function endCall() {
    router.push('/tele')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070A' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading room…</p>
      </div>
    )
  }

  if (!appt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#07070A' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Appointment not found.</p>
        <Link href="/tele" className="text-sm" style={{ color: '#F97316' }}>Back to Telemedicine</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#07070A' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 z-10"
        style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>
          <p className="text-sm font-semibold text-white">Synapse Consultation</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {appt.chief_complaint ?? 'Video Consultation'}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
        >
          ● Live
        </span>
      </div>

      {/* Video area */}
      <div className="flex-1 flex relative" style={{ background: '#111' }}>
        {/* Remote video placeholder */}
        <div className="flex-1 flex items-center justify-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}
          >
            D
          </div>
        </div>

        {/* Local camera preview */}
        <div
          className="absolute bottom-4 right-4 h-32 w-24 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: '#222', border: '2px solid rgba(255,255,255,0.1)' }}
        >
          {camOn ? (
            <p className="text-[10px] text-center px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Camera Preview
            </p>
          ) : (
            <VideoOff className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.3)' }} />
          )}
        </div>

        {/* Side panel */}
        {panel !== 'none' && (
          <div
            className="absolute right-0 top-0 bottom-0 w-80 flex flex-col"
            style={{ background: 'rgba(7,7,10,0.95)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-sm font-semibold text-white">{panel === 'chat' ? 'Chat' : 'SOAP Notes'}</p>
              <button type="button" onClick={() => setPanel('none')}>
                <X className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
              </button>
            </div>

            {panel === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`text-xs px-3 py-2 rounded-xl ${m.role === 'me' ? 'ml-6 text-right' : 'mr-6'}`}
                      style={{
                        background: m.role === 'me' ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.8)',
                      }}
                    >
                      {m.content}
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <p className="text-xs text-center pt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>No messages yet</p>
                  )}
                </div>
                <div className="p-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && chatInput.trim()) {
                        setChatMessages(prev => [...prev, { role: 'me', content: chatInput.trim() }])
                        setChatInput('')
                      }
                    }}
                    placeholder="Type a message…"
                    className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                </div>
              </>
            )}

            {panel === 'notes' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {(['subjective', 'objective', 'assessment', 'plan'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {field}
                    </label>
                    <textarea
                      value={note[field]}
                      onChange={e => setNote(prev => ({ ...prev, [field]: e.target.value }))}
                      rows={3}
                      placeholder={
                        field === 'subjective' ? "Patient's complaint & history…"
                          : field === 'objective' ? 'Vitals, exam findings…'
                            : field === 'assessment' ? 'Diagnosis / impression…'
                              : 'Treatment plan, follow-up…'
                      }
                      className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={savingNote}
                  className="w-full rounded-lg py-2 text-xs font-bold transition-all disabled:opacity-60"
                  style={{ background: '#F97316', color: '#07070A' }}
                >
                  {savingNote ? 'Saving…' : noteSaved ? '✓ Saved' : 'Save Note'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="flex items-center justify-center gap-4 py-4 px-4"
        style={{ background: 'rgba(0,0,0,0.8)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <button
          type="button"
          onClick={() => setMicOn(v => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full transition-all"
          style={{ background: micOn ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.2)', color: micOn ? 'white' : '#EF4444' }}
          title={micOn ? 'Mute' : 'Unmute'}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => setCamOn(v => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full transition-all"
          style={{ background: camOn ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.2)', color: camOn ? 'white' : '#EF4444' }}
          title={camOn ? 'Stop Camera' : 'Start Camera'}
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => setPanel(p => p === 'chat' ? 'none' : 'chat')}
          className="flex h-12 w-12 items-center justify-center rounded-full transition-all"
          style={{ background: panel === 'chat' ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.1)', color: panel === 'chat' ? '#F97316' : 'white' }}
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setPanel(p => p === 'notes' ? 'none' : 'notes')}
          className="flex h-12 w-12 items-center justify-center rounded-full transition-all"
          style={{ background: panel === 'notes' ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.1)', color: panel === 'notes' ? '#F97316' : 'white' }}
          title="SOAP Notes"
        >
          <FileText className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={endCall}
          className="flex h-12 w-12 items-center justify-center rounded-full transition-all"
          style={{ background: '#EF4444', color: 'white' }}
          title="End Call"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
