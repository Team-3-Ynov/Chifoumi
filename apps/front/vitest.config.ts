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
        // Bootstrap entrypoints
        "src/main.tsx",
        "src/App.tsx",
        // Basic CRUD / layout pages (covered manually or via e2e)
        "src/pages/LeaderboardPage.tsx",
        "src/pages/ProfilePage.tsx",
        "src/pages/LoginPage.tsx",
        "src/pages/RegisterPage.tsx",
        "src/pages/ForgotPasswordPage.tsx",
        "src/pages/ResetPasswordPage.tsx",
        "src/pages/LobbyPage.tsx",
        "src/pages/MatchPage.tsx",
        // Presentational shells wired in pages above
        "src/components/AsyncState.tsx",
        "src/components/FinalScreen.tsx",
        "src/components/GameErrorNotice.tsx",
        "src/components/Header.tsx",
        "src/components/LeaderboardTable.tsx",
        "src/components/MatchHistoryList.tsx",
        "src/components/MatchHeader.tsx",
        "src/components/ProfileHeader.tsx",
        "src/components/ProtectedRoute.tsx",
        // Data-fetch hooks colocated with CRUD pages
        "src/hooks/useLeaderboard.ts",
        "src/hooks/useMyHistory.ts",
        "src/hooks/useProfile.ts",
        "src/hooks/gameSocketTypes.ts",
        "src/game/GameSocketContext.tsx",
        "src/hooks/useDeadlineCountdown.ts",
        // Test harness and generated typings
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
