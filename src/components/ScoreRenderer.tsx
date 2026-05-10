import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadVexFlow } from '../lib/vexflowLoader';
import type { ScoreEvent, ScoreTimeline } from '../music/scoreTimeline';
import type { FeedbackState, LessonStep, PianoKeyName, StepNote } from '../types';

type ScoreRendererProps = {
  timeline: ScoreTimeline;
  activeStepIndex: number;
  currentBeat: number;
  feedbackTone?: FeedbackState['tone'];
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

const annotationForStep = (step: LessonStep, stepNotes: StepNote[]) => {
  const fingers = stepNotes.map((note) => note.finger).filter(Boolean).join('-');

  if (fingers) {
    return fingers;
  }

  if (step.scoreLabel === 'stacc.') {
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

const restDurationsForBeats = (beats: number): Array<'h' | 'q' | '8' | '16'> => {
  const durations: Array<'h' | 'q' | '8' | '16'> = [];
  let remaining = Number(beats.toFixed(4));

  while (remaining >= 2) {
    durations.push('h');
    remaining = Number((remaining - 2).toFixed(4));
  }

  while (remaining >= 1) {
    durations.push('q');
    remaining = Number((remaining - 1).toFixed(4));
  }

  while (remaining >= 0.5) {
    durations.push('8');
    remaining = Number((remaining - 0.5).toFixed(4));
  }

  while (remaining >= 0.25) {
    durations.push('16');
    remaining = Number((remaining - 0.25).toFixed(4));
  }

  return durations;
};

type ScoreLayout = {
  minOffset: number;
  maxOffset: number;
  playheadX: number;
  positions: Array<{ beat: number; x: number }>;
  scrolling: boolean;
  noteTop: number;
  noteHeight: number;
};

export const ScoreRenderer = ({
  timeline,
  activeStepIndex,
  currentBeat,
  feedbackTone = 'idle',
}: ScoreRendererProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentBeatRef = useRef(currentBeat);
  const activeStepIndexRef = useRef(activeStepIndex);
  const feedbackToneRef = useRef<FeedbackState['tone']>(feedbackTone);
  const layoutRef = useRef<ScoreLayout | null>(null);
  const renderRequestRef = useRef(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const scoreEvents = useMemo(() => {
    const remainder = Number((timeline.totalBeats % timeline.beatsPerMeasure).toFixed(4));

    if (remainder === 0) {
      return timeline.events;
    }

    const paddingBeats = Number((timeline.beatsPerMeasure - remainder).toFixed(4));
    const paddingDurations = restDurationsForBeats(paddingBeats);
    let beatCursor = timeline.totalBeats;

    return [
      ...timeline.events,
      ...paddingDurations.map((duration, paddingIndex) => {
        const beatDuration = duration === 'h' ? 2 : duration === 'q' ? 1 : duration === '8' ? 0.5 : 0.25;
        const event: ScoreEvent = {
          id: `${timeline.lessonId}-padding-${paddingIndex}`,
          stepIndex: timeline.events.length + paddingIndex,
          step: {
            text: 'Rust tot het einde van de maat.',
            keys: [],
            notes: [{ key: 'B3', duration, hand: 'right', rest: true }],
            duration,
            recognitionMode: 'manual-score',
          },
          notes: [{ key: 'B3', duration, hand: 'right', rest: true }],
          keys: [],
          recognitionMode: 'manual-score',
          beatStart: beatCursor,
          beatDuration,
          beatEnd: beatCursor + beatDuration,
          measure: Math.floor(beatCursor / timeline.beatsPerMeasure) + 1,
          beatInMeasure: beatCursor % timeline.beatsPerMeasure,
          isRest: true,
        };

        beatCursor += beatDuration;
        return event;
      }),
    ];
  }, [timeline]);
  const displayTotalBeats = scoreEvents.at(-1)?.beatEnd ?? timeline.totalBeats;
  const displayMeasureCount = Math.max(1, Math.ceil(displayTotalBeats / timeline.beatsPerMeasure));
  const scrollingScore = timeline.autoPlayable;
  const updateFeedbackOverlay = useCallback((stepIndex: number, tone: FeedbackState['tone']) => {
    const container = containerRef.current;
    const layout = layoutRef.current;

    if (!container || !layout || layout.positions.length === 0) {
      return;
    }

    const event = scoreEvents[stepIndex];
    const position = layout.positions[Math.min(stepIndex, layout.positions.length - 2)];
    let marker = container.querySelector<HTMLDivElement>('.score-note-target');

    if (!event || !position) {
      marker?.remove();
      return;
    }

    if (!marker) {
      marker = document.createElement('div');
      marker.setAttribute('aria-hidden', 'true');
      container.appendChild(marker);
    }

    const label = event.keys[0]?.replace('#', '♯') ?? (event.isRest ? 'rust' : 'nu');
    marker.className = `score-note-target ${tone}`;
    marker.dataset.label = label;
    marker.style.left = `${position.x}px`;
    marker.style.top = `${layout.noteTop}px`;
    marker.style.height = `${layout.noteHeight}px`;
  }, [scoreEvents]);

  const applyScoreScroll = useCallback((nextBeat: number) => {
    const container = containerRef.current;
    const layout = layoutRef.current;
    const viewport = container?.parentElement;

    if (!container || !layout || layout.positions.length === 0) {
      return;
    }

    const lastPosition = layout.positions.at(-1) ?? layout.positions[0];
    const clampedBeat = Math.max(0, Math.min(nextBeat, lastPosition.beat));
    let left = layout.positions[0];
    let right = lastPosition;

    for (let index = 0; index < layout.positions.length - 1; index += 1) {
      const current = layout.positions[index];
      const next = layout.positions[index + 1];

      if (clampedBeat >= current.beat && clampedBeat <= next.beat) {
        left = current;
        right = next;
        break;
      }
    }

    const beatSpan = Math.max(0.0001, right.beat - left.beat);
    const localProgress = Math.max(0, Math.min(1, (clampedBeat - left.beat) / beatSpan));
    const playheadTargetX = left.x + (right.x - left.x) * localProgress;

    if (!layout.scrolling) {
      viewport?.style.setProperty('--score-playhead-x', `${playheadTargetX}px`);
      container.style.transform = 'translate3d(0, 0, 0)';
      return;
    }

    const offset = Math.min(layout.maxOffset, Math.max(layout.minOffset, layout.playheadX - playheadTargetX));

    container.style.transform = `translate3d(${offset}px, 0, 0)`;
  }, []);

  useEffect(() => {
    currentBeatRef.current = currentBeat;
    applyScoreScroll(currentBeat);
  }, [applyScoreScroll, currentBeat]);

  useEffect(() => {
    activeStepIndexRef.current = activeStepIndex;
    feedbackToneRef.current = feedbackTone;
    updateFeedbackOverlay(activeStepIndex, feedbackTone);
  }, [activeStepIndex, feedbackTone, updateFeedbackOverlay]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || scoreEvents.length === 0) {
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
        const compact = rawViewportWidth < 720 || rawViewportHeight < 280;
        const grandStaff = usesGrandStaff(scoreEvents.map((event) => event.step));
        const viewportWidth = Math.max(rawViewportWidth, compact ? 320 : 420);
        const viewportHeight = Math.max(rawViewportHeight, grandStaff ? 360 : 310);
        const pixelsPerBeat = compact ? 150 : 190;
        const noteSpacing = pixelsPerBeat;
        const playheadX = scrollingScore ? viewportWidth * (compact ? 0.38 : 0.42) : viewportWidth * 0.5;
        const leadIn = scrollingScore ? playheadX : 0;
        const tailOut = scrollingScore ? viewportWidth - playheadX + noteSpacing * 1.45 : Math.max(36, viewportWidth * 0.04);
        const width = scrollingScore
          ? Math.max(viewportWidth, leadIn + Math.max(scoreEvents.length * 86, displayTotalBeats * pixelsPerBeat) + tailOut)
          : viewportWidth;
        const height = viewportHeight;
        const staveX = scrollingScore ? Math.max(compact ? 34 : 48, leadIn * 0.72) : Math.max(compact ? 56 : 72, viewportWidth * 0.07);
        const lineSpacing = grandStaff
          ? Math.max(compact ? 22 : 25, Math.min(36, height * 0.082))
          : Math.max(compact ? 29 : 33, Math.min(46, height * 0.14));
        const musicFontSize = grandStaff ? (compact ? 48 : 54) : compact ? 60 : 68;
        const accidentalFontSize = grandStaff ? (compact ? 33 : 37) : compact ? 38 : 42;
        const topStaveY = grandStaff ? Math.max(18, height * 0.07) : Math.max(18, height * 0.16);
        const bassStaveY = topStaveY + lineSpacing * 6.25;
        const staveWidth = scrollingScore
          ? width - staveX - Math.max(120, tailOut * 0.72)
          : width - staveX - Math.max(32, viewportWidth * 0.05);
        const totalBeats = displayTotalBeats;

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
            .addTimeSignature(timeline.timeSignature ?? '4/4')
            .setStyle({ fillStyle: scoreColors.ink, strokeStyle: scoreColors.ink });
          stave.setDefaultLedgerLineStyle({ strokeStyle: scoreColors.ledger, lineWidth: 1.45 });
          stave.setContext(context).draw();

          return stave;
        };

        const makeNote = (event: ScoreEvent, clef: ScoreClef, hidden = false) => {
          const duration = durationForStep(event.step);
          const stepNotes = hidden ? [] : notesForClef(event.step, clef, grandStaff);
          const isStepRest = event.isRest;
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

          const annotationText = annotationForStep(event.step, sortedNotes);
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
        const trebleNotes = scoreEvents.map((event) =>
          makeNote(event, 'treble', grandStaff && notesForClef(event.step, 'treble', true).length === 0),
        );
        const trebleVoice = new Voice({ numBeats: Math.max(4, Math.ceil(totalBeats)), beatValue: 4 }).setMode(Voice.Mode.SOFT);
        trebleVoice.addTickables(trebleNotes);

        const voices = [trebleVoice];
        const staves = [trebleStave];
        let bassNotes: InstanceType<typeof StaveNote>[] = [];

        if (grandStaff) {
          const bassStave = makeStave('bass', bassStaveY);
          bassNotes = scoreEvents.map((event) => makeNote(event, 'bass', notesForClef(event.step, 'bass', true).length === 0));
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
        formatter.format(voices, Math.max(compact ? 240 : 340, staveWidth - (scrollingScore ? (compact ? 130 : 185) : 82)));
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
        const positions = [
          ...scoreEvents.map((event, index) => ({
            beat: event.beatStart,
            x: positionedNotes[index] ?? staveX + index * noteSpacing,
          })),
          {
            beat: displayTotalBeats,
            x: lastPosition + noteSpacing * 0.95,
          },
        ];
        const xForBeat = (beat: number) => {
          const finalPosition = positions.at(-1) ?? positions[0];
          let left = positions[0];
          let right = finalPosition;

          for (let index = 0; index < positions.length - 1; index += 1) {
            const current = positions[index];
            const next = positions[index + 1];

            if (beat >= current.beat && beat <= next.beat) {
              left = current;
              right = next;
              break;
            }
          }

          const beatSpan = Math.max(0.0001, right.beat - left.beat);
          const progress = Math.max(0, Math.min(1, (beat - left.beat) / beatSpan));
          return left.x + (right.x - left.x) * progress;
        };

        const svg = container.querySelector('svg');
        if (svg) {
          const namespace = 'http://www.w3.org/2000/svg';
          const measureTop = topStaveY + lineSpacing * 0.98;
          const measureBottom = grandStaff ? bassStaveY + lineSpacing * 4.98 : topStaveY + lineSpacing * 4.98;

          for (let measure = 1; measure < displayMeasureCount; measure += 1) {
            const measureBeat = measure * timeline.beatsPerMeasure;
            const x = xForBeat(measureBeat);
            const line = document.createElementNS(namespace, 'line');
            line.setAttribute('x1', String(x));
            line.setAttribute('x2', String(x));
            line.setAttribute('y1', String(measureTop));
            line.setAttribute('y2', String(measureBottom));
            line.setAttribute('stroke', scoreColors.ink);
            line.setAttribute('stroke-opacity', '0.34');
            line.setAttribute('stroke-width', '1.3');
            line.setAttribute('shape-rendering', 'geometricPrecision');
            svg.appendChild(line);
          }
        }

        layoutRef.current = {
          minOffset: Math.min(0, viewportWidth - width),
          maxOffset: 0,
          playheadX,
          positions,
          scrolling: scrollingScore,
          noteTop: grandStaff ? Math.max(8, topStaveY - lineSpacing * 0.35) : Math.max(8, topStaveY - lineSpacing * 0.8),
          noteHeight: grandStaff ? bassStaveY + lineSpacing * 5.7 - topStaveY : lineSpacing * 6.4,
        };
        applyScoreScroll(currentBeatRef.current);
        updateFeedbackOverlay(activeStepIndexRef.current, feedbackToneRef.current);
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
  }, [applyScoreScroll, scoreEvents, scrollingScore, timeline, updateFeedbackOverlay]);

  return (
    <div
      className={`${scrollingScore ? 'score-renderer scrolling' : 'score-renderer static'} tone-${feedbackTone}`}
      aria-label={`Bladmuziekweergave, stap ${activeStepIndex + 1}`}
    >
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
