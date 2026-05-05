import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow both localhost and 127.0.0.1 as dev origins.
  // Required when running behind PM2 — without this Next.js 16 blocks
  // its own JS bundle from loading, preventing React from hydrating.
  allowedDevOrigins: ["localhost", "127.0.0.1"],

  // Run instrumentation.ts on server startup (pre-warms Tesseract language model)
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
