const THINK_BLOCK = /<(?:think|thinking|reason)>[\s\S]*?<\/(?:think|thinking|reason)>/gi;
const FENCE_OPEN = /```(?:json|javascript|js)?\s*/gi;
const FENCE_CLOSE = /```/g;

export type ClinicalConfidence = "high" | "medium" | "low";

export type ClinicalDifferential = {
  condition: string;
  icd11_code: string | null;
  confidence: ClinicalConfidence;
  rationale: string;
  key_features: string;
};

export type ClinicalDemoResult = {
  differentials: ClinicalDifferential[];
  suggested_workup: string[];
  red_flags: string[];
  clinical_note: string;
  ucg_reference: string | null;
  follow_up_questions?: string[];
};

function asConfidence(value: unknown): ClinicalConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (typeof value === "number") {
    if (value >= 0.75) return "high";
    if (value >= 0.4) return "medium";
    return "low";
  }
  const text = String(value ?? "").toLowerCase();
  if (text.includes("high")) return "high";
  if (text.includes("low")) return "low";
  return "medium";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean)
    .slice(0, 8);
}

function stripModelNoise(raw: string): string {
  return raw
    .replace(THINK_BLOCK, "")
    .replace(/<\|(?:think|channel)>\s*[\s\S]*?<\|(?:\/think|\/channel|message)>/gi, "")
    .replace(FENCE_OPEN, "")
    .replace(FENCE_CLOSE, "")
    .trim();
}

export function extractJsonObject(raw: string): Record<string, unknown> {
  const cleaned = stripModelNoise(raw);
  if (!cleaned) throw new Error("empty model response");

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to substring extraction.
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("model response did not contain JSON");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("model JSON was not an object");
  }
  return parsed as Record<string, unknown>;
}

export function normalizeClinicalDemo(data: Record<string, unknown>): ClinicalDemoResult {
  const rawDiffs = Array.isArray(data.differentials)
    ? data.differentials
    : Array.isArray(data.hypotheses)
      ? data.hypotheses
      : [];

  const differentials = rawDiffs
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      condition: String(item.condition ?? item.conditionName ?? "Unspecified").trim() || "Unspecified",
      icd11_code:
        item.icd11_code == null && item.icd11Code == null
          ? null
          : String(item.icd11_code ?? item.icd11Code).trim() || null,
      confidence: asConfidence(item.confidence),
      rationale: String(item.rationale ?? item.aiReasoning ?? "").trim(),
      key_features: String(item.key_features ?? item.keyFeatures ?? "").trim(),
    }))
    .filter((item) => item.condition !== "Unspecified" || item.rationale.length > 0)
    .slice(0, 5);

  if (differentials.length === 0) {
    throw new Error("model JSON omitted differentials");
  }

  const followUps = asStringList(data.follow_up_questions ?? data.followUpQuestions);

  return {
    differentials,
    suggested_workup: asStringList(data.suggested_workup ?? data.suggestedWorkup),
    red_flags: asStringList(data.red_flags ?? data.redFlags),
    clinical_note: String(data.clinical_note ?? data.clinicalNote ?? "").trim(),
    ucg_reference:
      data.ucg_reference == null && data.ucgReference == null
        ? null
        : String(data.ucg_reference ?? data.ucgReference).trim() || null,
    ...(followUps.length ? { follow_up_questions: followUps } : {}),
  };
}

export function parseClinicalDemoResponse(raw: string): ClinicalDemoResult {
  return normalizeClinicalDemo(extractJsonObject(raw));
}
