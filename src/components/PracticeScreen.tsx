import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Hand, Mic, RotateCcw } from 'lucide-react';
import { prettyKeys } from '../data/piano';
import { PremiumKeyboard } from './PremiumKeyboard';
import { ScoreRenderer } from './ScoreRenderer';
import type { FeedbackState, LearningMode, Lesson, LessonStep, PianoKeyName } from '../types';

type PracticeScreenProps = {
  lesson: Lesson;
  step: LessonStep;
  stepIndex: number;
  mode: LearningMode;
  isListening: boolean;
  detectedNote: PianoKeyName | null;
  feedback: FeedbackState;
  completed: boolean;
  canGoBack: boolean;
  onModeChange: (mode: LearningMode) => void;
  onBackHome: () => void;
  onKeyPress: (note: PianoKeyName) => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onRestart: () => void;
};

const durationBeats = (duration = 'q') => {
  if (duration === 'w') {
    return 4;
  }

  if (duration === 'h') {
    return 2;
  }

  if (duration === '8') {
    return 0.5;
  }

  if (duration === '16') {
    return 0.25;
  }

  return 1;
};

export const PracticeScreen = ({
  lesson,
  step,
  stepIndex,
  mode,
  isListening,
  detectedNote,
  feedback,
  completed,
  canGoBack,
  onModeChange,
  onBackHome,
  onKeyPress,
  onPreviousStep,
  onNextStep,
  onRestart,
}: PracticeScreenProps) => {
  const [scorePlaying, setScorePlaying] = useState(false);
  const [scoreSpeed, setScoreSpeed] = useState(75);
  const [scoreStepProgress, setScoreStepProgress] = useState(0);
  const progress = ((stepIndex + 1) / lesson.steps.length) * 100;
  const currentKeys = step.keys.length > 0 ? prettyKeys(step.keys) : 'rust';
  const featuredKey = step.expectedNote ?? step.keys[0];
  const hand = step.hand ?? step.notes?.find((note) => note.hand)?.hand;
  const handLabel = hand === 'right' ? 'Rechterhand' : hand === 'left' ? 'Linkerhand' : hand === 'both' ? 'Beide handen' : '';
  const fingerLabel = step.notes?.map((note) => note.finger).filter(Boolean).join('-');
  const isRestStep = step.keys.length === 0;
  const goalVerb = isRestStep ? 'Tel' : 'Speel';
  const goalLabel = isRestStep ? step.count ?? 'rust' : currentKeys;
  const techniqueLabel = [
    handLabel,
    fingerLabel ? `vinger ${fingerLabel}` : '',
    step.count ? `tel ${step.count}` : '',
  ].filter(Boolean).join(' · ');
  const coachTip =
    completed
      ? 'Je voortgang is opgeslagen. Kies straks de volgende les of herhaal deze rustig.'
      : step.coaching ??
        (step.recognitionMode === 'chord'
          ? 'Laat de tonen tegelijk landen en luister of het akkoord rustig klinkt.'
          : isRestStep
            ? 'Blijf meetellen zonder een toets te spelen.'
            : techniqueLabel || 'Kijk naar het blad en speel rustig door.');
  const feedbackCopy =
    completed
      ? 'Les afgerond'
      : feedback.tone === 'success' || feedback.tone === 'error' || feedback.tone === 'warning'
        ? feedback.message
        : mode === 'manual'
          ? 'Speel op je piano in je eigen tempo.'
          : isListening
            ? 'Luistert naar je piano.'
            : 'Microfoon wordt gestart.';
  const feedbackLabel = {
    idle: 'Klaar',
    listening: 'Luistert',
    success: 'Goed',
    warning: 'Let op',
    error: 'Nog eens',
  }[feedback.tone];
  const autoPlayerAvailable =
    lesson.level !== 'starter' ||
    lesson.module.includes('Eerste melodieen') ||
    lesson.module.includes('Repertoire') ||
    lesson.module.includes('Klassieke') ||
    lesson.module.includes('Minimalistische');
  const stepDurationMs = useMemo(() => {
    const tempo = lesson.tempo ?? 72;
    const stepNotes = step.notes?.length ? step.notes : [];
    const duration = stepNotes[0]?.duration ?? step.duration ?? 'q';
    const beatMs = 60000 / tempo;

    return (durationBeats(duration) * beatMs) / (scoreSpeed / 100);
  }, [lesson.tempo, scoreSpeed, step.duration, step.notes]);
  const playheadStepIndex = autoPlayerAvailable && scorePlaying ? stepIndex + scoreStepProgress : stepIndex;

  useEffect(() => {
    setScoreStepProgress(0);
  }, [lesson.id, stepIndex]);

  useEffect(() => {
    if (!autoPlayerAvailable || !scorePlaying || completed) {
      return undefined;
    }

    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - startedAt) / stepDurationMs);
      setScoreStepProgress(nextProgress);

      if (nextProgress >= 1) {
        setScoreStepProgress(0);
        if (stepIndex >= lesson.steps.length - 1) {
          setScorePlaying(false);
        }
        onNextStep();
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [autoPlayerAvailable, completed, lesson.steps.length, onNextStep, scorePlaying, stepDurationMs, stepIndex]);

  useEffect(() => {
    if (!autoPlayerAvailable || completed) {
      setScorePlaying(false);
    }
  }, [autoPlayerAvailable, completed]);

  return (
    <section className="premium-stage premium-live-stage premium-practice-live pro-practice-live" aria-label="Oefenmodus">
      <header className="premium-practice-top pro-practice-top">
        <button className="premium-round" onClick={onBackHome} type="button" aria-label="Terug naar menu">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <span>{lesson.module}</span>
          <strong>{lesson.title}</strong>
        </div>

        <div className="premium-mode-cluster" role="group" aria-label="Leermodus">
          <button
            className={mode === 'listen' ? 'listening' : ''}
            onClick={() => onModeChange('listen')}
            type="button"
          >
            <Mic aria-hidden="true" />
            Luisteren
            {mode === 'listen' && isListening ? <i aria-label="Microfoon actief" /> : null}
          </button>
          <button
            className={mode === 'manual' ? 'listening' : ''}
            onClick={() => onModeChange('manual')}
            type="button"
          >
            <Hand aria-hidden="true" />
            Handmatig
          </button>
        </div>
      </header>

      <div className="premium-progress" aria-label="Lesvoortgang">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="pro-practice-reader">
        <section className="premium-score pro-score-full pro-score-sheet" aria-label="Bladmuziek">
          <div className="pro-sheet-coach">
            <div className="pro-sheet-step">
              <span>Stap {stepIndex + 1}/{lesson.steps.length}</span>
              <strong>{completed ? 'Les afgerond' : `${goalVerb} ${goalLabel}`}</strong>
              <p>{coachTip}</p>
            </div>

            <div className="pro-sheet-facts" aria-label="Speelgegevens">
              <div>
                <small>Techniek</small>
                <strong>{techniqueLabel || 'Rustig spelen'}</strong>
              </div>
              <div>
                <small>{feedbackLabel}</small>
                <strong>{feedbackCopy}</strong>
              </div>
              <div className={`pro-inline-status ${feedback.tone}`}>
                <i aria-hidden="true" />
                <strong>{featuredKey ? featuredKey.replace('#', '♯') : 'Rust'}</strong>
                <span>
                  {detectedNote
                    ? `${mode === 'manual' ? 'Gekozen' : 'Gehoord'}: ${detectedNote.replace('#', '♯')}`
                    : mode === 'manual'
                      ? 'Eigen tempo'
                      : isListening
                        ? 'Microfoon actief'
                        : 'Microfoon starten'}
                </span>
              </div>
            </div>

            {autoPlayerAvailable ? (
              <div className="pro-speed-control">
                <button onClick={() => setScorePlaying((value) => !value)} type="button">
                  {scorePlaying ? 'Pauze' : 'Start'}
                </button>
                <input
                  aria-label="Scoresnelheid"
                  max="120"
                  min="50"
                  onChange={(event) => setScoreSpeed(Number(event.target.value))}
                  step="5"
                  type="range"
                  value={scoreSpeed}
                />
              </div>
            ) : (
              <small className="pro-sheet-wait">Kijk, speel, ga door in je eigen tempo</small>
            )}
          </div>

          <ScoreRenderer
            feedbackTone={feedback.tone}
            playheadStepIndex={playheadStepIndex}
            stepIndex={stepIndex}
            steps={lesson.steps}
            timeSignature={lesson.timeSignature}
          />
        </section>
      </div>

      <div className="premium-practice-controls pro-practice-controls">
        <button disabled={!canGoBack} onClick={onPreviousStep} type="button">
          <ArrowLeft aria-hidden="true" />
          Vorige
        </button>
        <button onClick={onRestart} type="button">
          <RotateCcw aria-hidden="true" />
          Opnieuw
        </button>
        <button onClick={onNextStep} type="button">
          {completed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {completed ? 'Klaar' : 'Volgende'}
        </button>
      </div>

      <PremiumKeyboard
        detectedKey={detectedNote}
        disabled={completed || mode !== 'manual'}
        expectedKey={step.expectedNote}
        lessonKeys={step.keys}
        onKeyPress={onKeyPress}
      />
    </section>
  );
};
