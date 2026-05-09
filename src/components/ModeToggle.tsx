import { Hand, Mic } from 'lucide-react';
import type { LearningMode } from '../types';

type ModeToggleProps = {
  mode: LearningMode;
  isListening: boolean;
  onChange: (mode: LearningMode) => void;
};

export const ModeToggle = ({ mode, isListening, onChange }: ModeToggleProps) => (
  <div className="mode-toggle" role="group" aria-label="Leermodus">
    <button
      aria-pressed={mode === 'listen'}
      className={mode === 'listen' ? 'active' : ''}
      onClick={() => onChange('listen')}
      type="button"
    >
      <Mic aria-hidden="true" />
      Luisteren
      {mode === 'listen' && isListening ? <span className="mic-dot" aria-label="Microfoon actief" /> : null}
    </button>
    <button
      aria-pressed={mode === 'manual'}
      className={mode === 'manual' ? 'active' : ''}
      onClick={() => onChange('manual')}
      type="button"
    >
      <Hand aria-hidden="true" />
      Handmatig
    </button>
  </div>
);
