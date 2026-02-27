/**
 * Image utility functions for handling external vs local images.
 *
 * The core problem: Next.js Image Optimization often breaks external images due to:
 * - Hotlink protection on athletic department sites
 * - CDN restrictions (SideArm, CloudFront, etc.)
 * - Supabase storage URLs that are already optimized
 *
 * Solution: ALL external URLs (starting with http/https) use raw <img> tags
 * with native browser lazy loading. Only local/relative paths use Next.js Image.
 */

/**
 * Check if a URL is external (should bypass Next.js Image Optimization)
 */
export function isExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Check if a URL is a local path (can use Next.js Image)
 */
export function isLocalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/') && !url.startsWith('//');
}
