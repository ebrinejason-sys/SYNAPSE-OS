import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type FeedbackBody = {
  category: string;
  message: string;
  email?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FeedbackBody;
    const { category, message, email } = body;

    if (!category || !message?.trim()) {
      return NextResponse.json({ error: "Category and message are required" }, { status: 400 });
    }

    // In a real implementation, this would:
    // 1. Store in a feedback table (separate from production data)
    // 2. Send to a monitoring system (e.g., GitHub Issues, Slack, email)
    // 3. Not expose any internal credentials

    console.log("[demo/feedback] Received:", {
      category,
      messageLength: message.length,
      hasEmail: Boolean(email),
      timestamp: new Date().toISOString(),
    });

    // For now, just log and acknowledge
    // TODO: Integrate with actual feedback collection system

    return NextResponse.json({ ok: true, message: "Feedback received" });
  } catch (error) {
    console.error("[demo/feedback] Error:", error);
    return NextResponse.json({ error: "Failed to process feedback" }, { status: 500 });
  }
}