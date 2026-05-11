import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Hand, Mic, Pause, Play, RotateCcw } from 'lucide-react';
import { useScoreTransport } from '../music/useScoreTransport';
import { PremiumKeyboard } from './PremiumKeyboard';
import { ScoreRenderer } from './ScoreRenderer';
import type { PianoKeyName } from '../types';
import type { PracticePlayerProps } from './practicePlayerTypes';

const compactModuleName = (module: string) => module.replace(/^\d+\.\s*/, '');

const countdownLabels = ['3', '2', '1', 'Speel'];
const emptyKeys: PianoKeyName[] = [];
const scorePreRollBeats = 0.9;

export const PracticePlayerV2 = ({
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
  onModeChange,
  onBackHome,
  onKeyPress,
  onRestart,
  onTransportStepChange,
  onTransportComplete,
  practiceProfile,
  timeline,
}: PracticePlayerProps) => {
  const [playing, setPlaying] = useState(false);
  const [speedPercent, setSpeedPercent] = useState(70);
  const [countdownIndex, setCountdownIndex] = useState(0);
  const transport = useScoreTransport({
    timeline,
    playing,
    speedPercent,
    activeStepIndex: stepIndex,
    disabled: completed,
    preRollBeats: scorePreRollBeats,
    stepLateBeats: 0.12,
    stepLeadBeats: 0.88,
    onStepChange: onTransportStepChange,
    onEnd: () => {
      setPlaying(false);
      onTransportComplete();
    },
  });
  const soundingEvent = transport.activeEvent;
  const targetEvent = timeline.events[stepIndex] ?? soundingEvent;
  const currentKeys = targetEvent?.keys.length ? targetEvent.keys : step.keys;
  const upcomingEvent = useMemo(
    () => timeline.events.find((event) => event.stepIndex > (targetEvent?.stepIndex ?? stepIndex) && event.keys.length > 0 && !event.isRest),
    [stepIndex, targetEvent?.stepIndex, timeline.events],
  );
  const upcomingKeys = upcomingEvent?.keys ?? emptyKeys;
  const beatsUntilCue = upcomingEvent ? upcomingEvent.beatStart - transport.currentBeat : Number.POSITIVE_INFINITY;
  const cueWindowBeats = 1.25;
  const cueProgress = Number.isFinite(beatsUntilCue) ? Math.max(0, Math.min(1, 1 - beatsUntilCue / cueWindowBeats)) : 0;
  const cueActive = playing && cueProgress > 0 && cueProgress < 1;
  const progress = timeline.totalBeats > 0 ? Math.max(0, Math.min(100, (transport.currentBeat / timeline.totalBeats) * 100)) : 0;
  const countdownActive = !completed && countdownIndex < countdownLabels.length;
  const feedbackKind = noteFeedback.kind;
  const showTinyFeedback = ['correct', 'wrong', 'late', 'missed'].includes(feedbackKind);

  useEffect(() => {
    setPlaying(false);
    setCountdownIndex(0);
  }, [lesson.id]);

  useEffect(() => {
    if (completed) {
      setPlaying(false);
      return undefined;
    }

    if (countdownIndex >= countdownLabels.length) {
      setPlaying(true);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCountdownIndex((index) => index + 1);
    }, countdownIndex === countdownLabels.length - 1 ? 520 : 760);

    return () => window.clearTimeout(timer);
  }, [completed, countdownIndex]);

  const restartFlow = () => {
    setPlaying(false);
    setCountdownIndex(0);
    onRestart();
  };

  return (
    <section className={`practice-v2 profile-${practiceProfile}`} aria-label="Oefenmodus v2">
      <header className="practice-v2-topbar">
        <button className="practice-v2-icon" onClick={onBackHome} type="button" aria-label="Terug naar menu">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="practice-v2-title">
          <span>{compactModuleName(lesson.module)}</span>
          <strong>{lesson.title}</strong>
        </div>
        <div className="practice-v2-mode" role="group" aria-label="Leermodus">
          <button className={mode === 'listen' ? 'active' : ''} onClick={() => onModeChange('listen')} type="button">
            <Mic aria-hidden="true" />
            {mode === 'listen' && isListening ? <i aria-label="Microfoon actief" /> : null}
          </button>
          <button className={mode === 'manual' ? 'active' : ''} onClick={() => onModeChange('manual')} type="button">
            <Hand aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="practice-v2-stage">
        <section className="practice-v2-flow practice-v2-sheet" aria-label="Echte bladmuziek">
          <div className="practice-v2-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <ScoreRenderer
            activeStepIndex={stepIndex}
            currentBeat={transport.currentBeat}
            feedbackTone={feedback.tone}
            noteFeedback={noteFeedback}
            timeline={timeline}
          />
          <div className="practice-v2-now">
            <small>Nu</small>
            <strong>{soundingEvent?.measure ? `Maat ${soundingEvent.measure}` : 'Start'}</strong>
          </div>
          {countdownActive ? (
            <div className="practice-v2-countdown" aria-live="polite">
              <span>{countdownLabels[countdownIndex]}</span>
            </div>
          ) : null}
          {showTinyFeedback ? (
            <div className={`practice-v2-feedback ${feedbackKind}`} key={noteFeedback.pulseId} aria-live="polite">
              {feedbackKind === 'correct' ? <Check aria-hidden="true" /> : null}
              <span>{feedbackKind === 'correct' ? 'Goed' : feedbackKind === 'late' ? 'Bijna' : 'Probeer door'}</span>
            </div>
          ) : null}
        </section>
      </main>

      <section className="practice-v2-controls" aria-label="Oefenbediening">
        <button onClick={() => setPlaying((value) => !value)} type="button">
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{playing ? 'Pauze' : 'Speel'}</span>
        </button>
        <button onClick={restartFlow} type="button">
          <RotateCcw aria-hidden="true" />
          <span>Opnieuw</span>
        </button>
        <label>
          <span>{speedPercent}%</span>
          <input
            aria-label="Snelheid"
            max="115"
            min="45"
            onChange={(event) => setSpeedPercent(Number(event.target.value))}
            step="5"
            type="range"
            value={speedPercent}
          />
        </label>
      </section>

      <PremiumKeyboard
        detectedKey={detectedNote}
        detectedKeys={detectedNotes}
        disabled={completed || mode !== 'manual'}
        expectedKey={step.expectedNote}
        feedbackTone={feedback.tone}
        lessonKeys={currentKeys}
        noteFeedback={noteFeedback}
        onKeyPress={onKeyPress}
        showLabels={false}
        cueActive={cueActive}
        upcomingKeys={upcomingKeys}
      />
    </section>
  );
};
