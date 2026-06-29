# EPIC-S1-FRONT — Front React (auth, lobby, match, leaderboard, profil) + tests

**Sprint :** 1
**Priorité globale :** P0 (US-040 à US-042) + P1 (US-043 tests)
**Objectif :** transformer la coque Vite/React de l'US-006 en application jouable de bout en bout. Le brief le rappelle : « aucune valorisation sur l'UX/UI » → on vise la **propreté du code** (composants purs, hooks bien découpés, séparation logique/présentation), pas le pixel.
**Réf. design :** §3.1 (front), §1 (UX minimaliste)

> **Note** : ces stories étaient implicites dans `US-031` (E2E cross-instance) qui simulait des clients programmatiquement. Pour la démo soutenance et la note Fonctionnel ×4, il faut un vrai front.

---

### US-040 — Auth pages : login + register + AuthContext + persistance tokens

- **Epic** : EPIC-S1-FRONT
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §3.1, §6.1 auth
- **Dépend de** : US-007 (auth API)

#### Contexte
Premier point d'entrée de l'app. Doit gérer la persistance des tokens (refresh automatique en arrière-plan), le routing protégé, et l'affichage des erreurs API.

#### User story
En tant que **visiteur**, je veux **pouvoir créer un compte ou me connecter via deux pages dédiées et rester authentifié au refresh** afin d'**accéder ensuite au lobby et au matchmaking sans ressaisir mon mot de passe à chaque navigation**.

#### Acceptance criteria
- **AC1** : Given une URL `/login`, When j'ouvre la page, Then je vois un formulaire (email + password) + lien vers `/register`. Submit → `POST /auth/login` → si OK, tokens stockés (en mémoire pour l'access, `httpOnly cookie` ou `sessionStorage` pour le refresh selon arbitrage) + redirect `/lobby`.
- **AC2** : Given une URL `/register`, When je soumets `{ email, password, displayName }` valides, Then `POST /auth/register` puis redirect direct sur `/lobby` (l'utilisateur est connecté à l'inscription).
- **AC3** : Given une erreur API (401, 409), When je soumets, Then un message d'erreur lisible s'affiche sous le formulaire (`Email déjà utilisé`, `Identifiants invalides`).
- **AC4** : Given un access token expiré pendant la navigation, When une requête API renvoie 401, Then un intercepteur Axios/fetch tente automatiquement `POST /auth/refresh`. Si le refresh réussit → la requête originale est rejouée transparente. Si échec → redirect `/login`.
- **AC5** : Given un user authentifié, When il navigue sur `/login` ou `/register`, Then il est redirigé sur `/lobby` (pas la peine de se reconnecter).
- **AC6** : Given un user authentifié, When il clique sur un bouton "Logout" (présent dans le header), Then `POST /auth/logout` est appelé puis redirect `/login`.
- **AC7** : Validation client (Zod) sur les formulaires : email format, password ≥10 chars, displayName 3-30 alphanum (mêmes règles que côté API).

#### Tâches techniques
- [ ] Setup React Router v6+ (routes : `/login`, `/register`, `/lobby`, `/match/:id`, `/leaderboard`, `/profile/:id?`).
- [ ] `AuthContext` (Context API ou Zustand) exposant `{ user, accessToken, login, logout, register }`.
- [ ] Client API (`apiClient.ts`) avec intercepteur 401 → refresh.
- [ ] Composants `LoginForm`, `RegisterForm` purs, formulaires validés via Zod + `react-hook-form`.
- [ ] Composant `<ProtectedRoute>` qui redirige vers `/login` si non authentifié.
- [ ] Composant `<Header>` avec displayName + bouton logout.

#### Definition of Done (en plus de la DoD globale)
- [ ] Aucun mot de passe loggé console.
- [ ] L'access token n'est **jamais** stocké en `localStorage` (XSS).

---

### US-041 — Lobby + écran de match avec hook `useGameSocket` (BO3 simple, P0)

- **Epic** : EPIC-S1-FRONT
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §6.2 (events WS)
- **Dépend de** : US-040 (auth), US-018 (joinQueue), US-019 (matchmaking), US-020 (session), US-021 (BO3)

#### Contexte
Cœur de l'expérience joueur. La page Lobby permet de rejoindre la file ; l'écran Match consomme les events WS et affiche le déroulé du BO3. Le hook `useGameSocket` encapsule la connexion Socket.io (état, events, cleanup).

#### User story
En tant que **joueur authentifié**, je veux **cliquer sur "Trouver un match" depuis le lobby et être conduit automatiquement à l'écran de match dès qu'un adversaire est trouvé** afin de **jouer un BO3 jusqu'à un gagnant**.

#### Acceptance criteria
- **AC1** : Given `/lobby`, When je vois la page, Then bouton "Trouver un match" + indicateur de mon rating actuel + (si en attente) timer `Recherche depuis 0:12...`.
- **AC2** : Given je clique "Trouver un match", When le client émet `joinQueue`, Then je reçois `queueJoined` (timer démarre) puis `matchFound` (redirect `/match/:matchId`).
- **AC3** : Given je suis sur `/match/:matchId`, When je vois la page, Then : header avec mon `displayName/rating` vs `opponent.displayName/rating`, score `0-0`, **3 boutons "Pierre / Feuille / Ciseaux"**, indicateur de round, et un compte à rebours `5s` synchronisé sur le `roundStart.deadline`.
- **AC4** : Given je clique sur un coup, When émission `play { matchId, roundNumber, move }`, Then les boutons sont désactivés et message "En attente de l'adversaire…" jusqu'à `roundResolved`.
- **AC5** : Given `roundResolved` reçu, When affichage, Then animation/feedback minimal (texte) "Vous : Pierre — Adversaire : Ciseaux — Vous gagnez le round !" + score mis à jour.
- **AC6** : Given `matchEnded`, When affichage, Then écran de fin avec score final, gagnant, `eloDelta` (`+16` ou `-16` colorié) et bouton "Retour au lobby".
- **AC7** : Given un timeout (5s sans cliquer), When le serveur émet `matchEnded { reason: "FORFEIT_TIMEOUT" }`, Then écran "Défaite par forfait".
- **AC8** : Given je quitte la page en cours de match (back navigateur), When je reviens sur `/lobby`, Then warning "Vous avez un match en cours" + bouton "Reprendre" (utile en P2 avec US-038).
- **AC9** : Le hook `useGameSocket()` gère proprement le cleanup (déconnexion WS au unmount, pas de leak).

#### Tâches techniques
- [ ] Page `LobbyPage` avec bouton + state local (idle / queued / found).
- [ ] Page `MatchPage` consommant `useGameSocket(matchId)`.
- [ ] Hook `useGameSocket(matchId?)` dans `src/hooks/` : connexion WS, abonnement events, cleanup, retours typés via les schémas Zod partagés (`@chifoumi/schemas`).
- [ ] Composants purs : `<MatchHeader>`, `<MoveButtons>`, `<RoundResultBanner>`, `<FinalScreen>`.
- [ ] Synchronisation horloge serveur/client (deadline ISO → countdown local avec recalibrage).
- [ ] Gestion erreurs WS (rejet, déco) avec toast minimaliste.

---

### US-042 — Pages Leaderboard + Profil (mien et public d'un autre joueur)

- **Epic** : EPIC-S1-FRONT
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §6.1 leaderboard, profil
- **Dépend de** : US-010 (`/me`), US-011 (`/me/history`), US-012 (`/users/:id/profile`), US-013 (`/leaderboard`)

#### Contexte
Pages à charge faible côté front mais essentielles pour donner du sens au ranked et démontrer la consommation de l'API en lecture.

#### User story
En tant que **joueur**, je veux **consulter le top 50 du leaderboard et mon profil avec mon historique de matchs paginé** afin de **suivre ma progression et comparer mon rang**.

#### Acceptance criteria
- **AC1** : Given `/leaderboard`, When je consulte, Then tableau `Rang | Joueur (displayName cliquable → /profile/:id) | Rating | Matchs joués`. 50 lignes max.
- **AC2** : Auto-refresh toutes les 30s (intervalle aligné sur le TTL cache Redis API US-013).
- **AC3** : Given `/profile` (sans param = mon profil), When je consulte, Then : displayName, email (si mien), rating, gamesPlayed, winRate, date d'inscription, et un onglet "Historique" qui appelle `/me/history?limit=20` + pagination "Charger plus" via `nextCursor`.
- **AC4** : Given `/profile/:id` d'un autre joueur, When je consulte, Then mêmes infos publiques **sans email** + sans onglet historique (US futur).
- **AC5** : Loading states (skeleton), error states (retry), empty states ("Aucun match joué encore").

#### Tâches techniques
- [ ] Page `LeaderboardPage` + composant `<LeaderboardTable>`.
- [ ] Page `ProfilePage` (route param optionnel) + composants `<ProfileHeader>`, `<MatchHistoryList>`.
- [ ] Hook `useLeaderboard()` (fetch + interval + react-query ou SWR pour le cache client).
- [ ] Hook `useMyHistory()` avec pagination cursor (infinite query).
- [ ] Lien depuis `<Header>` vers `/leaderboard` et `/profile`.

---

### US-043 — Tests front : Vitest + React Testing Library (composants critiques + hooks)

- **Epic** : EPIC-S1-FRONT
- **Priorité** : **P1**
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §8 (tests front)
- **Dépend de** : US-040, US-041, US-042

#### Contexte
Le brief impose explicitement « Couverture Front » avec exclusions explicites. Le design §8 cible : composants de jeu, hook WebSocket avec mock, helpers (formattage ELO, calcul progression ligue). Pas de tests sur les pages CRUD basiques.

#### User story
En tant que **mainteneur**, je veux **des tests Vitest+RTL sur les hooks et composants critiques du front** afin de **garantir la non-régression sur la logique de jeu (timer, états WS, formattage) et satisfaire le critère "Couverture Front" du brief**.

#### Acceptance criteria
- **AC1** : Given le hook `useGameSocket`, When je le teste avec un **mock Socket.io** (`socket.io-mock` ou wrapper custom), Then je couvre : connexion OK, événements `matchFound` / `roundStart` / `roundResolved` / `matchEnded` reçus, cleanup au unmount, gestion de `error`.
- **AC2** : Given le composant `<MoveButtons>`, When je teste, Then : 3 boutons rendus, callback `onPlay` invoqué avec le bon `move`, désactivation après clic.
- **AC3** : Given le composant `<RoundResultBanner>`, When je teste avec différents winners (`a`, `b`, `draw`), Then le bon message s'affiche.
- **AC4** : Given le helper de formattage ELO (`formatRatingDelta(+16)` → `"+16"` vert ; `-16` → `"-16"` rouge), When je teste, Then comportement attendu.
- **AC5** : Given le hook `useAuth`, When je teste : login OK / login KO / logout / refresh auto sur 401, Then chaque branche couverte.
- **AC6** : Configuration **Vitest** : `coverage.thresholds.lines: 60`, `coverage.thresholds.branches: 50` (seuils volontairement modestes côté front car « UX non valorisée »).
- **AC7** : Exclusions explicites via `vitest.config.ts` (`coverage.exclude`) sur les pages CRUD basiques (`LeaderboardPage`, `ProfilePage`) et le bootstrap (`main.tsx`, `App.tsx`).
- **AC8** : Tests passent en CI (intégrés à `pnpm -r test`).

#### Tâches techniques
- [ ] `pnpm --filter @chifoumi/front add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`.
- [ ] `vitest.config.ts` avec env `jsdom`, setup `src/test/setup.ts`.
- [ ] Mock Socket.io centralisé dans `src/test/mocks/socket.ts`.
- [ ] Tests : `useGameSocket.test.tsx`, `useAuth.test.tsx`, `MoveButtons.test.tsx`, `RoundResultBanner.test.tsx`, `formatRating.test.ts`.
- [ ] Doc dans `apps/front/README.md` sur la stratégie de test.

---

### Récap Epic S1-FRONT

| Story | SP | Priorité |
|---|---|---|
| US-040 Auth pages + AuthContext | 3 | P0 |
| US-041 Lobby + écran de match + hook WS | 5 | P0 |
| US-042 Leaderboard + Profil | 3 | P0 |
| US-043 Tests Vitest+RTL | 3 | P1 |
| **Total** | **14 SP** | — |

> Sans cette epic, le critère **Fonctionnel ×4** repose uniquement sur l'API et l'E2E programmatique (US-031), ce qui est insuffisant pour une démo en soutenance.
