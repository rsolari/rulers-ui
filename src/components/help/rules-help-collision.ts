'use client';

import { useState, useLayoutEffect, useCallback, type RefObject } from 'react';

export const RULES_HELP_AVOID_ATTR = 'data-rules-help-avoid';

interface AvoidanceRect {
  direction: 'bottom' | 'right' | 'both';
  rect: DOMRect;
}

export interface CollisionInsets {
  bottom: number;
  right: number;
  top: number;
}

const DEFAULT_INSETS: CollisionInsets = { bottom: 16, right: 16, top: 56 };

const SHEET_MIN_HEIGHT = 320; // 20rem
const SHEET_MIN_WIDTH = 304; // 19rem

export function getRulesHelpAvoidanceRects(
  viewportWidth: number,
  viewportHeight: number,
  elements: AvoidanceRect[],
): CollisionInsets {
  let bottom = 16;
  let right = 16;

  const safeAreaBottom = typeof CSS !== 'undefined' && CSS.supports?.('padding-bottom', 'env(safe-area-inset-bottom)')
    ? 0 // browser handles via env()
    : 0;

  for (const { direction, rect } of elements) {
    if (rect.width === 0 && rect.height === 0) continue;

    if (direction === 'bottom' || direction === 'both') {
      const elementBottom = viewportHeight - rect.top + safeAreaBottom;
      bottom = Math.max(bottom, elementBottom);
    }

    if (direction === 'right' || direction === 'both') {
      const elementRight = viewportWidth - rect.left;
      right = Math.max(right, elementRight);
    }
  }

  return { bottom, right, top: DEFAULT_INSETS.top };
}

export type HelpPlacementMode = 'dock' | 'drawer' | 'sheet';

export function computePlacement(
  viewportWidth: number,
  viewportHeight: number,
  insets: CollisionInsets,
): HelpPlacementMode {
  if (viewportWidth < 768) return 'sheet';

  const availableHeight = viewportHeight - insets.top - insets.bottom;
  const availableWidth = viewportWidth - insets.right;

  if (availableHeight < SHEET_MIN_HEIGHT || availableWidth < SHEET_MIN_WIDTH) {
    return 'sheet';
  }

  if (viewportWidth >= 1024) return 'dock';
  return 'drawer';
}

export function useRulesHelpCollision(
  surfaceRef: RefObject<HTMLElement | null>,
  options: { enabled: boolean },
) {
  const [insets, setInsets] = useState<CollisionInsets>(DEFAULT_INSETS);
  const [placement, setPlacement] = useState<HelpPlacementMode>('dock');

  const measure = useCallback(() => {
    const elements = document.querySelectorAll<HTMLElement>(`[${RULES_HELP_AVOID_ATTR}]`);
    const avoidRects: AvoidanceRect[] = [];

    elements.forEach((el) => {
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
      const dir = (el.getAttribute(RULES_HELP_AVOID_ATTR) || 'bottom') as AvoidanceRect['direction'];
      avoidRects.push({ direction: dir, rect: el.getBoundingClientRect() });
    });

    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;

    const computed = getRulesHelpAvoidanceRects(vw, vh, avoidRects);

    const headerEl = document.querySelector<HTMLElement>('header[class*="sticky"]');
    if (headerEl) {
      computed.top = Math.max(computed.top, headerEl.getBoundingClientRect().bottom);
    }

    setInsets(computed);
    setPlacement(computePlacement(vw, vh, computed));
  }, []);

  useLayoutEffect(() => {
    if (!options.enabled) return;

    measure();

    const observer = new ResizeObserver(measure);
    const avoidElements = document.querySelectorAll<HTMLElement>(`[${RULES_HELP_AVOID_ATTR}]`);
    avoidElements.forEach((el) => observer.observe(el));

    if (surfaceRef.current) observer.observe(surfaceRef.current);

    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [options.enabled, measure, surfaceRef]);

  const style: Record<string, string> = {
    '--rules-help-safe-bottom': `${insets.bottom}px`,
    '--rules-help-safe-right': `${insets.right}px`,
    '--rules-help-top-offset': `${insets.top}px`,
  };

  return { insets, placement, style, measure };
}
