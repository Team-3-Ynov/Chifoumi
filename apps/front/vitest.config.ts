import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/App.tsx",
        "src/pages/LeaderboardPage.tsx",
        "src/pages/ProfilePage.tsx",
        "src/pages/LoginPage.tsx",
        "src/pages/RegisterPage.tsx",
        "src/pages/LobbyPage.tsx",
        "src/components/AsyncState.tsx",
        "src/components/Header.tsx",
        "src/components/LeaderboardTable.tsx",
        "src/components/MatchHistoryList.tsx",
        "src/components/ProfileHeader.tsx",
        "src/components/ProtectedRoute.tsx",
        "src/hooks/useLeaderboard.ts",
        "src/hooks/useMyHistory.ts",
        "src/hooks/useProfile.ts",
        "src/hooks/gameSocketTypes.ts",
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/vite-env.d.ts",
        "src/api/types.ts",
      ],
      thresholds: {
        lines: 60,
        branches: 50,
      },
    },
  },
});
