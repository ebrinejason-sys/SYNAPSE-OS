import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email"

// GET - List all inquiries (admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { data: inquiries, error } = await (supabaseAdmin as any)
      .from("pharmacy_inquiries")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(inquiries)
  } catch (error) {
    console.error("Error fetching inquiries:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create new inquiry (session optional — supports unauthenticated password-reset requests)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, userName, type, subject, message } = body

    if (!userEmail || !userName || !type || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Attempt to get session — it may be null for public/unauthenticated requests
    const session = await getPharmacySession()

    const { data: inquiry, error } = await supabaseAdmin
      .from("pharmacy_inquiries")
      .insert({
        tenant_id: session?.profile.tenant_id ?? null,
        profile_id: session?.user.id ?? null,
        user_email: userEmail,
        user_name: userName,
        type,
        subject,
        message,
        status: "PENDING",
      })
      .select()
      .single()

    if (error) throw error

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || "ebrinetushabe@gmail.com"

    const typeLabels: Record<string, string> = {
      FEATURE_REQUEST: "Feature Request",
      PASSWORD_RESET: "Password Reset Request",
      ACCESS_REQUEST: "Access Request",
      DELETE_REQUEST: "Delete Request",
      OTHER: "General Inquiry",
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
          .info-box { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .badge-yellow { background-color: #FEF3C7; color: #92400E; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New User Inquiry</h1>
          </div>
          <div class="content">
            <p><span class="badge badge-yellow">${typeLabels[type] ?? type}</span></p>

            <div class="info-box">
              <p><strong>From:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <h3>Message:</h3>
            <div style="background-color: white; padding: 15px; border-radius: 5px;">
              <p>${message}</p>
            </div>

            <p style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/portal/inquiries"
                 style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
                View in Dashboard
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} SYNAPSE Pharm. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    await sendEmail({
      to: adminEmail,
      subject: `[SYNAPSE Pharm] ${typeLabels[type] ?? type}: ${subject}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true, inquiry })
  } catch (error) {
    console.error("Error creating inquiry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update inquiry status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const body = await request.json()
    const { id, status, adminResponse } = body

    if (!id) {
      return NextResponse.json({ error: "Inquiry ID required" }, { status: 400 })
    }

    const updateData: {
      status?: string
      admin_response?: string
      responded_at?: string
    } = {}

    if (status) updateData.status = status
    if (adminResponse !== undefined) updateData.admin_response = adminResponse
    if (status === "RESOLVED") updateData.responded_at = new Date().toISOString()

    const { data: inquiry, error } = await supabaseAdmin
      .from("pharmacy_inquiries")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    // If resolved, send email to user
    if (status === "RESOLVED" && adminResponse) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
            .response-box { background-color: white; padding: 15px; border-left: 4px solid #10B981; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Inquiry Has Been Resolved</h1>
            </div>
            <div class="content">
              <h2>Hello ${inquiry.user_name},</h2>
              <p>Your inquiry regarding "<strong>${inquiry.subject}</strong>" has been reviewed and resolved.</p>

              <div class="response-box">
                <h3 style="margin-top: 0; color: #10B981;">Admin Response:</h3>
                <p>${adminResponse}</p>
              </div>

              <p>If you have any further questions, please don't hesitate to reach out.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} SYNAPSE Pharm. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `

      await sendEmail({
        to: inquiry.user_email,
        subject: `Re: ${inquiry.subject} - Resolved`,
        html: emailHtml,
      })
    }

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_INQUIRY",
      entity: "INQUIRY",
      entity_id: id,
      details: `Updated inquiry status to ${status}`,
    })

    return NextResponse.json(inquiry)
  } catch (error) {
    console.error("Error updating inquiry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
