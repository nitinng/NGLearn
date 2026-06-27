// ============================================================
// Alumni Types
// ============================================================

export type AlumniStatus =
  | 'Active'
  | 'Placed'
  | 'DropOut'
  | 'Intern (Out Campus)'
  | 'Intern (In Campus)'
  | 'Completed'
  | 'Completed-Opted out for placement'
  | 'InActive';

/**
 * Mirrors the `alumni_master` table.
 * email is the PRIMARY KEY — org-issued and immutable.
 */
export interface AlumniMaster {
  email: string;
  import_batch_id: string | null;
  name: string | null;
  phone_number: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  campus: string | null;
  course: string | null;
  entry_year: number | null;
  technology_stack: string | null;
  donor: string | null;
  cycle: string | null;
  company: string | null;
  starting_position: string | null;
  starting_salary: number | null;
  month_of_placement: string | null;
  year_of_placement: number | null;
  linkedin_profile: string | null;
  status: AlumniStatus | null;
  dropout_date: string | null;   // ISO date string
  reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mirrors the `alumni_profile` table.
 * alumni_email FK → alumni_master(email)
 */
export interface AlumniProfile {
  id: string;
  alumni_email: string;          // FK → alumni_master(email)
  phone_number: string | null;
  city: string | null;
  state: string | null;
  profile_photo: string | null;  // Supabase Storage URL
  highest_education: string | null;
  batch_year: number | null;
  bio: string | null;
  skills: string[];
  linkedin_profile: string | null;
  github_profile: string | null;
  current_company: string | null;
  current_position: string | null;   // column named current_position in DB (current_role is a reserved word)
  current_salary: number | null;
  career_progression: CareerEntry[];
  mentoring_interests: string[];
  created_at: string;
  updated_at: string;
  updated_by: string | null;     // auth.users UUID
}

export interface CareerEntry {
  company: string;
  role: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

/**
 * Fields that a Member (Alumni) can override from their profile.
 * Profile value takes priority over master value when set.
 */
export const OVERRIDABLE_FIELDS = [
  'phone_number',
  'city',
  'state',
  'linkedin_profile',
] as const;

export type OverridableField = typeof OVERRIDABLE_FIELDS[number];

/**
 * Merged view of alumni_master + alumni_profile.
 * Profile values take precedence over master values for overridable fields.
 * _sources tracks where each field value came from for UI attribution badges.
 */
export interface MergedProfile extends AlumniMaster {
  // Overridable fields — may come from profile instead of master
  phone_number: string | null;
  city: string | null;
  state: string | null;
  linkedin_profile: string | null;
  // Profile-only fields (no master equivalent)
  profile_photo: string | null;
  highest_education: string | null;
  batch_year: number | null;
  bio: string | null;
  skills: string[];
  github_profile: string | null;
  current_company: string | null;
  current_position: string | null;
  current_salary: number | null;
  career_progression: CareerEntry[];
  mentoring_interests: string[];
  // Source attribution for UI ("From GHAR" / "Self-reported")
  _sources: Partial<Record<OverridableField, 'profile' | 'master'>>;
  // Whether this alumni has an alumni_profile row at all
  _has_profile: boolean;
}

// ============================================================
// Coursera Integration Types
// ============================================================

export interface CourseraConfig {
  id: string;
  client_id: string;
  client_secret: string;
  org_id: string;
  test_mode: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseraActivity {
  id: string;
  email: string;
  course_id: string;
  course_name: string;
  overall_progress: number;
  approx_total_hours: number;
  completed: boolean;
  membership_state: string;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

