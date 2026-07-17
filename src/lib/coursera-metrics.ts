export type PrevTotals = { email: string; prev_hours: number; prev_completions: number; is_active?: boolean };

export function computeMetricsBlob(
  learnerMonthRecords: any[],
  prevRecords: any[],
  totalLicenses: number,
  minMonthlyHours: number
) {
  const prevByEmail = new Map(prevRecords.map(r => [r.email, r]));

  const total_learners = learnerMonthRecords.length;
  const active_learners = learnerMonthRecords.filter(r => r.is_active).length;
  const inactive_learners = learnerMonthRecords.filter(r => !r.is_active).length;
  const compliant_learners = learnerMonthRecords.filter(r => r.is_compliant).length;
  const total_lifetime_hours = learnerMonthRecords.reduce((s, r) => s + (r.cumulative_hours || 0), 0);
  const monthly_hours_total = learnerMonthRecords.reduce((s, r) => s + (r.monthly_hours || 0), 0);
  const avg_hours_per_active_learner = active_learners > 0 ? monthly_hours_total / active_learners : 0;
  const total_courses_enrolled = learnerMonthRecords.reduce((s, r) => s + (r.courses_enrolled || 0), 0);
  const total_courses_completed = learnerMonthRecords.reduce((s, r) => s + (r.courses_completed || 0), 0);
  const monthly_completions = learnerMonthRecords.reduce((s, r) => s + (r.new_completions || 0), 0);
  const overall_completion_rate = total_courses_enrolled > 0
    ? (total_courses_completed / total_courses_enrolled) * 100 : 0;
  const licenses_active = active_learners;
  const license_utilization_pct = totalLicenses > 0
    ? (licenses_active / totalLicenses) * 100 : null;

  const prevActiveLearners = prevRecords.filter(r => r.is_active).length;
  const prevMonthlyHours = prevRecords.reduce((s, r) => s + (r.monthly_hours || 0), 0);
  const prevCompletions = prevRecords.reduce((s, r) => s + (r.new_completions || 0), 0);

  return {
    // Executive cards
    total_learners,
    active_learners,
    inactive_learners,
    compliant_learners,
    total_lifetime_hours,
    monthly_hours: monthly_hours_total,
    avg_hours_per_active_learner,
    total_courses_enrolled,
    total_courses_completed,
    monthly_completions,
    overall_completion_rate,
    total_licenses: totalLicenses,
    licenses_active,
    license_utilization_pct,

    // MoM deltas
    mom_active_learners: active_learners - prevActiveLearners,
    mom_monthly_hours: monthly_hours_total - prevMonthlyHours,
    mom_completions: monthly_completions - prevCompletions,
    new_learners_this_month: learnerMonthRecords.filter(r => !prevByEmail.has(r.email)).length,
    reactivated_learners: learnerMonthRecords.filter(r =>
      r.is_active && prevByEmail.has(r.email) && !prevByEmail.get(r.email)!.is_active
    ).length,
    became_inactive: learnerMonthRecords.filter(r =>
      !r.is_active && prevByEmail.has(r.email) && prevByEmail.get(r.email)!.is_active
    ).length,

    // Distributions
    hours_distribution: {
      '0':     learnerMonthRecords.filter(r => r.monthly_hours === 0).length,
      '1-5':   learnerMonthRecords.filter(r => r.monthly_hours > 0 && r.monthly_hours <= 5).length,
      '6-10':  learnerMonthRecords.filter(r => r.monthly_hours > 5 && r.monthly_hours <= 10).length,
      '11-20': learnerMonthRecords.filter(r => r.monthly_hours > 10 && r.monthly_hours <= 20).length,
      '21-40': learnerMonthRecords.filter(r => r.monthly_hours > 20 && r.monthly_hours <= 40).length,
      '40+':   learnerMonthRecords.filter(r => r.monthly_hours > 40).length,
    },
    progress_distribution: {
      '0%':     learnerMonthRecords.filter(r => (r.avg_progress || 0) === 0).length,
      '1-25%':  learnerMonthRecords.filter(r => (r.avg_progress || 0) > 0 && (r.avg_progress || 0) <= 25).length,
      '26-50%': learnerMonthRecords.filter(r => (r.avg_progress || 0) > 25 && (r.avg_progress || 0) <= 50).length,
      '51-75%': learnerMonthRecords.filter(r => (r.avg_progress || 0) > 50 && (r.avg_progress || 0) <= 75).length,
      '76-99%': learnerMonthRecords.filter(r => (r.avg_progress || 0) > 75 && (r.avg_progress || 0) < 100).length,
      '100%':   learnerMonthRecords.filter(r => (r.avg_progress || 0) === 100).length,
    },

    // Leaderboards (pre-sorted, top 20)
    top_learners_by_hours: [...learnerMonthRecords]
      .sort((a, b) => b.monthly_hours - a.monthly_hours)
      .slice(0, 20)
      .map(r => ({ email: r.email, name: r.name, monthly_hours: r.monthly_hours, cumulative_hours: r.cumulative_hours })),

    top_learners_by_cumulative: [...learnerMonthRecords]
      .sort((a, b) => b.cumulative_hours - a.cumulative_hours)
      .slice(0, 20)
      .map(r => ({ email: r.email, name: r.name, cumulative_hours: r.cumulative_hours })),

    bottom_learners: [...learnerMonthRecords]
      .filter(r => r.is_active)
      .sort((a, b) => a.monthly_hours - b.monthly_hours)
      .slice(0, 20)
      .map(r => ({ email: r.email, name: r.name, monthly_hours: r.monthly_hours, days_since_activity: r.days_since_activity })),

    // Intervention lists
    learners_below_target: [...learnerMonthRecords]
      .filter(r => r.is_active && !r.is_compliant)
      .sort((a, b) => a.monthly_hours - b.monthly_hours)
      .slice(0, 50)
      .map(r => ({ email: r.email, name: r.name, monthly_hours: r.monthly_hours })),

    learners_no_activity_30: [...learnerMonthRecords]
      .filter(r => r.days_since_activity !== null && r.days_since_activity >= 30)
      .sort((a, b) => (b.days_since_activity ?? 0) - (a.days_since_activity ?? 0))
      .slice(0, 50)
      .map(r => ({ email: r.email, name: r.name, days_since_activity: r.days_since_activity })),

    learners_no_activity_60: learnerMonthRecords
      .filter(r => r.days_since_activity !== null && r.days_since_activity >= 60).length,
    learners_no_activity_90: learnerMonthRecords
      .filter(r => r.days_since_activity !== null && r.days_since_activity >= 90).length,
    never_active: learnerMonthRecords.filter(r => r.days_since_activity === null).length,

    // Alerts
    alerts: [
      {
        type: 'below_target',
        count: learnerMonthRecords.filter(r => r.is_active && !r.is_compliant).length,
        threshold: minMonthlyHours,
      },
      {
        type: 'inactive_30',
        count: learnerMonthRecords.filter(r => (r.days_since_activity ?? -1) >= 30).length,
      },
      {
        type: 'inactive_90',
        count: learnerMonthRecords.filter(r => (r.days_since_activity ?? -1) >= 90).length,
      }
    ].filter(a => a.count > 0)
  };
}
