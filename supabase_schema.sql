-- ==========================================
-- 1. Create NG Campuses Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ng_campuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ng_campuses ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow authenticated users to view
DROP POLICY IF EXISTS "Allow authenticated select on campuses" ON public.ng_campuses;
CREATE POLICY "Allow authenticated select on campuses" 
    ON public.ng_campuses 
    FOR SELECT 
    TO authenticated 
    USING (true);


-- ==========================================
-- 2. Create Highest Education Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.highest_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.highest_education ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow authenticated users to view
DROP POLICY IF EXISTS "Allow authenticated select on highest_education" ON public.highest_education;
CREATE POLICY "Allow authenticated select on highest_education" 
    ON public.highest_education 
    FOR SELECT 
    TO authenticated 
    USING (true);


-- ==========================================
-- 3. Create NG Courses Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ng_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ng_courses ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow authenticated users to view
DROP POLICY IF EXISTS "Allow authenticated select on courses" ON public.ng_courses;
CREATE POLICY "Allow authenticated select on courses" 
    ON public.ng_courses 
    FOR SELECT 
    TO authenticated 
    USING (true);



-- ==========================================
-- 4. Seed Initial Data
-- ==========================================

-- Seed Campuses
INSERT INTO public.ng_campuses (name, status)
VALUES 
    ('Bangalore', 'active'),
    ('Dantewada', 'active'),
    ('Dharamshala', 'active'),
    ('Jashpur', 'active'),
    ('Kishanganj', 'active'),
    ('Pune', 'active'),
    ('Raigarh', 'active'),
    ('Amravati', 'closed'),
    ('Delhi', 'closed'),
    ('Raipur', 'closed'),
    ('Udaipur', 'closed')
ON CONFLICT (name) DO UPDATE 
SET status = EXCLUDED.status;

-- Seed Highest Education
INSERT INTO public.highest_education (name)
VALUES 
    ('High School (10th)'),
    ('Intermediate (12th)'),
    ('Diploma'),
    ('Undergraduate (Bachelors)'),
    ('Postgraduate (Masters)'),
    ('PhD / Doctorate'),
    ('Other')
ON CONFLICT (name) DO NOTHING;

-- Seed Courses
INSERT INTO public.ng_courses (name)
VALUES 
    ('School of Programming'),
    ('School of Business'),
    ('School of Finance')
ON CONFLICT (name) DO NOTHING;


-- ==========================================
-- 5. Alumni Data Management Tables
-- ==========================================
-- Run order: helper functions â†’ import_batches â†’ alumni_master
--            â†’ alumni_profile â†’ import_batch_records â†’ audit_log
-- ==========================================


-- ==========================================
-- 5.0 Helper Functions (must be defined first â€” policies reference them)
-- ==========================================

-- Returns TRUE if the calling user is a Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT (
    auth.jwt() ->> 'email' = 'nitin@navgurukul.org'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin'
  )
$$;

-- Returns TRUE if the calling user is a Member (Alumni self-service)
CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'Member'
  )
$$;


-- Exposes PostgreSQL set_config as a secure RPC endpoint for audit session variables
CREATE OR REPLACE FUNCTION public.set_config(parameter text, value text, is_local boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_catalog.set_config(parameter, value, is_local);
END;
$$;



-- ==========================================
-- 5.1 import_batches
-- ==========================================
CREATE TABLE IF NOT EXISTS public.import_batches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name           TEXT NOT NULL,
    file_type           TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx')),
    file_size           BIGINT,
    uploaded_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_by_name    TEXT NOT NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    records_processed   INTEGER NOT NULL DEFAULT 0,
    records_created     INTEGER NOT NULL DEFAULT 0,
    records_updated     INTEGER NOT NULL DEFAULT 0,
    records_failed      INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'processing'
                            CHECK (status IN ('processing', 'completed', 'failed', 'rolled_back')),
    notes               TEXT
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_batches_select_internal" ON public.import_batches;
CREATE POLICY "import_batches_select_internal"
    ON public.import_batches FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin'
    );

DROP POLICY IF EXISTS "import_batches_write_super_admin" ON public.import_batches;
CREATE POLICY "import_batches_write_super_admin"
    ON public.import_batches FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());


-- ==========================================
-- 5.2 alumni_master
-- ==========================================
-- email is the PRIMARY KEY: org-issued, immutable,
-- stable identity anchor across all GHAR imports.
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alumni_master (
    email               TEXT PRIMARY KEY,
    import_batch_id     UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
    name                TEXT,
    phone_number        TEXT,
    gender              TEXT,
    city                TEXT,
    state               TEXT,
    campus              TEXT,
    course              TEXT,
    entry_year          INTEGER,
    technology_stack    TEXT,
    donor               TEXT,
    cycle               TEXT,
    company             TEXT,
    starting_position   TEXT,
    starting_salary     NUMERIC(12, 2),
    month_of_placement  TEXT,
    year_of_placement   INTEGER,
    linkedin_profile    TEXT,
    status              TEXT
                            CHECK (status IN (
                                'Active',
                                'Placed',
                                'DropOut',
                                'Intern (Out Campus)',
                                'Intern (In Campus)',
                                'Completed',
                                'Completed-Opted out for placement',
                                'InActive'
                            )),
    dropout_date        DATE,
    reason              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alumni_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alumni_master_select_all" ON public.alumni_master;
CREATE POLICY "alumni_master_select_all"
    ON public.alumni_master FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "alumni_master_insert_super_admin" ON public.alumni_master;
CREATE POLICY "alumni_master_insert_super_admin"
    ON public.alumni_master FOR INSERT
    TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "alumni_master_update_super_admin" ON public.alumni_master;
CREATE POLICY "alumni_master_update_super_admin"
    ON public.alumni_master FOR UPDATE
    TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "alumni_master_delete_super_admin" ON public.alumni_master;
CREATE POLICY "alumni_master_delete_super_admin"
    ON public.alumni_master FOR DELETE
    TO authenticated USING (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_alumni_master_campus       ON public.alumni_master(campus);
CREATE INDEX IF NOT EXISTS idx_alumni_master_course       ON public.alumni_master(course);
CREATE INDEX IF NOT EXISTS idx_alumni_master_status       ON public.alumni_master(status);
CREATE INDEX IF NOT EXISTS idx_alumni_master_entry_year   ON public.alumni_master(entry_year);
CREATE INDEX IF NOT EXISTS idx_alumni_master_import_batch ON public.alumni_master(import_batch_id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_alumni_master_name_trgm
    ON public.alumni_master USING GIN (name gin_trgm_ops);


-- ==========================================
-- 5.3 alumni_profile
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alumni_profile (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumni_email         TEXT NOT NULL UNIQUE
                             REFERENCES public.alumni_master(email) ON DELETE CASCADE,
    phone_number         TEXT,
    city                 TEXT,
    state                TEXT,
    profile_photo        TEXT,
    highest_education    TEXT,
    batch_year           INTEGER,
    bio                  TEXT,
    skills               TEXT[],
    linkedin_profile     TEXT,
    github_profile       TEXT,
    current_company      TEXT,
    current_position     TEXT,       -- renamed from current_role (reserved word in PostgreSQL)
    current_salary       NUMERIC(12, 2),
    career_progression   JSONB DEFAULT '[]'::jsonb,
    mentoring_interests  TEXT[],
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.alumni_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alumni_profile_select_all" ON public.alumni_profile;
CREATE POLICY "alumni_profile_select_all"
    ON public.alumni_profile FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "alumni_profile_insert_own" ON public.alumni_profile;
CREATE POLICY "alumni_profile_insert_own"
    ON public.alumni_profile FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            public.is_member()
            AND alumni_email = (auth.jwt() ->> 'email')
        )
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS "alumni_profile_update_own_or_admin" ON public.alumni_profile;
CREATE POLICY "alumni_profile_update_own_or_admin"
    ON public.alumni_profile FOR UPDATE
    TO authenticated
    USING (
        (
            public.is_member()
            AND alumni_email = (auth.jwt() ->> 'email')
        )
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS "alumni_profile_delete_super_admin" ON public.alumni_profile;
CREATE POLICY "alumni_profile_delete_super_admin"
    ON public.alumni_profile FOR DELETE
    TO authenticated USING (public.is_super_admin());


-- ==========================================
-- 5.4 import_batch_records
-- ==========================================
CREATE TABLE IF NOT EXISTS public.import_batch_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id  UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    alumni_email     TEXT REFERENCES public.alumni_master(email) ON DELETE SET NULL,
    action           TEXT NOT NULL CHECK (action IN ('created', 'updated', 'skipped', 'failed')),
    status           TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.import_batch_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_batch_records_select_internal" ON public.import_batch_records;
CREATE POLICY "import_batch_records_select_internal"
    ON public.import_batch_records FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin'
    );

DROP POLICY IF EXISTS "import_batch_records_write_super_admin" ON public.import_batch_records;
CREATE POLICY "import_batch_records_write_super_admin"
    ON public.import_batch_records FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_ibr_batch_id     ON public.import_batch_records(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_ibr_alumni_email ON public.import_batch_records(alumni_email);


-- ==========================================
-- 5.5 audit_log
-- ==========================================
-- record_id is TEXT to support both email PKs (alumni_master)
-- and UUID PKs (all other tables). APPEND-ONLY â€” no UPDATE/DELETE policies.
-- ==========================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name           TEXT NOT NULL,
    record_id            TEXT NOT NULL,
    field_name           TEXT NOT NULL,
    old_value            TEXT,
    new_value            TEXT,
    action_type          TEXT NOT NULL
                             CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE', 'IMPORT', 'RESTORE')),
    changed_by_user_id   UUID,
    changed_by_name      TEXT,
    changed_by_role      TEXT,
    changed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address           TEXT
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_internal" ON public.audit_log;
CREATE POLICY "audit_log_select_internal"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin()
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin'
    );

CREATE INDEX IF NOT EXISTS idx_audit_record_id   ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_table_name  ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at  ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id     ON public.audit_log(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON public.audit_log(action_type);


-- ==========================================
-- 5.7 Audit Trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.fn_audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_old        JSONB := to_jsonb(OLD);
    v_new        JSONB := to_jsonb(NEW);
    v_field      TEXT;
    v_action     TEXT;
    v_record_id  TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action    := 'INSERT';
        v_record_id := COALESCE(v_new->>'email', v_new->>'id');
    ELSIF TG_OP = 'UPDATE' THEN
        v_action    := 'UPDATE';
        v_record_id := COALESCE(v_new->>'email', v_new->>'id');
    ELSIF TG_OP = 'DELETE' THEN
        v_action    := 'DELETE';
        v_record_id := COALESCE(v_old->>'email', v_old->>'id');
    END IF;

    IF TG_OP = 'INSERT' THEN
        FOR v_field IN SELECT key FROM jsonb_each(v_new) LOOP
            IF v_new->>v_field IS NOT NULL
               AND v_field NOT IN ('created_at', 'updated_at') THEN
                INSERT INTO public.audit_log
                    (table_name, record_id, field_name, old_value, new_value,
                     action_type, changed_by_user_id, changed_by_name,
                     changed_by_role, changed_at)
                VALUES
                    (TG_TABLE_NAME, v_record_id, v_field, NULL, v_new->>v_field,
                     v_action, auth.uid(),
                     current_setting('app.current_user_name', TRUE),
                     current_setting('app.current_user_role', TRUE), NOW());
            END IF;
        END LOOP;

    ELSIF TG_OP = 'UPDATE' THEN
        FOR v_field IN SELECT key FROM jsonb_each(v_new) LOOP
            IF v_field NOT IN ('created_at', 'updated_at')
               AND (v_old->>v_field IS DISTINCT FROM v_new->>v_field) THEN
                INSERT INTO public.audit_log
                    (table_name, record_id, field_name, old_value, new_value,
                     action_type, changed_by_user_id, changed_by_name,
                     changed_by_role, changed_at)
                VALUES
                    (TG_TABLE_NAME, v_record_id, v_field,
                     v_old->>v_field, v_new->>v_field,
                     v_action, auth.uid(),
                     current_setting('app.current_user_name', TRUE),
                     current_setting('app.current_user_role', TRUE), NOW());
            END IF;
        END LOOP;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_log
            (table_name, record_id, field_name, old_value, new_value,
             action_type, changed_by_user_id, changed_by_name,
             changed_by_role, changed_at)
        VALUES
            (TG_TABLE_NAME, v_record_id, '*', v_old::TEXT, NULL,
             v_action, auth.uid(),
             current_setting('app.current_user_name', TRUE),
             current_setting('app.current_user_role', TRUE), NOW());
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_alumni_master
    AFTER INSERT OR UPDATE OR DELETE ON public.alumni_master
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

CREATE TRIGGER trg_audit_alumni_profile
    AFTER INSERT OR UPDATE OR DELETE ON public.alumni_profile
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();


-- ==========================================
-- 5.8 updated_at Auto-refresh
-- ==========================================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_updated_at_alumni_master
    BEFORE UPDATE ON public.alumni_master
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_updated_at_alumni_profile
    BEFORE UPDATE ON public.alumni_profile
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- ==========================================
-- 5.9 Coursera Integration Tables
-- ==========================================

CREATE TABLE IF NOT EXISTS public.coursera_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    org_id TEXT NOT NULL,
    test_mode BOOLEAN NOT NULL DEFAULT TRUE,
    minimum_monthly_hours NUMERIC NOT NULL DEFAULT 20.0,
    inactive_after_days INTEGER NOT NULL DEFAULT 90,
    snapshot_frequency TEXT DEFAULT 'monthly',
    audit_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allow_global_data_view BOOLEAN NOT NULL DEFAULT TRUE,
    allow_global_activity_logs_view BOOLEAN NOT NULL DEFAULT TRUE,
    total_licenses INTEGER,
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coursera_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coursera_config_super_admin_all" ON public.coursera_config;
CREATE POLICY "coursera_config_super_admin_all"
    ON public.coursera_config FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.coursera_snapshots (
  id bigserial not null,
  snapshot_month date not null,
  email text not null,
  name text null,
  course_id text not null,
  course_name text null,
  course_slug text null,
  university text null,
  course_type text null,
  program_name text null,
  enrollment_time timestamp with time zone null,
  last_activity_time timestamp with time zone null,
  overall_progress numeric not null default 0,
  cumulative_learning_hours numeric not null default 0,
  estimated_course_hours numeric null,
  completed boolean not null default false,
  removed_from_program boolean not null default false,
  completion_time timestamp with time zone null,
  course_grade numeric null,
  certificate_url text null,
  imported_at timestamp with time zone null default now(),
  constraint coursera_snapshots_pkey primary key (id),
  constraint coursera_snapshots_snapshot_month_email_course_id_key unique (snapshot_month, email, course_id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_snap_month on public.coursera_snapshots using btree (snapshot_month) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_snap_email on public.coursera_snapshots using btree (email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_snap_email_course on public.coursera_snapshots using btree (email, course_id) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.coursera_learner_month (
  id bigserial not null,
  month date not null,
  email text not null,
  name text null,
  monthly_hours numeric not null default 0,
  cumulative_hours numeric not null default 0,
  courses_enrolled integer null default 0,
  courses_active integer null default 0,
  courses_completed integer null default 0,
  new_completions integer null default 0,
  avg_progress numeric null default 0,
  is_active boolean null default false,
  is_compliant boolean null default false,
  days_since_activity integer null,
  constraint coursera_learner_month_pkey primary key (id),
  constraint coursera_learner_month_month_email_key unique (month, email)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_lm_month on public.coursera_learner_month using btree (month) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_lm_email on public.coursera_learner_month using btree (email) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.coursera_computed_metrics (
  id bigserial not null,
  month date not null,
  metrics jsonb not null,
  generated_at timestamp with time zone null default now(),
  generated_by text null,
  constraint coursera_computed_metrics_pkey primary key (id),
  constraint coursera_computed_metrics_month_key unique (month)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cm_month on public.coursera_computed_metrics using btree (month) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.coursera_import_log (
    id BIGSERIAL PRIMARY KEY,
    snapshot_month DATE NOT NULL,
    filename TEXT,
    file_size_bytes BIGINT,
    rows_imported INTEGER,
    learners_affected INTEGER,
    action TEXT NOT NULL, -- 'import', 'rollback', 'recalculate'
    status TEXT NOT NULL, -- 'success', 'error'
    error_message TEXT,
    duration_ms BIGINT,
    imported_by TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_il_month ON public.coursera_import_log using btree (snapshot_month) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_il_action ON public.coursera_import_log using btree (action) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_il_status ON public.coursera_import_log using btree (status) TABLESPACE pg_default;

ALTER TABLE public.coursera_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_learner_month DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_computed_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_import_log DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.coursera_activity (
    id TEXT PRIMARY KEY, -- externalId~contentType~contentId
    email TEXT NOT NULL REFERENCES public.alumni_master(email) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    overall_progress NUMERIC NOT NULL DEFAULT 0, -- 0 to 100
    approx_total_hours NUMERIC NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    membership_state TEXT NOT NULL DEFAULT 'MEMBER',
    is_alumni BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coursera_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coursera_activity_select_all" ON public.coursera_activity;
CREATE POLICY "coursera_activity_select_all"
    ON public.coursera_activity FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "coursera_activity_write_super_admin" ON public.coursera_activity;
CREATE POLICY "coursera_activity_write_super_admin"
    ON public.coursera_activity FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_updated_at_coursera_config
    BEFORE UPDATE ON public.coursera_config
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_updated_at_coursera_activity
    BEFORE UPDATE ON public.coursera_activity
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


CREATE TABLE IF NOT EXISTS public.coursera_activity_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_month DATE NOT NULL,
    email TEXT NOT NULL REFERENCES public.alumni_master(email) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    course_name TEXT,
    cumulative_hours NUMERIC NOT NULL DEFAULT 0,
    overall_progress NUMERIC,
    completed BOOLEAN,
    source TEXT CHECK (source IN ('CSV', 'API', 'MANUAL')),
    snapshot_batch UUID,
    is_alumni BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(snapshot_month, email, course_id, snapshot_batch)
);

-- Enable RLS
ALTER TABLE public.coursera_activity_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coursera_activity_snapshot_select_all" ON public.coursera_activity_snapshot;
CREATE POLICY "coursera_activity_snapshot_select_all"
    ON public.coursera_activity_snapshot FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "coursera_activity_snapshot_write_super_admin" ON public.coursera_activity_snapshot;
CREATE POLICY "coursera_activity_snapshot_write_super_admin"
    ON public.coursera_activity_snapshot FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_coursera_activity_snapshot_email ON public.coursera_activity_snapshot(email);
CREATE INDEX IF NOT EXISTS idx_coursera_activity_snapshot_date ON public.coursera_activity_snapshot(recorded_at);
CREATE INDEX IF NOT EXISTS idx_coursera_activity_snapshot_month ON public.coursera_activity_snapshot(snapshot_month);
CREATE INDEX IF NOT EXISTS idx_coursera_activity_snapshot_email_course ON public.coursera_activity_snapshot(email, course_id);
CREATE INDEX IF NOT EXISTS idx_coursera_activity_snapshot_email_course_date ON public.coursera_activity_snapshot(email, course_id, recorded_at);


-- ==========================================
-- 5.10 Coursera Sync Log & Metrics
-- ==========================================

CREATE TABLE IF NOT EXISTS public.coursera_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    records_processed INTEGER NOT NULL DEFAULT 0,
    records_inserted INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    duration_ms BIGINT,
    error_message TEXT
);

ALTER TABLE public.coursera_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coursera_sync_log_all"
    ON public.coursera_sync_log FOR ALL
    TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


CREATE TABLE IF NOT EXISTS public.coursera_metrics (
    id INT PRIMARY KEY DEFAULT 1,
    lifetime_users INT NOT NULL DEFAULT 0,
    active_users INT NOT NULL DEFAULT 0,
    active_alumni INT NOT NULL DEFAULT 0,
    total_learning_hours NUMERIC NOT NULL DEFAULT 0,
    course_completions INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coursera_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coursera_metrics_all"
    ON public.coursera_metrics FOR ALL
    TO authenticated USING (true) WITH CHECK (true);


CREATE TABLE IF NOT EXISTS public.coursera_monthly_metrics (
    id TEXT PRIMARY KEY,
    month_label TEXT NOT NULL,
    total_learning_hours NUMERIC NOT NULL DEFAULT 0,
    lifetime_users INT NOT NULL DEFAULT 0,
    active_users INT NOT NULL DEFAULT 0,
    active_alumni INT NOT NULL DEFAULT 0,
    inactive_users INT NOT NULL DEFAULT 0,
    inactive_alumni INT NOT NULL DEFAULT 0,
    course_completions INT NOT NULL DEFAULT 0,
    avg_learning_hours NUMERIC NOT NULL DEFAULT 0,
    avg_course_completions NUMERIC NOT NULL DEFAULT 0,
    completion_rate NUMERIC NOT NULL DEFAULT 0,
    license_utilization NUMERIC NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coursera_monthly_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coursera_monthly_metrics_all"
    ON public.coursera_monthly_metrics FOR ALL
    TO authenticated USING (true) WITH CHECK (true);


CREATE TABLE IF NOT EXISTS public.coursera_compliance_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    email TEXT NOT NULL,
    hours NUMERIC NOT NULL DEFAULT 0,
    is_compliant BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_alumni BOOLEAN NOT NULL DEFAULT FALSE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(month, email)
);

ALTER TABLE public.coursera_compliance_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coursera_compliance_audit_all"
    ON public.coursera_compliance_audit FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- TEAM AUTO-GROUPING TRIGGER
-- ==============================================================================

-- Function to sync the group_name for all members based on their team's current size
CREATE OR REPLACE FUNCTION public.sync_ng_members_groups()
RETURNS trigger AS $$
BEGIN
  -- Prevent infinite recursion caused by updating the same table
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  WITH team_counts AS (
    SELECT team, count(*) as c
    FROM public.ng_members
    WHERE team IS NOT NULL
    GROUP BY team
  ),
  team_groups AS (
    SELECT team,
           CASE 
             WHEN c > 30 THEN '1'
             WHEN c >= 11 AND c <= 30 THEN '2'
             ELSE '3'
           END as new_group
    FROM team_counts
  )
  UPDATE public.ng_members m
  SET group_name = tg.new_group
  FROM team_groups tg
  WHERE m.team = tg.team AND (m.group_name IS DISTINCT FROM tg.new_group);

  -- For members with no team, set group to null
  UPDATE public.ng_members
  SET group_name = NULL
  WHERE team IS NULL AND group_name IS NOT NULL;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_ng_members_groups ON public.ng_members;

-- Create the statement-level trigger
CREATE TRIGGER trigger_sync_ng_members_groups
AFTER INSERT OR UPDATE OF team OR DELETE ON public.ng_members
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_ng_members_groups();



-- ==========================================
-- Published Reports
-- ==========================================


CREATE TABLE public.published_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    report_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.published_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to published_reports"
ON public.published_reports FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to insert published_reports"
ON public.published_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete published_reports"
ON public.published_reports FOR DELETE TO authenticated USING (true);
