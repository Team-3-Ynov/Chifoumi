import { Link, useParams } from "react-router-dom";

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();

  return (
    <div className="page">
      <section className="panel" aria-labelledby="match-title">
        <h1 id="match-title" className="title">
          Match
        </h1>
        <p className="subtitle">
          L&apos;écran de jeu BO3 arrive avec l&apos;US-041. Match{" "}
          <code>{matchId ?? "inconnu"}</code>.
        </p>
        <Link to="/lobby" className="button">
          Retour au lobby
        </Link>
      </section>
    </div>
  );
}
