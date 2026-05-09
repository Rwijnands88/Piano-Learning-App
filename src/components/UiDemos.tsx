import { BookOpen, ChevronLeft, Gauge, Hand, Mic, Pause, Piano, Sparkles } from 'lucide-react';
import { PianoKeyboard } from './PianoKeyboard';
import type { PianoKeyName } from '../types';

type DemoVariant = {
  id: string;
  title: string;
  subtitle: string;
  lessonKeys: PianoKeyName[];
  detectedKey: PianoKeyName;
  accent: string;
};

const variants: DemoVariant[] = [
  {
    id: 'concert',
    title: 'Walnut Concert',
    subtitle: 'Donker walnoot, ivoor, messing accenten en een rustige partituur.',
    lessonKeys: ['C3', 'E3', 'G3'],
    detectedKey: 'C3',
    accent: 'warm',
  },
  {
    id: 'score',
    title: 'Ivory Score',
    subtitle: 'Nummers centraal: een lichte bladmuziektafel met vaste speellijn.',
    lessonKeys: ['G3', 'A3', 'C4'],
    detectedKey: 'A3',
    accent: 'blue',
  },
  {
    id: 'practice',
    title: 'Nocturne Practice',
    subtitle: 'Avondstudio met meer feedback, zonder de piano uit beeld te duwen.',
    lessonKeys: ['F3', 'A3', 'C4'],
    detectedKey: 'F3',
    accent: 'green',
  },
];

const StaffPreview = ({ variant }: { variant: DemoVariant }) => {
  const notes = variant.id === 'practice' ? ['F', 'A', 'C', 'A', 'F'] : ['C', 'D', 'E', 'G', 'E', 'C'];

  return (
    <div className={`staff-preview ${variant.accent}`}>
      <div className="staff-top">
        <button aria-label="Terug" className="round-tool" type="button">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="song-label">
          <span>{variant.id === 'concert' ? 'Module 2' : 'Song mode'}</span>
          <strong>{variant.id === 'score' ? 'Ode aan de Vreugde' : variant.title}</strong>
        </div>
        <button aria-label="Pauze" className="round-tool" type="button">
          <Pause aria-hidden="true" />
        </button>
      </div>

      <div className="grand-staff" aria-label="Demo notenbalk">
        <div className="brace" aria-hidden="true">{'{'}</div>
        <div className="clef treble" aria-hidden="true">𝄞</div>
        <div className="clef bass" aria-hidden="true">𝄢</div>
        <div className="measure-lines" />
        <div className="playhead" />
        <div className="staff-line treble l1" />
        <div className="staff-line treble l2" />
        <div className="staff-line treble l3" />
        <div className="staff-line treble l4" />
        <div className="staff-line treble l5" />
        <div className="staff-line bass l1" />
        <div className="staff-line bass l2" />
        <div className="staff-line bass l3" />
        <div className="staff-line bass l4" />
        <div className="staff-line bass l5" />

        {notes.map((note, index) => (
          <div className={`demo-note n${index + 1}`} key={`${note}-${index}`}>
            <span>{note}</span>
          </div>
        ))}

        <div className="finger-number f1">1</div>
        <div className="finger-number f3">3</div>
        <div className="finger-number f5">5</div>
      </div>
    </div>
  );
};

const DemoCard = ({ variant }: { variant: DemoVariant }) => (
  <article className={`ui-demo-card ${variant.accent}`}>
    <div className="demo-card-copy">
      <span className="demo-kicker">{variant.title}</span>
      <p>{variant.subtitle}</p>
    </div>
    <div className="tablet-frame">
      <StaffPreview variant={variant} />
      <div className="demo-bottom">
        <div className="demo-status">
          <span><Mic aria-hidden="true" /> Luisteren</span>
          <span><Gauge aria-hidden="true" /> 92%</span>
          <span><Hand aria-hidden="true" /> Handmatig</span>
        </div>
        <PianoKeyboard
          detectedKey={variant.detectedKey}
          expectedKey={variant.lessonKeys[0]}
          lessonKeys={variant.lessonKeys}
        />
      </div>
    </div>
  </article>
);

export const UiDemos = () => (
  <main className="demo-shell">
    <div className="portrait-gate">
      <Piano aria-hidden="true" />
      <strong>Draai je tablet naar landscape</strong>
      <span>Deze piano-app is ontworpen voor horizontaal oefenen naast je instrument.</span>
    </div>

    <header className="demo-hero">
      <div>
        <p className="eyebrow">UI richting</p>
        <h1>Klassieke piano, moderne lesflow</h1>
        <p>
          Drie demo’s voor een landscape-first ervaring: notenbalk centraal, toetsenbord vast onderin en
          bediening alleen waar je die nodig hebt.
        </p>
      </div>
      <div className="demo-hero-badges">
        <span><BookOpen aria-hidden="true" /> Nummers</span>
        <span><Piano aria-hidden="true" /> Landscape</span>
        <span><Sparkles aria-hidden="true" /> Klassiek</span>
      </div>
    </header>

    <section className="demo-grid" aria-label="UI demo varianten">
      {variants.map((variant) => (
        <DemoCard key={variant.id} variant={variant} />
      ))}
    </section>
  </main>
);
