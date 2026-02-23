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
      {
        protocol: "https",
        hostname: "cornellbigred.com",
      },
      {
        protocol: "https",
        hostname: "gopsusports.com",
      },
      {
        protocol: "https",
        hostname: "pennathletics.com",
      },
      {
        protocol: "https",
        hostname: "gocrimson.com",
      },
      {
        protocol: "https",
        hostname: "d3mojdi32uv7q.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "yalebulldogs.com",
      },
      {
        protocol: "https",
        hostname: "goheels.com",
      },
      {
        protocol: "https",
        hostname: "navysports.com",
      },
      {
        protocol: "https",
        hostname: "unlvrebels.com",
      },
      {
        protocol: "https",
        hostname: "towsontigers.com",
      },
      {
        protocol: "https",
        hostname: "fightingirish.com",
      },
      {
        protocol: "https",
        hostname: "virginiasports.com",
      },
      {
        protocol: "https",
        hostname: "hokiesports.com",
      },
      {
        protocol: "https",
        hostname: "ramblinwreck.com",
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
