import { ArrowLeft, Clock3, Gauge, Hand, Mic, Music2, Play, Target } from 'lucide-react';
import { prettyKeys } from '../data/piano';
import type { LearningMode, Lesson } from '../types';

type LessonIntroScreenProps = {
  lesson: Lesson;
  mode: LearningMode;
  onBackHome: () => void;
  onModeChange: (mode: LearningMode) => void;
  onStart: () => void;
};

const compactModuleName = (module: string) => module.replace(/^\d+\.\s*/, '');

const uniqueTargets = (lesson: Lesson) => {
  const keys = lesson.steps.flatMap((step) => step.keys);
  return [...new Set(keys)].slice(0, 8);
};

const lessonMethod = (lesson: Lesson) => {
  if (lesson.steps.some((step) => step.recognitionMode === 'chord' || step.keys.length > 1)) {
    return 'Akkoorden speel je rustig op je piano; de app begeleidt visueel en je stapt door wanneer het goed voelt.';
  }

  if (lesson.level === 'starter') {
    return 'De app wacht op losse noten. Speel langzaam, luister goed en ga pas verder als de noot klopt.';
  }

  return 'Bij muziekstukken loopt het blad als een speler. Zet de snelheid lager en bouw pas op als het ontspannen voelt.';
};

export const LessonIntroScreen = ({ lesson, mode, onBackHome, onModeChange, onStart }: LessonIntroScreenProps) => {
  const targets = uniqueTargets(lesson);
  const targetLabel = targets.length > 0 ? prettyKeys(targets) : 'rusten en tellen';
  const focus = lesson.focus?.length ? lesson.focus.slice(0, 4) : ['rustig lezen', 'gelijke puls'];

  return (
    <section className="lesson-prelude premium-live-stage" aria-label="Lesuitleg">
      <header className="prelude-topbar">
        <button className="player-icon-button" onClick={onBackHome} type="button" aria-label="Terug naar menu">
          <ArrowLeft aria-hidden="true" />
        </button>
        <span>{compactModuleName(lesson.module)}</span>
      </header>

      <main className="prelude-body">
        <section className="prelude-hero">
          <span>Voor je begint</span>
          <h1>{lesson.title}</h1>
          <p>{lesson.description}</p>
        </section>

        <section className="prelude-plan" aria-label="Lesplan">
          <div>
            <Target aria-hidden="true" />
            <small>Vandaag leer je</small>
            <strong>{focus.join(' · ')}</strong>
          </div>
          <div>
            <Music2 aria-hidden="true" />
            <small>Te spelen</small>
            <strong>{targetLabel}</strong>
          </div>
          <div>
            <Clock3 aria-hidden="true" />
            <small>Duur</small>
            <strong>{lesson.estimatedMinutes ?? 8} min · {lesson.steps.length} stappen</strong>
          </div>
          <div>
            <Gauge aria-hidden="true" />
            <small>Tempo</small>
            <strong>{lesson.tempo ?? 72} bpm · {lesson.timeSignature ?? '4/4'}</strong>
          </div>
        </section>

        <section className="prelude-teacher-note" aria-label="Docenttip">
          <small>Zo oefen je</small>
          <p>{lessonMethod(lesson)}</p>
        </section>
      </main>

      <footer className="prelude-actions">
        <div className="prelude-mode" role="group" aria-label="Leermodus">
          <button className={mode === 'listen' ? 'active' : ''} onClick={() => onModeChange('listen')} type="button">
            <Mic aria-hidden="true" />
            Luisteren
          </button>
          <button className={mode === 'manual' ? 'active' : ''} onClick={() => onModeChange('manual')} type="button">
            <Hand aria-hidden="true" />
            Handmatig
          </button>
        </div>
        <button className="prelude-start" onClick={onStart} type="button">
          <Play aria-hidden="true" />
          Start oefening
        </button>
      </footer>
    </section>
  );
};
