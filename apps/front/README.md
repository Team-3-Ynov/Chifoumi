# @chifoumi/front

React + Vite client for Chifoumi Ranked.

## Testing strategy

Critical front logic is covered with **Vitest** and **React Testing Library**:

- `useGameSocket` — Socket.io lifecycle and match events via a centralized mock in `src/test/mocks/socket.ts`
- `useAuth` — login, logout, bootstrap refresh, and query cache cleanup
- `MoveButtons` and `RoundResultBanner` — pure match UI components
- `formatRatingDelta` — ELO delta formatting helper
- `apiClient` — 401 retry and API error parsing

Coverage thresholds are enforced in `vitest.config.ts` (`lines: 60`, `branches: 50`).

Explicit coverage exclusions keep CRUD pages and bootstrap files out of the front threshold:

- `src/main.tsx`, `src/App.tsx`
- `src/pages/LeaderboardPage.tsx`, `src/pages/ProfilePage.tsx`
- other basic pages and layout components (`LoginPage`, `RegisterPage`, `LobbyPage`, `Header`, etc.)

Run tests locally:

```bash
pnpm --filter @chifoumi/front test
```

## Game client

The lobby and BO3 match screens use `VITE_GAME_SERVICE_URL` (default:
`http://localhost:3001`) and connect to the `/game` Socket.io namespace. The access token comes
from `AuthContext` memory and is never persisted by the game client. Only public active-match
metadata is stored in `sessionStorage` to display the resume action.
