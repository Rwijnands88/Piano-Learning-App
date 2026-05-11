import { memo } from 'react';
import { pianoKeys, whiteKeys } from '../data/piano';
import type { FeedbackState, PianoKeyName, PracticeNoteFeedback } from '../types';

type PremiumKeyboardProps = {
  lessonKeys: PianoKeyName[];
  upcomingKeys?: PianoKeyName[];
  detectedKey: PianoKeyName | null;
  expectedKey?: PianoKeyName;
  feedbackTone?: FeedbackState['tone'];
  noteFeedback?: PracticeNoteFeedback;
  disabled?: boolean;
  showLabels?: boolean;
  cueActive?: boolean;
  onKeyPress?: (note: PianoKeyName) => void;
};

const blackOffsets: Record<string, number> = {
  'C#': 0.72,
  'D#': 1.72,
  'F#': 3.72,
  'G#': 4.72,
  'A#': 5.72,
};

export const PremiumKeyboard = memo(function PremiumKeyboard({
  lessonKeys,
  upcomingKeys = [],
  detectedKey,
  expectedKey,
  feedbackTone = 'idle',
  noteFeedback,
  disabled = false,
  showLabels = true,
  cueActive = false,
  onKeyPress,
}: PremiumKeyboardProps) {
  const lessonSet = new Set(lessonKeys);
  const upcomingSet = new Set(upcomingKeys);
  const canPlay = Boolean(onKeyPress) && !disabled;

  return (
    <div className={`premium-keys feedback-${noteFeedback?.kind ?? feedbackTone} ${cueActive ? 'cue-near' : ''}`} aria-label="Piano toetsenbord">
      <div className="premium-white-row">
        {whiteKeys.map((key) => {
          const classes = [
            lessonSet.has(key.note) ? 'lesson' : '',
            upcomingSet.has(key.note) && !lessonSet.has(key.note) ? 'upcoming' : '',
            detectedKey === key.note ? 'detected' : '',
            expectedKey === key.note ? 'expected' : '',
            noteFeedback?.expectedNote === key.note ? `target-${noteFeedback.kind}` : '',
            noteFeedback?.detectedNote === key.note ? `attempt-${noteFeedback.kind}` : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              aria-label={`Speel ${key.label}`}
              className={classes}
              disabled={!canPlay}
              key={key.note}
              onClick={() => onKeyPress?.(key.note)}
              type="button"
            >
              <b>{showLabels && (lessonSet.has(key.note) || detectedKey === key.note) ? key.label : ''}</b>
            </button>
          );
        })}
      </div>
      <div className="premium-black-row">
        {pianoKeys
          .filter((key) => key.accidental)
          .map((key) => {
            const pitchName = key.note.slice(0, -1);
            const octave = Number(key.note.at(-1));
            const octaveOffset = octave === 4 ? 7 : 0;
            const left = `${((octaveOffset + blackOffsets[pitchName]) / whiteKeys.length) * 100}%`;
            const classes = [
              lessonSet.has(key.note) ? 'lesson' : '',
              upcomingSet.has(key.note) && !lessonSet.has(key.note) ? 'upcoming' : '',
              detectedKey === key.note ? 'detected' : '',
              expectedKey === key.note ? 'expected' : '',
              noteFeedback?.expectedNote === key.note ? `target-${noteFeedback.kind}` : '',
              noteFeedback?.detectedNote === key.note ? `attempt-${noteFeedback.kind}` : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                aria-label={`Speel ${key.label}`}
                className={classes}
                disabled={!canPlay}
                key={key.note}
                onClick={() => onKeyPress?.(key.note)}
                style={{ left }}
                type="button"
              >
                <b>{showLabels && (lessonSet.has(key.note) || detectedKey === key.note) ? key.label : ''}</b>
              </button>
            );
          })}
      </div>
    </div>
  );
});
