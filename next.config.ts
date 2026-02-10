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
    ],
  },
};

export default nextConfig;
