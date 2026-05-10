import { pianoKeys, whiteKeys } from '../data/piano';
import type { FeedbackState, PianoKeyName } from '../types';

type PremiumKeyboardProps = {
  lessonKeys: PianoKeyName[];
  detectedKey: PianoKeyName | null;
  expectedKey?: PianoKeyName;
  feedbackTone?: FeedbackState['tone'];
  disabled?: boolean;
  onKeyPress?: (note: PianoKeyName) => void;
};

const blackOffsets: Record<string, number> = {
  'C#': 0.72,
  'D#': 1.72,
  'F#': 3.72,
  'G#': 4.72,
  'A#': 5.72,
};

export const PremiumKeyboard = ({
  lessonKeys,
  detectedKey,
  expectedKey,
  feedbackTone = 'idle',
  disabled = false,
  onKeyPress,
}: PremiumKeyboardProps) => {
  const lessonSet = new Set(lessonKeys);
  const canPlay = Boolean(onKeyPress) && !disabled;

  return (
    <div className={`premium-keys feedback-${feedbackTone}`} aria-label="Piano toetsenbord">
      <div className="premium-white-row">
        {whiteKeys.map((key) => {
          const classes = [
            lessonSet.has(key.note) ? 'lesson' : '',
            detectedKey === key.note ? 'detected' : '',
            expectedKey === key.note ? 'expected' : '',
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
              <b>{lessonSet.has(key.note) || detectedKey === key.note ? key.label : ''}</b>
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
              detectedKey === key.note ? 'detected' : '',
              expectedKey === key.note ? 'expected' : '',
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
                <b>{lessonSet.has(key.note) || detectedKey === key.note ? key.label : ''}</b>
              </button>
            );
          })}
      </div>
    </div>
  );
};
