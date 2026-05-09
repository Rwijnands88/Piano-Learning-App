import { useEffect, useMemo, useRef, useState } from 'react';
import { prettyKeys } from '../data/piano';
import { loadVexFlow } from '../lib/vexflowLoader';
import type { FeedbackState, LessonStep, PianoKeyName, StepNote } from '../types';

type ScoreRendererProps = {
  steps: LessonStep[];
  stepIndex: number;
  feedbackTone: FeedbackState['tone'];
  timeSignature?: string;
};

const BEATS_PER_SYSTEM = 4;

const scoreColors = {
  ink: '#111118',
  muted: '#77707d',
  current: '#c8913a',
  success: '#3bb87a',
  error: '#e05050',
};

const noteToMidi = (note: PianoKeyName) => {
  const [, pitch, octaveText] = note.match(/^([A-G]#?)(\d)$/) ?? [];
  const pitchIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(pitch);
  return (Number(octaveText) + 1) * 12 + pitchIndex;
};

const toVexKey = (note: PianoKeyName) => {
  const [, pitch, octave] = note.match(/^([A-G]#?)(\d)$/) ?? [];
  return `${pitch.toLowerCase()}/${octave}`;
};

const labelForStep = (step: LessonStep) => prettyKeys(step.keys).replaceAll(' - ', ' ');

const notesForStep = (step: LessonStep): StepNote[] =>
  step.notes?.length
    ? step.notes
    : step.keys.map((key) => ({
        key,
        duration: step.duration ?? 'q',
        hand: step.hand,
      }));

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

const scoreLabelForStep = (step: LessonStep) => {
  if (step.scoreLabel) {
    return step.scoreLabel;
  }

  const notes = notesForStep(step);
  const fingers = notes.map((note) => note.finger).filter(Boolean).join('-');
  const hand = step.hand ?? notes.find((note) => note.hand)?.hand;
  const handLabel = hand === 'right' ? 'RH' : hand === 'left' ? 'LH' : hand === 'both' ? '2H' : '';

  return [handLabel, fingers].filter(Boolean).join(' ') || labelForStep(step);
};

const styleForStep = (absoluteIndex: number, currentIndex: number, feedbackTone: FeedbackState['tone']) => {
  if (absoluteIndex !== currentIndex) {
    return { fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink };
  }

  if (feedbackTone === 'success') {
    return { fillStyle: scoreColors.success, strokeStyle: scoreColors.success };
  }

  if (feedbackTone === 'error') {
    return { fillStyle: scoreColors.error, strokeStyle: scoreColors.error };
  }

  return { fillStyle: scoreColors.current, strokeStyle: scoreColors.current };
};

const clefForSteps = (steps: LessonStep[]) => {
  const notes = steps.flatMap((step) => notesForStep(step).filter((note) => !note.rest).map((note) => note.key));
  const average = notes.reduce((total, note) => total + noteToMidi(note), 0) / Math.max(notes.length, 1);
  return average < 60 ? 'bass' : 'treble';
};

const getSystemWindow = (steps: LessonStep[], stepIndex: number) => {
  const start = Math.floor(stepIndex / BEATS_PER_SYSTEM) * BEATS_PER_SYSTEM;
  return steps.slice(start, start + BEATS_PER_SYSTEM).map((step, index) => ({
    step,
    absoluteIndex: start + index,
  }));
};

export const ScoreRenderer = ({ steps, stepIndex, feedbackTone, timeSignature = '4/4' }: ScoreRendererProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderRequestRef = useRef(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const systemSteps = useMemo(() => getSystemWindow(steps, stepIndex), [steps, stepIndex]);
  const currentSystemIndex = systemSteps.findIndex(({ absoluteIndex }) => absoluteIndex === stepIndex);
  const cursorLeft = `${24 + Math.max(currentSystemIndex, 0) * 18}%`;

  useEffect(() => {
    const container = containerRef.current;

    if (!container || systemSteps.length === 0) {
      return;
    }

    let disposed = false;

    const renderScore = async () => {
      const requestId = ++renderRequestRef.current;

      try {
        setLoadState((state) => (state === 'ready' ? state : 'loading'));
        const {
          Accidental,
          Annotation,
          AnnotationHorizontalJustify,
          AnnotationVerticalJustify,
          Formatter,
          Renderer,
          Stave,
          StaveNote,
          Voice,
        } = await loadVexFlow();

        if (disposed || requestId !== renderRequestRef.current || !containerRef.current) {
          return;
        }

        const compact = container.clientWidth < 520 || container.clientHeight < 150;
        const width = Math.max(container.clientWidth, compact ? 280 : 360);
        const height = Math.max(container.clientHeight, compact ? 118 : 210);
        const staveX = compact ? Math.max(10, width * 0.018) : Math.max(18, width * 0.025);
        const staveY = compact ? Math.max(8, height * 0.08) : Math.max(26, height * 0.18);
        const staveWidth = width - staveX * 2;
        const clef = clefForSteps(systemSteps.map(({ step }) => step));

        container.replaceChildren();

        const renderer = new Renderer(container, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();
        context.setFillStyle(scoreColors.ink);
        context.setStrokeStyle(scoreColors.ink);
        context.setFont('Inter, Arial, sans-serif', compact ? 9 : 12, 600);

        const stave = new Stave(staveX, staveY, staveWidth, {
          spacingBetweenLinesPx: compact ? Math.max(8, Math.min(11, height * 0.08)) : Math.max(12, Math.min(18, height * 0.065)),
          spaceAboveStaffLn: 1,
          spaceBelowStaffLn: compact ? 2 : 4,
        });
        stave
          .addClef(clef)
          .addTimeSignature(timeSignature)
          .setStyle({ fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink });
        stave.setDefaultLedgerLineStyle({ strokeStyle: 'rgba(17, 17, 24, 0.7)', lineWidth: 1.4 });
        stave.setContext(context).draw();

        const notes = systemSteps.map(({ step, absoluteIndex }) => {
          const style = styleForStep(absoluteIndex, stepIndex, feedbackTone);
          const stepNotes = notesForStep(step);
          const duration = stepNotes[0]?.duration ?? step.duration ?? 'q';
          const isRest = stepNotes.length > 0 && stepNotes.every((stepNote) => stepNote.rest);
          const note = new StaveNote({
            keys: isRest ? ['b/4'] : stepNotes.map((stepNote) => toVexKey(stepNote.key)),
            duration: isRest ? `${duration}r` : duration,
            clef,
            autoStem: true,
          });

          stepNotes.forEach(({ key }, keyIndex) => {
            note.setKeyStyle(keyIndex, style);

            if (!isRest && key.includes('#')) {
              const accidental = new Accidental('#').setStyle(style);
              note.addModifier(accidental, keyIndex);
            }
          });

          const label = new Annotation(scoreLabelForStep(step))
            .setFont('Inter, Arial, sans-serif', compact ? 9 : 12, 800)
            .setJustification(AnnotationHorizontalJustify.CENTER)
            .setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
            .setStyle({ fillStyle: absoluteIndex === stepIndex ? style.fillStyle : scoreColors.muted });

          note.setStyle(style).setStemStyle(style);
          note.setLedgerLineStyle({ strokeStyle: style.strokeStyle, lineWidth: absoluteIndex === stepIndex ? 1.8 : 1.3 });
          note.addModifier(label, 0);

          return note;
        });

        const totalBeats = systemSteps.reduce((total, { step }) => {
          const stepNotes = notesForStep(step);
          return total + durationBeats(stepNotes[0]?.duration ?? step.duration ?? 'q');
        }, 0);
        const voice = new Voice({ numBeats: Math.max(BEATS_PER_SYSTEM, Math.ceil(totalBeats)), beatValue: 4 }).setMode(Voice.Mode.SOFT);
        voice.addTickables(notes);

        new Formatter().joinVoices([voice]).format([voice], Math.max(compact ? 150 : 220, staveWidth - (compact ? 64 : 110)));
        voice.draw(context, stave);
        setLoadState('ready');
      } catch {
        if (!disposed && requestId === renderRequestRef.current) {
          setLoadState('error');
        }
      }
    };

    void renderScore();

    const resizeObserver = new ResizeObserver(() => {
      void renderScore();
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
    };
  }, [feedbackTone, stepIndex, systemSteps]);

  return (
    <div className="score-renderer" aria-label="Bladmuziekweergave">
      <div className="score-playhead" style={{ left: cursorLeft }} aria-hidden="true" />
      {loadState !== 'ready' ? (
        <div className={`score-status ${loadState}`} aria-live="polite">
          {loadState === 'error' ? 'Notatie kon niet geladen worden' : 'Notatie laden...'}
        </div>
      ) : null}
      <div className="score-system" ref={containerRef} />
    </div>
  );
};
