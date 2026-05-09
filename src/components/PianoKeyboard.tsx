import { pianoKeys, whiteKeys } from '../data/piano';
import type { CSSProperties } from 'react';
import type { PianoKeyName } from '../types';

type PianoKeyboardProps = {
  lessonKeys: PianoKeyName[];
  detectedKey: PianoKeyName | null;
  expectedKey?: PianoKeyName;
};

const whiteIndexFor = (note: PianoKeyName) => whiteKeys.findIndex((key) => key.note === note);

const blackOffsets: Record<string, number> = {
  'C#': 0.73,
  'D#': 1.72,
  'F#': 3.72,
  'G#': 4.72,
  'A#': 5.72,
};

export const PianoKeyboard = ({ lessonKeys, detectedKey, expectedKey }: PianoKeyboardProps) => {
  const lessonSet = new Set(lessonKeys);

  return (
    <section className="keyboard-section" aria-label="Visueel piano toetsenbord">
      <div className="keyboard-legend">
        <span><i className="legend lesson" /> Les</span>
        <span><i className="legend detected" /> Live</span>
        <span><i className="legend expected" /> Verwacht</span>
      </div>
      <div className="piano" style={{ '--white-count': whiteKeys.length } as CSSProperties}>
        <div className="white-row">
          {whiteKeys.map((key) => {
            const classes = [
              'piano-key',
              'white-key',
              lessonSet.has(key.note) ? 'lesson-key' : '',
              detectedKey === key.note ? 'detected-key' : '',
              expectedKey === key.note ? 'expected-key' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div aria-label={key.label} className={classes} key={key.note}>
                <span>{key.label}</span>
              </div>
            );
          })}
        </div>
        <div className="black-row" aria-hidden="true">
          {pianoKeys
            .filter((key) => key.accidental)
            .map((key) => {
              const pitchName = key.note.slice(0, -1);
              const octave = Number(key.note.at(-1));
              const octaveOffset = octave === 4 ? 7 : 0;
              const left = `${((octaveOffset + blackOffsets[pitchName]) / whiteKeys.length) * 100}%`;
              const classes = [
                'piano-key',
                'black-key',
                lessonSet.has(key.note) ? 'lesson-key' : '',
                detectedKey === key.note ? 'detected-key' : '',
                expectedKey === key.note ? 'expected-key' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div className={classes} key={key.note} style={{ left }}>
                  <span>{key.label}</span>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
};
