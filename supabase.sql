-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.answers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  result_id uuid,
  question_id uuid,
  user_answer_text text,
  selected_option_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  time_spent_seconds integer,
  attempt_id uuid,
  CONSTRAINT answers_pkey PRIMARY KEY (id),
  CONSTRAINT answers_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.results(id),
  CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.question_options(id),
  CONSTRAINT answers_question_fk FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT answers_result_fk FOREIGN KEY (result_id) REFERENCES public.results(id),
  CONSTRAINT answers_option_fk FOREIGN KEY (selected_option_id) REFERENCES public.question_options(id),
  CONSTRAINT answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.assessment_attempts(id)
);
CREATE TABLE public.assessment_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'not_started'::text,
  answered_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL,
  progress_percent numeric NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  submitted_at timestamp with time zone,
  completed_at timestamp with time zone,
  last_activity_at timestamp with time zone DEFAULT now(),
  duration_seconds integer,
  ai_status text DEFAULT 'pending'::text,
  ai_summary jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  cheating_count integer DEFAULT 0,
  cheating_events jsonb,
  question_timings jsonb,
  average_seconds_per_question numeric,
  last_ai_error text,
  CONSTRAINT assessment_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_attempts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT assessment_attempts_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id)
);
CREATE TABLE public.assessments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  hr_id uuid,
  target_role text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  duration integer,
  CONSTRAINT assessments_pkey PRIMARY KEY (id),
  CONSTRAINT assessments_hr_id_fkey FOREIGN KEY (hr_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.landing_page (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  hero_title text NOT NULL,
  hero_subtitle text,
  hero_image text,
  call_to_action_text text,
  candidate_name text,
  candidate_description text,
  candidate_fit_score text,
  candidate_image text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT landing_page_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text UNIQUE,
  name text,
  role text NOT NULL DEFAULT 'candidate'::text,
  created_at timestamp with time zone DEFAULT now(),
  band text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.question_options (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  question_id uuid,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_options_pkey PRIMARY KEY (id),
  CONSTRAINT question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  text text NOT NULL,
  format text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  required boolean DEFAULT false,
  assessment_id uuid,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id)
);
CREATE TABLE public.results (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid,
  assessment_id uuid,
  completed_at timestamp with time zone DEFAULT now(),
  overall_score numeric,
  skill_scores jsonb,
  strengths jsonb,
  weaknesses jsonb,
  recommended_roles jsonb,
  summary text,
  development_suggestions jsonb,
  ai_summary jsonb,
  analysis_model text,
  analysis_version text,
  analysis_completed_at timestamp with time zone,
  personality_traits jsonb,
  role_fit jsonb,
  time_analysis jsonb,
  cheating_summary jsonb,
  insight_locale text,
  insight_version text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT results_pkey PRIMARY KEY (id),
  CONSTRAINT results_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT results_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);