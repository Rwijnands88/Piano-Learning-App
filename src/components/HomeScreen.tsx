import { BookOpen, CheckCircle2, Gauge, Hand, LogOut, Mic, Piano, Play, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Lesson } from '../types';

type HomePanel = 'overview' | 'lessons' | 'progress' | 'mode';

type HomeScreenProps = {
  lessons: Lesson[];
  selectedLessonId: string;
  completedLessonIds: Set<string>;
  source: 'firestore' | 'bundled' | 'mixed';
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
  const [activePanel, setActivePanel] = useState<HomePanel>('overview');
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const visibleLessons = useMemo(() => {
    const recommended = lessons.find((lesson) => !completedLessonIds.has(lesson.id));
    const items = [selectedLesson, recommended, ...lessons].filter(Boolean) as Lesson[];

    return [...new Map(items.map((lesson) => [lesson.id, lesson])).values()].slice(0, 3);
  }, [completedLessonIds, lessons, selectedLesson]);
  const completionPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const sourceLabel = source === 'mixed' ? 'Kernlessen + Firestore' : source === 'firestore' ? 'Firestore lessen' : 'Lokale lessen';
  const modules = lessons.reduce<Record<string, Lesson[]>>((groups, lesson) => {
    groups[lesson.module] = [...(groups[lesson.module] ?? []), lesson];
    return groups;
  }, {});
  const nextLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? selectedLesson;
  const selectLesson = (lessonId: string) => {
    onSelectLesson(lessonId);
    setActivePanel('overview');
  };

  return (
    <section className="premium-stage premium-live-stage premium-home-live" aria-label="Startscherm">
      <header className="premium-app-top">
        <div className="premium-brand">
          <span><Piano aria-hidden="true" /></span>
          <div>
            <small>Piano Studio</small>
            <strong>Salon Practice</strong>
          </div>
        </div>

        <nav aria-label="Hoofdmenu">
          <button className={activePanel === 'overview' ? 'active' : ''} onClick={() => setActivePanel('overview')} type="button">
            Menu
          </button>
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
            <span className="premium-kicker">{sourceLabel}</span>
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
              className={activePanel === 'overview' ? 'premium-menu-action active' : 'premium-menu-action'}
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
            <button
              className={activePanel === 'lessons' ? 'premium-menu-action active' : 'premium-menu-action'}
              onClick={() => setActivePanel('lessons')}
              type="button"
            >
              <BookOpen aria-hidden="true" />
              <span>
                <strong>Lessen</strong>
                <small>{lessons.length} beschikbaar</small>
              </span>
            </button>
            <button
              className={activePanel === 'progress' ? 'premium-menu-action active' : 'premium-menu-action'}
              onClick={() => setActivePanel('progress')}
              type="button"
            >
              <Gauge aria-hidden="true" />
              <span>
                <strong>Voortgang</strong>
                <small>{completedCount}/{lessons.length} afgerond</small>
              </span>
            </button>
            <button
              className={activePanel === 'mode' ? 'premium-menu-action active' : 'premium-menu-action'}
              onClick={() => setActivePanel('mode')}
              type="button"
            >
              <span className="premium-dual-icons"><Mic aria-hidden="true" /><Hand aria-hidden="true" /></span>
              <span>
                <strong>Modus</strong>
                <small>Luisteren of handmatig</small>
              </span>
            </button>
          </div>

          <section className="premium-home-panel" aria-label="Menu-inhoud">
            {activePanel === 'overview' ? (
              <div className="premium-lesson-strip">
                {visibleLessons.map((lesson, index) => {
                  const completed = completedLessonIds.has(lesson.id);
                  return (
                    <button
                      className={lesson.id === selectedLessonId ? 'premium-lesson active' : 'premium-lesson'}
                      key={lesson.id}
                      onClick={() => selectLesson(lesson.id)}
                      type="button"
                    >
                      <span>{completed ? <CheckCircle2 aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.steps.length} stappen{lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ''}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {activePanel === 'lessons' ? (
              <div className="premium-panel-list">
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
                            onClick={() => selectLesson(lesson.id)}
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
              </div>
            ) : null}

            {activePanel === 'progress' ? (
              <div className="premium-info-panel">
                <div>
                  <small>Voortgang</small>
                  <strong>{completionPercent}%</strong>
                  <span>{completedCount} van {lessons.length} lessen afgerond</span>
                </div>
                <div>
                  <small>Volgende stap</small>
                  <strong>{nextLesson?.title ?? 'Geen lessen'}</strong>
                  <span>{nextLesson?.module ?? 'Leerlijn'}</span>
                </div>
              </div>
            ) : null}

            {activePanel === 'mode' ? (
              <div className="premium-info-panel">
                <div>
                  <small>Luisteren</small>
                  <strong>Microfoon-feedback</strong>
                  <span>Beste keuze voor losse noten en eenvoudige melodieen.</span>
                </div>
                <div>
                  <small>Handmatig</small>
                  <strong>Zelf doorstappen</strong>
                  <span>Gebruik dit voor akkoorden, rusten en tweehandige stukken.</span>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
};
