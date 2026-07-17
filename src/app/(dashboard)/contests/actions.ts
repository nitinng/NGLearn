"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";

async function verifyAdminAccess() {
  const role = await getUserRole();
  if (role !== "Admin" && role !== "PNC") {
    throw new Error("Unauthorized: Only admins and PNCs can perform this action.");
  }
}

// -----------------------------------------------------------------------------
// Contest Series
// -----------------------------------------------------------------------------

export async function createContestSeries(data: { name: string; description?: string }) {
  await verifyAdminAccess();
  const supabase = createAdminClient();

  const { data: result, error } = await supabase
    .from("contest_series")
    .insert([data])
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/contests");
  return { data: result };
}

export async function updateContestSeries(id: string, data: { name: string; description?: string }) {
  await verifyAdminAccess();
  const supabase = createAdminClient();

  const { data: result, error } = await supabase
    .from("contest_series")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/contests");
  return { data: result };
}

export async function deleteContestSeries(id: string) {
  await verifyAdminAccess();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("contest_series")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/contests");
  return { success: true };
}


// -----------------------------------------------------------------------------
// Sub-Contests
// -----------------------------------------------------------------------------

export async function createSubContest(data: {
  series_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
}) {
  await verifyAdminAccess();
  const supabase = createAdminClient();

  const { data: result, error } = await supabase
    .from("sub_contests")
    .insert([data])
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/contests");
  return { data: result };
}

export async function updateSubContest(id: string, data: {
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
}) {
  await verifyAdminAccess();
  const supabase = createAdminClient();

  const { data: result, error } = await supabase
    .from("sub_contests")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/contests");
  return { data: result };
}

export async function deleteSubContest(id: string) {
  await verifyAdminAccess();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("sub_contests")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/contests");
  return { success: true };
}
