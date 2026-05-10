import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock3,
  Crown,
  Flame,
  Gauge,
  Library,
  ListMusic,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
  Music2,
  Piano,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import type { Lesson, PracticeProfile } from '../types';

type HomePanel = 'today' | 'path' | 'repertoire' | 'workouts' | 'growth' | 'studio';

type HomeScreenProps = {
  lessons: Lesson[];
  selectedLessonId: string;
  completedLessonIds: Set<string>;
  source: 'firestore' | 'bundled' | 'mixed';
  userName?: string | null;
  onStartPractice: () => void;
  onStartLesson: (lessonId: string) => void;
  onResetLessonProgress: (lessonId: string) => Promise<void>;
  onResetAllProgress: () => Promise<void>;
  practiceProfile: PracticeProfile;
  onPracticeProfileChange: (profile: PracticeProfile) => void;
  onPreparePractice: () => void;
  onLogOut: () => void;
};

const panelItems: Array<{ id: HomePanel; title: string; subtitle: string; icon: typeof Sparkles }> = [
  { id: 'today', title: 'Vandaag', subtitle: 'Je sessie', icon: Sparkles },
  { id: 'path', title: 'Leerlijn', subtitle: 'Stap voor stap', icon: MapIcon },
  { id: 'repertoire', title: 'Repertoire', subtitle: 'Stukken', icon: Library },
  { id: 'workouts', title: 'Workouts', subtitle: 'Korte training', icon: Flame },
  { id: 'growth', title: 'Groei', subtitle: 'Voortgang', icon: Trophy },
  { id: 'studio', title: 'Studio', subtitle: 'Account', icon: SlidersHorizontal },
];

const sourceLabel = {
  mixed: 'Kernlessen + Firestore',
  firestore: 'Firestore lessen',
  bundled: 'Lokale lessen',
};

const compactModuleName = (module: string) => module.replace(/^\d+\.\s*/, '');

type ModuleStatus = 'completed' | 'current' | 'open' | 'preview';

const statusLabel: Record<ModuleStatus, string> = {
  completed: 'Voltooid',
  current: 'Nu spelen',
  open: 'Vrij',
  preview: 'Vooruitblik',
};

const levelLabel = {
  starter: 'Start',
  beginner: 'Beginner',
  'late-beginner': 'Next',
  intermediate: 'Plus',
} satisfies Record<NonNullable<Lesson['level']>, string>;

const profileCopy = {
  premium: {
    title: 'Concert dark',
    text: 'Donker, goud en vol contrast voor normale tablets en desktop.',
  },
  'ivory-light': {
    title: 'Ivory light',
    text: 'Lichter, stiller en prettig bij daglicht.',
  },
  'ipad-light': {
    title: 'iPad 9.7 light',
    text: 'Sneller en rustiger voor oudere tablets.',
  },
} satisfies Record<PracticeProfile, { title: string; text: string }>;

export const HomeScreen = ({
  lessons,
  selectedLessonId,
  completedLessonIds,
  source,
  userName,
  onStartPractice,
  onStartLesson,
  onResetLessonProgress,
  onResetAllProgress,
  practiceProfile,
  onPracticeProfileChange,
  onPreparePractice,
  onLogOut,
}: HomeScreenProps) => {
  const [activePanel, setActivePanel] = useState<HomePanel>('today');
  const [resetPrompt, setResetPrompt] = useState<{ kind: 'lesson'; lesson: Lesson } | { kind: 'all' } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const nextLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? selectedLesson;
  const featuredLesson = nextLesson ?? selectedLesson;
  const displayName = userName?.trim() || 'Pianist';
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
      lessons.filter((lesson) => {
        const moduleName = lesson.module.toLowerCase();
        return (
          lesson.source === 'traditional' ||
          lesson.source === 'public-domain' ||
          moduleName.includes('repertoire') ||
          moduleName.includes('klassieke') ||
          moduleName.includes('minimalistische')
        );
      }),
    [lessons],
  );

  const workoutLessons = useMemo(
    () => lessons.filter((lesson) => lesson.module.toLowerCase().includes('workout') || lesson.tags?.includes('workout')),
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

  const activeModuleName = nextLesson?.module ?? selectedLesson?.module ?? modules[0]?.[0];
  const activeModuleIndex = Math.max(0, modules.findIndex(([module]) => module === activeModuleName));
  const levelScore = Math.floor(completedCount * 120 + completedMinutes * 8);
  const currentStreak = Math.min(7, Math.max(1, Math.ceil(completedCount / 3)));
  const nextMilestone = Math.max(5, Math.ceil((completedCount + 1) / 5) * 5);
  const nextMilestoneProgress = Math.min(100, Math.round((completedCount / nextMilestone) * 100));
  const unlockedModules = modules.filter(([, moduleLessons], index) => {
    if (index <= activeModuleIndex + 1) {
      return true;
    }

    const previousModule = modules[index - 1]?.[1] ?? [];
    return previousModule.length > 0 && previousModule.every((lesson) => completedLessonIds.has(lesson.id));
  }).length;

  const moduleSnapshots = modules.map(([module, moduleLessons], index) => {
    const done = moduleLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
    const firstOpen = moduleLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? moduleLessons[0];
    const percent = moduleLessons.length > 0 ? Math.round((done / moduleLessons.length) * 100) : 0;
    const status: ModuleStatus =
      done === moduleLessons.length ? 'completed' : module === activeModuleName ? 'current' : index <= activeModuleIndex + 1 ? 'open' : 'preview';

    return {
      done,
      firstOpen,
      index,
      lessons: moduleLessons,
      module,
      percent,
      status,
    };
  });

  const achievements = [
    {
      id: 'first-lesson',
      title: 'Eerste sessie',
      detail: 'Je bent begonnen',
      complete: completedCount >= 1,
      icon: Star,
    },
    {
      id: 'five-lessons',
      title: 'Vijf lessen',
      detail: `${Math.min(completedCount, 5)}/5 afgerond`,
      complete: completedCount >= 5,
      icon: Trophy,
    },
    {
      id: 'first-piece',
      title: 'Eerste stuk',
      detail: 'Repertoire geopend',
      complete: repertoireLessons.some((lesson) => completedLessonIds.has(lesson.id)),
      icon: Music2,
    },
    {
      id: 'chord-player',
      title: 'Akkoordspeler',
      detail: 'Harmonie module',
      complete: lessons.some((lesson) => lesson.focus?.includes('akkoorden') && completedLessonIds.has(lesson.id)),
      icon: Crown,
    },
    {
      id: 'two-hands',
      title: 'Twee handen',
      detail: 'Coordinatie',
      complete: lessons.some((lesson) => lesson.focus?.includes('twee handen') && completedLessonIds.has(lesson.id)),
      icon: Award,
    },
  ];

  const nextAchievement = achievements.find((achievement) => !achievement.complete) ?? achievements[achievements.length - 1];
  const displayProfile = profileCopy[practiceProfile];

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
          <button
            onClick={() => (featuredLesson ? startLesson(featuredLesson.id) : onStartPractice())}
            onFocus={onPreparePractice}
            onPointerEnter={onPreparePractice}
            type="button"
          >
            Oefenen
          </button>
        </nav>

        <div className="premium-user">
          <UserRound aria-hidden="true" />
          <span>{displayName}</span>
          <button aria-label="Uitloggen" onClick={onLogOut} type="button">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="premium-glass pro-learning-shell">
        <div className="premium-home-screen pro-learning-home">
          <section className="premium-hero-panel pro-home-hero">
            <span className="premium-kicker">{sourceLabel[source]}</span>
            <h1>Practice Hub</h1>
            <p>Een duidelijke route: dagmissie, leerlijn, repertoire en groei. Geen losse selectie meer, elke kaart brengt je direct naar de oefening.</p>

            <div className="pro-hero-focus">
              <small>Volgende stap</small>
              <strong>{featuredLesson?.title ?? 'Vrij spelen'}</strong>
              <span>{featuredLesson ? `${compactModuleName(featuredLesson.module)} · ${featuredLesson.estimatedMinutes ?? 8} min` : 'Kies een les'}</span>
            </div>

            <button
              className="premium-primary"
              onClick={() => (featuredLesson ? startLesson(featuredLesson.id) : onStartPractice())}
              onFocus={onPreparePractice}
              onPointerEnter={onPreparePractice}
              type="button"
            >
              <Play aria-hidden="true" />
              Ga verder
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
                <div className="pro-panel-header pro-panel-header-split">
                  <div>
                    <span>Vandaag</span>
                    <strong>Je oefenmissie staat klaar</strong>
                  </div>
                  <div className="pro-xp-chip">
                    <Sparkles aria-hidden="true" />
                    <span>{levelScore} XP</span>
                  </div>
                </div>
                <div className="pro-mission-brief">
                  <div>
                    <small>Level route</small>
                    <strong>{completionPercent}% programma</strong>
                    <span>{unlockedModules}/{modules.length} hoofdstukken vrijgespeeld</span>
                  </div>
                  <div>
                    <small>Streak</small>
                    <strong>{currentStreak} dagen</strong>
                    <span>Vandaag telt als je een sessie afrondt</span>
                  </div>
                  <div>
                    <small>Volgende badge</small>
                    <strong>{nextAchievement.title}</strong>
                    <span>{nextAchievement.detail}</span>
                  </div>
                </div>
                <div className="pro-session-grid">
                  {todayPlan.map(({ label, lesson, detail }) => (
                    <button
                      className={lesson.id === featuredLesson?.id ? 'pro-session-card recommended' : 'pro-session-card'}
                      key={`${label}-${lesson.id}`}
                      onClick={() => startLesson(lesson.id)}
                      type="button"
                    >
                      <small>{label}</small>
                      <strong>{lesson.title}</strong>
                      <span>{detail}</span>
                      <em>{lesson.id === featuredLesson?.id ? 'Aanbevolen' : 'Start sessie'}</em>
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
                <div className="pro-panel-header pro-panel-header-split">
                  <div>
                    <span>Leerlijn</span>
                    <strong>Horizontale route naar echte stukken</strong>
                  </div>
                  <div className="pro-xp-chip">
                    <MapIcon aria-hidden="true" />
                    <span>{unlockedModules} unlocks</span>
                  </div>
                </div>
                <div className="pro-course-track">
                  {moduleSnapshots.map(({ done, firstOpen, index, lessons: moduleLessons, module, percent, status }) => {
                    const resetLesson = [...moduleLessons].reverse().find((lesson) => completedLessonIds.has(lesson.id));

                    return (
                      <article className={`pro-course-island ${status}`} key={module}>
                        <div className="pro-course-top">
                          <span>Hoofdstuk {index + 1}</span>
                          <em>{statusLabel[status]}</em>
                        </div>
                        <button className="pro-course-main" onClick={() => firstOpen && startLesson(firstOpen.id)} type="button">
                          <strong>{compactModuleName(module)}</strong>
                          <small>{firstOpen?.title ?? 'Module voltooid'}</small>
                          <div className="pro-module-progress" aria-label={`${percent}% afgerond`}>
                            <i style={{ width: `${percent}%` }} />
                          </div>
                        </button>
                        <div className="pro-course-node-row" aria-label={`Lessen in ${compactModuleName(module)}`}>
                          {moduleLessons.map((lesson, lessonIndex) => {
                            const completed = completedLessonIds.has(lesson.id);
                            const isNext = firstOpen?.id === lesson.id && status !== 'completed';
                            const nodeClass = completed ? 'completed' : isNext ? 'next' : status === 'preview' ? 'preview' : 'open';

                            return (
                              <button
                                aria-label={`${lesson.title} starten`}
                                className={`pro-course-node ${nodeClass}`}
                                key={lesson.id}
                                onClick={() => startLesson(lesson.id)}
                                title={lesson.title}
                                type="button"
                              >
                                {completed ? <CheckCircle2 aria-hidden="true" /> : status === 'preview' ? <LockKeyhole aria-hidden="true" /> : <span>{lessonIndex + 1}</span>}
                              </button>
                            );
                          })}
                        </div>
                        <div className="pro-course-footer">
                          <span>{done}/{moduleLessons.length} afgerond</span>
                          <button
                            disabled={!resetLesson}
                            onClick={() => resetLesson && setResetPrompt({ kind: 'lesson', lesson: resetLesson })}
                            type="button"
                          >
                            Reset laatst
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activePanel === 'repertoire' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header pro-panel-header-split">
                  <div>
                    <span>Repertoire</span>
                    <strong>Muziekbibliotheek met echte speelduur</strong>
                  </div>
                  <div className="pro-xp-chip">
                    <Library aria-hidden="true" />
                    <span>{repertoireLessons.length} stukken</span>
                  </div>
                </div>
                <div className="pro-card-grid">
                  {repertoireLessons.map((lesson) => {
                    const completed = completedLessonIds.has(lesson.id);
                    const isRecommended = lesson.id === recommendedPiece?.id;

                    return (
                      <button
                        className={completed ? 'pro-library-card completed' : isRecommended ? 'pro-library-card recommended' : 'pro-library-card'}
                        key={lesson.id}
                        onClick={() => startLesson(lesson.id)}
                        type="button"
                      >
                        <Music2 aria-hidden="true" />
                        <span>{levelLabel[lesson.level ?? 'beginner']}</span>
                        <strong>{lesson.title}</strong>
                        <small>{lesson.estimatedMinutes ?? 8} min · {lesson.steps.length} stappen</small>
                        <i>{completed ? 'Voltooid' : isRecommended ? 'Aanbevolen' : lesson.source === 'original' ? 'Origineel' : 'Traditioneel'}</i>
                        <em className="pro-card-action">Start stuk</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activePanel === 'workouts' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header pro-panel-header-split">
                  <div>
                    <span>Workouts</span>
                    <strong>Arcade-achtige drills voor spiergeheugen</strong>
                  </div>
                  <div className="pro-xp-chip">
                    <Flame aria-hidden="true" />
                    <span>+120 XP</span>
                  </div>
                </div>
                <div className="pro-card-grid compact">
                  {workoutLessons.map((lesson) => {
                    const completed = completedLessonIds.has(lesson.id);

                    return (
                      <button
                        className={completed ? 'pro-workout-card completed' : lesson.id === recommendedWorkout?.id ? 'pro-workout-card recommended' : 'pro-workout-card'}
                        key={lesson.id}
                        onClick={() => startLesson(lesson.id)}
                        type="button"
                      >
                        <Flame aria-hidden="true" />
                        <strong>{lesson.title}</strong>
                        <span>{lesson.focus?.join(' · ') ?? 'training'}</span>
                        <i>{completed ? 'Claimed' : lesson.id === recommendedWorkout?.id ? 'Daily boost' : `${lesson.estimatedMinutes ?? 6} min`}</i>
                        <em className="pro-card-action">Start training</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activePanel === 'growth' ? (
              <div className="pro-panel-content">
                <div className="pro-panel-header pro-panel-header-split">
                  <div>
                    <span>Groei</span>
                    <strong>Level, badges en vaardigheid</strong>
                  </div>
                  <div className="pro-xp-chip">
                    <Trophy aria-hidden="true" />
                    <span>{levelScore} XP</span>
                  </div>
                </div>
                <div className="pro-growth-hero">
                  <div>
                    <small>Volgende mijlpaal</small>
                    <strong>{completedCount}/{nextMilestone} lessen</strong>
                    <span>Blijf rustig bouwen. Kleine sessies tellen ook.</span>
                  </div>
                  <div className="pro-ring" style={{ '--progress': `${nextMilestoneProgress}%` } as CSSProperties}>
                    <span>{nextMilestoneProgress}%</span>
                  </div>
                </div>
                <div className="pro-achievement-row">
                  {achievements.map(({ complete, detail, icon: Icon, id, title }) => (
                    <article className={complete ? 'pro-achievement complete' : 'pro-achievement'} key={id}>
                      <Icon aria-hidden="true" />
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </article>
                  ))}
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
                  <strong>Account, voortgang en weergave</strong>
                </div>
                <div className="pro-studio-board">
                  <article className="pro-studio-card pro-studio-profile">
                    <div>
                      <UserRound aria-hidden="true" />
                    </div>
                    <small>Account</small>
                    <strong className="pro-account-name" title={displayName}>
                      {displayName}
                    </strong>
                    <span className="pro-account-email">Privéprofiel actief</span>
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

                  <article className="pro-studio-card pro-display-profile">
                    <SlidersHorizontal aria-hidden="true" />
                    <small>Weergave</small>
                    <strong>{displayProfile.title}</strong>
                    <span>{displayProfile.text}</span>
                    <div className="pro-profile-toggle" role="group" aria-label="Weergaveprofiel">
                      <button
                        className={practiceProfile === 'premium' ? 'active' : ''}
                        onClick={() => onPracticeProfileChange('premium')}
                        type="button"
                      >
                        Dark
                      </button>
                      <button
                        className={practiceProfile === 'ivory-light' ? 'active' : ''}
                        onClick={() => onPracticeProfileChange('ivory-light')}
                        type="button"
                      >
                        White
                      </button>
                      <button
                        className={practiceProfile === 'ipad-light' ? 'active' : ''}
                        onClick={() => onPracticeProfileChange('ipad-light')}
                        type="button"
                      >
                        iPad light
                      </button>
                    </div>
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
