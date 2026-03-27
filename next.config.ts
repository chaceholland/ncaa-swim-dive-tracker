import type { NextConfig } from "next";

/**
 * Non-.edu college athletics domains that host team logos and athlete headshots.
 * Add new domains here when onboarding teams whose sites aren't on .edu domains.
 */
const athleticsDomains = [
  "auburntigers.com",
  "calbears.com",
  "cornellbigred.com",
  "fightingirish.com",
  "gamecocksonline.com",
  "gocrimson.com",
  "goheels.com",
  "gopsusports.com",
  "gostanford.com",
  "hokiesports.com",
  "lsusports.net",
  "navysports.com",
  "pennathletics.com",
  "ramblinwreck.com",
  "smumustangs.com",
  "towsontigers.com",
  "unlvrebels.com",
  "virginiasports.com",
  "yalebulldogs.com",
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase storage — team logos & athlete headshots
      {
        protocol: "https",
        hostname: "dtnozcqkuzhjmjvsfjqk.supabase.co",
      },
      // University athletics sites on .edu domains
      {
        protocol: "https",
        hostname: "**.edu",
      },
      // SideArm Sports CDN — powers most NCAA athletics sites
      {
        protocol: "https",
        hostname: "images.sidearmdev.com",
      },
      // CloudFront CDNs used by various athletics sites
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
      // Google Cloud Storage
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      // Non-.edu athletics domains (generated from array above)
      ...athleticsDomains.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
