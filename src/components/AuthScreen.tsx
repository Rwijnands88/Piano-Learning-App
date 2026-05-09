import { FormEvent, useState } from 'react';
import { Eye, Lock, Mail, Music2 } from 'lucide-react';

type AuthScreenProps = {
  error: string;
  loading: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
};

export const AuthScreen = ({ error, loading, onSignIn, onRegister }: AuthScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (isRegistering) {
        await onRegister(email, password);
      } else {
        await onSignIn(email, password);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand-mark">
          <Music2 aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Privé studio</p>
          <h1 id="auth-title">Piano Studio</h1>
          <p className="auth-intro">Log in met je eigen account om lessen en voortgang gescheiden te houden.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>E-mail</span>
            <div className="input-shell">
              <Mail aria-hidden="true" />
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="naam@example.com"
                required
                type="email"
                value={email}
              />
            </div>
          </label>

          <label className="field">
            <span>Wachtwoord</span>
            <div className="input-shell">
              <Lock aria-hidden="true" />
              <input
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimaal 6 tekens"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                className="icon-button"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                <Eye aria-hidden="true" />
              </button>
            </div>
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={busy || loading} type="submit">
            {isRegistering ? 'Account maken' : 'Inloggen'}
          </button>
        </form>

        <button className="text-button" onClick={() => setIsRegistering((value) => !value)} type="button">
          {isRegistering ? 'Ik heb al een account' : 'Nieuw account voor tweede gebruiker'}
        </button>
      </section>
    </main>
  );
};
