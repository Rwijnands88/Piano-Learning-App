import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Hand, Mic, Pause, Play, RotateCcw } from 'lucide-react';
import { prettyKeys } from '../data/piano';
import { createScoreTimeline } from '../music/scoreTimeline';
import { useScoreTransport } from '../music/useScoreTransport';
import { PremiumKeyboard } from './PremiumKeyboard';
import { PracticePlayerV2 } from './PracticePlayerV2';
import { ScoreRenderer } from './ScoreRenderer';
import type { FeedbackState, LearningMode, Lesson, LessonStep, PianoKeyName, PracticeNoteFeedback, PracticeProfile } from '../types';

type PracticeScreenProps = {
  lesson: Lesson;
  step: LessonStep;
  stepIndex: number;
  mode: LearningMode;
  isListening: boolean;
  detectedNote: PianoKeyName | null;
  feedback: FeedbackState;
  noteFeedback: PracticeNoteFeedback;
  completed: boolean;
  canGoBack: boolean;
  onModeChange: (mode: LearningMode) => void;
  onBackHome: () => void;
  onKeyPress: (note: PianoKeyName) => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onRestart: () => void;
  onTransportStepChange: (stepIndex: number) => void;
  onTransportComplete: () => void;
  practiceProfile: PracticeProfile;
};

const compactModuleName = (module: string) => module.replace(/^\d+\.\s*/, '');

export const PracticeScreen = ({
  lesson,
  step,
  stepIndex,
  mode,
  isListening,
  detectedNote,
  feedback,
  noteFeedback,
  completed,
  canGoBack,
  onModeChange,
  onBackHome,
  onKeyPress,
  onPreviousStep,
  onNextStep,
  onRestart,
  onTransportStepChange,
  onTransportComplete,
  practiceProfile,
}: PracticeScreenProps) => {
  const [scorePlaying, setScorePlaying] = useState(false);
  const [scoreSpeed, setScoreSpeed] = useState(65);
  const timeline = useMemo(() => createScoreTimeline(lesson), [lesson]);
  const transport = useScoreTransport({
    timeline,
    playing: scorePlaying,
    speedPercent: scoreSpeed,
    activeStepIndex: stepIndex,
    disabled: completed,
    onStepChange: onTransportStepChange,
    onEnd: () => {
      setScorePlaying(false);
      onTransportComplete();
    },
  });
  const progress = ((stepIndex + 1) / lesson.steps.length) * 100;
  const timelineProgress = Math.max(progress, transport.totalProgress);
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
  const practiceModeLabel = timeline.autoPlayable ? 'Meespelen' : mode === 'listen' ? 'Wait mode' : 'Eigen tempo';
  const speedLabel = scoreSpeed <= 70 ? 'Rustig' : scoreSpeed < 95 ? 'Normaal' : 'Vloeiend';
  const bubbleLabel = {
    pending: 'Klaar',
    active: 'Nu',
    correct: 'Goed',
    late: 'Bijna',
    wrong: 'Nog eens',
    missed: 'Gemist',
  }[noteFeedback.kind];
  const showFeedbackBubble = ['correct', 'late', 'wrong', 'missed'].includes(noteFeedback.kind);
  const statusCopy =
    feedback.tone === 'success' || feedback.tone === 'error' || feedback.tone === 'warning'
      ? feedback.message
      : timeline.autoPlayable
        ? 'Start de speler wanneer je klaarzit. Verlaag de snelheid voor controle.'
        : mode === 'listen'
          ? isListening
            ? 'De app wacht op de juiste noot.'
            : 'Microfoon wordt gestart.'
          : 'Speel op je piano en stap zelf door.';
  useEffect(() => {
    if (!timeline.autoPlayable || completed) {
      setScorePlaying(false);
    }
  }, [completed, timeline.autoPlayable]);

  const handlePreviousStep = () => {
    setScorePlaying(false);
    onPreviousStep();
  };

  const handleNextStep = () => {
    setScorePlaying(false);
    onNextStep();
  };

  const handleRestart = () => {
    setScorePlaying(false);
    onRestart();
  };

  if (timeline.autoPlayable) {
    return (
      <PracticePlayerV2
        completed={completed}
        detectedNote={detectedNote}
        feedback={feedback}
        isListening={isListening}
        lesson={lesson}
        mode={mode}
        noteFeedback={noteFeedback}
        onBackHome={onBackHome}
        onKeyPress={onKeyPress}
        onModeChange={onModeChange}
        onRestart={onRestart}
        onTransportComplete={onTransportComplete}
        onTransportStepChange={onTransportStepChange}
        practiceProfile={practiceProfile}
        step={step}
        stepIndex={stepIndex}
      />
    );
  }

  return (
    <section
      className={`premium-stage premium-live-stage premium-practice-live pro-practice-live learning-player profile-${practiceProfile}`}
      aria-label="Oefenmodus"
    >
      <header className="player-topbar">
        <button className="player-icon-button" onClick={onBackHome} type="button" aria-label="Terug naar menu">
          <ChevronLeft aria-hidden="true" />
        </button>

        <div className="player-title">
          <span>{compactModuleName(lesson.module)}</span>
          <strong>{lesson.title}</strong>
        </div>

        <div className="player-mode-toggle" role="group" aria-label="Leermodus">
          <button
            className={mode === 'listen' ? 'active' : ''}
            onClick={() => onModeChange('listen')}
            type="button"
          >
            <Mic aria-hidden="true" />
            <span>Luisteren</span>
            {mode === 'listen' && isListening ? <i aria-label="Microfoon actief" /> : null}
          </button>
          <button
            className={mode === 'manual' ? 'active' : ''}
            onClick={() => onModeChange('manual')}
            type="button"
          >
            <Hand aria-hidden="true" />
            <span>Handmatig</span>
          </button>
        </div>
      </header>

      <div className="player-progress" aria-label="Lesvoortgang">
        <span style={{ width: `${timelineProgress}%` }} />
      </div>

      <main className="player-stage">
        <section className="player-sheet" aria-label="Bladmuziek">
          <div className="player-score-frame">
            <ScoreRenderer
              feedbackTone={feedback.tone}
              activeStepIndex={stepIndex}
              currentBeat={transport.currentBeat}
              noteFeedback={noteFeedback}
              timeline={timeline}
            />
          </div>
          {showFeedbackBubble ? (
            <div className={`player-feedback-bubble ${noteFeedback.kind}`} key={noteFeedback.pulseId} aria-live="polite">
              <span>{bubbleLabel}</span>
              <strong>{noteFeedback.message}</strong>
            </div>
          ) : null}
        </section>
      </main>

      <div className="player-transport" aria-label="Oefenbediening">
        <div className={`player-compact-cue ${feedback.tone}`}>
          <i aria-hidden="true" />
          <span>{practiceModeLabel} · stap {stepIndex + 1}/{lesson.steps.length}</span>
          <strong>{completed ? 'Les afgerond' : `${goalVerb} ${goalLabel}`}</strong>
          <small>{statusCopy}</small>
        </div>

        <button disabled={!canGoBack} onClick={handlePreviousStep} type="button">
          <ArrowLeft aria-hidden="true" />
          <span>Vorige</span>
        </button>
        <button onClick={handleRestart} type="button">
          <RotateCcw aria-hidden="true" />
          <span>Opnieuw</span>
        </button>
        <button className="primary" onClick={handleNextStep} type="button">
          {completed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          <span>{completed ? 'Klaar' : 'Volgende'}</span>
        </button>

        {timeline.autoPlayable ? (
          <div className="player-speed compact">
            <button onClick={() => setScorePlaying((value) => !value)} type="button">
              {scorePlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              <span>{scorePlaying ? 'Pauze' : 'Start'}</span>
            </button>
            <strong>{speedLabel} · {scoreSpeed}%</strong>
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
          <span className="player-tempo-pill">{feedback.tone === 'idle' ? techniqueLabel || 'Rustig spelen' : `${feedbackLabel}: ${feedbackCopy}`}</span>
        )}
      </div>

      <PremiumKeyboard
        detectedKey={detectedNote}
        disabled={completed || mode !== 'manual'}
        expectedKey={step.expectedNote}
        feedbackTone={feedback.tone}
        lessonKeys={step.keys}
        noteFeedback={noteFeedback}
        onKeyPress={onKeyPress}
      />
    </section>
  );
};
