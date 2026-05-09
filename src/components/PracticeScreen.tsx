import { ArrowLeft, ArrowRight, Check, ChevronLeft, Hand, Mic, RotateCcw } from 'lucide-react';
import { prettyKeys } from '../data/piano';
import { PremiumKeyboard } from './PremiumKeyboard';
import { ScoreRenderer } from './ScoreRenderer';
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
  onKeyPress: (note: PianoKeyName) => void;
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
  onKeyPress,
  onPreviousStep,
  onNextStep,
  onRestart,
}: PracticeScreenProps) => {
  const progress = ((stepIndex + 1) / lesson.steps.length) * 100;
  const currentKeys = prettyKeys(step.keys);
  const featuredKey = step.expectedNote ?? step.keys[0];
  const feedbackLabel = {
    idle: 'Klaar',
    listening: 'Luistert',
    success: 'Goed',
    warning: 'Let op',
    error: 'Nog eens',
  }[feedback.tone];

  return (
    <section className="premium-stage premium-live-stage premium-practice-live" aria-label="Oefenmodus">
      <header className="premium-practice-top">
        <button className="premium-round" onClick={onBackHome} type="button" aria-label="Terug naar menu">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <span>{lesson.module}</span>
          <strong>{lesson.title}</strong>
        </div>

        <div className="premium-mode-cluster" role="group" aria-label="Leermodus">
          <button
            className={mode === 'listen' ? 'listening' : ''}
            onClick={() => onModeChange('listen')}
            type="button"
          >
            <Mic aria-hidden="true" />
            Luisteren
            {mode === 'listen' && isListening ? <i aria-label="Microfoon actief" /> : null}
          </button>
          <button
            className={mode === 'manual' ? 'listening' : ''}
            onClick={() => onModeChange('manual')}
            type="button"
          >
            <Hand aria-hidden="true" />
            Handmatig
          </button>
        </div>
      </header>

      <div className="premium-progress" aria-label="Lesvoortgang">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="premium-practice-stage">
        <section className="premium-score" aria-label="Lesstap">
          <div className="premium-score-copy">
            <span>Stap {stepIndex + 1}/{lesson.steps.length}</span>
            <h1>{completed ? 'Les afgerond' : step.text}</h1>
            <p>{completed ? 'Je voortgang is opgeslagen. Kies straks de volgende les in het menu.' : `Speel: ${currentKeys}`}</p>
          </div>
          <ScoreRenderer feedbackTone={feedback.tone} stepIndex={stepIndex} steps={lesson.steps} />
        </section>

        <aside className={`premium-coach ${feedback.tone}`}>
          <span>{feedbackLabel}</span>
          <strong>{featuredKey.replace('#', '♯')}</strong>
          <p>{feedback.message}</p>
          <div className="premium-feedback-meter">
            <i />
            <span>
              {detectedNote
                ? `${mode === 'manual' ? 'Tik' : 'Live'}: ${detectedNote.replace('#', '♯')}`
                : mode === 'manual'
                  ? 'Tik een toets op het scherm'
                  : 'Nog geen noot gehoord'}
            </span>
          </div>
          <dl>
            <div>
              <dt>Verwacht</dt>
              <dd>{featuredKey.replace('#', '♯')}</dd>
            </div>
            <div>
              <dt>Akkoord</dt>
              <dd>{currentKeys}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="premium-practice-controls">
        <button disabled={!canGoBack} onClick={onPreviousStep} type="button">
          <ArrowLeft aria-hidden="true" />
          Vorige
        </button>
        <button onClick={onRestart} type="button">
          <RotateCcw aria-hidden="true" />
          Opnieuw
        </button>
        <button onClick={onNextStep} type="button">
          {completed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {completed ? 'Klaar' : 'Volgende'}
        </button>
      </div>

      <PremiumKeyboard
        detectedKey={detectedNote}
        disabled={completed || mode !== 'manual'}
        expectedKey={step.expectedNote}
        lessonKeys={step.keys}
        onKeyPress={onKeyPress}
      />
    </section>
  );
};
