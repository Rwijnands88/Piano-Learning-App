import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Hand,
  Library,
  ListMusic,
  LogOut,
  Map as MapIcon,
  Mic,
  Music2,
  Piano,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Lesson } from '../types';

type HomePanel = 'today' | 'path' | 'repertoire' | 'workouts' | 'growth' | 'studio';

type HomeScreenProps = {
  lessons: Lesson[];
  selectedLessonId: string;
  completedLessonIds: Set<string>;
  source: 'firestore' | 'bundled' | 'mixed';
  userEmail?: string | null;
  onSelectLesson: (lessonId: string) => void;
  onStartPractice: () => void;
  onStartLesson: (lessonId: string) => void;
  onResetLessonProgress: (lessonId: string) => Promise<void>;
  onResetAllProgress: () => Promise<void>;
  onPreparePractice: () => void;
  onLogOut: () => void;
};

const panelItems: Array<{ id: HomePanel; title: string; subtitle: string; icon: typeof Sparkles }> = [
  { id: 'today', title: 'Vandaag', subtitle: 'Je sessie', icon: Sparkles },
  { id: 'path', title: 'Leerlijn', subtitle: 'Stap voor stap', icon: MapIcon },
  { id: 'repertoire', title: 'Repertoire', subtitle: 'Stukken', icon: Library },
  { id: 'workouts', title: 'Workouts', subtitle: 'Korte training', icon: Flame },
  { id: 'growth', title: 'Groei', subtitle: 'Voortgang', icon: Trophy },
  { id: 'studio', title: 'Studio', subtitle: 'Modus en account', icon: SlidersHorizontal },
];

const sourceLabel = {
  mixed: 'Kernlessen + Firestore',
  firestore: 'Firestore lessen',
  bundled: 'Lokale lessen',
};

const compactModuleName = (module: string) => module.replace(/^\d+\.\s*/, '');

export const HomeScreen = ({
  lessons,
  selectedLessonId,
  completedLessonIds,
  source,
  userEmail,
  onSelectLesson,
  onStartPractice,
  onStartLesson,
  onResetLessonProgress,
  onResetAllProgress,
  onPreparePractice,
  onLogOut,
}: HomeScreenProps) => {
  const [activePanel, setActivePanel] = useState<HomePanel>('today');
  const [resetPrompt, setResetPrompt] = useState<{ kind: 'lesson'; lesson: Lesson } | { kind: 'all' } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const nextLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? selectedLesson;
  const activeLesson = selectedLesson ?? nextLesson;
  const [accountName, accountDomain] = userEmail?.split('@') ?? [];
  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const completionPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const completedMinutes = lessons
    .filter((lesson) => completedLessonIds.has(lesson.id))
    .reduce((total, lesson) => total + (lesson.estimatedMinutes ?? 0), 0);
  const totalMinutes = lessons.reduce((total, lesson) => total + (lesson.estimatedMinutes ?? 0), 0);

  const modules = useMemo(() => {
    const groups = lessons.reduce<Record<string, Lesson[]>>((items, lesson) => {
      items[lesson.module] = [...(items[lesson.module] ?? []), lesson];
      return items;
    }, {});

    return Object.entries(groups);
  }, [lessons]);

  const repertoireLessons = useMemo(
    () =>
      lessons.filter((lesson) =>
        lesson.source === 'traditional' ||
        lesson.source === 'public-domain' ||
        lesson.module.includes('Repertoire') ||
        lesson.module.includes('Klassieke') ||
        lesson.module.includes('Minimalistische'),
      ),
    [lessons],
  );

  const workoutLessons = useMemo(
    () => lessons.filter((lesson) => lesson.module.includes('Workouts') || lesson.tags?.includes('workout')),
    [lessons],
  );

  const recommendedWorkout = workoutLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? workoutLessons[0];
  const recommendedPiece =
    repertoireLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? repertoireLessons[0] ?? nextLesson;
  const todayPlan = [
    recommendedWorkout ? { label: 'Warm-up', lesson: recommendedWorkout, detail: 'Maak handen en oren wakker' } : null,
    nextLesson ? { label: 'Nieuwe stap', lesson: nextLesson, detail: 'De volgende les in je leerlijn' } : null,
    recommendedPiece ? { label: 'Muziekstuk', lesson: recommendedPiece, detail: 'Speel iets dat als muziek voelt' } : null,
  ].filter(Boolean) as Array<{ label: string; lesson: Lesson; detail: string }>;

  const skillStats = useMemo(() => {
    const skillMap = new Map<string, { total: number; done: number }>();

    lessons.forEach((lesson) => {
      const skills = lesson.focus?.length ? lesson.focus : ['algemeen'];
      skills.forEach((skill) => {
        const current = skillMap.get(skill) ?? { total: 0, done: 0 };
        current.total += 1;
        if (completedLessonIds.has(lesson.id)) {
          current.done += 1;
        }
        skillMap.set(skill, current);
      });
    });

    return [...skillMap.entries()]
      .map(([skill, stat]) => ({
        skill,
        total: stat.total,
        done: stat.done,
        percent: stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [completedLessonIds, lessons]);

  const chooseLesson = (lessonId: string) => {
    onSelectLesson(lessonId);
  };

  const startLesson = (lessonId: string) => {
    onPreparePractice();
    onStartLesson(lessonId);
  };

  const confirmReset = async () => {
    if (!resetPrompt) {
      return;
    }

    setIsResetting(true);
    try {
      if (resetPrompt.kind === 'lesson') {
        await onResetLessonProgress(resetPrompt.lesson.id);
      } else {
        await onResetAllProgress();
      }
      setResetPrompt(null);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <section className="premium-stage premium-live-stage premium-home-live" aria-label="Startscherm">
      <header className="premium-app-top pro-app-top">
        <div className="premium-brand">
          <span><Piano aria-hidden="true" /></span>
          <div>
            <small>Piano Studio</small>
            <strong>Practice Hub</strong>
          </div>
        </div>

        <nav aria-label="Snelle acties">
          <button className={activePanel === 'today' ? 'active' : ''} onClick={() => setActivePanel('today')} type="button">
            Vandaag
          </button>
          <button onClick={onStartPractice} onFocus={onPreparePractice} onPointerEnter={onPreparePractice} type="button">
            Start
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

      <div className="premium-glass pro-learning-shell">
        <div className="premium-home-screen pro-learning-home">
          <section className="premium-hero-panel pro-home-hero">
            <span className="premium-kicker">{sourceLabel[source]}</span>
            <h1>Wat speel je vandaag?</h1>
            <p>{activeLesson?.description ?? 'Kies een korte sessie en bouw rustig door aan je pianospel.'}</p>

            <div className="pro-hero-focus">
              <small>Geselecteerd</small>
              <strong>{activeLesson?.title ?? 'Vrij spelen'}</strong>
              <span>{activeLesson ? `${compactModuleName(activeLesson.module)} · ${activeLesson.estimatedMinutes ?? 8} min` : 'Kies een les'}</span>
            </div>

            <button
              className="premium-primary"
              onClick={() => (activeLesson ? startLesson(activeLesson.id) : onStartPractice())}
              onFocus={onPreparePractice}
              onPointerEnter={onPreparePractice}
              type="button"
            >
              <Play aria-hidden="true" />
              Start sessie
            </button>
          </section>

          <div className="premium-menu-rail pro-menu-rail" aria-label="Hoofdmenu">
            {panelItems.map(({ id, title, subtitle, icon: Icon }) => (
              <button
                className={activePanel === id ? 'premium-menu-action active' : 'premium-menu-action'}
                key={id}
                onClick={() => setActivePanel(id)}
                type="button"
              >
                <Icon aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </span>
              </button>
            ))}
          </div>

          <section
            className={activePanel === 'studio' ? 'premium-home-panel pro-home-panel pro-home-panel-studio' : 'premium-home-panel pro-home-panel'}
            aria-label="Menu-inhoud"
          >
            {activePanel === 'today' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header">
                  <span>Dagplanning</span>
                  <strong>Drie korte stappen, zonder zoeken</strong>
                </div>
                <div className="pro-session-grid">
                  {todayPlan.map(({ label, lesson, detail }) => (
                    <button
                      className={lesson.id === selectedLessonId ? 'pro-session-card active' : 'pro-session-card'}
                      key={`${label}-${lesson.id}`}
                      onClick={() => chooseLesson(lesson.id)}
                      type="button"
                    >
                      <small>{label}</small>
                      <strong>{lesson.title}</strong>
                      <span>{detail}</span>
                      <em>{lesson.id === selectedLessonId ? 'Geselecteerd' : 'Klik om te kiezen'}</em>
                    </button>
                  ))}
                </div>
                <div className="pro-metric-row">
                  <div>
                    <Gauge aria-hidden="true" />
                    <span>{completionPercent}%</span>
                    <small>programma</small>
                  </div>
                  <div>
                    <Clock3 aria-hidden="true" />
                    <span>{completedMinutes}/{totalMinutes}</span>
                    <small>minuten</small>
                  </div>
                  <div>
                    <Target aria-hidden="true" />
                    <span>{completedCount}/{lessons.length}</span>
                    <small>lessen</small>
                  </div>
                </div>
              </div>
            ) : null}

            {activePanel === 'path' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header">
                  <span>Leerlijn</span>
                  <strong>Van eerste toets naar tweehandig repertoire</strong>
                </div>
                <div className="pro-module-stack">
                  {modules.map(([module, moduleLessons]) => {
                    const done = moduleLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
                    const firstOpen = moduleLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? moduleLessons[0];
                    const percent = Math.round((done / moduleLessons.length) * 100);

                    return (
                      <article className="pro-module-card has-lesson-list" key={module}>
                        <div>
                          <small>{done}/{moduleLessons.length} afgerond</small>
                          <strong>{compactModuleName(module)}</strong>
                          <span>{firstOpen?.title ?? 'Module voltooid'}</span>
                        </div>
                        <div className="pro-module-progress" aria-label={`${percent}% afgerond`}>
                          <i style={{ width: `${percent}%` }} />
                        </div>
                        <button onClick={() => firstOpen && chooseLesson(firstOpen.id)} type="button">
                          {firstOpen?.id === selectedLessonId ? 'Geselecteerd' : done === moduleLessons.length ? 'Kies herhaling' : 'Selecteer'}
                        </button>
                        <div className="pro-lesson-reset-list">
                          {moduleLessons.map((lesson) => {
                            const completed = completedLessonIds.has(lesson.id);

                            return (
                              <div className={completed ? 'pro-lesson-reset-row completed' : 'pro-lesson-reset-row'} key={lesson.id}>
                                <span>{completed ? <CheckCircle2 aria-hidden="true" /> : lesson.order / 10}</span>
                                <strong>{lesson.title}</strong>
                                <small>{lesson.estimatedMinutes ?? 8} min</small>
                                <button onClick={() => startLesson(lesson.id)} type="button">Start</button>
                                <button
                                  disabled={!completed}
                                  onClick={() => setResetPrompt({ kind: 'lesson', lesson })}
                                  type="button"
                                >
                                  Reset
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activePanel === 'repertoire' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header">
                  <span>Repertoire</span>
                  <strong>Muziekstukken die meegroeien met je niveau</strong>
                </div>
                <div className="pro-card-grid">
                  {repertoireLessons.map((lesson) => (
                    <button
                      className={lesson.id === selectedLessonId ? 'pro-library-card active' : 'pro-library-card'}
                      key={lesson.id}
                      onClick={() => chooseLesson(lesson.id)}
                      onDoubleClick={() => startLesson(lesson.id)}
                      type="button"
                    >
                      <Music2 aria-hidden="true" />
                      <span>{lesson.level ?? 'beginner'}</span>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.estimatedMinutes ?? 8} min · {lesson.steps.length} stappen</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activePanel === 'workouts' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header">
                  <span>Workouts</span>
                  <strong>Korte trainingen voor techniek, lezen en akkoorden</strong>
                </div>
                <div className="pro-card-grid compact">
                  {workoutLessons.map((lesson) => (
                    <button
                      className={lesson.id === selectedLessonId ? 'pro-workout-card active' : 'pro-workout-card'}
                      key={lesson.id}
                      onClick={() => chooseLesson(lesson.id)}
                      type="button"
                    >
                      <Flame aria-hidden="true" />
                      <strong>{lesson.title}</strong>
                      <span>{lesson.focus?.join(' · ') ?? 'training'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activePanel === 'growth' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header">
                  <span>Groei</span>
                  <strong>Waar je sterker wordt</strong>
                </div>
                <div className="pro-skill-grid">
                  {skillStats.map(({ skill, done, total, percent }) => (
                    <article className="pro-skill-card" key={skill}>
                      <small>{done}/{total}</small>
                      <strong>{skill}</strong>
                      <div className="pro-module-progress" aria-label={`${percent}%`}>
                        <i style={{ width: `${percent}%` }} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {activePanel === 'studio' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header">
                  <span>Studio</span>
                  <strong>Hoe je vandaag wilt oefenen</strong>
                </div>
                <div className="pro-studio-board">
                  <article className="pro-studio-card pro-studio-profile">
                    <div>
                      <UserRound aria-hidden="true" />
                    </div>
                    <small>Account</small>
                    <strong className="pro-account-name" title={userEmail ?? 'Ingelogd'}>
                      {accountName || 'Ingelogd'}
                    </strong>
                    <span className="pro-account-email">{accountDomain ? `@${accountDomain}` : 'Privestudio actief'}</span>
                    <button onClick={onLogOut} type="button">Uitloggen</button>
                  </article>

                  <article className="pro-studio-card pro-studio-progress">
                    <Gauge aria-hidden="true" />
                    <small>Voortgang</small>
                    <strong>{completionPercent}%</strong>
                    <span>{completedCount}/{lessons.length} lessen afgerond</span>
                    <div className="pro-module-progress" aria-label={`${completionPercent}% afgerond`}>
                      <i style={{ width: `${completionPercent}%` }} />
                    </div>
                  </article>

                  <article className="pro-studio-card">
                    <Mic aria-hidden="true" />
                    <small>Luisteren</small>
                    <strong>Microfoon-feedback</strong>
                    <span>Voor toonherkenning bij noten en melodieen.</span>
                  </article>

                  <article className="pro-studio-card">
                    <Hand aria-hidden="true" />
                    <small>Handmatig</small>
                    <strong>Zelf doorstappen</strong>
                    <span>Voor akkoorden, rusten en lastigere passages.</span>
                  </article>

                  <article className="pro-studio-card">
                    <ListMusic aria-hidden="true" />
                    <small>Bron</small>
                    <strong>{sourceLabel[source]}</strong>
                    <span>{lessons.length} lessen · {totalMinutes} oefenminuten</span>
                  </article>

                  <article className="pro-studio-card pro-account-danger">
                    <RotateCcw aria-hidden="true" />
                    <small>Reset</small>
                    <strong>Voortgang</strong>
                    <span>{completedCount} afgeronde lessen</span>
                    <button disabled={completedCount === 0} onClick={() => setResetPrompt({ kind: 'all' })} type="button">
                      Alles resetten
                    </button>
                  </article>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {resetPrompt ? (
        <div className="pro-reset-backdrop" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <section className="pro-reset-dialog">
            <div>
              <AlertTriangle aria-hidden="true" />
            </div>
            <span>Kleine waarschuwing</span>
            <h2 id="reset-title">
              {resetPrompt.kind === 'lesson' ? `Reset "${resetPrompt.lesson.title}"?` : 'Alle voortgang resetten?'}
            </h2>
            <p>
              {resetPrompt.kind === 'lesson'
                ? 'Alleen deze les wordt weer open gezet. Je kunt hem daarna opnieuw volgen.'
                : 'Alle afgeronde lessen van dit account worden gewist. Je lessen zelf blijven gewoon bestaan.'}
            </p>
            <div>
              <button disabled={isResetting} onClick={() => setResetPrompt(null)} type="button">Annuleer</button>
              <button disabled={isResetting} onClick={() => void confirmReset()} type="button">
                {isResetting ? 'Resetten...' : 'Reset bevestigen'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
};
