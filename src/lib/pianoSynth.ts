import { pianoKeys } from '../data/piano';
import type { PianoKeyName } from '../types';

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

const frequencyByNote = new Map(pianoKeys.map((key) => [key.note, key.frequency]));

const getAudioContext = () => {
  audioContext ??= new AudioContext();

  if (!masterGain) {
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.42;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
};

export const playPianoNote = async (note: PianoKeyName) => {
  const frequency = frequencyByNote.get(note);

  if (!frequency) {
    return;
  }

  const context = getAudioContext();

  if (context.state === 'suspended') {
    await context.resume();
  }

  const now = context.currentTime;
  const noteGain = context.createGain();
  const tone = context.createOscillator();
  const body = context.createOscillator();

  tone.type = 'triangle';
  tone.frequency.setValueAtTime(frequency, now);

  body.type = 'sine';
  body.frequency.setValueAtTime(frequency * 2, now);

  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.exponentialRampToValueAtTime(0.62, now + 0.012);
  noteGain.gain.exponentialRampToValueAtTime(0.22, now + 0.16);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);

  tone.connect(noteGain);
  body.connect(noteGain);
  noteGain.connect(masterGain ?? context.destination);

  tone.start(now);
  body.start(now);
  tone.stop(now + 0.86);
  body.stop(now + 0.86);
};
