import type { PianoKeyName } from '../types';

type PianoKey = {
  note: PianoKeyName;
  label: string;
  octave: number;
  accidental: boolean;
  frequency: number;
};

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const midiFor = (note: PianoKeyName) => {
  const [, name, octaveText] = note.match(/^([A-G]#?)(\d)$/) ?? [];
  const octave = Number(octaveText);
  return (octave + 1) * 12 + noteNames.indexOf(name);
};

const frequencyFor = (note: PianoKeyName) => {
  const midi = midiFor(note);
  return 440 * 2 ** ((midi - 69) / 12);
};

export const pianoKeys: PianoKey[] = [
  'C3',
  'C#3',
  'D3',
  'D#3',
  'E3',
  'F3',
  'F#3',
  'G3',
  'G#3',
  'A3',
  'A#3',
  'B3',
  'C4',
  'C#4',
  'D4',
  'D#4',
  'E4',
  'F4',
  'F#4',
  'G4',
  'G#4',
  'A4',
  'A#4',
  'B4',
].map((note) => ({
  note: note as PianoKeyName,
  label: note.replace('#', '♯'),
  octave: Number(note.at(-1)),
  accidental: note.includes('#'),
  frequency: frequencyFor(note as PianoKeyName),
}));

export const whiteKeys = pianoKeys.filter((key) => !key.accidental);
export const blackKeys = pianoKeys.filter((key) => key.accidental);

export const noteFromFrequency = (frequency: number): PianoKeyName | null => {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteName = noteNames[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const note = `${noteName}${octave}` as PianoKeyName;

  return pianoKeys.some((key) => key.note === note) ? note : null;
};

export const prettyKeys = (keys: PianoKeyName[]) => keys.map((key) => key.replace('#', '♯')).join(' - ');
