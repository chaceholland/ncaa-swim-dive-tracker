import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  /**
   * Threshold at which to trigger intersection (0-1)
   * @default 0.1
   */
  threshold?: number | number[];
  /**
   * Margin around the root element
   * @default '0px'
   */
  rootMargin?: string;
  /**
   * Root element for intersection (null = viewport)
   * @default null
   */
  root?: Element | null;
  /**
   * Whether to freeze the intersection state once element becomes visible
   * Performance optimization to stop observing after first intersection
   * @default true
   */
  freezeOnceVisible?: boolean;
}

interface UseIntersectionObserverReturn {
  /**
   * Ref to attach to the element being observed
   */
  ref: React.RefObject<HTMLElement | null>;
  /**
   * Whether the element is currently intersecting
   */
  isIntersecting: boolean;
  /**
   * Whether the element has been visible at least once
   */
  hasBeenVisible: boolean;
}

/**
 * Custom React hook for scroll-triggered animations using Intersection Observer API
 *
 * @param options - Configuration options for the intersection observer
 * @returns Object containing ref, isIntersecting, and hasBeenVisible
 *
 * @example
 * ```tsx
 * function AnimatedCard() {
 *   const { ref, isIntersecting } = useIntersectionObserver({
 *     threshold: 0.2,
 *     freezeOnceVisible: true
 *   });
 *
 *   return (
 *     <div
 *       ref={ref}
 *       className={cn(
 *         "transition-all duration-500",
 *         isIntersecting ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
 *       )}
 *     >
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    root = null,
    freezeOnceVisible = true,
  } = options;

  const ref = useRef<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    // Early return if element doesn't exist
    if (!element) {
      return;
    }

    // Early return if already frozen
    if (freezeOnceVisible && hasBeenVisible) {
      return;
    }

    // Check if IntersectionObserver is supported
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: assume element is visible
      setIsIntersecting(true);
      setHasBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isCurrentlyIntersecting = entry.isIntersecting;

        setIsIntersecting(isCurrentlyIntersecting);

        // Update hasBeenVisible if element becomes visible
        if (isCurrentlyIntersecting && !hasBeenVisible) {
          setHasBeenVisible(true);
        }

        // Unobserve if freezeOnceVisible is enabled and element is now visible
        if (freezeOnceVisible && isCurrentlyIntersecting) {
          observer.unobserve(element);
        }
      },
      {
        threshold,
        rootMargin,
        root,
      }
    );

    observer.observe(element);

    // Cleanup
    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold, rootMargin, root, freezeOnceVisible, hasBeenVisible]);

  return {
    ref,
    isIntersecting,
    hasBeenVisible,
  };
}
