import type { Lesson, LessonStep, NoteDuration, PianoKeyName, RecognitionMode, StepNote } from '../types';

export type ScoreEvent = {
  id: string;
  stepIndex: number;
  step: LessonStep;
  notes: StepNote[];
  keys: PianoKeyName[];
  expectedNote?: PianoKeyName;
  recognitionMode: RecognitionMode;
  beatStart: number;
  beatDuration: number;
  beatEnd: number;
  measure: number;
  beatInMeasure: number;
  isRest: boolean;
};

export type ScoreTimeline = {
  lessonId: string;
  tempo: number;
  timeSignature: Lesson['timeSignature'];
  beatsPerMeasure: number;
  totalBeats: number;
  measureCount: number;
  events: ScoreEvent[];
  autoPlayable: boolean;
};

export const durationToBeats = (duration: NoteDuration = 'q') => {
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

export const beatsPerMeasureFor = (timeSignature: Lesson['timeSignature'] = '4/4') => {
  const [numeratorText, denominatorText] = timeSignature.split('/');
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 4;
  }

  return numerator * (4 / denominator);
};

const notesForStep = (step: LessonStep): StepNote[] => {
  if (step.notes?.length) {
    return step.notes;
  }

  return step.keys.map((key) => ({
    key,
    duration: step.duration ?? 'q',
    hand: step.hand,
  }));
};

const durationForStep = (step: LessonStep) => {
  const firstNote = notesForStep(step)[0];
  return firstNote?.duration ?? step.duration ?? 'q';
};

const recognitionForStep = (step: LessonStep): RecognitionMode => {
  if (step.recognitionMode) {
    return step.recognitionMode;
  }

  return step.keys.length > 1 ? 'chord' : 'single-note';
};

const lessonSupportsAutoplay = (lesson: Lesson) =>
  lesson.level !== 'starter' ||
  lesson.module.includes('Eerste melodieen') ||
  lesson.module.includes('Repertoire') ||
  lesson.module.includes('Klassieke') ||
  lesson.module.includes('Minimalistische');

export const createScoreTimeline = (lesson: Lesson): ScoreTimeline => {
  const beatsPerMeasure = beatsPerMeasureFor(lesson.timeSignature);
  let beatCursor = 0;

  const events = lesson.steps.map((step, stepIndex) => {
    const notes = notesForStep(step);
    const beatDuration = durationToBeats(durationForStep(step));
    const event: ScoreEvent = {
      id: `${lesson.id}-${stepIndex}`,
      stepIndex,
      step,
      notes,
      keys: step.keys,
      expectedNote: step.expectedNote ?? step.keys[0],
      recognitionMode: recognitionForStep(step),
      beatStart: beatCursor,
      beatDuration,
      beatEnd: beatCursor + beatDuration,
      measure: Math.floor(beatCursor / beatsPerMeasure) + 1,
      beatInMeasure: beatCursor % beatsPerMeasure,
      isRest: notes.length === 0 || notes.every((note) => note.rest),
    };

    beatCursor += beatDuration;
    return event;
  });

  const totalBeats = Math.max(beatCursor, 0);

  return {
    lessonId: lesson.id,
    tempo: lesson.tempo ?? 72,
    timeSignature: lesson.timeSignature ?? '4/4',
    beatsPerMeasure,
    totalBeats,
    measureCount: Math.max(1, Math.ceil(totalBeats / beatsPerMeasure)),
    events,
    autoPlayable: lessonSupportsAutoplay(lesson),
  };
};

export const beatForStep = (timeline: ScoreTimeline, stepIndex: number) =>
  timeline.events[Math.max(0, Math.min(stepIndex, timeline.events.length - 1))]?.beatStart ?? 0;

export const eventAtBeat = (timeline: ScoreTimeline, beat: number) => {
  if (timeline.events.length === 0) {
    return null;
  }

  const clampedBeat = Math.max(0, Math.min(beat, Math.max(0, timeline.totalBeats - 0.0001)));
  return (
    timeline.events.find((event) => clampedBeat >= event.beatStart && clampedBeat < event.beatEnd) ??
    timeline.events.at(-1) ??
    null
  );
};

export const stepIndexForBeat = (timeline: ScoreTimeline, beat: number) =>
  eventAtBeat(timeline, beat)?.stepIndex ?? 0;

