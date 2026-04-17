/**
 * @file React integration layer that drives a `driver.js` popover from the
 *   pure tour engine and React Router navigation.
 *
 * Responsibility: Mounts the singleton driver instance, walks tour steps,
 *   navigates between routes when a step lives elsewhere, and exposes a
 *   `useAppTour()` hook so any descendant can start/stop the suggested tour.
 * Used by: Wraps the app in `app/root.tsx` (any route can call `useAppTour`).
 *   `TourButton` is the primary consumer that calls `startSuggestedTour`.
 * Gotchas:
 *   - `driverRef` holds a single `driver.js` instance lazily imported on first
 *     use (driver.js is large; this keeps it out of the initial bundle).
 *   - `sessionRef` is the source of truth for the active tour. It's a ref
 *     (not state) because the inner driver.js callbacks need synchronous
 *     access — re-rendering on every step would race with driver.js's own
 *     animation lifecycle.
 *   - `renderTokenRef` increments on every step transition. `waitForElement`
 *     promises captured before the increment compare against the snapshot
 *     and bail out on resolve — without this, a stale anchor lookup could
 *     highlight the wrong element after the user clicks Next.
 *   - `suppressDestroyedRef` flags "I am about to call driver.destroy() so I
 *     can re-highlight; do NOT treat the resulting onDestroyStarted/onDestroyed
 *     as a user-initiated close". Without it, `clearTourState` would fire on
 *     every step transition and tear the tour down.
 *   - When the next step lives on a different route, the popover is destroyed
 *     first (`pendingRoute` set), navigation runs, and the `pendingRoute`
 *     effect re-enters `showStep` once the location updates. This avoids
 *     driver.js highlighting an unmounting page.
 * Related: `app/lib/tours/tour-engine.ts`, `app/lib/tours/tour-utils.ts`,
 *   `app/lib/tours/tour-definitions.ts`, `app/components/TourButton.tsx`
 */

import type { Driver, PopoverDOM } from 'driver.js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import 'driver.js/dist/driver.css';
import { tourDefinitions } from '~/lib/tours/tour-definitions';
import {
  createTourSession,
  findStepIndex,
  getStepMeta,
  moveSession,
  moveSessionAfterMissingTarget,
  storeStepSelection,
  type ActiveTourSession,
} from '~/lib/tours/tour-engine';
import { isLessonRoute, markTourCompleted } from '~/lib/tours/tour-storage';
import type { AppTourDefinition, AppTourId } from '~/lib/tours/tour-types';
import { waitForElement } from '~/lib/tours/tour-utils';

type TourContextValue = {
  activeTourId: AppTourId | null;
  isRunning: boolean;
  suggestedTourId: AppTourId | null;
  startTour: (tourId: AppTourId) => void;
  startSuggestedTour: () => void;
  stopTour: () => void;
};

const AppTourContext = createContext<TourContextValue | null>(null);

function applyPopoverTheme(popover: PopoverDOM) {
  popover.previousButton.classList.add('driver-tour-button', 'driver-tour-button-secondary');
  popover.nextButton.classList.add('driver-tour-button', 'driver-tour-button-primary');
  popover.closeButton.setAttribute('aria-label', 'Close tour');
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTourId, setActiveTourId] = useState<AppTourId | null>(null);
  // Lazily constructed driver.js instance; kept across steps to preserve animation state.
  const driverRef = useRef<Driver | null>(null);
  // Live tour session; mutated in place by the engine helpers.
  const sessionRef = useRef<ActiveTourSession | null>(null);
  // Bumped on every step transition; in-flight async work checks against a snapshot to detect staleness.
  const renderTokenRef = useRef(0);
  // True while we are intentionally destroying the popover to re-highlight; tells the destroy callbacks
  // to skip clearing tour state (otherwise every next-button press would end the tour).
  const suppressDestroyedRef = useRef(false);

  const clearTourState = useCallback(() => {
    renderTokenRef.current += 1;
    sessionRef.current = null;
    setActiveTourId(null);
  }, []);

  const destroyDriver = useCallback((suppressOnDestroyed = false) => {
    if (suppressOnDestroyed) {
      suppressDestroyedRef.current = true;
    }

    driverRef.current?.destroy();
  }, []);

  const ensureDriver = useCallback(async () => {
    if (driverRef.current) return driverRef.current;

    const { driver } = await import('driver.js');
    driverRef.current = driver({
      animate: true,
      allowClose: true,
      overlayClickBehavior: () => {
        stopTour();
      },
      overlayOpacity: 0.62,
      overlayColor: 'rgb(20 14 10)',
      smoothScroll: true,
      stagePadding: 12,
      stageRadius: 20,
      popoverOffset: 18,
      showProgress: true,
      allowKeyboardControl: true,
      popoverClass: 'driver-popover-aitutor',
      onDestroyStarted: () => {
        if (suppressDestroyedRef.current) return;
        clearTourState();
      },
      onDestroyed: () => {
        if (suppressDestroyedRef.current) {
          suppressDestroyedRef.current = false;
          return;
        }

        clearTourState();
      },
    });

    return driverRef.current;
  }, [clearTourState]);

  const stopTour = useCallback(() => {
    clearTourState();
    destroyDriver(true);
  }, [clearTourState, destroyDriver]);

  const completeTour = useCallback(
    (tour: AppTourDefinition) => {
      markTourCompleted(tour);
      stopTour();
    },
    [stopTour],
  );

  const showStep = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    const { step, route, hasPrevious, hasNext } = getStepMeta(session);
    if (!route) {
      // Step's route is unresolvable in current context — skip past it.
      const nextIndex = moveSessionAfterMissingTarget(session);
      if (nextIndex == null) {
        completeTour(session.tour);
        return;
      }
      void showStep();
      return;
    }

    session.context.currentPath = location.pathname;

    if (route !== location.pathname) {
      // Defer rendering until the new route mounts; the pendingRoute effect re-enters showStep.
      destroyDriver(true);
      session.pendingRoute = route;
      navigate(route);
      return;
    }

    // Snapshot the render token so any awaited work below can detect a step change and bail out.
    const token = ++renderTokenRef.current;

    try {
      const element = await waitForElement(step.target);
      if (renderTokenRef.current !== token || sessionRef.current !== session) return;

      // Probe whether the NEXT step is reachable assuming the user clicks Next on this anchor;
      // used purely to label the button "Continue" vs "Finish" without mutating real state.
      const projectedSession: ActiveTourSession = {
        ...session,
        context: { ...session.context },
      };
      storeStepSelection(projectedSession, element);
      const projectedHasNext =
        findStepIndex(projectedSession, projectedSession.stepIndex + 1, 1) != null;

      const driver = await ensureDriver();
      if (renderTokenRef.current !== token || sessionRef.current !== session) return;

      destroyDriver(true);

      driver.highlight({
        element,
        disableActiveInteraction: true,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? 'bottom',
          align: step.align ?? 'center',
          showButtons: [...(hasPrevious ? (['previous'] as const) : []), 'next', 'close'],
          progressText: `${session.stepIndex + 1} of ${session.tour.steps.length}`,
          nextBtnText: projectedHasNext ? 'Continue' : 'Finish',
          prevBtnText: 'Back',
          doneBtnText: 'Finish',
          onPopoverRender: applyPopoverTheme,
          onCloseClick: () => stopTour(),
          onPrevClick: () => {
            const currentSession = sessionRef.current;
            if (!currentSession) return;
            const previousIndex = moveSession(currentSession, -1);
            if (previousIndex == null) return;
            void showStep();
          },
          onNextClick: () => {
            const currentSession = sessionRef.current;
            if (!currentSession) return;

            storeStepSelection(
              currentSession,
              driver.getActiveElement() ?? document.querySelector(step.target),
            );

            const nextIndex = moveSession(currentSession, 1);
            if (nextIndex == null) {
              completeTour(currentSession.tour);
              return;
            }
            void showStep();
          },
        },
      });
    } catch {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const nextIndex = moveSessionAfterMissingTarget(currentSession);
      if (nextIndex == null) {
        completeTour(currentSession.tour);
        return;
      }
      void showStep();
    }
  }, [completeTour, ensureDriver, location.pathname, navigate, stopTour]);

  const startTour = useCallback(
    (tourId: AppTourId) => {
      const tour = tourDefinitions[tourId];
      sessionRef.current = createTourSession(tour, location.pathname);
      setActiveTourId(tourId);
      destroyDriver(true);
      void showStep();
    },
    [destroyDriver, location.pathname, showStep],
  );

  // Picks the contextually appropriate tour for the current page: the lesson-specific tour when
  // the student is inside a lesson, otherwise the broader journey tour. Non-student routes opt out.
  const suggestedTourId = useMemo<AppTourId | null>(() => {
    if (!location.pathname.startsWith('/student')) return null;
    return isLessonRoute(location.pathname) ? 'student-lesson-help' : 'student-journey';
  }, [location.pathname]);

  const startSuggestedTour = useCallback(() => {
    if (!suggestedTourId) return;
    startTour(suggestedTourId);
  }, [startTour, suggestedTourId]);

  // Resumes showStep once React Router has actually committed the navigation we requested.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.context.currentPath = location.pathname;

    if (session.pendingRoute === location.pathname) {
      session.pendingRoute = null;
      void showStep();
    }
  }, [location.pathname, showStep]);

  useEffect(
    () => () => {
      destroyDriver(true);
    },
    [destroyDriver],
  );

  const value = useMemo<TourContextValue>(
    () => ({
      activeTourId,
      isRunning: activeTourId != null,
      suggestedTourId,
      startTour,
      startSuggestedTour,
      stopTour,
    }),
    [activeTourId, startSuggestedTour, startTour, stopTour, suggestedTourId],
  );

  return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}

/**
 * Access the tour controller. Throws when used outside a `TourProvider` to
 * surface mounting bugs at render time rather than producing silent no-ops.
 */
export function useAppTour() {
  const context = useContext(AppTourContext);
  if (!context) {
    throw new Error('useAppTour must be used within a TourProvider');
  }
  return context;
}
