import { Suspense } from 'react'
import type { Metadata } from 'next'
import BookMeetingForm from './BookMeetingForm'

export const metadata: Metadata = {
  title: 'Book a Meeting · SYNAPSE',
  description: 'Request a meeting with the SYNAPSE team for enterprise and custom healthcare deployments.',
  alternates: { canonical: 'https://synapseos.tech/book-meeting' },
}

export default function BookMeetingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#07070A] p-10 text-slate-400">Loading…</main>}>
      <BookMeetingForm />
    </Suspense>
  )
}
