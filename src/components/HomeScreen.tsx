import { BookOpen, CheckCircle2, Gauge, Hand, LogOut, Mic, Piano, Play, UserRound } from 'lucide-react';
import type { Lesson } from '../types';

type HomeScreenProps = {
  lessons: Lesson[];
  selectedLessonId: string;
  completedLessonIds: Set<string>;
  source: 'firestore' | 'bundled';
  userEmail?: string | null;
  onSelectLesson: (lessonId: string) => void;
  onStartPractice: () => void;
  onPreparePractice: () => void;
  onLogOut: () => void;
};

export const HomeScreen = ({
  lessons,
  selectedLessonId,
  completedLessonIds,
  source,
  userEmail,
  onSelectLesson,
  onStartPractice,
  onPreparePractice,
  onLogOut,
}: HomeScreenProps) => {
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const visibleLessons = lessons.slice(0, 3);
  const modules = lessons.reduce<Record<string, Lesson[]>>((groups, lesson) => {
    groups[lesson.module] = [...(groups[lesson.module] ?? []), lesson];
    return groups;
  }, {});

  return (
    <section className="premium-stage premium-live-stage" aria-label="Startscherm">
      <header className="premium-app-top">
        <div className="premium-brand">
          <span><Piano aria-hidden="true" /></span>
          <div>
            <small>Piano Studio</small>
            <strong>Salon Practice</strong>
          </div>
        </div>

        <nav aria-label="Hoofdmenu">
          <button className="active" type="button">Menu</button>
          <button onClick={onStartPractice} onFocus={onPreparePractice} onPointerEnter={onPreparePractice} type="button">
            Oefenen
          </button>
        </nav>

        <div className="premium-user">
          <UserRound aria-hidden="true" />
          <span>{userEmail ?? 'Ingelogd'}</span>
          <button aria-label="Uitloggen" onClick={onLogOut} type="button">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="premium-glass">
        <div className="premium-home-screen">
          <section className="premium-hero-panel">
            <span className="premium-kicker">{source === 'firestore' ? 'Firestore lessen' : 'Lokale lessen'}</span>
            <h1>{selectedLesson?.title ?? 'Kies je les'}</h1>
            <p>{selectedLesson?.description ?? 'Start een rustige oefensessie naast je piano.'}</p>
            <button
              className="premium-primary"
              onClick={onStartPractice}
              onFocus={onPreparePractice}
              onPointerEnter={onPreparePractice}
              type="button"
            >
              <Play aria-hidden="true" />
              Start oefening
            </button>
          </section>

          <div className="premium-menu-rail" aria-label="Hoofdacties">
            <button
              className="premium-menu-action active"
              onClick={onStartPractice}
              onFocus={onPreparePractice}
              onPointerEnter={onPreparePractice}
              type="button"
            >
              <Play aria-hidden="true" />
              <span>
                <strong>Oefenen</strong>
                <small>Luistermodus klaar</small>
              </span>
            </button>
            <button className="premium-menu-action" type="button">
              <BookOpen aria-hidden="true" />
              <span>
                <strong>Lessen</strong>
                <small>{lessons.length} beschikbaar</small>
              </span>
            </button>
            <button className="premium-menu-action" type="button">
              <Gauge aria-hidden="true" />
              <span>
                <strong>Voortgang</strong>
                <small>{completedCount}/{lessons.length} afgerond</small>
              </span>
            </button>
            <button className="premium-menu-action" type="button">
              <span className="premium-dual-icons"><Mic aria-hidden="true" /><Hand aria-hidden="true" /></span>
              <span>
                <strong>Modus</strong>
                <small>Luisteren of handmatig</small>
              </span>
            </button>
          </div>

          <div className="premium-lesson-strip">
            {visibleLessons.map((lesson, index) => {
              const completed = completedLessonIds.has(lesson.id);
              return (
                <button
                  className={lesson.id === selectedLessonId ? 'premium-lesson active' : 'premium-lesson'}
                  key={lesson.id}
                  onClick={() => onSelectLesson(lesson.id)}
                  type="button"
                >
                  <span>{completed ? <CheckCircle2 aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
                  <strong>{lesson.title}</strong>
                <small>{lesson.steps.length} stappen{lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ''}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <nav className="home-menu premium-module-list" aria-label="Lesmenu">
        {Object.entries(modules).map(([module, moduleLessons]) => (
          <section className="home-menu-section" key={module}>
            <h2>{module}</h2>
            <div className="home-lesson-row">
              {moduleLessons.map((lesson) => {
                const active = lesson.id === selectedLessonId;
                const completed = completedLessonIds.has(lesson.id);

                return (
                  <button
                    className={active ? 'home-lesson-card active' : 'home-lesson-card'}
                    key={lesson.id}
                    onClick={() => onSelectLesson(lesson.id)}
                    type="button"
                  >
                    <span className="lesson-card-status">
                      {completed ? <CheckCircle2 aria-hidden="true" /> : lesson.order / 10}
                    </span>
                    <strong>{lesson.title}</strong>
                    <small>{lesson.steps.length} stappen{lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ''}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </section>
  );
};
