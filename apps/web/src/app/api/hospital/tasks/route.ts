import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { rowToDepartmentTask } from '@synapse/db/work-queue-persist'
import { WorkQueue, type TaskStatus } from '@synapse/db/work-queue'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const department = req.nextUrl.searchParams.get('department')
  const cap = department === 'pharmacy'
    ? await requireHospitalCapability(ctx, 'prescription', 'read', 'opd')
    : await requireHospitalCapability(ctx, 'queue', 'read', 'opd')
  if (cap) return cap

  const encounterId = req.nextUrl.searchParams.get('encounter_id')
  const status = req.nextUrl.searchParams.get('status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db
    .from('department_tasks')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (department) query = query.eq('owner_department', department)
  if (encounterId) query = query.eq('encounter_id', encounterId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tasks = (data ?? []).map((row: Record<string, unknown>) => rowToDepartmentTask(row))

  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'queue', 'write', 'opd')
  if (cap) return cap

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const taskId = typeof body?.taskId === 'string' ? body.taskId : ''
  const status = typeof body?.status === 'string' ? body.status as TaskStatus : null
  if (!taskId || !status) {
    return NextResponse.json({ error: 'taskId and status are required' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data: row, error: loadError } = await db
    .from('department_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const task = rowToDepartmentTask(row)
  const queue = new WorkQueue()
  queue.tasks.set(task.id, task)
  const transition = queue.transition(task.id, status, {
    actorId: ctx.userId,
    assignedTo: ctx.userId,
    resultSummary: typeof body?.resultSummary === 'string' ? body.resultSummary : undefined,
  })
  if (!transition.ok) return NextResponse.json({ error: transition.error }, { status: 409 })

  const updated = transition.task
  const { error: updateError } = await db
    .from('department_tasks')
    .update({
      status: updated.status,
      assigned_to: updated.assignedTo,
      accepted_at: updated.acceptedAt,
      completed_at: updated.completedAt,
      cancelled_at: updated.cancelledAt,
      result_summary: updated.resultSummary,
      updated_at: updated.updatedAt,
    })
    .eq('id', task.id)
    .eq('tenant_id', ctx.tenantId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ task: updated })
}
