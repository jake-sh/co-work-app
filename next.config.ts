import type { NextConfig } from "next";

// Vercel's default squash-merge commit title is "<PR title> (#123)", so the
// PR number that produced this deploy can be read straight out of it. Shown
// in Settings as e.g. "v2.5.0" (PR #250, one digit per version segment) —
// purely for the user's own tracking of which build is live, not a real
// semver release.
const prNumber = process.env.VERCEL_GIT_COMMIT_MESSAGE?.match(/\(#(\d+)\)/)?.[1];
const appVersion = prNumber ? `v${prNumber.split("").join(".")}` : "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
