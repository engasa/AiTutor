import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import type { Topic } from '../lib/types';

export type CourseTopicsState = {
  topics: Topic[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTopic: (name: string) => Promise<Topic>;
};

const sortTopics = (items: Topic[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

export function useCourseTopics(courseOfferingId: number | null): CourseTopicsState {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadTopics = useCallback(async () => {
    if (!courseOfferingId) {
      setTopics([]);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const fetched = await api.topicsForCourse(courseOfferingId);
      if (requestId === requestIdRef.current) {
        setTopics(sortTopics(fetched));
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        console.error('Failed to load topics', err);
        setError('Could not load topics for this course.');
        setTopics([]);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [courseOfferingId]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const createTopic = useCallback(
    async (name: string) => {
      if (!courseOfferingId) {
        throw new Error('Course offering is not defined.');
      }

      const created = await api.createTopic(courseOfferingId, { name });
      setTopics((prev) => sortTopics([...prev, created]));
      return created;
    },
    [courseOfferingId],
  );

  const refresh = useCallback(async () => {
    await loadTopics();
  }, [loadTopics]);

  return {
    topics,
    loading,
    error,
    refresh,
    createTopic,
  };
}

const CourseTopicsContext = createContext<CourseTopicsState | null>(null);

type CourseTopicsProviderProps = {
  value: CourseTopicsState;
  children: ReactNode;
};

export function CourseTopicsProvider({ value, children }: CourseTopicsProviderProps) {
  return <CourseTopicsContext.Provider value={value}>{children}</CourseTopicsContext.Provider>;
}

export function useCourseTopicsContext() {
  const context = useContext(CourseTopicsContext);
  if (!context) {
    throw new Error('useCourseTopicsContext must be used within a CourseTopicsProvider.');
  }
  return context;
}
