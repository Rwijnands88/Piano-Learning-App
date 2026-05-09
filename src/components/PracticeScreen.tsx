import { ArrowLeft, ArrowRight, Check, Home, RotateCcw } from 'lucide-react';
import { prettyKeys } from '../data/piano';
import { ModeToggle } from './ModeToggle';
import { PianoKeyboard } from './PianoKeyboard';
import type { FeedbackState, LearningMode, Lesson, LessonStep, PianoKeyName } from '../types';

type PracticeScreenProps = {
  lesson: Lesson;
  step: LessonStep;
  stepIndex: number;
  mode: LearningMode;
  isListening: boolean;
  detectedNote: PianoKeyName | null;
  feedback: FeedbackState;
  completed: boolean;
  canGoBack: boolean;
  onModeChange: (mode: LearningMode) => void;
  onBackHome: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onRestart: () => void;
};

export const PracticeScreen = ({
  lesson,
  step,
  stepIndex,
  mode,
  isListening,
  detectedNote,
  feedback,
  completed,
  canGoBack,
  onModeChange,
  onBackHome,
  onPreviousStep,
  onNextStep,
  onRestart,
}: PracticeScreenProps) => {
  const progress = ((stepIndex + 1) / lesson.steps.length) * 100;
  const currentKeys = prettyKeys(step.keys);

  return (
    <section className="practice-screen" aria-label="Oefenmodus">
      <header className="practice-topbar">
        <button className="secondary-button compact" onClick={onBackHome} type="button">
          <Home aria-hidden="true" />
          Menu
        </button>
        <div className="practice-title">
          <span>{lesson.module}</span>
          <strong>{lesson.title}</strong>
        </div>
        <ModeToggle isListening={isListening} mode={mode} onChange={onModeChange} />
      </header>

      <div className="practice-progress" aria-label="Lesvoortgang">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="practice-main">
        <section className="practice-score-board">
          <div className="practice-staff" aria-hidden="true">
            <div className="practice-clef">𝄞</div>
            <div className="practice-playhead" />
            {Array.from({ length: 5 }, (_, index) => (
              <span className="practice-staff-line" key={index} style={{ top: `${28 + index * 10}%` }} />
            ))}
            {step.keys.map((key, index) => (
              <span className={`practice-note note-${index}`} key={key}>
                {key.replace('#', '♯')}
              </span>
            ))}
          </div>

          <div className="practice-instruction">
            <span className="step-pill">Stap {stepIndex + 1}/{lesson.steps.length}</span>
            <h1>{completed ? 'Les afgerond' : step.text}</h1>
            <p>{completed ? 'Je voortgang is opgeslagen. Kies een volgende les in het menu.' : `Speel: ${currentKeys}`}</p>
          </div>
        </section>

        <aside className={`practice-feedback ${feedback.tone}`}>
          <span>Feedback</span>
          <strong>{feedback.message}</strong>
          <dl>
            <div>
              <dt>Verwacht</dt>
              <dd>{step.expectedNote?.replace('#', '♯') ?? currentKeys}</dd>
            </div>
            <div>
              <dt>Live</dt>
              <dd>{detectedNote ? detectedNote.replace('#', '♯') : '...'}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="practice-controls">
        <button className="secondary-button" disabled={!canGoBack} onClick={onPreviousStep} type="button">
          <ArrowLeft aria-hidden="true" />
          Vorige
        </button>
        <button className="secondary-button" onClick={onRestart} type="button">
          <RotateCcw aria-hidden="true" />
          Opnieuw
        </button>
        <button className="primary-button" onClick={onNextStep} type="button">
          {completed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {completed ? 'Klaar' : 'Volgende'}
        </button>
      </div>

      <PianoKeyboard detectedKey={detectedNote} expectedKey={step.expectedNote} lessonKeys={step.keys} />
    </section>
  );
};
