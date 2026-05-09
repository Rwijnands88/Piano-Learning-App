# Piano Studio

Interactieve piano-leerapp voor tabletgebruik naast een echte piano. De app gebruikt React 19, Vite, TypeScript, Firebase Auth, Firestore, Web Audio API, Pitchy en een handgeschreven PWA service worker.

## Functies

- Login en registratie via Firebase Auth.
- Voortgang per gebruiker in `users/{userId}/progress`.
- Lessen uit Firestore `lessons`, met lokale fallbacklessen wanneer de collectie leeg is.
- Luistermodus met microfoon, Web Audio API en Pitchy.
- Automatische stap-overgang bij de juiste gedetecteerde noot.
- Handmatige modus zonder microfoon.
- Visueel piano-toetsenbord met 2 octaven.
- PWA manifest en service worker voor installatie op tablet.

## Firestore datamodel

`lessons/{lessonId}`

```ts
{
  title: string;
  description: string;
  order: number;
  module: string;
  steps: Array<{
    text: string;
    keys: string[];
    expectedNote?: string;
  }>;
}
```

`users/{userId}/progress/{lessonId}`

```ts
{
  lessonId: string;
  completed: boolean;
  completedAt: Timestamp;
}
```

## Lokale setup

```bash
npm install
cp .env.example .env
npm run dev
```

Vul `.env` met de waarden uit Firebase Console > Project settings > Your apps > Web app.

## Privé muziekbestanden

Muziekbestanden horen niet in GitHub of in Vercel assets. Zet ze in Firebase Storage onder:

```text
users/{uid}/music-uploads/
users/{uid}/converted-lessons/
```

`storage.rules` staat alleen reads/writes toe voor de ingelogde eigenaar van die map. De app-code kan hiervoor `uploadPrivateMusicFile` uit `src/lib/musicStorage.ts` gebruiken. Ondersteunde bronbestanden zijn audio, MIDI, MusicXML, PDF en JPG/PNG scans tot 50 MB.

Zet Firebase Storage eerst eenmalig aan via Firebase Console > Storage > Get Started. Daarna kun je de regels deployen met:

```bash
firebase deploy --only storage
```

## Firebase deployment

```bash
npm run build
firebase login
firebase use --add
firebase deploy --only firestore:rules,storage
```

Zet in Firebase Console ook Email/Password sign-in aan onder Authentication > Sign-in method.
