import type { NextConfig } from "next";

// In development (npm run dev), disable static export so dynamic routes like
// /leads/[id] work normally with the local dev server.
// In production (npm run build), enable static export for Cloudflare Pages deployment.
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  ...(isDev ? {} : {
    output: 'export',
    trailingSlash: true,
  }),
};

export default nextConfig;
