import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { prettyKeys } from '../data/piano';
import type { FeedbackState, Lesson, LessonStep, PianoKeyName } from '../types';

type LessonStageProps = {
  lesson: Lesson;
  step: LessonStep;
  stepIndex: number;
  detectedNote: PianoKeyName | null;
  feedback: FeedbackState;
  completed: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onNext: () => void;
  onRestart: () => void;
};

export const LessonStage = ({
  lesson,
  step,
  stepIndex,
  detectedNote,
  feedback,
  completed,
  canGoBack,
  onBack,
  onNext,
  onRestart,
}: LessonStageProps) => {
  const progress = ((stepIndex + 1) / lesson.steps.length) * 100;

  return (
    <section className="lesson-stage" aria-labelledby="lesson-title">
      <div className="lesson-title-row">
        <div>
          <p className="eyebrow">{lesson.module}</p>
          <h1 id="lesson-title">{lesson.title}</h1>
        </div>
        <div className="step-count">
          {stepIndex + 1}
          <span>/{lesson.steps.length}</span>
        </div>
      </div>

      <div className="progress-track" aria-label="Lesvoortgang">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="instruction-grid">
        <article className="instruction-panel">
          <h2>{completed ? 'Les afgerond' : 'Speel nu'}</h2>
          <p>{completed ? 'Mooi. Je voortgang is opgeslagen bij je account.' : step.text}</p>
          <div className="keys-strip" aria-label="Te spelen toetsen">
            {step.keys.map((key) => (
              <span key={key}>{key.replace('#', '♯')}</span>
            ))}
          </div>
        </article>

        <aside className={`feedback-panel ${feedback.tone}`}>
          <h2>Feedback</h2>
          <p>{feedback.message}</p>
          <dl>
            <div>
              <dt>Verwacht</dt>
              <dd>{step.expectedNote?.replace('#', '♯') ?? prettyKeys(step.keys)}</dd>
            </div>
            <div>
              <dt>Live</dt>
              <dd>{detectedNote ? detectedNote.replace('#', '♯') : '...'}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="lesson-actions">
        <button className="secondary-button" disabled={!canGoBack} onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" />
          Vorige
        </button>
        <button className="secondary-button" onClick={onRestart} type="button">
          <RotateCcw aria-hidden="true" />
          Opnieuw
        </button>
        <button className="primary-button" onClick={onNext} type="button">
          {completed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {completed ? 'Voltooid' : 'Volgende stap'}
        </button>
      </div>
    </section>
  );
};
