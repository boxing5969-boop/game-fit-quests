
-- Add new enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'revision_requested';

-- Add code column to branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code text UNIQUE;

-- Create level_status_type enum
DO $$ BEGIN
  CREATE TYPE public.level_status_type AS ENUM (
    'locked', 'in_progress', 'pending', 'approved', 
    'revision_requested', 'rejected', 'boss_cleared'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create level_status table
CREATE TABLE IF NOT EXISTS public.level_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rank_name public.rank_name NOT NULL,
  level_number integer NOT NULL CHECK (level_number BETWEEN 1 AND 10),
  status public.level_status_type NOT NULL DEFAULT 'locked',
  completed_at timestamptz,
  approved_by uuid,
  approval_note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, rank_name, level_number)
);
ALTER TABLE public.level_status ENABLE ROW LEVEL SECURITY;

-- Create manager_notes table
CREATE TABLE IF NOT EXISTS public.manager_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  note_type text NOT NULL DEFAULT 'internal' CHECK (note_type IN ('internal', 'visible')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manager_notes ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
