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
      {
        protocol: "https",
        hostname: "auburntigers.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "gamecocksonline.com",
      },
      {
        protocol: "https",
        hostname: "lsusports.net",
      },
      {
        protocol: "https",
        hostname: "calbears.com",
      },
      {
        protocol: "https",
        hostname: "smumustangs.com",
      },
      {
        protocol: "https",
        hostname: "gostanford.com",
      },
      {
        protocol: "https",
        hostname: "d11rxijfksshz7.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "dxbhsrqyrr690.cloudfront.net",
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
