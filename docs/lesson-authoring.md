# Lespakket uitbreiden

De vaste leerlijn staat lokaal in `src/data/defaultLessons.ts`. Voortgang blijft per gebruiker in Firestore staan.

Geef Codex later bijvoorbeeld zo'n opdracht:

```text
Voeg een nieuwe module toe aan het lokale lespakket: "Blues basis".
Maak 8 lessen voor beginner tot late-beginner, binnen C3-B4, met hand, vingerzetting,
tempo, maatsoort en notatie-stappen. Gebruik geen copyrighted volledige songs.
```

Voor een specifiek nummer:

```text
Ik heb de bladmuziek/licentie van [titel]. Zet dit prive om naar een oefenles
met rechterhand apart, linkerhand apart en daarna twee handen samen.
```

Gebruik lokaal voor kernlessen. Gebruik Firestore vooral voor voortgang en later eventueel persoonlijke extra stukken.
