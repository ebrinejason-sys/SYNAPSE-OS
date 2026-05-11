export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole =
  | "platform_admin"
  | "facility_admin"
  | "doctor"
  | "nurse"
  | "lab_tech"
  | "lab_supervisor"
  | "pharmacist"
  | "radiologist"
  | "receptionist"
  | "patient"
  | "chw"
  | "independent_doctor";

export type AcuityLevel = "IMMEDIATE" | "URGENT" | "ROUTINE" | "EXPECTANT";
export type EncounterStatus = "open" | "signed" | "cancelled";
export type LabOrderUrgency = "STAT" | "URGENT" | "ROUTINE";
export type LabResultStatus = "preliminary" | "final" | "corrected" | "cancelled";
export type PharmacyOrderStatus = "pending" | "dispensing" | "dispensed" | "cancelled";
export type ReferralStatus = "pending" | "accepted" | "rejected" | "completed";
export type AlertLevel = "INFO" | "WATCH" | "WARNING" | "EMERGENCY";
export type ScoreSeverity = "low" | "moderate" | "high" | "critical" | "normal";

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          custom_domain: string | null;
          country: string;
          region: string | null;
          district: string | null;
          facility_type: string;
          bed_capacity: number | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          logo_url: string | null;
          plan: "trial" | "starter" | "professional" | "enterprise";
          is_active: boolean;
          onboarding_completed: boolean;
          onboarding_step: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tenants"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: UserRole;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          speciality: string | null;
          department_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      patients: {
        Row: {
          id: string;
          tenant_id: string;
          mrn: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          sex: "M" | "F" | "I";
          phone: string | null;
          email: string | null;
          address: string | null;
          district: string | null;
          nin: string | null;
          blood_group: string | null;
          allergies: string[];
          comorbidities: string[];
          insurance_provider_id: string | null;
          insurance_number: string | null;
          linked_app_user_id: string | null;
          expo_push_token: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: Omit<Database["public"]["Tables"]["patients"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
      };
      encounters: {
        Row: {
          id: string;
          tenant_id: string;
          patient_id: string;
          department_id: string | null;
          encounter_type: "OPD" | "IPD" | "EMERGENCY" | "TELE" | "ANC" | "PROCEDURE";
          status: EncounterStatus;
          acuity: AcuityLevel | null;
          chief_complaint: string | null;
          history_of_presenting_illness: string | null;
          examination_findings: string | null;
          assessment: string | null;
          plan: string | null;
          soap_note: string | null;
          discharge_instructions: string | null;
          temp: number | null;
          bp_systolic: number | null;
          bp_diastolic: number | null;
          heart_rate: number | null;
          respiratory_rate: number | null;
          spo2: number | null;
          weight_kg: number | null;
          height_cm: number | null;
          bmi: number | null;
          doctor_id: string | null;
          nurse_id: string | null;
          is_signed: boolean;
          signed_at: string | null;
          insurance_claim_id: string | null;
          tele_session_id: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: Omit<Database["public"]["Tables"]["encounters"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["encounters"]["Insert"]>;
      };
      encounter_diagnoses: {
        Row: {
          id: string;
          tenant_id: string;
          encounter_id: string;
          icd11_code: string;
          diagnosis_text: string;
          certainty: "confirmed" | "provisional" | "differential";
          is_primary: boolean;
          ai_suggested: boolean;
          ai_confidence: number | null;
          override_reason: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["encounter_diagnoses"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["encounter_diagnoses"]["Insert"]>;
      };
      lab_orders: {
        Row: {
          id: string;
          tenant_id: string;
          encounter_id: string;
          patient_id: string;
          loinc_code: string | null;
          test_name: string;
          urgency: LabOrderUrgency;
          status: "ordered" | "collected" | "processing" | "resulted" | "verified" | "cancelled";
          ordered_by: string;
          ordered_at: string;
          collected_at: string | null;
          resulted_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          insurance_covered: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["lab_orders"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["lab_orders"]["Insert"]>;
      };
      lab_results: {
        Row: {
          id: string;
          tenant_id: string;
          lab_order_id: string;
          patient_id: string;
          loinc_code: string | null;
          test_name: string;
          result_value: string;
          unit: string | null;
          reference_range: string | null;
          status: LabResultStatus;
          is_critical: boolean;
          is_abnormal: boolean;
          ai_interpretation: string | null;
          ai_model_used: string | null;
          instrument_bridge_id: string | null;
          released_to_patient_at: string | null;
          created_at: string;
          version: number;
        };
        Insert: Omit<Database["public"]["Tables"]["lab_results"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["lab_results"]["Insert"]>;
      };
      score_definitions: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          category: string;
          version: string | null;
          parameters: Json;
          calculation_logic: string | null;
          interpretation_ranges: Json | null;
          reference_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["score_definitions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["score_definitions"]["Insert"]>;
      };
      score_calculations: {
        Row: {
          id: string;
          tenant_id: string;
          patient_id: string;
          encounter_id: string | null;
          score_definition_code: string;
          calculated_by: string;
          parameters_input: Json;
          calculated_value: number | null;
          calculated_at: string;
          ai_interpretation: string | null;
          ai_confidence: number | null;
          ai_model_used: string | null;
          ai_guideline_citation: string | null;
          final_interpretation: string | null;
          final_severity: ScoreSeverity | null;
          overridden_by: string | null;
          override_reason: string | null;
          overridden_at: string | null;
          is_self_assessment: boolean;
          shared_with_provider: boolean;
          created_at: string;
          version: number;
        };
        Insert: Omit<Database["public"]["Tables"]["score_calculations"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["score_calculations"]["Insert"]>;
      };
      audit_events: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          patient_id: string | null;
          encounter_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          old_value: Json | null;
          new_value: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_events"]["Row"], "id" | "created_at">;
        Update: never;
      };
      outbreak_alerts: {
        Row: {
          id: string;
          created_by_tenant_id: string;
          icd11_code: string;
          disease_name: string;
          alert_level: AlertLevel;
          affected_districts: string[];
          description: string;
          recommendations: string;
          is_active: boolean;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["outbreak_alerts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["outbreak_alerts"]["Insert"]>;
      };
      facility_referrals: {
        Row: {
          id: string;
          from_tenant_id: string;
          to_tenant_id: string;
          patient_id: string;
          encounter_id: string;
          status: ReferralStatus;
          speciality: string;
          urgency: "IMMEDIATE" | "URGENT" | "ROUTINE";
          clinical_summary: string;
          fhir_bundle: Json | null;
          consent_obtained: boolean;
          consent_method: "screen" | "sms_otp" | null;
          accepted_by: string | null;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["facility_referrals"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["facility_referrals"]["Insert"]>;
      };
    };
  };
}

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type Encounter = Database["public"]["Tables"]["encounters"]["Row"];
export type EncounterDiagnosis = Database["public"]["Tables"]["encounter_diagnoses"]["Row"];
export type LabOrder = Database["public"]["Tables"]["lab_orders"]["Row"];
export type LabResult = Database["public"]["Tables"]["lab_results"]["Row"];
export type ScoreDefinition = Database["public"]["Tables"]["score_definitions"]["Row"];
export type ScoreCalculation = Database["public"]["Tables"]["score_calculations"]["Row"];
export type AuditEvent = Database["public"]["Tables"]["audit_events"]["Row"];
export type OutbreakAlert = Database["public"]["Tables"]["outbreak_alerts"]["Row"];
export type FacilityReferral = Database["public"]["Tables"]["facility_referrals"]["Row"];
