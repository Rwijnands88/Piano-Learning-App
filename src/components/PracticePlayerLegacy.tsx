import { ArrowLeft, ArrowRight, Check, ChevronLeft, Hand, Mic, RotateCcw } from 'lucide-react';
import { prettyKeys } from '../data/piano';
import { useScoreTransport } from '../music/useScoreTransport';
import { PremiumKeyboard } from './PremiumKeyboard';
import { ScoreRenderer } from './ScoreRenderer';
import type { PracticePlayerProps } from './practicePlayerTypes';

const compactModuleName = (module: string) => module.replace(/^\d+\.\s*/, '');

export const PracticePlayerLegacy = ({
  lesson,
  step,
  stepIndex,
  mode,
  isListening,
  detectedNote,
  detectedNotes,
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
  timeline,
}: PracticePlayerProps) => {
  const transport = useScoreTransport({
    timeline,
    playing: false,
    speedPercent: 65,
    activeStepIndex: stepIndex,
    disabled: completed,
    onStepChange: onTransportStepChange,
    onEnd: onTransportComplete,
  });
  const progress = ((stepIndex + 1) / lesson.steps.length) * 100;
  const timelineProgress = Math.max(progress, transport.totalProgress);
  const currentKeys = step.keys.length > 0 ? prettyKeys(step.keys) : 'rust';
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
  const practiceModeLabel = mode === 'listen' ? 'Wait mode' : 'Eigen tempo';
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
      : mode === 'listen'
        ? isListening
          ? 'De app wacht op de juiste noot.'
          : 'Microfoon wordt gestart.'
        : 'Speel op je piano en stap zelf door.';

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

        <button disabled={!canGoBack} onClick={onPreviousStep} type="button">
          <ArrowLeft aria-hidden="true" />
          <span>Vorige</span>
        </button>
        <button onClick={onRestart} type="button">
          <RotateCcw aria-hidden="true" />
          <span>Opnieuw</span>
        </button>
        <button className="primary" onClick={onNextStep} type="button">
          {completed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          <span>{completed ? 'Klaar' : 'Volgende'}</span>
        </button>

        <span className="player-tempo-pill">
          {feedback.tone === 'idle' ? techniqueLabel || 'Rustig spelen' : `${feedbackLabel}: ${feedbackCopy}`}
        </span>
      </div>

      <PremiumKeyboard
        detectedKey={detectedNote}
        detectedKeys={detectedNotes}
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
