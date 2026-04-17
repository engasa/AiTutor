/**
 * @file Pure state machine for guided product tours.
 *
 * Responsibility: Owns the `ActiveTourSession` shape and provides pure(-ish)
 *   transition helpers. Knows nothing about the DOM, driver.js, or React —
 *   that integration lives in `TourProvider.tsx`.
 * Used by: `app/components/TourProvider.tsx`
 * Gotchas:
 *   - `findStepIndex` walks past steps whose route cannot be resolved (e.g. a
 *     step that points at a course-detail page when the user has no courses).
 *     This lets a single tour definition gracefully degrade across roles/states.
 *   - `storeStepSelection` is the bridge between user clicks and the next step's
 *     dynamic route: when the user selects a card with `data-tour-route`, we
 *     stash that route into `session.context` so the next step can navigate to it.
 *   - `direction` is preserved on the session so that `moveSessionAfterMissingTarget`
 *     keeps walking the same way after a skip (forward stays forward, back stays back).
 * Related: `tour-utils.ts`, `tour-types.ts`, `tour-storage.ts`
 */

import type { AppTourDefinition, AppTourStep, TourContextState } from './tour-types';
import { isLessonRoute } from './tour-storage';
import { readRouteFromElement, resolveStepRoute } from './tour-utils';

export type ActiveTourSession = {
  tour: AppTourDefinition;
  stepIndex: number;
  direction: 1 | -1;
  context: TourContextState;
  pendingRoute: string | null;
};

/**
 * Seeds tour context. If the user is already deep in a lesson when the tour
 * starts, that route is pre-recorded so lesson-scoped steps don't need a click
 * to populate `selectedLessonRoute`.
 */
export function createInitialTourContext(pathname: string): TourContextState {
  return {
    currentPath: pathname,
    selectedCourseRoute: null,
    selectedModuleRoute: null,
    selectedLessonRoute: isLessonRoute(pathname) ? pathname : null,
  };
}

export function createTourSession(tour: AppTourDefinition, pathname: string): ActiveTourSession {
  return {
    tour,
    stepIndex: 0,
    direction: 1,
    context: createInitialTourContext(pathname),
    pendingRoute: null,
  };
}

export function getSessionStep(session: ActiveTourSession): AppTourStep {
  return session.tour.steps[session.stepIndex];
}

/**
 * Walks `direction` from `fromIndex` to find the next reachable step. Steps
 * whose dynamic route resolves to null (e.g. depends on a course the user
 * never selected) are skipped silently, keeping tours robust across roles.
 */
export function findStepIndex(session: ActiveTourSession, fromIndex: number, direction: 1 | -1) {
  for (let index = fromIndex; index >= 0 && index < session.tour.steps.length; index += direction) {
    const route = resolveStepRoute(session.tour.steps[index], session.context);
    if (route) return index;
  }

  return null;
}

export function getStepRoute(session: ActiveTourSession, step = getSessionStep(session)) {
  return resolveStepRoute(step, session.context);
}

export function getStepMeta(session: ActiveTourSession) {
  return {
    step: getSessionStep(session),
    route: getStepRoute(session),
    hasPrevious: findStepIndex(session, session.stepIndex - 1, -1) != null,
    hasNext: findStepIndex(session, session.stepIndex + 1, 1) != null,
  };
}

export function moveSession(session: ActiveTourSession, direction: 1 | -1) {
  const nextIndex = findStepIndex(session, session.stepIndex + direction, direction);
  if (nextIndex == null) return null;

  session.direction = direction;
  session.stepIndex = nextIndex;
  return nextIndex;
}

/**
 * Used when the highlighted DOM target failed to appear; advance in whatever
 * direction the user was already heading rather than trapping them.
 */
export function moveSessionAfterMissingTarget(session: ActiveTourSession) {
  return moveSession(session, session.direction);
}

/**
 * Captures the user's current selection (a clicked card, etc.) into the
 * session context under the key declared by `step.storeRouteFromTarget`.
 * This is how a "click any course" step feeds the route for the next
 * "now look at this course's modules" step.
 */
export function storeStepSelection(session: ActiveTourSession, element: Element | null) {
  const currentStep = getSessionStep(session);
  if (!currentStep.storeRouteFromTarget) return;

  session.context[currentStep.storeRouteFromTarget] = readRouteFromElement(element);
}
