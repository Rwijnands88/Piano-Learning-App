import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadVexFlow } from '../lib/vexflowLoader';
import type { FeedbackState, LessonStep, PianoKeyName, StepNote } from '../types';

type ScoreRendererProps = {
  steps: LessonStep[];
  stepIndex: number;
  playheadStepIndex?: number;
  feedbackTone?: FeedbackState['tone'];
  timeSignature?: string;
};

const scoreColors = {
  ink: '#111118',
  muted: '#77707d',
  ledger: 'rgba(17, 17, 24, 0.62)',
  hidden: 'rgba(17, 17, 24, 0)',
};

type ScoreClef = 'treble' | 'bass';

const noteToMidi = (note: PianoKeyName) => {
  const [, pitch, octaveText] = note.match(/^([A-G]#?)(\d)$/) ?? [];
  const pitchIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(pitch);

  if (pitchIndex < 0) {
    return 60;
  }

  return (Number(octaveText) + 1) * 12 + pitchIndex;
};

const toVexKey = (note: PianoKeyName) => {
  const [, pitch, octave] = note.match(/^([A-G]#?)(\d)$/) ?? [];
  return `${pitch.toLowerCase()}/${octave}`;
};

const notesForStep = (step: LessonStep): StepNote[] =>
  step.notes?.length
    ? step.notes
    : step.keys.map((key) => ({
        key,
        duration: step.duration ?? 'q',
        hand: step.hand,
      }));

const durationForStep = (step: LessonStep) => notesForStep(step)[0]?.duration ?? step.duration ?? 'q';

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

const annotationForStep = (step: LessonStep, stepNotes: StepNote[]) => {
  const fingers = stepNotes.map((note) => note.finger).filter(Boolean).join('-');

  if (fingers) {
    return fingers;
  }

  if (step.scoreLabel === 'stacc.' || step.scoreLabel === 'rust') {
    return step.scoreLabel;
  }

  return '';
};

const clefForNote = (note: StepNote, step: LessonStep): ScoreClef => {
  const hand = note.hand ?? step.hand;

  if (hand === 'left') {
    return 'bass';
  }

  if (hand === 'right') {
    return 'treble';
  }

  return noteToMidi(note.key) < 60 ? 'bass' : 'treble';
};

const usesGrandStaff = (steps: LessonStep[]) =>
  steps.some((step) =>
    step.hand === 'left' ||
    step.hand === 'both' ||
    notesForStep(step).some((note) => !note.rest && ((note.hand ?? step.hand) === 'left' || (note.hand ?? step.hand) === 'both')),
  );

const notesForClef = (step: LessonStep, clef: ScoreClef, grandStaff: boolean) => {
  const notes = notesForStep(step).filter((note) => !note.rest);

  if (!grandStaff) {
    return notes;
  }

  return notes.filter((note) => clefForNote(note, step) === clef);
};

type ScoreLayout = {
  minOffset: number;
  maxOffset: number;
  playheadX: number;
  positions: number[];
};

export const ScoreRenderer = ({
  steps,
  stepIndex,
  playheadStepIndex = stepIndex,
  timeSignature = '4/4',
}: ScoreRendererProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playheadStepIndexRef = useRef(playheadStepIndex);
  const layoutRef = useRef<ScoreLayout | null>(null);
  const renderRequestRef = useRef(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const scoreSteps = useMemo(
    () =>
      steps.map((step, absoluteIndex) => ({
        step,
        absoluteIndex,
        duration: durationForStep(step),
      })),
    [steps],
  );
  const applyScoreScroll = useCallback((nextPlayheadIndex: number) => {
    const container = containerRef.current;
    const layout = layoutRef.current;

    if (!container || !layout || layout.positions.length === 0) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(nextPlayheadIndex, layout.positions.length - 1));
    const currentIndex = Math.floor(clampedIndex);
    const nextIndex = Math.min(currentIndex + 1, layout.positions.length - 1);
    const localProgress = clampedIndex - currentIndex;
    const currentX = layout.positions[currentIndex] ?? layout.positions[0];
    const nextX = layout.positions[nextIndex] ?? currentX;
    const playheadTargetX = currentX + (nextX - currentX) * localProgress;
    const offset = Math.min(layout.maxOffset, Math.max(layout.minOffset, layout.playheadX - playheadTargetX));

    container.style.transform = `translate3d(${offset}px, 0, 0)`;
  }, []);

  useEffect(() => {
    playheadStepIndexRef.current = playheadStepIndex;
    applyScoreScroll(playheadStepIndex);
  }, [applyScoreScroll, playheadStepIndex]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || scoreSteps.length === 0) {
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
          StaveConnector,
          StaveNote,
          Voice,
        } = await loadVexFlow();

        if (disposed || requestId !== renderRequestRef.current || !containerRef.current) {
          return;
        }

        const viewport = container.parentElement;
        const rawViewportWidth = viewport?.clientWidth ?? container.clientWidth;
        const rawViewportHeight = viewport?.clientHeight ?? container.clientHeight;
        const compact = rawViewportWidth < 560 || rawViewportHeight < 190;
        const grandStaff = usesGrandStaff(scoreSteps.map(({ step }) => step));
        const viewportWidth = Math.max(rawViewportWidth, compact ? 280 : 360);
        const viewportHeight = Math.max(rawViewportHeight, grandStaff ? 300 : 235);
        const noteSpacing = compact ? 176 : 238;
        const playheadX = viewportWidth * (compact ? 0.38 : 0.42);
        const leadIn = playheadX;
        const tailOut = viewportWidth - playheadX + noteSpacing * 1.45;
        const width = Math.max(viewportWidth, leadIn + scoreSteps.length * noteSpacing + tailOut);
        const height = viewportHeight;
        const staveX = Math.max(compact ? 34 : 48, leadIn * 0.72);
        const lineSpacing = grandStaff
          ? Math.max(compact ? 15 : 18, Math.min(28, height * 0.075))
          : Math.max(compact ? 17 : 21, Math.min(32, height * 0.115));
        const musicFontSize = grandStaff ? (compact ? 34 : 39) : compact ? 38 : 44;
        const accidentalFontSize = grandStaff ? (compact ? 25 : 29) : compact ? 28 : 32;
        const topStaveY = grandStaff ? Math.max(18, height * 0.075) : Math.max(24, height * 0.18);
        const bassStaveY = topStaveY + lineSpacing * 6.25;
        const staveWidth = width - staveX - Math.max(120, tailOut * 0.72);
        const totalBeats = scoreSteps.reduce((total, { duration }) => total + durationBeats(duration), 0);

        viewport?.style.setProperty('--score-playhead-x', `${playheadX}px`);
        container.replaceChildren();
        container.style.width = `${width}px`;
        container.style.transform = 'translate3d(0, 0, 0)';

        const renderer = new Renderer(container, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();
        context.setFillStyle(scoreColors.ink);
        context.setStrokeStyle(scoreColors.ink);
        context.setFont('Inter, Arial, sans-serif', compact ? 11 : 13, 600);

        const makeStave = (clef: ScoreClef, y: number) => {
          const stave = new Stave(staveX, y, staveWidth, {
            spacingBetweenLinesPx: lineSpacing,
            spaceAboveStaffLn: grandStaff ? 1 : 1.5,
            spaceBelowStaffLn: grandStaff ? 2 : 4,
          });

          stave
            .addClef(clef)
            .addTimeSignature(timeSignature)
            .setStyle({ fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink });
          stave.setDefaultLedgerLineStyle({ strokeStyle: scoreColors.ledger, lineWidth: 1.45 });
          stave.setContext(context).draw();

          return stave;
        };

        const makeNote = (step: LessonStep, clef: ScoreClef, hidden = false) => {
          const duration = durationForStep(step);
          const stepNotes = hidden ? [] : notesForClef(step, clef, grandStaff);
          const isStepRest = notesForStep(step).length > 0 && notesForStep(step).every((note) => note.rest);
          const isRest = hidden || isStepRest || stepNotes.length === 0;
          const sortedNotes = [...stepNotes].sort((a, b) => noteToMidi(a.key) - noteToMidi(b.key));
          const note = new StaveNote({
            keys: isRest ? [clef === 'bass' ? 'd/3' : 'b/4'] : sortedNotes.map((stepNote) => toVexKey(stepNote.key)),
            duration: isRest ? `${duration}r` : duration,
            clef,
            autoStem: true,
          });
          note.noteHeads.forEach((noteHead) => noteHead.setFontSize(musicFontSize));

          if (hidden && !isStepRest) {
            note.setStyle({ fillStyle: scoreColors.hidden, strokeStyle: scoreColors.hidden });
            note.setLedgerLineStyle({ strokeStyle: scoreColors.hidden, lineWidth: 0 });
            return note;
          }

          sortedNotes.forEach(({ key }, keyIndex) => {
            note.setKeyStyle(keyIndex, { fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink });

            if (key.includes('#')) {
              const accidental = new Accidental('#').setStyle({ fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink });
              accidental.setFontSize(accidentalFontSize);
              note.addModifier(accidental, keyIndex);
            }
          });

          const annotationText = annotationForStep(step, sortedNotes);
          if (annotationText) {
            const label = new Annotation(annotationText)
              .setFont('Inter, Arial, sans-serif', compact ? 9 : 11, 800)
              .setJustification(AnnotationHorizontalJustify.CENTER)
              .setVerticalJustification(clef === 'bass' ? AnnotationVerticalJustify.BOTTOM : AnnotationVerticalJustify.TOP)
              .setStyle({ fillStyle: scoreColors.muted });

            note.addModifier(label, 0);
          }

          note
            .setStyle({ fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink })
            .setStemStyle({ fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink });
          note.setLedgerLineStyle({ strokeStyle: scoreColors.ledger, lineWidth: 1.45 });

          return note;
        };

        const trebleStave = makeStave('treble', topStaveY);
        const trebleNotes = scoreSteps.map(({ step }) => makeNote(step, 'treble', grandStaff && notesForClef(step, 'treble', true).length === 0));
        const trebleVoice = new Voice({ numBeats: Math.max(4, Math.ceil(totalBeats)), beatValue: 4 }).setMode(Voice.Mode.SOFT);
        trebleVoice.addTickables(trebleNotes);

        const voices = [trebleVoice];
        const staves = [trebleStave];
        let bassNotes: InstanceType<typeof StaveNote>[] = [];

        if (grandStaff) {
          const bassStave = makeStave('bass', bassStaveY);
          bassNotes = scoreSteps.map(({ step }) => makeNote(step, 'bass', notesForClef(step, 'bass', true).length === 0));
          const bassVoice = new Voice({ numBeats: Math.max(4, Math.ceil(totalBeats)), beatValue: 4 }).setMode(Voice.Mode.SOFT);
          bassVoice.addTickables(bassNotes);
          voices.push(bassVoice);
          staves.push(bassStave);

          new StaveConnector(trebleStave, bassStave).setType('brace').setContext(context).draw();
          new StaveConnector(trebleStave, bassStave).setType('singleLeft').setContext(context).draw();
          new StaveConnector(trebleStave, bassStave).setType('singleRight').setContext(context).draw();
        }

        const formatter = new Formatter();
        voices.forEach((voice) => formatter.joinVoices([voice]));
        formatter.format(voices, Math.max(compact ? 240 : 340, staveWidth - (compact ? 130 : 185)));
        trebleVoice.draw(context, trebleStave);
        if (grandStaff && voices[1] && staves[1]) {
          voices[1].draw(context, staves[1]);
        }

        const positionedNotes = grandStaff
          ? trebleNotes.map((note, index) => {
              const trebleNote = note as { getAbsoluteX?: () => number };
              const bassNote = bassNotes[index] as { getAbsoluteX?: () => number } | undefined;
              return trebleNote.getAbsoluteX?.() ?? bassNote?.getAbsoluteX?.() ?? staveX + index * noteSpacing;
            })
          : trebleNotes.map((note, index) => {
              const positionedNote = note as { getAbsoluteX?: () => number };
              return positionedNote.getAbsoluteX?.() ?? staveX + index * noteSpacing;
            });
        const lastPosition = positionedNotes.at(-1) ?? staveX;
        const positions = [...positionedNotes, lastPosition + noteSpacing * 0.95];

        layoutRef.current = {
          minOffset: Math.min(0, viewportWidth - width),
          maxOffset: 0,
          playheadX,
          positions,
        };
        applyScoreScroll(playheadStepIndexRef.current);
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
    resizeObserver.observe(container.parentElement ?? container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
    };
  }, [applyScoreScroll, scoreSteps, timeSignature]);

  return (
    <div className="score-renderer" aria-label="Bladmuziekweergave">
      <div className="score-playhead" aria-hidden="true" />
      <div className="score-playhead-label" aria-hidden="true">nu</div>
      {loadState !== 'ready' ? (
        <div className={`score-status ${loadState}`} aria-live="polite">
          {loadState === 'error' ? 'Notatie kon niet geladen worden' : 'Notatie laden...'}
        </div>
      ) : null}
      <div className="score-system" ref={containerRef} />
    </div>
  );
};
