import { Link } from "react-router-dom";

export function LobbyPage() {
  return (
    <div className="page">
      <section className="panel" aria-labelledby="lobby-title">
        <h1 id="lobby-title" className="title">
          Lobby
        </h1>
        <p className="subtitle">
          L&apos;écran de matchmaking arrive avec l&apos;US-041. En attendant, consultez le{" "}
          <Link to="/leaderboard">leaderboard</Link> ou votre <Link to="/profile">profil</Link>.
        </p>
      </section>
    </div>
  );
}
