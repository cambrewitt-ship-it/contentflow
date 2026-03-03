import { SupabaseClient } from '@supabase/supabase-js';

export type OnboardingChecklistField =
  | 'checklist_business_profile'
  | 'checklist_create_post'
  | 'checklist_add_to_calendar'
  | 'checklist_publish_post';

/**
 * Marks an onboarding checklist step as complete for a user.
 * Only writes to the DB if the step isn't already marked true.
 * Errors are suppressed so a checklist failure never breaks the main flow.
 */
export async function markOnboardingStep(
  supabase: SupabaseClient,
  userId: string,
  ...fields: OnboardingChecklistField[]
): Promise<void> {
  if (!fields.length) return;
  try {
    const updates: Partial<Record<OnboardingChecklistField, boolean>> = {};
    for (const f of fields) updates[f] = true;
    await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);
  } catch {
    // Non-critical — don't let checklist failures surface to the user
  }
}
