-- Only needed if supabase/schema.sql was run BEFORE these views were added to it.
-- Creates the cohort-scoped views used by the dashboard, activity logs and learner pages.
CREATE OR REPLACE VIEW public.cohort_learner_month WITH (security_invoker = true) AS
SELECT cm.cohort_id, cm.full_name, lm.*
FROM public.coursera_learner_month lm
JOIN public.cohort_members cm ON cm.email = lm.email;

CREATE OR REPLACE VIEW public.tracked_learner_month WITH (security_invoker = true) AS
SELECT
  (SELECT cm.full_name FROM public.cohort_members cm
    WHERE cm.email = lm.email AND cm.full_name IS NOT NULL
    ORDER BY cm.added_at DESC LIMIT 1) AS full_name,
  lm.*
FROM public.coursera_learner_month lm
WHERE EXISTS (SELECT 1 FROM public.cohort_members cm WHERE cm.email = lm.email);

REVOKE ALL ON public.cohort_learner_month, public.tracked_learner_month FROM anon, authenticated;
GRANT SELECT ON public.cohort_learner_month, public.tracked_learner_month TO service_role;
NOTIFY pgrst, 'reload schema';
