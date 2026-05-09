import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { defaultLessons } from '../data/defaultLessons';
import { db } from '../lib/firebase';
import type { FingerNumber, Lesson, LessonStep, NoteDuration, PianoHand, PianoKeyName, RecognitionMode, StepNote } from '../types';

type LessonsState = {
  lessons: Lesson[];
  loading: boolean;
  source: 'firestore' | 'bundled' | 'mixed';
  error: string;
};

const normalizeNotes = (notes: unknown): StepNote[] | undefined => {
  if (!Array.isArray(notes)) {
    return undefined;
  }

  return notes
    .map<StepNote | null>((note) => {
      const source = note as Record<string, unknown>;
      const key = typeof source.key === 'string' ? (source.key as PianoKeyName) : undefined;

      if (!key) {
        return null;
      }

      const normalized: StepNote = { key };
      const duration = typeof source.duration === 'string' ? LessonStepDuration(source.duration) : undefined;

      if (duration) {
        normalized.duration = duration;
      }

      if (typeof source.finger === 'number' && source.finger >= 1 && source.finger <= 5) {
        normalized.finger = source.finger as FingerNumber;
      }

      if (typeof source.hand === 'string') {
        normalized.hand = source.hand as PianoHand;
      }

      if (source.rest === true) {
        normalized.rest = true;
      }

      return normalized;
    })
    .filter((note): note is StepNote => note !== null);
};

const normalizeStep = (step: unknown): LessonStep => {
  const source = step as Record<string, unknown>;
  const keys = Array.isArray(source.keys) ? (source.keys.filter((key) => typeof key === 'string') as PianoKeyName[]) : [];
  const notes = normalizeNotes(source.notes);

  return {
    text: String(source.text ?? ''),
    keys,
    expectedNote: typeof source.expectedNote === 'string' ? (source.expectedNote as PianoKeyName) : keys[0],
    notes,
    duration: typeof source.duration === 'string' ? LessonStepDuration(source.duration) : notes?.[0]?.duration,
    hand: typeof source.hand === 'string' ? (source.hand as PianoHand) : notes?.[0]?.hand,
    count: typeof source.count === 'string' ? source.count : undefined,
    coaching: typeof source.coaching === 'string' ? source.coaching : undefined,
    scoreLabel: typeof source.scoreLabel === 'string' ? source.scoreLabel : undefined,
    recognitionMode: typeof source.recognitionMode === 'string' ? (source.recognitionMode as RecognitionMode) : undefined,
  };
};

const LessonStepDuration = (duration: string): NoteDuration | undefined => {
  if (duration === 'w' || duration === 'h' || duration === 'q' || duration === '8' || duration === '16') {
    return duration;
  }

  return undefined;
};

const normalizeLesson = (id: string, data: Record<string, unknown>): Lesson => {
  const steps = Array.isArray(data.steps)
    ? data.steps.map(normalizeStep).filter((step) => step.keys.length > 0 || Boolean(step.notes?.length))
    : [];

  return {
    id,
    title: String(data.title ?? 'Naamloze les'),
    description: String(data.description ?? ''),
    order: Number(data.order ?? 0),
    module: String(data.module ?? 'Lessen'),
    steps,
    level: typeof data.level === 'string' ? data.level as Lesson['level'] : undefined,
    estimatedMinutes: typeof data.estimatedMinutes === 'number' ? data.estimatedMinutes : undefined,
    tempo: typeof data.tempo === 'number' ? data.tempo : undefined,
    timeSignature: typeof data.timeSignature === 'string' ? data.timeSignature as Lesson['timeSignature'] : undefined,
    focus: Array.isArray(data.focus) ? data.focus.filter((item) => typeof item === 'string') as string[] : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((item) => typeof item === 'string') as string[] : undefined,
    source: typeof data.source === 'string' ? data.source as Lesson['source'] : undefined,
  };
};

const mergeWithBundledLessons = (firestoreLessons: Lesson[]) => {
  const remoteById = new Map(firestoreLessons.map((lesson) => [lesson.id, lesson]));
  const bundledIds = new Set(defaultLessons.map((lesson) => lesson.id));
  const bundledWithOverrides = defaultLessons.map((lesson) => remoteById.get(lesson.id) ?? lesson);
  const customFirestoreLessons = firestoreLessons
    .filter((lesson) => !bundledIds.has(lesson.id))
    .sort((a, b) => a.order - b.order);

  return [...bundledWithOverrides, ...customFirestoreLessons];
};

export const useLessons = (enabled: boolean): LessonsState => {
  const [state, setState] = useState<LessonsState>({
    lessons: defaultLessons,
    loading: Boolean(db && enabled),
    source: 'bundled',
    error: '',
  });

  useEffect(() => {
    const firestore = db;

    if (!firestore || !enabled) {
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

        const firestoreLessons = snapshot.docs
          .map((doc) => normalizeLesson(doc.id, doc.data()))
          .filter((lesson) => lesson.steps.length > 0);
        const lessons = mergeWithBundledLessons(firestoreLessons);

        setState({
          lessons,
          loading: false,
          source: firestoreLessons.length > 0 ? 'mixed' : 'bundled',
          error: '',
        });
      } catch (caught) {
        if (!cancelled) {
          const details =
            caught instanceof FirebaseError
              ? `${caught.code}: ${caught.message}`
              : caught instanceof Error
                ? caught.message
                : 'Onbekende Firebase-fout';

          setState({
            lessons: defaultLessons,
            loading: false,
            source: 'bundled',
            error: `Firestore-lessen konden niet geladen worden; lokale lessen zijn actief. (${details})`,
          });
        }
      }
    };

    void loadLessons();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
};
