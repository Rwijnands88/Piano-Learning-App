import { Piano, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { HomeScreen } from './components/HomeScreen';
import { LessonCompleteScreen } from './components/LessonCompleteScreen';
import { LessonIntroScreen } from './components/LessonIntroScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useProgress } from './hooks/useProgress';
import { hasFirebaseConfig } from './lib/firebase';
import { playPianoNote } from './lib/pianoSynth';
import { preloadVexFlow } from './lib/vexflowLoader';
import { lessonSupportsAutoplay } from './music/scoreTimeline';
import type { FeedbackState, LearningMode, PianoKeyName, PracticeNoteFeedback, PracticeNoteFeedbackKind, PracticeProfile } from './types';

const initialFeedback: FeedbackState = {
  tone: 'idle',
  message: 'Kies een les. Tijdens het oefenen zie je steeds een kort speeldoel.',
};

const storedPracticeProfile = (): PracticeProfile => {
  const stored = window.localStorage.getItem('practice-profile');
  if (stored === 'ipad-light' || stored === 'ivory-light' || stored === 'premium') {
    return stored;
  }

  const compactTablet = window.innerWidth <= 1100 && window.innerHeight <= 820 && window.matchMedia('(pointer: coarse)').matches;
  return compactTablet ? 'ipad-light' : 'premium';
};

const LearningApp = () => {
  const auth = useAuth();
  const { lessons, source, error: lessonError } = useLessons(Boolean(auth.user));
  const progress = useProgress(auth.user?.uid);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [screen, setScreen] = useState<'home' | 'intro' | 'practice' | 'complete'>('home');
  const [mode, setMode] = useState<LearningMode>('listen');
  const [practiceProfile, setPracticeProfile] = useState<PracticeProfile>(storedPracticeProfile);
  const [feedback, setFeedback] = useState<FeedbackState>(initialFeedback);
  const [noteFeedback, setNoteFeedback] = useState<PracticeNoteFeedback>({
    kind: 'pending',
    stepIndex: 0,
    message: 'Kies een les.',
    pulseId: 0,
  });
  const [manualDetectedNote, setManualDetectedNote] = useState<PianoKeyName | null>(null);
  const [completedSessionLessons, setCompletedSessionLessons] = useState<Set<string>>(new Set());
  const lastAcceptedNoteRef = useRef<string>('');
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const noteFeedbackPulseRef = useRef(0);

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0],
    [lessons, selectedLessonId],
  );
  const selectedLessonIndex = useMemo(
    () => lessons.findIndex((lesson) => lesson.id === selectedLesson?.id),
    [lessons, selectedLesson?.id],
  );

  const currentStep = selectedLesson?.steps[Math.min(stepIndex, Math.max(selectedLesson.steps.length - 1, 0))];
  const expectedStepNote = currentStep?.expectedNote ?? currentStep?.keys[0];
  const canMatchWithMicrophone =
    currentStep?.recognitionMode !== 'manual-score' &&
    currentStep?.recognitionMode !== 'chord' &&
    Boolean(expectedStepNote);
  const lessonCompleted = Boolean(selectedLesson && completedSessionLessons.has(selectedLesson.id));
  const selectedLessonAutoPlayable = Boolean(selectedLesson && lessonSupportsAutoplay(selectedLesson));
  const nextLesson = lessons[selectedLessonIndex + 1];
  const displayedCompletedLessonIds = useMemo(
    () => new Set([...progress.completedLessonIds, ...completedSessionLessons]),
    [completedSessionLessons, progress.completedLessonIds],
  );

  const pitch = usePitchDetection(
    mode,
    Boolean(auth.user && currentStep && canMatchWithMicrophone && !lessonCompleted && screen === 'practice'),
  );
  const displayedDetectedNote = mode === 'manual' ? manualDetectedNote : pitch.detectedNote;

  useEffect(() => {
    window.localStorage.setItem('practice-profile', practiceProfile);
  }, [practiceProfile]);

  const publishNoteFeedback = (
    kind: PracticeNoteFeedbackKind,
    message: string,
    detectedNote: PianoKeyName | null = null,
  ) => {
    const expected = currentStep?.expectedNote ?? currentStep?.keys[0];

    setNoteFeedback({
      kind,
      stepIndex,
      expectedNote: expected,
      detectedNote,
      message,
      pulseId: (noteFeedbackPulseRef.current += 1),
    });
  };

  const changeMode = (nextMode: LearningMode) => {
    if (nextMode === 'listen') {
      pitch.resetError();
      setManualDetectedNote(null);
    } else {
      setFeedback({ tone: 'idle', message: 'Handmatig: speel op je piano in je eigen tempo.' });
    }

    setMode(nextMode);
  };

  const openLessonIntro = (lessonId = selectedLesson?.id) => {
    const lessonToStart = lessons.find((lesson) => lesson.id === lessonId) ?? selectedLesson;

    if (lessonToStart) {
      setSelectedLessonId(lessonToStart.id);
      setCompletedSessionLessons((items) => {
        const next = new Set(items);
        next.delete(lessonToStart.id);
        return next;
      });
    }

    setStepIndex(0);
    lastAcceptedNoteRef.current = '';
    setManualDetectedNote(null);
    setFeedback(initialFeedback);
    preloadVexFlow();
    setScreen('intro');
  };

  const beginPractice = () => {
    if (!selectedLesson) {
      return;
    }

    setStepIndex(0);
    lastAcceptedNoteRef.current = '';
    setManualDetectedNote(null);
    setFeedback({ tone: 'idle', message: 'Oefening gestart.' });
    preloadVexFlow();
    setScreen('practice');
  };

  useEffect(() => {
    if (!currentStep || screen !== 'practice') {
      return;
    }

    const expected = currentStep.expectedNote ?? currentStep.keys[0];
    const nextKind: PracticeNoteFeedbackKind = currentStep.keys.length === 0 ? 'pending' : 'active';
    const label = expected?.replace('#', '♯') ?? 'rust';

    setNoteFeedback({
      kind: nextKind,
      stepIndex,
      expectedNote: expected,
      detectedNote: null,
      message: currentStep.keys.length === 0 ? 'Tel de rust rustig door.' : `Speel ${label}.`,
      pulseId: (noteFeedbackPulseRef.current += 1),
    });
  }, [currentStep, screen, selectedLessonId, stepIndex]);

  useEffect(() => {
    if (screen === 'practice' && pitch.permissionDenied) {
      setMode('manual');
      setFeedback({ tone: 'warning', message: pitch.error || 'Microfoon geweigerd. Handmatige modus is actief.' });
      publishNoteFeedback('late', 'Handmatige modus is actief.');
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
          ? 'Lees de rust of telstap en ga verder wanneer je klaar bent.'
          : currentStep.recognitionMode === 'chord'
            ? 'Akkoorden worden visueel begeleid. Speel het akkoord en ga verder wanneer het goed voelt.'
          : pitch.isListening
            ? 'Luistert naar je piano.'
            : 'Microfoon wordt gestart...',
    });
  }, [currentStep, expectedStepNote, lessonCompleted, mode, pitch.isListening, screen, selectedLessonId, stepIndex]);

  useEffect(() => {
    if (
      !currentStep ||
      mode !== 'listen' ||
      !pitch.detectedNote ||
      !expectedStepNote ||
      !canMatchWithMicrophone ||
      lessonCompleted ||
      screen !== 'practice'
    ) {
      return;
    }

    const attemptKey = `${selectedLesson?.id}-${stepIndex}-${pitch.detectedNote}`;

    if (attemptKey === lastAcceptedNoteRef.current) {
      return;
    }

    if (pitch.detectedNote === expectedStepNote) {
      lastAcceptedNoteRef.current = attemptKey;
      setFeedback({
        tone: 'success',
        message: selectedLessonAutoPlayable
          ? `${pitch.detectedNote.replace('#', '♯')} klopt. Blijf in de puls.`
          : `${pitch.detectedNote.replace('#', '♯')} klopt. Door naar de volgende stap.`,
      });
      publishNoteFeedback('correct', `Goed: ${pitch.detectedNote.replace('#', '♯')}.`, pitch.detectedNote);

      if (!selectedLessonAutoPlayable) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          goNext();
        }, 650);
      }
    } else {
      setFeedback({
        tone: 'error',
        message: `${pitch.detectedNote.replace('#', '♯')} gehoord. Probeer ${expectedStepNote.replace('#', '♯')}.`,
      });
      publishNoteFeedback(
        'wrong',
        `${pitch.detectedNote.replace('#', '♯')} gehoord, probeer ${expectedStepNote.replace('#', '♯')}.`,
        pitch.detectedNote,
      );
    }
  }, [
    canMatchWithMicrophone,
    currentStep,
    expectedStepNote,
    lessonCompleted,
    mode,
    pitch.detectedNote,
    screen,
    selectedLessonAutoPlayable,
    selectedLesson?.id,
    stepIndex,
  ]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const markLessonCompleted = (lessonId: string) => {
    setCompletedSessionLessons((items) => new Set(items).add(lessonId));
    void progress.markCompleted(lessonId);
  };

  const resetLessonProgress = async (lessonId: string) => {
    setCompletedSessionLessons((items) => {
      const next = new Set(items);
      next.delete(lessonId);
      return next;
    });
    await progress.resetCompleted(lessonId);
  };

  const resetAllProgress = async () => {
    setCompletedSessionLessons(new Set());
    await progress.resetAll();
  };

  const setPracticeStep = (nextStepIndex: number) => {
    if (!selectedLesson) {
      return;
    }

    const boundedStep = Math.max(0, Math.min(nextStepIndex, selectedLesson.steps.length - 1));
    setStepIndex(boundedStep);
  };

  const completeCurrentLesson = () => {
    if (!selectedLesson || lessonCompleted) {
      setScreen('complete');
      return;
    }

    setManualDetectedNote(null);
    lastAcceptedNoteRef.current = '';
    markLessonCompleted(selectedLesson.id);
    setFeedback({ tone: 'success', message: 'Les afgerond. Je voortgang is opgeslagen.' });
    setScreen('complete');
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

    if (lessonCompleted) {
      setScreen('complete');
      return;
    }

    if (stepIndex >= selectedLesson.steps.length - 1) {
      markLessonCompleted(selectedLesson.id);
      setFeedback({ tone: 'success', message: 'Les afgerond. Je voortgang is opgeslagen.' });
      setScreen('complete');
      return;
    }

    setStepIndex((index) => index + 1);
    if (mode === 'manual') {
      setFeedback({ tone: 'idle', message: 'Nieuwe stap klaar. Speel hem rustig op je piano.' });
    }
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

  const repeatLesson = () => {
    if (selectedLesson) {
      openLessonIntro(selectedLesson.id);
    }
  };

  const openNextLessonIntro = () => {
    if (nextLesson) {
      openLessonIntro(nextLesson.id);
      return;
    }

    setScreen('home');
  };

  const handleManualKeyPress = (note: PianoKeyName) => {
    if (!currentStep || mode !== 'manual' || lessonCompleted || screen !== 'practice') {
      return;
    }

    void playPianoNote(note);
    setManualDetectedNote(note);

    const expected = currentStep.expectedNote ?? currentStep.keys[0];
    if (!expected) {
      setFeedback({ tone: 'idle', message: `${note.replace('#', '♯')} gespeeld.` });
      publishNoteFeedback('active', `${note.replace('#', '♯')} gespeeld.`, note);
      return;
    }

    if (note === expected) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }

      setFeedback({ tone: 'success', message: `${note.replace('#', '♯')} klopt. Door naar de volgende stap.` });
      publishNoteFeedback('correct', `Goed: ${note.replace('#', '♯')}.`, note);
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        goNext();
      }, 450);
      return;
    }

    setFeedback({
      tone: 'error',
      message: `${note.replace('#', '♯')} gekozen. Probeer ${expected.replace('#', '♯')}.`,
    });
    publishNoteFeedback('wrong', `${note.replace('#', '♯')} gekozen, probeer ${expected.replace('#', '♯')}.`, note);
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
    <main className="app-shell" data-practice-profile={practiceProfile}>
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
          onResetAllProgress={resetAllProgress}
          onResetLessonProgress={resetLessonProgress}
          onPracticeProfileChange={setPracticeProfile}
          onStartLesson={openLessonIntro}
          onStartPractice={() => openLessonIntro()}
          practiceProfile={practiceProfile}
          selectedLessonId={selectedLesson.id}
          source={source}
          userName={auth.user.displayName}
        />
      ) : screen === 'intro' ? (
        <LessonIntroScreen
          lesson={selectedLesson}
          mode={mode}
          onBackHome={() => setScreen('home')}
          onModeChange={changeMode}
          onStart={beginPractice}
        />
      ) : screen === 'complete' ? (
        <LessonCompleteScreen
          completedCount={displayedCompletedLessonIds.size}
          lesson={selectedLesson}
          nextLesson={nextLesson}
          onBackHome={() => setScreen('home')}
          onNextLesson={openNextLessonIntro}
          onRepeat={repeatLesson}
          totalLessons={lessons.length}
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
          noteFeedback={noteFeedback}
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
          onTransportComplete={completeCurrentLesson}
          onTransportStepChange={setPracticeStep}
          practiceProfile={practiceProfile}
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
