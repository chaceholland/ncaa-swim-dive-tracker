import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.edu",
      },
      {
        protocol: "https",
        hostname: "dtnozcqkuzhjmjvsfjqk.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.sidearmdev.com",
      },
    ],
  },
};

export default nextConfig;
