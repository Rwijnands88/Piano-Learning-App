import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, hasFirebaseConfig } from '../lib/firebase';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const authErrorMessage = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (code.includes('invalid-credential') || code.includes('wrong-password')) {
    return 'E-mail of wachtwoord klopt niet.';
  }

  if (code.includes('email-already-in-use')) {
    return 'Dit e-mailadres heeft al een account.';
  }

  if (code.includes('weak-password')) {
    return 'Gebruik een wachtwoord van minimaal 6 tekens.';
  }

  return 'Inloggen lukt nu niet. Controleer je Firebase-configuratie.';
};

export const useAuth = (): AuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth || !hasFirebaseConfig) {
      setError('Vul eerst je Firebase environment variables in.');
      return;
    }

    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (caught) {
      setError(authErrorMessage(caught));
    }
  };

  const register = async (email: string, password: string, username: string) => {
    if (!auth || !hasFirebaseConfig) {
      setError('Vul eerst je Firebase environment variables in.');
      return;
    }

    const displayName = username.trim();
    if (displayName.length < 2) {
      setError('Kies een gebruikersnaam van minimaal 2 tekens.');
      return;
    }

    setError('');
    try {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credentials.user, {
        displayName,
      });
      setUser(credentials.user);
    } catch (caught) {
      setError(authErrorMessage(caught));
    }
  };

  const logOut = async () => {
    if (auth) {
      await signOut(auth);
    }
  };

  return { user, loading, error, signIn, register, logOut };
};
