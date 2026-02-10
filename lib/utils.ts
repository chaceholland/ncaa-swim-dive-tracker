import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes using clsx and tailwind-merge
 * Handles conditional classes and resolves conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate CSS gradient from team colors
 * @param primaryColor - Primary team color (hex)
 * @param secondaryColor - Secondary team color (hex, optional)
 * @returns CSS gradient string
 */
export function getTeamGradient(
  primaryColor: string,
  secondaryColor?: string
): string {
  if (!primaryColor) {
    return 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'; // Default gradient
  }

  // Clean hex colors (remove # if present)
  const primary = primaryColor.replace('#', '');
  const secondary = secondaryColor?.replace('#', '');

  // Validate hex colors
  const isValidHex = (hex: string) => /^[0-9A-Fa-f]{6}$/.test(hex);

  if (!isValidHex(primary)) {
    return 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'; // Default gradient
  }

  if (secondary && isValidHex(secondary)) {
    return `linear-gradient(135deg, #${primary} 0%, #${secondary} 100%)`;
  }

  // Generate a lighter version of primary color for single-color gradient
  const lighterShade = lightenColor(primary, 20);
  return `linear-gradient(135deg, #${primary} 0%, #${lighterShade} 100%)`;
}

/**
 * Lighten a hex color by a percentage
 * @param hex - Hex color without #
 * @param percent - Percentage to lighten (0-100)
 * @returns Lightened hex color without #
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, ((num >> 16) & 0xff) + amt);
  const G = Math.min(255, ((num >> 8) & 0xff) + amt);
  const B = Math.min(255, (num & 0xff) + amt);
  return ((R << 16) | (G << 8) | B).toString(16).padStart(6, '0');
}

/**
 * Extract 1-2 letter initials from team name
 * @param teamName - Full team name
 * @returns Initials (1-2 uppercase letters)
 */
export function getTeamInitials(teamName: string): string {
  if (!teamName || typeof teamName !== 'string') {
    return 'T';
  }

  const cleaned = teamName.trim();

  if (cleaned.length === 0) {
    return 'T';
  }

  // Split by spaces and filter out common words
  const words = cleaned
    .split(/\s+/)
    .filter(word =>
      word.length > 0 &&
      !['of', 'the', 'and', '&', 'at'].includes(word.toLowerCase())
    );

  if (words.length === 0) {
    return cleaned.charAt(0).toUpperCase();
  }

  if (words.length === 1) {
    // Single word: take first letter
    return words[0].charAt(0).toUpperCase();
  }

  // Multiple words: take first letter of first two words
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/**
 * Determine if text should be white or black based on background color
 * Uses WCAG luminance calculation for accessibility
 * @param hexColor - Background color (with or without #)
 * @returns 'white' or 'black'
 */
export function getContrastColor(hexColor: string): 'white' | 'black' {
  if (!hexColor) {
    return 'white';
  }

  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Validate hex color
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return 'white';
  }

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using WCAG formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black text for light backgrounds, white for dark
  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Format timestamps relative to now
 * @param date - Date string or Date object
 * @returns Formatted string (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatLastUpdated(date: string | Date): string {
  try {
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(then.getTime())) {
      return 'Unknown';
    }

    const diffMs = now.getTime() - then.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks}w ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths}mo ago`;
    } else {
      return `${diffYears}y ago`;
    }
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Calculate animation delay for staggered card entrance
 * @param index - Item index in list
 * @param baseDelay - Base delay in milliseconds (default: 50)
 * @param maxDelay - Maximum delay in milliseconds (default: 500)
 * @returns Delay in milliseconds
 */
export function getStaggerDelay(
  index: number,
  baseDelay: number = 50,
  maxDelay: number = 500
): number {
  if (index < 0) {
    return 0;
  }

  const delay = index * baseDelay;
  return Math.min(delay, maxDelay);
}
