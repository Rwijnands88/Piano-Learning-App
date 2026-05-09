import { pianoKeys, whiteKeys } from '../data/piano';
import type { PianoKeyName } from '../types';

type PremiumKeyboardProps = {
  lessonKeys: PianoKeyName[];
  detectedKey: PianoKeyName | null;
  expectedKey?: PianoKeyName;
};

const blackOffsets: Record<string, number> = {
  'C#': 0.72,
  'D#': 1.72,
  'F#': 3.72,
  'G#': 4.72,
  'A#': 5.72,
};

export const PremiumKeyboard = ({ lessonKeys, detectedKey, expectedKey }: PremiumKeyboardProps) => {
  const lessonSet = new Set(lessonKeys);

  return (
    <div className="premium-keys" aria-label="Piano toetsenbord">
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
            <span className={classes} key={key.note}>
              <b>{lessonSet.has(key.note) || detectedKey === key.note ? key.label : ''}</b>
            </span>
          );
        })}
      </div>
      <div className="premium-black-row" aria-hidden="true">
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
              <i className={classes} key={key.note} style={{ left }}>
                <b>{lessonSet.has(key.note) || detectedKey === key.note ? key.label : ''}</b>
              </i>
            );
          })}
      </div>
    </div>
  );
};
