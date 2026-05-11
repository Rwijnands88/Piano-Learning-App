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
import { lessonSupportsAutoplay } from '../music/scoreTimeline';
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
  { id: 'repertoire', title: 'Muziek', subtitle: 'Meespelen', icon: Library },
  { id: 'workouts', title: 'Workouts', subtitle: 'Korte training', icon: Flame },
  { id: 'growth', title: 'Groei', subtitle: 'Voortgang', icon: Trophy },
  { id: 'studio', title: 'Studio', subtitle: 'Account', icon: SlidersHorizontal },
];

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
    title: 'Neon dark',
    text: 'Diep donker, helder neon en veel contrast voor tablet en desktop.',
  },
  'ivory-light': {
    title: 'Clean light',
    text: 'Lichter canvas met dezelfde cockpit-structuur.',
  },
  'ipad-light': {
    title: 'iPad performance',
    text: 'Minder effecten, sneller en rustiger voor oudere tablets.',
  },
} satisfies Record<PracticeProfile, { title: string; text: string }>;

const panelMeta = {
  today: {
    eyebrow: 'Dagmissie',
    title: 'Kies je volgende speelmoment',
    text: 'Een korte route voor vandaag, zonder zoeken of parkeren onderaan het scherm.',
  },
  path: {
    eyebrow: 'Leerlijn',
    title: 'Speel door je route',
    text: 'Modules lopen horizontaal door als levels. Alles is direct te starten vanuit de route.',
  },
  repertoire: {
    eyebrow: 'Muziekmodus',
    title: 'Kies een stuk en speel direct mee',
    text: 'Alle muzieklessen gebruiken nu de rustige scrollspeler met aftellen, tempo en visuele timing.',
  },
  workouts: {
    eyebrow: 'Training',
    title: 'Snelle drills voor techniek',
    text: 'Gerichte oefeningen voor noten lezen, timing, handvorm en spiergeheugen.',
  },
  growth: {
    eyebrow: 'Groei',
    title: 'Bekijk je ontwikkeling',
    text: 'Badges, vaardigheden en mijlpalen zonder dat het je oefenflow onderbreekt.',
  },
  studio: {
    eyebrow: 'Studio',
    title: 'Profiel en instellingen',
    text: 'Weergave, reset en account staan bij elkaar, los van het oefenen zelf.',
  },
} satisfies Record<HomePanel, { eyebrow: string; title: string; text: string }>;

const lessonArtworkClass = (lesson?: Lesson) => {
  if (!lesson) {
    return 'notes';
  }

  const lessonText = `${lesson.module} ${lesson.title} ${lesson.focus?.join(' ') ?? ''} ${lesson.source ?? ''}`.toLowerCase();

  if (lessonText.includes('workout') || lessonText.includes('warm-up') || lessonText.includes('training')) {
    return 'workout';
  }

  if (lessonText.includes('akkoord') || lessonText.includes('chord') || lessonText.includes('harmonie')) {
    return 'chord';
  }

  if (
    lesson.source === 'traditional' ||
    lesson.source === 'public-domain' ||
    lessonText.includes('repertoire') ||
    lessonText.includes('ode') ||
    lessonText.includes('birthday') ||
    lessonText.includes('twinkle')
  ) {
    return 'piece';
  }

  if (lessonText.includes('ritme') || lessonText.includes('timing') || lessonText.includes('maat')) {
    return 'rhythm';
  }

  if (lessonText.includes('twee handen') || lessonText.includes('linkerhand') || lessonText.includes('rechterhand')) {
    return 'hands';
  }

  if (lessonText.includes('zwart')) {
    return 'black-keys';
  }

  return 'notes';
};

export const HomeScreen = ({
  lessons,
  selectedLessonId,
  completedLessonIds,
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

  const repertoireLessons = useMemo(() => lessons.filter(lessonSupportsAutoplay), [lessons]);

  const workoutLessons = useMemo(
    () => lessons.filter((lesson) => lesson.module.toLowerCase().includes('workout') || lesson.tags?.includes('workout')),
    [lessons],
  );

  const recommendedWorkout = workoutLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? workoutLessons[0];
  const recommendedPiece =
    repertoireLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? repertoireLessons[0] ?? nextLesson;
  const completedMusicCount = repertoireLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const musicPercent = repertoireLessons.length > 0 ? Math.round((completedMusicCount / repertoireLessons.length) * 100) : 0;
  const musicMinutes = repertoireLessons.reduce((total, lesson) => total + (lesson.estimatedMinutes ?? 0), 0);
  const todayPlan = [
    recommendedWorkout ? { label: 'Warm-up', lesson: recommendedWorkout, detail: 'Maak handen en oren wakker' } : null,
    nextLesson ? { label: 'Nieuwe stap', lesson: nextLesson, detail: 'De volgende les in je leerlijn' } : null,
    recommendedPiece ? { label: 'Muziekmodus', lesson: recommendedPiece, detail: 'Start de scrollspeler direct' } : null,
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

  const currentPanel = panelMeta[activePanel];
  const NextAchievementIcon = nextAchievement.icon;
  const maxSkillTotal = Math.max(...skillStats.map((stat) => stat.total), 1);
  const renderLessonArtwork = (lesson: Lesson | undefined, className = 'neo-lesson-art') => (
    <span className={`${className} ${lessonArtworkClass(lesson)}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );

  return (
    <section className="premium-stage premium-live-stage premium-home-live neo-home" aria-label="Startscherm">
      <div className="neo-shell">
        <aside className="neo-sidebar" aria-label="Hoofdmenu">
          <div className="neo-brand">
            <span><Piano aria-hidden="true" /></span>
            <div>
              <small>Piano Lab</small>
              <strong>Neon Studio</strong>
            </div>
          </div>

          <nav className="neo-nav" aria-label="Studio menu">
            {panelItems.map(({ id, title, subtitle, icon: Icon }) => (
              <button className={activePanel === id ? 'active' : ''} key={id} onClick={() => setActivePanel(id)} type="button">
                <Icon aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </span>
              </button>
            ))}
          </nav>

          <button
            className="neo-continue"
            onClick={() => (featuredLesson ? startLesson(featuredLesson.id) : onStartPractice())}
            onFocus={onPreparePractice}
            onPointerEnter={onPreparePractice}
            type="button"
          >
            <span><Play aria-hidden="true" /></span>
            <small>Ga verder</small>
            <strong>{featuredLesson?.title ?? 'Vrij spelen'}</strong>
            <em>{featuredLesson ? `${compactModuleName(featuredLesson.module)} · ${featuredLesson.estimatedMinutes ?? 8} min` : 'Direct oefenen'}</em>
          </button>

          <div className="neo-account-mini">
            <UserRound aria-hidden="true" />
            <span title={displayName}>{displayName}</span>
            <button aria-label="Uitloggen" onClick={onLogOut} type="button">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </aside>

        <main className="neo-workspace">
          <header className="neo-workspace-top">
            <div>
              <span>{currentPanel.eyebrow}</span>
              <h1>{currentPanel.title}</h1>
              <p>{currentPanel.text}</p>
            </div>
            <div className="neo-top-metrics" aria-label="Snelle voortgang">
              <span>
                <Sparkles aria-hidden="true" />
                <strong>{levelScore}</strong>
                <small>XP</small>
              </span>
              <span>
                <Flame aria-hidden="true" />
                <strong>{currentStreak}</strong>
                <small>streak</small>
              </span>
              <span>
                <Target aria-hidden="true" />
                <strong>{completionPercent}%</strong>
                <small>route</small>
              </span>
            </div>
          </header>

          <section className="neo-scene" aria-label="Menu-inhoud">
            {activePanel === 'today' ? (
              <div className="neo-panel neo-today-panel">
                <section className="neo-focus-strip">
                  <div>
                    <small>Volgende noot op de route</small>
                    <strong>{featuredLesson?.title ?? 'Vrij spelen'}</strong>
                    <span>{featuredLesson ? `${compactModuleName(featuredLesson.module)} · ${featuredLesson.estimatedMinutes ?? 8} minuten` : 'Open oefenmodus'}</span>
                  </div>
                  <button
                    onClick={() => (featuredLesson ? startLesson(featuredLesson.id) : onStartPractice())}
                    onFocus={onPreparePractice}
                    onPointerEnter={onPreparePractice}
                    type="button"
                  >
                    <Play aria-hidden="true" />
                    Start nu
                  </button>
                </section>

                <section className="neo-mission-lane" aria-label="Dagplanning">
                  {todayPlan.map(({ label, lesson, detail }) => (
                    <button
                      className={lesson.id === featuredLesson?.id ? 'neo-mission-tile recommended' : 'neo-mission-tile'}
                      key={`${label}-${lesson.id}`}
                      onClick={() => startLesson(lesson.id)}
                      type="button"
                    >
                      <i aria-hidden="true" />
                      {renderLessonArtwork(lesson)}
                      <small>{label}</small>
                      <strong>{lesson.title}</strong>
                      <span>{detail}</span>
                      <em>{lesson.estimatedMinutes ?? 8} min</em>
                    </button>
                  ))}
                </section>

                <section className="neo-data-ribbon" aria-label="Sessieoverzicht">
                  <div>
                    <Gauge aria-hidden="true" />
                    <strong>{completionPercent}%</strong>
                    <span>programma</span>
                  </div>
                  <div>
                    <Clock3 aria-hidden="true" />
                    <strong>{completedMinutes}/{totalMinutes}</strong>
                    <span>minuten</span>
                  </div>
                  <div>
                    <MapIcon aria-hidden="true" />
                    <strong>{unlockedModules}/{modules.length}</strong>
                    <span>hoofdstukken vrij</span>
                  </div>
                </section>
              </div>
            ) : null}

            {activePanel === 'path' ? (
              <div className="neo-panel neo-route-panel">
                <div className="neo-route-ribbon" aria-label="Leerlijn route">
                  {moduleSnapshots.map(({ done, firstOpen, index, lessons: moduleLessons, module, percent, status }) => {
                    const resetLesson = [...moduleLessons].reverse().find((lesson) => completedLessonIds.has(lesson.id));

                    return (
                      <article className={`neo-route-stop ${status}`} key={module}>
                        <div className="neo-route-head">
                          <span>Hoofdstuk {index + 1}</span>
                          <em>{statusLabel[status]}</em>
                        </div>
                        <button className="neo-route-main" onClick={() => firstOpen && startLesson(firstOpen.id)} type="button">
                          {renderLessonArtwork(firstOpen, 'neo-route-art')}
                          <strong>{compactModuleName(module)}</strong>
                          <small>{firstOpen?.title ?? 'Module voltooid'}</small>
                          <div className="neo-mini-progress" aria-label={`${percent}% afgerond`}>
                            <i style={{ width: `${percent}%` }} />
                          </div>
                        </button>
                        <div className="neo-route-nodes" aria-label={`Lessen in ${compactModuleName(module)}`}>
                          {moduleLessons.map((lesson, lessonIndex) => {
                            const completed = completedLessonIds.has(lesson.id);
                            const isNext = firstOpen?.id === lesson.id && status !== 'completed';
                            const nodeClass = completed ? 'completed' : isNext ? 'next' : status === 'preview' ? 'preview' : 'open';

                            return (
                              <button
                                aria-label={`${lesson.title} starten`}
                                className={`neo-route-node ${nodeClass}`}
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
                        <div className="neo-route-foot">
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
              <div className="neo-panel neo-library-panel">
                <div className="neo-library-grid">
                  {repertoireLessons.map((lesson) => {
                    const completed = completedLessonIds.has(lesson.id);
                    const isRecommended = lesson.id === recommendedPiece?.id;

                    return (
                      <button
                        className={completed ? 'neo-piece-row completed' : isRecommended ? 'neo-piece-row recommended' : 'neo-piece-row'}
                        key={lesson.id}
                        onClick={() => startLesson(lesson.id)}
                        type="button"
                      >
                        {renderLessonArtwork(lesson, 'neo-row-cover')}
                        <span>
                          <strong>{lesson.title}</strong>
                          <small>{lesson.estimatedMinutes ?? 8} min · {lesson.steps.length} stappen</small>
                        </span>
                        <i>{levelLabel[lesson.level ?? 'beginner']}</i>
                        <em>{completed ? 'Voltooid' : isRecommended ? 'Aanbevolen' : lesson.source === 'original' ? 'Origineel' : 'Traditioneel'}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activePanel === 'workouts' ? (
              <div className="neo-panel neo-workout-panel">
                <div className="neo-workout-deck">
                  {workoutLessons.map((lesson) => {
                    const completed = completedLessonIds.has(lesson.id);

                    return (
                      <button
                        className={completed ? 'neo-workout-tile completed' : lesson.id === recommendedWorkout?.id ? 'neo-workout-tile recommended' : 'neo-workout-tile'}
                        key={lesson.id}
                        onClick={() => startLesson(lesson.id)}
                        type="button"
                      >
                        {renderLessonArtwork(lesson, 'neo-workout-art')}
                        <strong>{lesson.title}</strong>
                        <span>{lesson.focus?.join(' · ') ?? 'training'}</span>
                        <i>{completed ? 'Claimed' : lesson.id === recommendedWorkout?.id ? 'Daily boost' : `${lesson.estimatedMinutes ?? 6} min`}</i>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activePanel === 'growth' ? (
              <div className="neo-panel neo-growth-panel">
                <section className="neo-growth-hero">
                  <div>
                    <small>Volgende mijlpaal</small>
                    <strong>{completedCount}/{nextMilestone} lessen</strong>
                    <span>Blijf rustig bouwen. Kleine sessies tellen ook.</span>
                  </div>
                  <div className="neo-ring" style={{ '--progress': `${nextMilestoneProgress}%` } as CSSProperties}>
                    <span>{nextMilestoneProgress}%</span>
                  </div>
                </section>
                <section className="neo-achievement-track">
                  {achievements.map(({ complete, detail, icon: Icon, id, title }) => (
                    <article className={complete ? 'neo-achievement complete' : 'neo-achievement'} key={id}>
                      <Icon aria-hidden="true" />
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </article>
                  ))}
                </section>
                <section className="neo-skill-board">
                  {skillStats.map(({ skill, done, total, percent }) => (
                    <article className="neo-skill-row" key={skill}>
                      <small>{done}/{total}</small>
                      <strong>{skill}</strong>
                      <div className="neo-mini-progress" aria-label={`${percent}%`}>
                        <i style={{ width: `${percent}%` }} />
                      </div>
                    </article>
                  ))}
                </section>
              </div>
            ) : null}

            {activePanel === 'studio' ? (
              <div className="neo-panel neo-studio-panel">
                <div className="neo-studio-grid">
                  <article className="neo-studio-unit profile">
                    <div>
                      <UserRound aria-hidden="true" />
                    </div>
                    <small>Account</small>
                    <strong title={displayName}>
                      {displayName}
                    </strong>
                    <span>Priveprofiel actief</span>
                    <button onClick={onLogOut} type="button">Uitloggen</button>
                  </article>

                  <article className="neo-studio-unit">
                    <Gauge aria-hidden="true" />
                    <small>Voortgang</small>
                    <strong>{completionPercent}%</strong>
                    <span>{completedCount}/{lessons.length} lessen afgerond</span>
                    <div className="neo-mini-progress" aria-label={`${completionPercent}% afgerond`}>
                      <i style={{ width: `${completionPercent}%` }} />
                    </div>
                  </article>

                  <article className="neo-studio-unit display">
                    <SlidersHorizontal aria-hidden="true" />
                    <small>Weergave</small>
                    <strong>{displayProfile.title}</strong>
                    <span>{displayProfile.text}</span>
                    <div className="neo-profile-toggle" role="group" aria-label="Weergaveprofiel">
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

                  <article className="neo-studio-unit music">
                    <ListMusic aria-hidden="true" />
                    <small>Muziekmodus</small>
                    <strong>{completedMusicCount}/{repertoireLessons.length} stukken</strong>
                    <span>Scrollspeler actief voor alle muziek · {musicMinutes} speelminuten</span>
                    <div className="neo-music-bars" aria-label={`${musicPercent}% muziek afgerond`}>
                      {[0.38, 0.62, 0.82, 0.5, 0.72].map((height, index) => (
                        <i
                          key={height}
                          style={
                            {
                              '--bar': `${Math.max(18, Math.round(height * Math.max(musicPercent, 34)))}%`,
                              '--delay': `${index * 70}ms`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </div>
                  </article>

                  <article className="neo-studio-unit danger">
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
        </main>

        <aside className="neo-hud" aria-label="Voortgang">
          <section className="neo-hud-card primary">
            <small>Route status</small>
            <div className="neo-hud-ring" style={{ '--progress': `${completionPercent}%` } as CSSProperties}>
              <span>{completionPercent}%</span>
            </div>
            <strong>{completedCount}/{lessons.length} lessen</strong>
            <p>{completedMinutes}/{totalMinutes} minuten gespeeld</p>
          </section>

          <section className="neo-hud-card">
            <small>Volgende badge</small>
            <div className="neo-badge-preview">
              <NextAchievementIcon aria-hidden="true" />
              <span>
                <strong>{nextAchievement.title}</strong>
                <em>{nextAchievement.detail}</em>
              </span>
            </div>
            <div className="neo-mini-progress" aria-label={`${nextMilestoneProgress}% naar volgende mijlpaal`}>
              <i style={{ width: `${nextMilestoneProgress}%` }} />
            </div>
          </section>

          <section className="neo-hud-card compact">
            <small>Muziekmodus</small>
            <strong>{repertoireLessons.length}</strong>
            <span>lessen met scrollspeler</span>
          </section>

          <section className="neo-hud-card neo-skill-micro">
            <small>Focus radar</small>
            <div className="neo-hud-bars" aria-label="Vaardigheden grafiek">
              {skillStats.slice(0, 4).map(({ skill, total }) => (
                <span key={skill} style={{ '--bar': `${Math.max(24, Math.round((total / maxSkillTotal) * 100))}%` } as CSSProperties}>
                  <i />
                  <em>{skill}</em>
                </span>
              ))}
            </div>
            <strong>{skillStats[0]?.skill ?? 'Start je eerste sessie'}</strong>
            <span>{skillStats[0] ? `${skillStats[0].done}/${skillStats[0].total} lessen afgerond` : 'Nog geen oefendata'}</span>
          </section>
        </aside>
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
