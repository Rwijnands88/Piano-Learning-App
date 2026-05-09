import { Piano, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { HomeScreen } from './components/HomeScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useProgress } from './hooks/useProgress';
import { hasFirebaseConfig } from './lib/firebase';
import { preloadVexFlow } from './lib/vexflowLoader';
import type { FeedbackState, LearningMode, PianoKeyName } from './types';

const initialFeedback: FeedbackState = {
  tone: 'idle',
  message: 'Kies een les en speel de gemarkeerde toets of ga handmatig verder.',
};

const LearningApp = () => {
  const auth = useAuth();
  const { lessons, source, error: lessonError } = useLessons(Boolean(auth.user));
  const progress = useProgress(auth.user?.uid);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [screen, setScreen] = useState<'home' | 'practice'>('home');
  const [mode, setMode] = useState<LearningMode>('listen');
  const [feedback, setFeedback] = useState<FeedbackState>(initialFeedback);
  const [manualDetectedNote, setManualDetectedNote] = useState<PianoKeyName | null>(null);
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
  const expectedStepNote = currentStep?.expectedNote ?? currentStep?.keys[0];
  const lessonCompleted = Boolean(selectedLesson && completedSessionLessons.has(selectedLesson.id));
  const displayedCompletedLessonIds = useMemo(
    () => new Set([...progress.completedLessonIds, ...completedSessionLessons]),
    [completedSessionLessons, progress.completedLessonIds],
  );

  const pitch = usePitchDetection(mode, Boolean(auth.user && currentStep && !lessonCompleted && screen === 'practice'));
  const displayedDetectedNote = mode === 'manual' ? manualDetectedNote : pitch.detectedNote;

  const changeMode = (nextMode: LearningMode) => {
    if (nextMode === 'listen') {
      pitch.resetError();
      setManualDetectedNote(null);
    } else {
      setFeedback({ tone: 'idle', message: 'Handmatige modus is actief. Tik de gemarkeerde toets op het scherm.' });
    }

    setMode(nextMode);
  };

  const startPractice = () => {
    preloadVexFlow();
    setScreen('practice');
  };

  useEffect(() => {
    if (screen === 'practice' && pitch.permissionDenied) {
      setMode('manual');
      setFeedback({ tone: 'warning', message: pitch.error || 'Microfoon geweigerd. Handmatige modus is actief.' });
    }
  }, [pitch.error, pitch.permissionDenied, screen]);

  useEffect(() => {
    if (!currentStep || mode !== 'listen' || lessonCompleted || screen !== 'practice') {
      return;
    }

    setFeedback({
      tone: pitch.isListening ? 'listening' : 'idle',
      message:
        currentStep.recognitionMode === 'manual-score' || !expectedStepNote
          ? 'Lees- of telstap. Gebruik Volgende wanneer je klaar bent.'
          : pitch.isListening
            ? 'Luistermodus is actief. Speel de gemarkeerde toets.'
            : 'Microfoon wordt gestart...',
    });
  }, [currentStep, expectedStepNote, lessonCompleted, mode, pitch.isListening, screen, selectedLessonId, stepIndex]);

  useEffect(() => {
    if (!currentStep || mode !== 'listen' || !pitch.detectedNote || !expectedStepNote || lessonCompleted || screen !== 'practice') {
      return;
    }

    const attemptKey = `${selectedLesson?.id}-${stepIndex}-${pitch.detectedNote}`;

    if (attemptKey === lastAcceptedNoteRef.current) {
      return;
    }

    if (pitch.detectedNote === expectedStepNote) {
      lastAcceptedNoteRef.current = attemptKey;
      setFeedback({ tone: 'success', message: `${pitch.detectedNote.replace('#', '♯')} klopt. Door naar de volgende stap.` });
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        goNext();
      }, 650);
    } else {
      setFeedback({
        tone: 'error',
        message: `${pitch.detectedNote.replace('#', '♯')} gehoord. Probeer ${expectedStepNote.replace('#', '♯')}.`,
      });
    }
  }, [currentStep, expectedStepNote, lessonCompleted, mode, pitch.detectedNote, screen, selectedLesson?.id, stepIndex]);

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
    setManualDetectedNote(null);
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
    if (mode === 'manual') {
      setFeedback({ tone: 'idle', message: 'Tik de gemarkeerde toets op het scherm.' });
    }
  };

  const selectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setStepIndex(0);
    lastAcceptedNoteRef.current = '';
    setManualDetectedNote(null);
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
    setManualDetectedNote(null);
    setFeedback({ tone: 'idle', message: 'Les opnieuw gestart.' });
    if (selectedLesson) {
      setCompletedSessionLessons((items) => {
        const next = new Set(items);
        next.delete(selectedLesson.id);
        return next;
      });
    }
  };

  const handleManualKeyPress = (note: PianoKeyName) => {
    if (!currentStep || mode !== 'manual' || lessonCompleted || screen !== 'practice') {
      return;
    }

    const expected = currentStep.expectedNote ?? currentStep.keys[0];
    if (!expected) {
      return;
    }
    setManualDetectedNote(note);

    if (note === expected) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }

      setFeedback({ tone: 'success', message: `${note.replace('#', '♯')} klopt. Door naar de volgende stap.` });
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        goNext();
      }, 450);
      return;
    }

    setFeedback({
      tone: 'error',
      message: `${note.replace('#', '♯')} gekozen. Probeer ${expected.replace('#', '♯')}.`,
    });
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
      <div className="portrait-gate">
        <Piano aria-hidden="true" />
        <strong>Draai je tablet naar landscape</strong>
        <span>De lesruimte en het toetsenbord zijn ontworpen voor horizontaal gebruik naast je piano.</span>
      </div>

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

      {screen === 'home' ? (
        <HomeScreen
          completedLessonIds={displayedCompletedLessonIds}
          lessons={lessons}
          onLogOut={auth.logOut}
          onPreparePractice={preloadVexFlow}
          onSelectLesson={selectLesson}
          onStartPractice={startPractice}
          selectedLessonId={selectedLesson.id}
          source={source}
          userEmail={auth.user.email}
        />
      ) : (
        <PracticeScreen
          canGoBack={stepIndex > 0}
          completed={lessonCompleted}
          detectedNote={displayedDetectedNote}
          feedback={feedback}
          isListening={pitch.isListening}
          lesson={selectedLesson}
          mode={mode}
          onBackHome={() => setScreen('home')}
          onKeyPress={handleManualKeyPress}
          onModeChange={changeMode}
          onNextStep={goNext}
          onPreviousStep={() => {
            lastAcceptedNoteRef.current = '';
            setManualDetectedNote(null);
            setStepIndex((index) => Math.max(0, index - 1));
          }}
          onRestart={restartLesson}
          step={currentStep}
          stepIndex={stepIndex}
        />
      )}
    </main>
  );
};

export const App = () => {
  return <LearningApp />;
};
