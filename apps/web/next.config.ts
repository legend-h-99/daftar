import type { NextConfig } from "next";
import path from "path";

const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH || "";
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001/api"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: `${basePath}/`,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  async rewrites() {
    if (isStaticExport) return [];

    return [
      {
        source: "/api-proxy/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
  // Pin the workspace root explicitly: this repo has sibling lockfiles
  // outside the daftar workspace which would otherwise make Next.js guess
  // (and warn about) the wrong root directory.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Let the standalone production instance build/serve from its own dir
  // (NEXT_DIST_DIR=.next-standalone) so it never collides with the Claude-run
  // dev server, which uses the default .next. Both can run at once.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com"
      : "script-src 'self' 'unsafe-inline' https://accounts.google.com";
    // In dev, allow the API on any local IP or HTTPS origin (for mobile testing via tunnel).
    // In production, restrict to the known API origin.
    const connectSrc = isDev
      ? "connect-src 'self' http://*:3001 https://* https://wa.me"
      : `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? ""} https://accounts.google.com https://wa.me`;

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              connectSrc,
              "frame-src https://accounts.google.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
