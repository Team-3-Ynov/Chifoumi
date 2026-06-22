import { useAuth } from "../auth/AuthContext.js";

export function LobbyPage() {
  const { user } = useAuth();

  return (
    <section className="page">
      <h1>Lobby</h1>
      <p>Bienvenue, {user?.displayName} 👋</p>
      <p>Le matchmaking et le classement arriveront dans les prochaines US.</p>
    </section>
  );
}
