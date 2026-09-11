-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260503191458  name: create_demo_auth_user
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


DO $$
DECLARE
  demo_uid uuid;
BEGIN
  -- Only create if not already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@synapseos.tech') THEN
    demo_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      demo_uid,
      'authenticated', 'authenticated',
      'demo@synapseos.tech',
      crypt('Demo4321', gen_salt('bf')),
      NOW(), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Dr. Demo User"}',
      NOW(), NOW(),
      '', '', '', ''
    );

    -- Link identity so password login works
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      demo_uid,
      jsonb_build_object('sub', demo_uid::text, 'email', 'demo@synapseos.tech'),
      'email',
      'demo@synapseos.tech',
      NOW(), NOW(), NOW()
    );

    -- Insert demo profile
    INSERT INTO demo.profiles (id, full_name, role, is_demo)
    VALUES (demo_uid, 'Dr. Demo User', 'doctor', true)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Demo user created: %', demo_uid;
  ELSE
    -- User exists — ensure demo.profiles row exists
    SELECT id INTO demo_uid FROM auth.users WHERE email = 'demo@synapseos.tech';
    INSERT INTO demo.profiles (id, full_name, role, is_demo)
    VALUES (demo_uid, 'Dr. Demo User', 'doctor', true)
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Demo user already exists: %', demo_uid;
  END IF;
END $$;
