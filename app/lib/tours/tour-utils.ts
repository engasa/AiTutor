/**
 * @file DOM helpers shared by the tour engine and the React provider.
 *
 * Responsibility: Bridges the pure tour engine to the live DOM (waiting for
 *   anchors, reading per-element route hints, and resolving function-typed
 *   step routes against the current context).
 * Used by: `tour-engine.ts`, `app/components/TourProvider.tsx`
 * Gotchas:
 *   - DOM convention: any element rendered with a `data-tour="<id>"` attribute
 *     becomes a tour anchor; if it ALSO carries `data-tour-route="<path>"`,
 *     clicking/highlighting it feeds the engine's selectedRoute state for the
 *     next step. Components opt in by adding both attributes — there is no
 *     central registry.
 *   - `waitForElement` resolves once and stops observing; callers that fire
 *     it across step changes must guard with their own staleness token (see
 *     `renderTokenRef` in `TourProvider.tsx`).
 * Related: `tour-engine.ts`, `tour-types.ts`
 */

import type { AppTourStep, TourContextState } from './tour-types';

/**
 * Resolves once `selector` matches in the live DOM. Used to wait out async
 * route renders so the popover doesn't try to highlight a not-yet-mounted
 * anchor. Rejects after `timeoutMs` so a missing target never hangs the tour.
 */
export function waitForElement(selector: string, timeoutMs = 4000) {
  return new Promise<Element>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('document is unavailable'));
      return;
    }

    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const next = document.querySelector(selector);
      if (!next) return;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve(next);
    });

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for ${selector}`));
    }, timeoutMs);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}

/**
 * Resolves a step's `route` field. Steps may declare a static path or a
 * function over the current context (e.g. "navigate to whichever course the
 * user just selected"). Returning null means this step isn't reachable yet
 * and the engine will skip it.
 */
export function resolveStepRoute(step: AppTourStep, context: TourContextState) {
  return typeof step.route === 'function' ? step.route(context) : step.route;
}

/**
 * Reads the `data-tour-route` attribute the engine uses to learn which route
 * a clicked card represents. Returns null when the attribute is missing or
 * the element isn't an HTMLElement (defensive for SVG/text nodes).
 */
export function readRouteFromElement(element: Element | null) {
  if (!element || !('dataset' in element)) return null;
  const route = (element as HTMLElement).dataset?.tourRoute;
  return typeof route === 'string' ? route : null;
}
