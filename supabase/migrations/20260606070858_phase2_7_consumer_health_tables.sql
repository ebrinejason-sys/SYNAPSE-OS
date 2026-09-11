-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260606070858  name: phase2_7_consumer_health_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Phase 7: Consumer Health App tables

CREATE TABLE IF NOT EXISTS menstrual_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_start DATE NOT NULL,
  cycle_end DATE,
  period_start DATE NOT NULL,
  period_end DATE,
  flow_intensity TEXT CHECK (flow_intensity IN ('spotting','light','medium','heavy')),
  symptoms TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diet_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meal_type TEXT CHECK (meal_type IN ('breakfast','lunch','dinner','snack','drink')),
  food_name TEXT NOT NULL,
  portion_description TEXT,
  estimated_calories INTEGER,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  image_url TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('exercise','sleep','hydration','meditation','medication','custom')),
  frequency TEXT DEFAULT 'daily',
  target_value NUMERIC,
  target_unit TEXT,
  streak_days INTEGER DEFAULT 0,
  last_logged_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES health_habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  value NUMERIC,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_health_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for all new tables
ALTER TABLE menstrual_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_health_chats ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY user_own_cycles ON menstrual_cycles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY user_own_diet ON diet_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY user_own_habits ON health_habits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY user_own_habit_logs ON habit_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY user_own_chats ON ai_health_chats FOR ALL USING (auth.uid() = user_id);
