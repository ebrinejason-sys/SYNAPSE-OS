/**
 * A repeated `release` on an order that was already RELEASED must be a no-op
 * for patient-facing side effects. Reports, domain events and review tasks are
 * already de-duplicated by lookup/idempotency keys, but the patient timeline
 * insert is not, so a retry used to write a second "Lab result released" event.
 */
export function isRepeatLabRelease(priorOrderStatus: string | null | undefined): boolean {
  return String(priorOrderStatus ?? '').toUpperCase() === 'RELEASED'
}
