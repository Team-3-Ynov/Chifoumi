import { useParams } from "react-router-dom";

// Placeholder — the public profile is owned by another US. `id` is optional:
// `/profile` shows the current user, `/profile/:id` another player.
export function ProfilePage() {
  const { id } = useParams();

  return (
    <section className="page">
      <h1>Profil {id ?? "(le mien)"}</h1>
      <p>Cette page sera implémentée dans une prochaine US.</p>
    </section>
  );
}
