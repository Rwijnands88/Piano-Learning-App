import type { Timestamp } from 'firebase/firestore';

export type PianoKeyName =
  | 'C3'
  | 'C#3'
  | 'D3'
  | 'D#3'
  | 'E3'
  | 'F3'
  | 'F#3'
  | 'G3'
  | 'G#3'
  | 'A3'
  | 'A#3'
  | 'B3'
  | 'C4'
  | 'C#4'
  | 'D4'
  | 'D#4'
  | 'E4'
  | 'F4'
  | 'F#4'
  | 'G4'
  | 'G#4'
  | 'A4'
  | 'A#4'
  | 'B4';

export type LessonStep = {
  text: string;
  keys: PianoKeyName[];
  expectedNote?: PianoKeyName;
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  order: number;
  module: string;
  steps: LessonStep[];
};

export type ProgressRecord = {
  lessonId: string;
  completed: boolean;
  completedAt?: Timestamp | null;
};

export type LearningMode = 'listen' | 'manual';

export type FeedbackState = {
  tone: 'idle' | 'listening' | 'success' | 'warning' | 'error';
  message: string;
};
