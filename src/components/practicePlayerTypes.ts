import type { ScoreTimeline } from '../music/scoreTimeline';
import type {
  FeedbackState,
  LearningMode,
  Lesson,
  LessonStep,
  PianoKeyName,
  PracticeNoteFeedback,
  PracticeProfile,
} from '../types';

export type PracticeScreenProps = {
  lesson: Lesson;
  step: LessonStep;
  stepIndex: number;
  mode: LearningMode;
  isListening: boolean;
  detectedNote: PianoKeyName | null;
  detectedNotes: PianoKeyName[];
  feedback: FeedbackState;
  noteFeedback: PracticeNoteFeedback;
  completed: boolean;
  canGoBack: boolean;
  onModeChange: (mode: LearningMode) => void;
  onBackHome: () => void;
  onKeyPress: (note: PianoKeyName) => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onRestart: () => void;
  onTransportStepChange: (stepIndex: number) => void;
  onTransportComplete: () => void;
  practiceProfile: PracticeProfile;
};

export type PracticePlayerProps = PracticeScreenProps & {
  timeline: ScoreTimeline;
};
