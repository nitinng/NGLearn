import type { AlumniMaster, AlumniProfile, MergedProfile, OVERRIDABLE_FIELDS } from '@/types/alumni';

const overridable: readonly (keyof AlumniProfile & keyof AlumniMaster)[] = [
  'phone_number',
  'city',
  'state',
  'linkedin_profile',
];

/**
 * Merges an alumni_master row with an optional alumni_profile row.
 *
 * Priority rule (per field):
 *   alumni_profile value → alumni_master value → null
 *
 * The _sources map records where each overridable field value came from,
 * enabling UI badges like "From GHAR" or "Self-reported".
 */
export function mergeAlumniProfile(
  master: AlumniMaster,
  profile: AlumniProfile | null
): MergedProfile {
  const merged: any = { ...master };
  const sources: MergedProfile['_sources'] = {};

  for (const field of overridable) {
    const profileValue = profile?.[field as keyof AlumniProfile] as string | null | undefined;
    if (profileValue !== null && profileValue !== undefined && profileValue !== '') {
      merged[field] = profileValue;
      sources[field as keyof typeof sources] = 'profile';
    } else {
      sources[field as keyof typeof sources] = 'master';
    }
  }

  // Profile-only fields
  merged.profile_photo       = profile?.profile_photo       ?? null;
  merged.highest_education   = profile?.highest_education   ?? null;
  merged.batch_year          = profile?.batch_year          ?? null;
  merged.bio                 = profile?.bio                 ?? null;
  merged.skills              = profile?.skills              ?? [];
  merged.github_profile      = profile?.github_profile      ?? null;
  merged.current_company     = profile?.current_company     ?? null;
  merged.current_position    = profile?.current_position    ?? null;
  merged.current_salary      = profile?.current_salary      ?? null;
  merged.career_progression  = profile?.career_progression  ?? [];
  merged.mentoring_interests = profile?.mentoring_interests ?? [];

  merged._sources    = sources;
  merged._has_profile = profile !== null;

  return merged as MergedProfile;
}
