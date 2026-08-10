import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/** Pharmacy settings incl. receipt identity (TIN, NDA licence, supervising pharmacist). */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { data: s } = await db()
    .from('pharmacy_settings')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  return NextResponse.json({
    settings: {
      pharmacyName: s?.pharmacy_name ?? '',
      legalName: s?.legal_name ?? '',
      tradingName: s?.trading_name ?? '',
      location: s?.location ?? '',
      contact: s?.contact ?? '',
      email: s?.email ?? '',
      logoUrl: s?.logo_url ?? s?.logo ?? null,
      tin: s?.tin ?? '',
      ndaLicenseNumber: s?.nda_license_number ?? '',
      supervisingPharmacist: s?.supervising_pharmacist ?? '',
      pharmacistRegNumber: s?.pharmacist_registration_number ?? '',
      branchName: s?.branch_name ?? '',
      receiptHeader: s?.receipt_header ?? '',
      receiptFooter: s?.receipt_footer ?? s?.footer_text ?? '',
      currency: s?.currency ?? 'UGX',
      taxRate: Number(s?.tax_rate ?? 0),
      vatEnabled: Boolean(s?.vat_enabled),
      vatRate: Number(s?.vat_rate ?? 18),
      lowStockThreshold: Number(s?.low_stock_threshold ?? 10),
      discountApprovalThresholdPct: Number(s?.discount_approval_threshold_pct ?? 5),
      mandatoryReceiptPrint: s?.mandatory_receipt_print !== false,
      printerType: s?.printer_type ?? 'default',
      receiptPaperWidth: (() => {
        const paper = String(s?.receipt_paper_width ?? '').toLowerCase()
        if (paper === '58' || paper === '80' || paper === 'a4') return paper
        return String(s?.printer_type ?? '').includes('58') ? '58' : '80'
      })(),
      receiptFontScale: Number(s?.receipt_font_scale ?? 1) || 1,
      autoPrintReceipt: Boolean(s?.auto_print_receipt),
    },
    canEdit: isMobilePharmacyAdmin(auth),
  })
}

/** Save settings. Admin-only. Core columns always saved; receipt-identity columns saved
 *  additively (guarded) so this works before/after the identity migration is applied. */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!isMobilePharmacyAdmin(auth)) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
  }

  const d = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const core = {
    tenant_id: auth.tenantId,
    pharmacy_name: d.pharmacyName ?? null,
    location: d.location ?? null,
    contact: d.contact ?? null,
    email: d.email ?? null,
    receipt_header: d.receiptHeader ?? null,
    receipt_footer: d.receiptFooter ?? null,
    footer_text: d.receiptFooter ?? null,
    currency: d.currency ?? 'UGX',
    tax_rate: d.taxRate ?? 0,
    low_stock_threshold: d.lowStockThreshold ?? 10,
    printer_type: d.printerType ?? 'default',
  }

  const { error } = await db().from('pharmacy_settings').upsert(core, { onConflict: 'tenant_id' })
  if (error) {
    console.error('[mobile/pharmacy/settings]', error.message)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  // Receipt-identity + policy columns (present after the identity migration).
  try {
    await db()
      .from('pharmacy_settings')
      .update({
        legal_name: d.legalName ?? null,
        trading_name: d.tradingName ?? null,
        logo_url: d.logoUrl ?? null,
        tin: d.tin ?? null,
        nda_license_number: d.ndaLicenseNumber ?? null,
        supervising_pharmacist: d.supervisingPharmacist ?? null,
        pharmacist_registration_number: d.pharmacistRegNumber ?? null,
        branch_name: d.branchName ?? null,
        vat_enabled: Boolean(d.vatEnabled),
        vat_rate: d.vatRate ?? 18,
        discount_approval_threshold_pct: d.discountApprovalThresholdPct ?? 5,
        mandatory_receipt_print: d.mandatoryReceiptPrint !== false,
        receipt_paper_width: (() => {
          const paper = String(d.receiptPaperWidth ?? '80').toLowerCase()
          return paper === '58' || paper === 'a4' ? paper : '80'
        })(),
        receipt_font_scale: Number(d.receiptFontScale ?? 1) || 1,
        auto_print_receipt: Boolean(d.autoPrintReceipt),
      })
      .eq('tenant_id', auth.tenantId)
  } catch {
    // Columns not present yet — core settings still saved.
  }

  try {
    await db().from('pharmacy_audit_logs').insert({
      tenant_id: auth.tenantId,
      profile_id: auth.userId,
      action: 'UPDATE_SETTINGS',
      entity: 'pharmacy_settings',
      details: { source: 'mobile' },
    })
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true })
}
