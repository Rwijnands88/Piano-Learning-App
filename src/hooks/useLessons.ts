import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { defaultLessons } from '../data/defaultLessons';
import { db } from '../lib/firebase';
import type { Lesson } from '../types';

type LessonsState = {
  lessons: Lesson[];
  loading: boolean;
  source: 'firestore' | 'bundled';
  error: string;
};

const normalizeLesson = (id: string, data: Record<string, unknown>): Lesson => ({
  id,
  title: String(data.title ?? 'Naamloze les'),
  description: String(data.description ?? ''),
  order: Number(data.order ?? 0),
  module: String(data.module ?? 'Lessen'),
  steps: Array.isArray(data.steps)
    ? data.steps.map((step) => {
        const source = step as Record<string, unknown>;
        return {
          text: String(source.text ?? ''),
          keys: Array.isArray(source.keys) ? source.keys : [],
          expectedNote: typeof source.expectedNote === 'string' ? source.expectedNote : undefined,
        };
      }) as Lesson['steps']
    : [],
});

export const useLessons = (): LessonsState => {
  const [state, setState] = useState<LessonsState>({
    lessons: defaultLessons,
    loading: Boolean(db),
    source: 'bundled',
    error: '',
  });

  useEffect(() => {
    const firestore = db;

    if (!firestore) {
      setState({ lessons: defaultLessons, loading: false, source: 'bundled', error: '' });
      return;
    }

    let cancelled = false;

    const loadLessons = async () => {
      try {
        const snapshot = await getDocs(query(collection(firestore, 'lessons'), orderBy('order', 'asc')));
        if (cancelled) {
          return;
        }

        const lessons = snapshot.docs.map((doc) => normalizeLesson(doc.id, doc.data()));
        setState({
          lessons: lessons.length > 0 ? lessons : defaultLessons,
          loading: false,
          source: lessons.length > 0 ? 'firestore' : 'bundled',
          error: '',
        });
      } catch {
        if (!cancelled) {
          setState({
            lessons: defaultLessons,
            loading: false,
            source: 'bundled',
            error: 'Firestore-lessen konden niet geladen worden; lokale lessen zijn actief.',
          });
        }
      }
    };

    void loadLessons();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
