import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  // Old URLs (from the NGConnect-style layout) → current routes, so bookmarks keep working.
  async redirects() {
    return [
      { source: '/data-management/coursera/activity-logs', destination: '/activity-logs', permanent: true },
      { source: '/data-management/coursera/export', destination: '/export', permanent: true },
      { source: '/data-management/coursera/learner/:email', destination: '/learners/:email', permanent: true },
      { source: '/data-management/coursera', destination: '/dashboard', permanent: true },
      { source: '/data-management/import-coursera', destination: '/import-reports', permanent: true },
      { source: '/data-management', destination: '/', permanent: true },
      { source: '/settings/coursera', destination: '/settings/targets', permanent: true },
    ];
  },
};

export default nextConfig;
