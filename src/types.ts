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

export type PianoHand = 'right' | 'left' | 'both';

export type FingerNumber = 1 | 2 | 3 | 4 | 5;

export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16';

export type StepNote = {
  key: PianoKeyName;
  duration?: NoteDuration;
  finger?: FingerNumber;
  hand?: PianoHand;
  rest?: boolean;
};

export type RecognitionMode = 'single-note' | 'melody' | 'chord' | 'manual-score';

export type LessonStep = {
  text: string;
  keys: PianoKeyName[];
  expectedNote?: PianoKeyName;
  notes?: StepNote[];
  duration?: NoteDuration;
  hand?: PianoHand;
  count?: string;
  coaching?: string;
  scoreLabel?: string;
  recognitionMode?: RecognitionMode;
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  order: number;
  module: string;
  steps: LessonStep[];
  level?: 'starter' | 'beginner' | 'late-beginner' | 'intermediate';
  estimatedMinutes?: number;
  tempo?: number;
  timeSignature?: '2/4' | '3/4' | '4/4' | '6/8';
  focus?: string[];
  tags?: string[];
  source?: 'original' | 'traditional' | 'public-domain' | 'technique';
};

export type ProgressRecord = {
  lessonId: string;
  completed: boolean;
  completedAt?: Timestamp | null;
};

export type LearningMode = 'listen' | 'manual';

export type PracticeProfile = 'premium' | 'ivory-light' | 'ipad-light';

export type FeedbackState = {
  tone: 'idle' | 'listening' | 'success' | 'warning' | 'error';
  message: string;
};

export type PracticeNoteFeedbackKind = 'pending' | 'active' | 'correct' | 'late' | 'wrong' | 'missed';

export type PracticeNoteFeedback = {
  kind: PracticeNoteFeedbackKind;
  stepIndex: number;
  expectedNote?: PianoKeyName;
  detectedNote?: PianoKeyName | null;
  message: string;
  pulseId: number;
};
