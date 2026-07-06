import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root explicitly: this repo has sibling lockfiles
  // outside the daftar workspace which would otherwise make Next.js guess
  // (and warn about) the wrong root directory.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Let the standalone production instance build/serve from its own dir
  // (NEXT_DIST_DIR=.next-standalone) so it never collides with the Claude-run
  // dev server, which uses the default .next. Both can run at once.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
