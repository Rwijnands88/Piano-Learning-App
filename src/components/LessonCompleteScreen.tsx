import { ArrowLeft, ArrowRight, CheckCircle2, Home, RotateCcw } from 'lucide-react';
import type { Lesson } from '../types';

type LessonCompleteScreenProps = {
  lesson: Lesson;
  nextLesson?: Lesson;
  completedCount: number;
  totalLessons: number;
  onBackHome: () => void;
  onRepeat: () => void;
  onNextLesson: () => void;
};

const compactModuleName = (module: string) => module.replace(/^\d+\.\s*/, '');

export const LessonCompleteScreen = ({
  lesson,
  nextLesson,
  completedCount,
  totalLessons,
  onBackHome,
  onRepeat,
  onNextLesson,
}: LessonCompleteScreenProps) => {
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <section className="lesson-finale premium-live-stage" aria-label="Les afgerond">
      <main className="finale-panel">
        <div className="finale-mark">
          <CheckCircle2 aria-hidden="true" />
        </div>
        <span>{compactModuleName(lesson.module)}</span>
        <h1>{lesson.title} afgerond</h1>
        <p>Mooi. Je hebt deze oefening opgeslagen. Neem even adem, herhaal hem rustig of ga door naar de volgende stap.</p>

        <div className="finale-progress" aria-label={`${progressPercent}% programma afgerond`}>
          <strong>{completedCount}/{totalLessons}</strong>
          <small>lessen afgerond</small>
          <i><b style={{ width: `${progressPercent}%` }} /></i>
        </div>

        {nextLesson ? (
          <div className="finale-next">
            <small>Volgende les</small>
            <strong>{nextLesson.title}</strong>
            <span>{nextLesson.estimatedMinutes ?? 8} min · {compactModuleName(nextLesson.module)}</span>
          </div>
        ) : null}

        <div className="finale-actions">
          <button onClick={onBackHome} type="button">
            <Home aria-hidden="true" />
            Menu
          </button>
          <button onClick={onRepeat} type="button">
            <RotateCcw aria-hidden="true" />
            Herhaal
          </button>
          <button className="primary" onClick={onNextLesson} type="button">
            {nextLesson ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
            {nextLesson ? 'Volgende' : 'Terug'}
          </button>
        </div>
      </main>
    </section>
  );
};
