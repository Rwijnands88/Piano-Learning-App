import { CheckCircle2, Circle, Layers3 } from 'lucide-react';
import type { Lesson } from '../types';

type LessonListProps = {
  lessons: Lesson[];
  selectedLessonId: string;
  completedLessonIds: Set<string>;
  onSelect: (lessonId: string) => void;
};

export const LessonList = ({ lessons, selectedLessonId, completedLessonIds, onSelect }: LessonListProps) => {
  const modules = lessons.reduce<Record<string, Lesson[]>>((groups, lesson) => {
    groups[lesson.module] = [...(groups[lesson.module] ?? []), lesson];
    return groups;
  }, {});

  return (
    <aside className="lesson-list" aria-label="Lessen">
      <div className="panel-heading">
        <Layers3 aria-hidden="true" />
        <h2>Leerlijn</h2>
      </div>

      {Object.entries(modules).map(([module, moduleLessons]) => (
        <section className="lesson-module" key={module}>
          <h3>{module}</h3>
          {moduleLessons.map((lesson) => {
            const completed = completedLessonIds.has(lesson.id);
            return (
              <button
                className={lesson.id === selectedLessonId ? 'lesson-item active' : 'lesson-item'}
                key={lesson.id}
                onClick={() => onSelect(lesson.id)}
                type="button"
              >
                {completed ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
                <span>
                  <strong>{lesson.title}</strong>
                  <small>{lesson.steps.length} stappen</small>
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </aside>
  );
};
