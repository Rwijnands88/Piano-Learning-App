import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ProgressRecord } from '../types';

type ProgressState = {
  completedLessonIds: Set<string>;
  loading: boolean;
  error: string;
  markCompleted: (lessonId: string) => Promise<void>;
};

export const useProgress = (userId?: string): ProgressState => {
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(db && userId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db || !userId) {
      setRecords([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    return onSnapshot(
      collection(db, 'users', userId, 'progress'),
      (snapshot) => {
        setRecords(snapshot.docs.map((item) => item.data() as ProgressRecord));
        setLoading(false);
        setError('');
      },
      () => {
        setError('Voortgang kon niet geladen worden.');
        setLoading(false);
      },
    );
  }, [userId]);

  const completedLessonIds = useMemo(
    () => new Set(records.filter((record) => record.completed).map((record) => record.lessonId)),
    [records],
  );

  const markCompleted = async (lessonId: string) => {
    if (!db || !userId) {
      return;
    }

    await setDoc(doc(db, 'users', userId, 'progress', lessonId), {
      lessonId,
      completed: true,
      completedAt: serverTimestamp(),
    });
  };

  return { completedLessonIds, loading, error, markCompleted };
};
