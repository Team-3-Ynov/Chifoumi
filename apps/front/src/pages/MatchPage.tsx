import { useParams } from "react-router-dom";

// Placeholder — the match experience is owned by another US.
export function MatchPage() {
  const { id } = useParams();

  return (
    <section className="page">
      <h1>Match {id}</h1>
      <p>Cette page sera implémentée dans une prochaine US.</p>
    </section>
  );
}
