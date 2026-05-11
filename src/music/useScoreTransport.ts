import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { beatForStep, eventAtBeat, stepIndexForBeat, type ScoreEvent, type ScoreTimeline } from './scoreTimeline';

type UseScoreTransportOptions = {
  timeline: ScoreTimeline;
  playing: boolean;
  speedPercent: number;
  activeStepIndex: number;
  disabled?: boolean;
  preRollBeats?: number;
  stepLeadBeats?: number;
  stepLateBeats?: number;
  onStepChange: (stepIndex: number) => void;
  onEnd: () => void;
};

type ScoreTransportState = {
  currentBeat: number;
  activeEvent: ScoreEvent | null;
  totalProgress: number;
  seekToStep: (stepIndex: number) => void;
};

const clampBeat = (timeline: ScoreTimeline, beat: number, preRollBeats = 0) =>
  Math.max(-preRollBeats, Math.min(beat, timeline.totalBeats));

const targetStepIndexForBeat = (timeline: ScoreTimeline, beat: number, leadBeats: number, lateBeats: number) => {
  if (leadBeats <= 0) {
    return stepIndexForBeat(timeline, beat);
  }

  const targetEvent = timeline.events.find(
    (event) => event.beatStart <= beat + leadBeats && beat <= event.beatStart + lateBeats,
  );

  return targetEvent?.stepIndex ?? stepIndexForBeat(timeline, beat);
};

export const useScoreTransport = ({
  timeline,
  playing,
  speedPercent,
  activeStepIndex,
  disabled = false,
  preRollBeats = 0,
  stepLeadBeats = 0,
  stepLateBeats = 0.16,
  onStepChange,
  onEnd,
}: UseScoreTransportOptions): ScoreTransportState => {
  const [currentBeat, setCurrentBeat] = useState(() => (activeStepIndex === 0 ? -preRollBeats : beatForStep(timeline, activeStepIndex)));
  const frameRef = useRef<number | null>(null);
  const currentBeatRef = useRef(currentBeat);
  const startBeatRef = useRef(currentBeat);
  const startTimeRef = useRef(0);
  const lastPublishedStepRef = useRef(activeStepIndex);
  const observedStepRef = useRef(activeStepIndex);
  const observedLessonRef = useRef(timeline.lessonId);
  const onStepChangeRef = useRef(onStepChange);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onStepChangeRef.current = onStepChange;
    onEndRef.current = onEnd;
  }, [onEnd, onStepChange]);

  const publishBeat = useCallback((beat: number) => {
    const nextBeat = clampBeat(timeline, beat, preRollBeats);
    currentBeatRef.current = nextBeat;
    setCurrentBeat(nextBeat);

    const nextStep = targetStepIndexForBeat(timeline, nextBeat, stepLeadBeats, stepLateBeats);
    if (nextStep !== lastPublishedStepRef.current) {
      lastPublishedStepRef.current = nextStep;
      onStepChangeRef.current(nextStep);
    }
  }, [preRollBeats, stepLateBeats, stepLeadBeats, timeline]);

  const seekToStep = useCallback((stepIndex: number) => {
    const nextBeat = stepIndex === 0 ? -preRollBeats : beatForStep(timeline, stepIndex);
    lastPublishedStepRef.current = stepIndex;
    currentBeatRef.current = nextBeat;
    startBeatRef.current = nextBeat;
    setCurrentBeat(nextBeat);
  }, [preRollBeats, timeline]);

  useEffect(() => {
    const lessonChanged = timeline.lessonId !== observedLessonRef.current;

    if (lessonChanged || activeStepIndex !== observedStepRef.current) {
      observedLessonRef.current = timeline.lessonId;
      observedStepRef.current = activeStepIndex;
    } else {
      return;
    }

    if (!playing) {
      seekToStep(activeStepIndex);
    }
  }, [activeStepIndex, playing, seekToStep, timeline.lessonId]);

  useEffect(() => {
    if (!playing || disabled || timeline.totalBeats <= 0) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return undefined;
    }

    startBeatRef.current = currentBeatRef.current;
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsedSeconds = (now - startTimeRef.current) / 1000;
      const beatsPerSecond = (timeline.tempo / 60) * (speedPercent / 100);
      const nextBeat = clampBeat(timeline, startBeatRef.current + elapsedSeconds * beatsPerSecond, preRollBeats);

      publishBeat(nextBeat);

      if (nextBeat >= timeline.totalBeats) {
        frameRef.current = null;
        onEndRef.current();
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [disabled, playing, preRollBeats, publishBeat, speedPercent, timeline]);

  const activeEvent = useMemo(() => eventAtBeat(timeline, currentBeat), [currentBeat, timeline]);
  const totalProgress = timeline.totalBeats > 0 ? Math.max(0, Math.min(100, (currentBeat / timeline.totalBeats) * 100)) : 0;

  return {
    currentBeat,
    activeEvent,
    totalProgress,
    seekToStep,
  };
};
