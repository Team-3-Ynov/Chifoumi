# Front Chifoumi

## Configuration locale

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GAME_SERVICE_URL=http://localhost:3001
```

Le client Socket.io ajoute automatiquement le namespace `/game` et transmet l'access token dans
la query de connexion attendue par le game-service.

## Intégration avec l'US-040

L'US-041 ne persiste aucun token. `App` accepte une propriété `session` en mémoire :

```tsx
<App
  session={{
    accessToken,
    user: { id: user.id, displayName: user.displayName, rating: user.rating },
  }}
/>
```

Le futur `AuthContext` de l'US-040 doit alimenter cette propriété après login, register ou refresh.
Sans session, les routes `/lobby` et `/match/:matchId` redirigent vers `/login`.

Les seules données conservées dans `sessionStorage` sont l'identifiant du match et le profil public
de l'adversaire, afin de proposer le bouton de reprise. L'access token n'y est jamais écrit.
