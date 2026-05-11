import { Piano, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { HomeScreen } from './components/HomeScreen';
import { LessonCompleteScreen } from './components/LessonCompleteScreen';
import { LessonIntroScreen } from './components/LessonIntroScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { prettyKeys } from './data/piano';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useProgress } from './hooks/useProgress';
import { hasFirebaseConfig } from './lib/firebase';
import { playPianoNote } from './lib/pianoSynth';
import { preloadVexFlow } from './lib/vexflowLoader';
import { lessonSupportsAutoplay } from './music/scoreTimeline';
import type { FeedbackState, LearningMode, LessonStep, PianoKeyName, PracticeNoteFeedback, PracticeNoteFeedbackKind, PracticeProfile } from './types';

const initialFeedback: FeedbackState = {
  tone: 'idle',
  message: 'Kies een les. Tijdens het oefenen zie je steeds een kort speeldoel.',
};

const prettyNote = (note: PianoKeyName) => note.replace('#', '♯');

const isChordStep = (step: LessonStep) => step.recognitionMode === 'chord' || step.keys.length > 1;

const expectedForStep = (step?: LessonStep) => step?.expectedNote ?? step?.keys[0];

const targetLabelForStep = (step: LessonStep) => {
  if (step.keys.length > 1) {
    return prettyKeys(step.keys);
  }

  return expectedForStep(step)?.replace('#', '♯') ?? 'rust';
};

const detectedNoteMatchesStep = (note: PianoKeyName, step: LessonStep) => {
  if (isChordStep(step)) {
    return step.keys.includes(note);
  }

  return note === expectedForStep(step);
};

const uniquePianoKeys = (keys: PianoKeyName[]) => Array.from(new Set(keys));

const matchingKeysForStep = (keys: PianoKeyName[], step: LessonStep) => (
  uniquePianoKeys(keys.filter((key) => detectedNoteMatchesStep(key, step)))
);

const minimumChordAttackVolume = 0.0105;
const chordStableWindowMs = 180;
const chordPartialHintCooldownMs = 1200;

const strikeQualityLabel = (volume: number) => {
  if (volume > 0 && volume < 0.008) {
    return 'zacht';
  }

  if (volume > 0.042) {
    return 'stevig';
  }

  return 'duidelijk';
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
  const completeScreenReadyAtRef = useRef(0);
  const noteFeedbackPulseRef = useRef(0);
  const chordCandidateRef = useRef<{ signature: string; since: number }>({ signature: '', since: 0 });
  const chordPartialHintRef = useRef<{ signature: string; at: number }>({ signature: '', at: 0 });

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
  const expectedStepNote = expectedForStep(currentStep);
  const canMatchWithMicrophone =
    currentStep?.recognitionMode !== 'manual-score' &&
    Boolean(expectedStepNote || currentStep?.keys.length);
  const lessonCompleted = Boolean(selectedLesson && completedSessionLessons.has(selectedLesson.id));
  const pitchTargetKeys = useMemo(() => {
    if (!currentStep || !canMatchWithMicrophone || lessonCompleted || screen !== 'practice') {
      return [];
    }

    return currentStep.keys.length > 0 ? currentStep.keys : expectedStepNote ? [expectedStepNote] : [];
  }, [canMatchWithMicrophone, currentStep, expectedStepNote, lessonCompleted, screen, selectedLesson?.id, stepIndex]);
  const selectedLessonAutoPlayable = Boolean(selectedLesson && lessonSupportsAutoplay(selectedLesson));
  const nextLesson = lessons[selectedLessonIndex + 1];
  const [listenAdvanceToNextLesson, setListenAdvanceToNextLesson] = useState(false);
  const displayedCompletedLessonIds = useMemo(
    () => new Set([...progress.completedLessonIds, ...completedSessionLessons]),
    [completedSessionLessons, progress.completedLessonIds],
  );

  const pitch = usePitchDetection(
    mode,
    Boolean(
      auth.user &&
        (
          (currentStep && canMatchWithMicrophone && !lessonCompleted && screen === 'practice') ||
          (screen === 'complete' && mode === 'listen' && listenAdvanceToNextLesson && nextLesson)
        ),
    ),
    pitchTargetKeys,
  );
  const displayedDetectedNotes = mode === 'manual'
    ? (manualDetectedNote ? [manualDetectedNote] : [])
    : (pitch.heardKeys.length > 0 ? pitch.heardKeys : pitch.detectedNote ? [pitch.detectedNote] : []);
  const displayedDetectedNote = displayedDetectedNotes[0] ?? null;

  useEffect(() => {
    window.localStorage.setItem('practice-profile', practiceProfile);
  }, [practiceProfile]);

  const publishNoteFeedback = (
    kind: PracticeNoteFeedbackKind,
    message: string,
    detectedNote: PianoKeyName | null = null,
    detectedKeys: PianoKeyName[] = detectedNote ? [detectedNote] : [],
  ) => {
    const expected = currentStep?.expectedNote ?? currentStep?.keys[0];
    const expectedKeys = currentStep?.keys.length ? currentStep.keys : expected ? [expected] : [];

    setNoteFeedback({
      kind,
      stepIndex,
      expectedNote: expected,
      expectedKeys,
      detectedNote,
      detectedKeys,
      message,
      pulseId: (noteFeedbackPulseRef.current += 1),
    });
  };

  useEffect(() => {
    chordCandidateRef.current = { signature: '', since: 0 };
    chordPartialHintRef.current = { signature: '', at: 0 };
  }, [screen, selectedLessonId, stepIndex]);

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
    setListenAdvanceToNextLesson(false);
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
    setListenAdvanceToNextLesson(false);
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
    const label = targetLabelForStep(currentStep);

    setNoteFeedback({
      kind: nextKind,
      stepIndex,
      expectedNote: expected,
      expectedKeys: currentStep.keys.length ? currentStep.keys : expected ? [expected] : [],
      detectedNote: null,
      detectedKeys: [],
      message: currentStep.keys.length === 0 ? 'Tel de rust rustig door.' : isChordStep(currentStep) ? `Speel ${label} samen.` : `Speel ${label}.`,
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
            ? `Luistert naar ${targetLabelForStep(currentStep)}. Speel het akkoord samen.`
          : pitch.isListening
            ? 'Luistert naar je piano.'
            : 'Microfoon wordt gestart...',
    });
  }, [currentStep, expectedStepNote, lessonCompleted, mode, pitch.isListening, screen, selectedLessonId, stepIndex]);

  useEffect(() => {
    if (
      !currentStep ||
      mode !== 'listen' ||
      (!pitch.detectedNote && pitch.heardKeys.length === 0) ||
      !canMatchWithMicrophone ||
      lessonCompleted ||
      screen !== 'practice'
    ) {
      return;
    }

    const matchedTargetKeys = matchingKeysForStep(pitch.heardKeys, currentStep);
    const detectedNote = pitch.detectedNote;
    const chordStep = isChordStep(currentStep);
    const matchedDetectedNote =
      !chordStep && detectedNote && detectedNoteMatchesStep(detectedNote, currentStep) ? detectedNote : null;
    const matchedKeys = uniquePianoKeys([
      ...matchedTargetKeys,
      ...(matchedDetectedNote ? [matchedDetectedNote] : []),
    ]);
    const attemptKeys = uniquePianoKeys([
      ...matchedKeys,
      ...(detectedNote ? [detectedNote] : []),
      ...(pitch.strongestTargetNote ? [pitch.strongestTargetNote] : []),
    ]);
    const attemptKey = `${selectedLesson?.id}-${stepIndex}-${attemptKeys.join('-') || 'signal'}-${Math.round(pitch.targetConfidence * 20)}`;

    if (attemptKey === lastAcceptedNoteRef.current) {
      return;
    }

    const targetLabel = targetLabelForStep(currentStep);
    const strikeLabel = strikeQualityLabel(pitch.volume);
    const strikeHint = strikeLabel === 'zacht' ? ' Speel iets duidelijker voor een betrouwbaarder signaal.' : '';
    const previousStep = selectedLessonAutoPlayable ? selectedLesson?.steps[stepIndex - 1] : undefined;
    const nextStep = selectedLessonAutoPlayable ? selectedLesson?.steps[stepIndex + 1] : undefined;
    const primaryAttemptNote = matchedKeys[0] ?? detectedNote;
    const confidenceByKey = new Map(pitch.targetAnalysis.map((item) => [item.key, item.confidence]));
    const matchedConfidence =
      matchedKeys.length > 0
        ? matchedKeys.reduce((total, key) => total + (confidenceByKey.get(key) ?? 0.5), 0) / matchedKeys.length
        : 0;
    const chordAttackReady = pitch.volume >= minimumChordAttackVolume && pitch.targetConfidence >= 0.56;
    const chordReady =
      chordStep &&
      chordAttackReady &&
      (
        currentStep.keys.length <= 2
          ? matchedKeys.length === currentStep.keys.length
          : matchedKeys.length === currentStep.keys.length || (matchedKeys.length >= 2 && matchedConfidence >= 0.62)
      );

    const timingLagMatch =
      selectedLessonAutoPlayable &&
      detectedNote !== null &&
      !detectedNoteMatchesStep(detectedNote, currentStep) &&
      Boolean(previousStep && detectedNoteMatchesStep(detectedNote, previousStep));
    const timingEarlyMatch =
      selectedLessonAutoPlayable &&
      detectedNote !== null &&
      !detectedNoteMatchesStep(detectedNote, currentStep) &&
      Boolean(nextStep && detectedNoteMatchesStep(detectedNote, nextStep));

    if (chordStep) {
      const now = performance.now();

      if (!chordAttackReady) {
        chordCandidateRef.current = { signature: '', since: 0 };
        return;
      }

      if (!chordReady) {
        chordCandidateRef.current = { signature: '', since: 0 };

        if (matchedKeys.length > 0) {
          const missingKeys = currentStep.keys.filter((key) => !matchedKeys.includes(key));
          const hintSignature = `${selectedLesson?.id}-${stepIndex}-${matchedKeys.join('-')}-${missingKeys.join('-')}`;

          if (
            hintSignature !== chordPartialHintRef.current.signature ||
            now - chordPartialHintRef.current.at > chordPartialHintCooldownMs
          ) {
            chordPartialHintRef.current = { signature: hintSignature, at: now };
            setFeedback({
              tone: 'listening',
              message: `Ik hoor ${prettyKeys(matchedKeys)}. Zoek rustig ${prettyKeys(missingKeys)} erbij.${strikeHint}`,
            });
          }
        }

        return;
      }

      const chordSignature = `${selectedLesson?.id}-${stepIndex}-${matchedKeys.join('-')}`;

      if (chordCandidateRef.current.signature !== chordSignature) {
        chordCandidateRef.current = { signature: chordSignature, since: now };
        return;
      }

      if (now - chordCandidateRef.current.since < chordStableWindowMs) {
        return;
      }
    }

    if ((chordStep && chordReady && primaryAttemptNote) || (!chordStep && matchedKeys.length > 0 && primaryAttemptNote)) {
      lastAcceptedNoteRef.current = attemptKey;
      setFeedback({
        tone: 'success',
        message: chordStep
          ? `Akkoord ${targetLabel} herkend. Aanslag: ${strikeLabel}.${strikeHint}`
          : selectedLessonAutoPlayable
            ? `${prettyNote(primaryAttemptNote)} klopt. Aanslag: ${strikeLabel}. Blijf in de puls.${strikeHint}`
            : `${prettyNote(primaryAttemptNote)} klopt. Aanslag: ${strikeLabel}. Door naar de volgende stap.${strikeHint}`,
      });
      publishNoteFeedback(
        'correct',
        chordStep ? `Akkoord: ${prettyKeys(matchedKeys)} · ${strikeLabel}.` : `Goed: ${prettyNote(primaryAttemptNote)} · ${strikeLabel}.`,
        primaryAttemptNote,
        matchedKeys.length > 0 ? matchedKeys : [primaryAttemptNote],
      );

      if (!selectedLessonAutoPlayable) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          goNext();
        }, 650);
      }
    } else if (timingLagMatch) {
      lastAcceptedNoteRef.current = attemptKey;
      setFeedback({
        tone: 'success',
        message: `${detectedNote ? prettyNote(detectedNote) : 'De noot'} klopt. De microfoon hoorde hem net later.`,
      });
      publishNoteFeedback('correct', `Goed: ${detectedNote ? prettyNote(detectedNote) : targetLabel}.`, detectedNote, detectedNote ? [detectedNote] : []);
    } else if (timingEarlyMatch) {
      lastAcceptedNoteRef.current = attemptKey;
      setFeedback({
        tone: 'warning',
        message: `${detectedNote ? prettyNote(detectedNote) : 'De noot'} is net vroeg. Wacht op de gloed.`,
      });
      publishNoteFeedback(
        'late',
        `${detectedNote ? prettyNote(detectedNote) : targetLabel} net vroeg.`,
        detectedNote,
        detectedNote ? [detectedNote] : [],
      );
    } else if (detectedNote) {
      setFeedback({
        tone: 'error',
        message: `${prettyNote(detectedNote)} gehoord. Probeer ${targetLabel}.`,
      });
      publishNoteFeedback(
        'wrong',
        `${prettyNote(detectedNote)} gehoord, probeer ${targetLabel}.`,
        detectedNote,
        [detectedNote],
      );
    }
  }, [
    canMatchWithMicrophone,
    currentStep,
    expectedStepNote,
    lessonCompleted,
    mode,
    pitch.detectedNote,
    pitch.heardKeys,
    pitch.strongestTargetNote,
    pitch.targetAnalysis,
    pitch.targetConfidence,
    pitch.volume,
    screen,
    selectedLessonAutoPlayable,
    selectedLesson?.id,
    selectedLesson?.steps,
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
    setListenAdvanceToNextLesson(mode === 'listen' && Boolean(nextLesson));
    completeScreenReadyAtRef.current = performance.now() + 900;

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
      setListenAdvanceToNextLesson(mode === 'listen' && Boolean(nextLesson));
      completeScreenReadyAtRef.current = performance.now() + 900;
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
    setListenAdvanceToNextLesson(false);
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

  useEffect(() => {
    if (
      screen !== 'complete' ||
      mode !== 'listen' ||
      !listenAdvanceToNextLesson ||
      !nextLesson ||
      !pitch.detectedNote
    ) {
      return;
    }

    if (performance.now() < completeScreenReadyAtRef.current) {
      return;
    }

    const attemptKey = `complete-${selectedLesson?.id}-${pitch.detectedNote}`;
    if (attemptKey === lastAcceptedNoteRef.current) {
      return;
    }

    lastAcceptedNoteRef.current = attemptKey;
    setFeedback({ tone: 'idle', message: `${prettyNote(pitch.detectedNote)} gehoord. Volgende les geopend.` });
    openLessonIntro(nextLesson.id);
  }, [
    listenAdvanceToNextLesson,
    mode,
    nextLesson,
    pitch.detectedNote,
    screen,
    selectedLesson?.id,
  ]);

  const handleManualKeyPress = (note: PianoKeyName) => {
    if (!currentStep || mode !== 'manual' || lessonCompleted || screen !== 'practice') {
      return;
    }

    void playPianoNote(note);
    setManualDetectedNote(note);

    const expected = expectedForStep(currentStep);
    const targetLabel = targetLabelForStep(currentStep);
    const chordStep = isChordStep(currentStep);
    if (!expected) {
      setFeedback({ tone: 'idle', message: `${prettyNote(note)} gespeeld.` });
      publishNoteFeedback('active', `${prettyNote(note)} gespeeld.`, note);
      return;
    }

    if (detectedNoteMatchesStep(note, currentStep)) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }

      setFeedback({
        tone: 'success',
        message: chordStep
          ? `Akkoordtoon ${prettyNote(note)} gekozen in ${targetLabel}.`
          : selectedLessonAutoPlayable
            ? `${prettyNote(note)} klopt. Blijf in de puls.`
            : `${prettyNote(note)} klopt. Door naar de volgende stap.`,
      });
      publishNoteFeedback('correct', chordStep ? `Akkoordtoon: ${prettyNote(note)}.` : `Goed: ${prettyNote(note)}.`, note);

      if (!selectedLessonAutoPlayable) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          goNext();
        }, 450);
      }
      return;
    }

    setFeedback({
      tone: 'error',
      message: `${prettyNote(note)} gekozen. Probeer ${targetLabel}.`,
    });
    publishNoteFeedback('wrong', `${prettyNote(note)} gekozen, probeer ${targetLabel}.`, note);
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
          canAdvanceWithPiano={mode === 'listen' && listenAdvanceToNextLesson && Boolean(nextLesson)}
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
          detectedNotes={displayedDetectedNotes}
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
