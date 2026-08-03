import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@synapse/db/types";
import {
  DEFAULT_SIGNATURE_SRC,
  DEFAULT_SIGNER_NAME,
  DEFAULT_SIGNER_TITLE,
} from "./document-branding";

export {
  DEFAULT_SIGNATURE_SRC,
  DEFAULT_SIGNER_NAME,
  DEFAULT_SIGNER_TITLE,
} from "./document-branding";

export type PlatformDocumentSettings = {
  id: string;
  signatureDataUrl: string | null;
  /** Resolved URL/path to show on documents (data URL or public asset). */
  signatureSrc: string;
  signerName: string;
  signerTitle: string;
  updatedAt: string | null;
};

function serviceDb() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any;
}

export async function getDocumentSettings(): Promise<PlatformDocumentSettings> {
  try {
    const db = serviceDb();
    const { data, error } = await db
      .from("platform_document_settings")
      .select("id, signature_data_url, signer_name, signer_title, updated_at")
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) {
      return {
        id: "default",
        signatureDataUrl: null,
        signatureSrc: DEFAULT_SIGNATURE_SRC,
        signerName: DEFAULT_SIGNER_NAME,
        signerTitle: DEFAULT_SIGNER_TITLE,
        updatedAt: null,
      };
    }

    const signatureDataUrl = (data.signature_data_url as string | null) ?? null;
    return {
      id: data.id ?? "default",
      signatureDataUrl,
      signatureSrc: signatureDataUrl || DEFAULT_SIGNATURE_SRC,
      signerName: (data.signer_name as string | null)?.trim() || DEFAULT_SIGNER_NAME,
      signerTitle: (data.signer_title as string | null)?.trim() || DEFAULT_SIGNER_TITLE,
      updatedAt: data.updated_at ?? null,
    };
  } catch {
    return {
      id: "default",
      signatureDataUrl: null,
      signatureSrc: DEFAULT_SIGNATURE_SRC,
      signerName: DEFAULT_SIGNER_NAME,
      signerTitle: DEFAULT_SIGNER_TITLE,
      updatedAt: null,
    };
  }
}
