import { LogOut, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { LessonList } from './components/LessonList';
import { LessonStage } from './components/LessonStage';
import { ModeToggle } from './components/ModeToggle';
import { PianoKeyboard } from './components/PianoKeyboard';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useProgress } from './hooks/useProgress';
import { hasFirebaseConfig } from './lib/firebase';
import type { FeedbackState, LearningMode } from './types';

const initialFeedback: FeedbackState = {
  tone: 'idle',
  message: 'Kies een les en speel de gemarkeerde toets of ga handmatig verder.',
};

export const App = () => {
  const auth = useAuth();
  const { lessons, source, error: lessonError } = useLessons(Boolean(auth.user));
  const progress = useProgress(auth.user?.uid);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<LearningMode>('listen');
  const [feedback, setFeedback] = useState<FeedbackState>(initialFeedback);
  const [completedSessionLessons, setCompletedSessionLessons] = useState<Set<string>>(new Set());
  const lastAcceptedNoteRef = useRef<string>('');
  const autoAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0],
    [lessons, selectedLessonId],
  );

  const currentStep = selectedLesson?.steps[Math.min(stepIndex, Math.max(selectedLesson.steps.length - 1, 0))];
  const lessonCompleted = Boolean(selectedLesson && completedSessionLessons.has(selectedLesson.id));
  const displayedCompletedLessonIds = useMemo(
    () => new Set([...progress.completedLessonIds, ...completedSessionLessons]),
    [completedSessionLessons, progress.completedLessonIds],
  );

  const pitch = usePitchDetection(mode, Boolean(auth.user && currentStep && !lessonCompleted));

  const changeMode = (nextMode: LearningMode) => {
    if (nextMode === 'listen') {
      pitch.resetError();
    }

    setMode(nextMode);
  };

  useEffect(() => {
    if (pitch.permissionDenied) {
      setMode('manual');
      setFeedback({ tone: 'warning', message: pitch.error || 'Microfoon geweigerd. Handmatige modus is actief.' });
    }
  }, [pitch.error, pitch.permissionDenied]);

  useEffect(() => {
    if (!currentStep || mode !== 'listen' || lessonCompleted) {
      return;
    }

    setFeedback({
      tone: pitch.isListening ? 'listening' : 'idle',
      message: pitch.isListening ? 'Luistermodus is actief. Speel de gemarkeerde toets.' : 'Microfoon wordt gestart...',
    });
  }, [currentStep, lessonCompleted, mode, pitch.isListening, selectedLessonId, stepIndex]);

  useEffect(() => {
    if (!currentStep || mode !== 'listen' || !pitch.detectedNote || lessonCompleted) {
      return;
    }

    const expected = currentStep.expectedNote ?? currentStep.keys[0];
    const attemptKey = `${selectedLesson?.id}-${stepIndex}-${pitch.detectedNote}`;

    if (attemptKey === lastAcceptedNoteRef.current) {
      return;
    }

    if (pitch.detectedNote === expected) {
      lastAcceptedNoteRef.current = attemptKey;
      setFeedback({ tone: 'success', message: `${pitch.detectedNote.replace('#', '♯')} klopt. Door naar de volgende stap.` });
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        goNext();
      }, 650);
    } else {
      setFeedback({
        tone: 'error',
        message: `${pitch.detectedNote.replace('#', '♯')} gehoord. Probeer ${expected.replace('#', '♯')}.`,
      });
    }
  }, [currentStep, lessonCompleted, mode, pitch.detectedNote, selectedLesson?.id, stepIndex]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const completeLesson = async () => {
    if (!selectedLesson) {
      return;
    }

    setCompletedSessionLessons((items) => new Set(items).add(selectedLesson.id));
    await progress.markCompleted(selectedLesson.id);
  };

  const goNext = () => {
    if (!selectedLesson) {
      return;
    }

    lastAcceptedNoteRef.current = '';
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (stepIndex >= selectedLesson.steps.length - 1) {
      void completeLesson();
      setFeedback({ tone: 'success', message: 'Les afgerond. Kies de volgende les in de leerlijn.' });
      return;
    }

    setStepIndex((index) => index + 1);
  };

  const selectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setStepIndex(0);
    lastAcceptedNoteRef.current = '';
    setFeedback(initialFeedback);
    setCompletedSessionLessons((items) => {
      const next = new Set(items);
      next.delete(lessonId);
      return next;
    });
  };

  const restartLesson = () => {
    setStepIndex(0);
    lastAcceptedNoteRef.current = '';
    setFeedback({ tone: 'idle', message: 'Les opnieuw gestart.' });
    if (selectedLesson) {
      setCompletedSessionLessons((items) => {
        const next = new Set(items);
        next.delete(selectedLesson.id);
        return next;
      });
    }
  };

  if (auth.loading) {
    return <main className="loading-screen">Piano Studio wordt geladen...</main>;
  }

  if (!auth.user) {
    return (
      <AuthScreen
        error={auth.error}
        loading={auth.loading}
        onRegister={auth.register}
        onSignIn={auth.signIn}
      />
    );
  }

  if (!selectedLesson || !currentStep) {
    return <main className="loading-screen">Lessen worden geladen...</main>;
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Piano Studio</p>
          <h1>Oefenen naast je piano</h1>
        </div>

        <div className="top-actions">
          <ModeToggle isListening={pitch.isListening} mode={mode} onChange={changeMode} />
          <button className="secondary-button compact" onClick={auth.logOut} type="button">
            <LogOut aria-hidden="true" />
            Uitloggen
          </button>
        </div>
      </header>

      {!hasFirebaseConfig ? (
        <div className="system-note warning">
          <WifiOff aria-hidden="true" />
          Firebase environment variables ontbreken. Vul `.env` om login en voortgang te activeren.
        </div>
      ) : null}

      {lessonError || progress.error || pitch.error ? (
        <div className="system-note">
          <WifiOff aria-hidden="true" />
          {[lessonError, progress.error, pitch.error].filter(Boolean).join(' ')}
        </div>
      ) : null}

      <div className="workspace">
        <LessonList
          completedLessonIds={displayedCompletedLessonIds}
          lessons={lessons}
          onSelect={selectLesson}
          selectedLessonId={selectedLesson.id}
        />

        <div className="practice-column">
          <div className="source-pill">{source === 'firestore' ? 'Firestore lessen' : 'Lokale lessen'}</div>
          <LessonStage
            canGoBack={stepIndex > 0}
            completed={lessonCompleted}
            detectedNote={pitch.detectedNote}
            feedback={feedback}
            lesson={selectedLesson}
            onBack={() => {
              lastAcceptedNoteRef.current = '';
              setStepIndex((index) => Math.max(0, index - 1));
            }}
            onNext={goNext}
            onRestart={restartLesson}
            step={currentStep}
            stepIndex={stepIndex}
          />
        </div>
      </div>

      <PianoKeyboard
        detectedKey={pitch.detectedNote}
        expectedKey={currentStep.expectedNote}
        lessonKeys={currentStep.keys}
      />
    </main>
  );
};
