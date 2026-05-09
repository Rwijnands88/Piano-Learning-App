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
  onLogOut,
}: HomeScreenProps) => {
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const modules = lessons.reduce<Record<string, Lesson[]>>((groups, lesson) => {
    groups[lesson.module] = [...(groups[lesson.module] ?? []), lesson];
    return groups;
  }, {});

  return (
    <section className="home-screen" aria-label="Startscherm">
      <header className="home-top">
        <div className="home-brand">
          <span className="brand-mark small"><Piano aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Piano Studio</p>
            <h1>Welkom terug</h1>
          </div>
        </div>

        <div className="home-account">
          <span><UserRound aria-hidden="true" /> {userEmail ?? 'Ingelogd'}</span>
          <button className="secondary-button compact" onClick={onLogOut} type="button">
            <LogOut aria-hidden="true" />
            Uitloggen
          </button>
        </div>
      </header>

      <div className="home-layout">
        <section className="home-continue">
          <div>
            <p className="eyebrow">{source === 'firestore' ? 'Firestore lessen' : 'Lokale lessen'}</p>
            <h2>{selectedLesson?.title ?? 'Kies een les'}</h2>
            <p>{selectedLesson?.description ?? 'Selecteer een les om te oefenen.'}</p>
          </div>
          <button className="home-play-button" onClick={onStartPractice} type="button">
            <Play aria-hidden="true" />
            Oefenen
          </button>
          <div className="home-piano-rail" aria-hidden="true">
            {Array.from({ length: 14 }, (_, index) => (
              <span className={index % 7 === 1 || index % 7 === 3 || index % 7 === 5 ? 'black' : ''} key={index} />
            ))}
          </div>
        </section>

        <section className="home-progress">
          <p className="eyebrow">Voortgang</p>
          <strong>{completedCount}/{lessons.length}</strong>
          <span>lessen afgerond</span>
        </section>
      </div>

      <section className="home-mode-menu" aria-label="Hoofdmenu">
        <button className="home-menu-tile primary" onClick={onStartPractice} type="button">
          <Play aria-hidden="true" />
          <span>
            <strong>Oefenen</strong>
            <small>Ga naar de rustige oefenmodus</small>
          </span>
        </button>
        <div className="home-menu-tile">
          <BookOpen aria-hidden="true" />
          <span>
            <strong>Lessen</strong>
            <small>{lessons.length} lessen beschikbaar</small>
          </span>
        </div>
        <div className="home-menu-tile">
          <Gauge aria-hidden="true" />
          <span>
            <strong>Voortgang</strong>
            <small>{completedCount} afgerond</small>
          </span>
        </div>
        <div className="home-menu-tile">
          <span className="dual-icons"><Mic aria-hidden="true" /><Hand aria-hidden="true" /></span>
          <span>
            <strong>Modus</strong>
            <small>Luisteren of handmatig in de oefenruimte</small>
          </span>
        </div>
      </section>

      <nav className="home-menu" aria-label="Lesmenu">
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
                    <small>{lesson.steps.length} stappen</small>
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
