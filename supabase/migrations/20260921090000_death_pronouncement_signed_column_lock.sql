-- Tighten signed pronouncement immutability.
-- Next-of-kin and document FK updates must not reopen identity or pronouncement facts.

CREATE OR REPLACE FUNCTION public.death_pronouncements_protect_signed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('pronounced', 'certified', 'amended') THEN
      RAISE EXCEPTION 'PRONOUNCEMENT_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status NOT IN ('pronounced', 'certified', 'amended') THEN
    RETURN NEW;
  END IF;

  -- Identity and pronouncement facts stay locked after the first signed write.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.facility_id IS DISTINCT FROM OLD.facility_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.person_id IS DISTINCT FROM OLD.person_id
     OR NEW.encounter_id IS DISTINCT FROM OLD.encounter_id
     OR NEW.pronounced_by IS DISTINCT FROM OLD.pronounced_by
     OR NEW.pronounced_at IS DISTINCT FROM OLD.pronounced_at
     OR NEW.is_synthetic IS DISTINCT FROM OLD.is_synthetic
     OR NEW.death_date_time IS DISTINCT FROM OLD.death_date_time
     OR NEW.death_time_precision IS DISTINCT FROM OLD.death_time_precision
     OR NEW.death_time_text IS DISTINCT FROM OLD.death_time_text
     OR NEW.location_type IS DISTINCT FROM OLD.location_type
     OR NEW.ward_id IS DISTINCT FROM OLD.ward_id
     OR NEW.bed_id IS DISTINCT FROM OLD.bed_id
     OR NEW.location_text IS DISTINCT FROM OLD.location_text
     OR NEW.resuscitation_attempted IS DISTINCT FROM OLD.resuscitation_attempted
     OR NEW.resuscitation_started_at IS DISTINCT FROM OLD.resuscitation_started_at
     OR NEW.resuscitation_stopped_at IS DISTINCT FROM OLD.resuscitation_stopped_at
     OR NEW.dnr_status IS DISTINCT FROM OLD.dnr_status
     OR NEW.circumstances IS DISTINCT FROM OLD.circumstances
     OR NEW.provisional_cause IS DISTINCT FROM OLD.provisional_cause
     OR NEW.external_cause_suspected IS DISTINCT FROM OLD.external_cause_suspected
     OR NEW.traumatic_death IS DISTINCT FROM OLD.traumatic_death
     OR NEW.suspicious_death IS DISTINCT FROM OLD.suspicious_death
     OR NEW.findings IS DISTINCT FROM OLD.findings THEN
    RAISE EXCEPTION 'PRONOUNCEMENT_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  -- Same-status follow-ups: next-of-kin, document links, audit, timestamps only.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.cause_of_death IS DISTINCT FROM OLD.cause_of_death
       OR NEW.contributing_conditions IS DISTINCT FROM OLD.contributing_conditions
       OR NEW.medicolegal_flags IS DISTINCT FROM OLD.medicolegal_flags
       OR NEW.certified_at IS DISTINCT FROM OLD.certified_at
       OR NEW.certified_by IS DISTINCT FROM OLD.certified_by THEN
      RAISE EXCEPTION 'PRONOUNCEMENT_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Certification may write cause/certifier while keeping pronouncement facts frozen.
  IF NEW.status = 'certified' AND OLD.status IN ('pronounced', 'amended') THEN
    RETURN NEW;
  END IF;

  -- Amendment is a status marker only; clinical facts stay frozen.
  IF NEW.status = 'amended' AND OLD.status IN ('pronounced', 'certified') THEN
    IF NEW.cause_of_death IS DISTINCT FROM OLD.cause_of_death
       OR NEW.contributing_conditions IS DISTINCT FROM OLD.contributing_conditions
       OR NEW.medicolegal_flags IS DISTINCT FROM OLD.medicolegal_flags
       OR NEW.certified_at IS DISTINCT FROM OLD.certified_at
       OR NEW.certified_by IS DISTINCT FROM OLD.certified_by THEN
      RAISE EXCEPTION 'PRONOUNCEMENT_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PRONOUNCEMENT_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.death_pronouncements_protect_signed() IS
  'After pronounced/certified/amended, identity and pronouncement facts cannot change. Next-of-kin and document FK updates cannot rewrite those columns.';
