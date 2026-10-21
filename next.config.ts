import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Add your CDN / Supabase storage hostname here when product images are uploaded there.
    remotePatterns: process.env.IMAGE_REMOTE_HOST ? [{ protocol: "https", hostname: process.env.IMAGE_REMOTE_HOST }] : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
