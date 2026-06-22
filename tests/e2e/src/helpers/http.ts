export type AuthTokens = {
  access: string;
  refresh: string;
};

export type RegisteredPlayer = {
  userId: string;
  email: string;
  displayName: string;
  tokens: AuthTokens;
};

export async function waitForHealth(baseUrl: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Service at ${baseUrl} did not become healthy: ${String(lastError)}`);
}

export async function createPlayer(apiUrl: string, label: string): Promise<RegisteredPlayer> {
  const suffix = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${suffix}@example.com`;
  const displayName = `e2e-${suffix}`;

  const response = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password1234",
      displayName,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`register failed (${response.status}): ${body}`);
  }

  const body = (await response.json()) as {
    user: { id: string; email: string; displayName: string };
    tokens: AuthTokens;
  };

  return {
    userId: body.user.id,
    email: body.user.email,
    displayName: body.user.displayName,
    tokens: body.tokens,
  };
}

export async function getMe(
  apiUrl: string,
  accessToken: string,
): Promise<{ rating: number; gamesPlayed: number }> {
  const response = await fetch(`${apiUrl}/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET /me failed (${response.status}): ${body}`);
  }

  return (await response.json()) as { rating: number; gamesPlayed: number };
}

export async function pollMe(
  apiUrl: string,
  accessToken: string,
  predicate: (profile: { rating: number; gamesPlayed: number }) => boolean,
  timeoutMs = 5_000,
): Promise<{ rating: number; gamesPlayed: number }> {
  const deadline = Date.now() + timeoutMs;
  let lastProfile: { rating: number; gamesPlayed: number } | null = null;

  while (Date.now() < deadline) {
    lastProfile = await getMe(apiUrl, accessToken);
    if (predicate(lastProfile)) {
      return lastProfile;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `GET /me predicate not satisfied within ${timeoutMs}ms (last=${JSON.stringify(lastProfile)})`,
  );
}
