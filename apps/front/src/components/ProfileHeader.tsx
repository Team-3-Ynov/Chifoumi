import type { ProfileData } from "../hooks/useProfile.js";

type ProfileHeaderProps = {
  profile: ProfileData;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatWinRate(value: number): string {
  return `${Math.round(value * 100)} %`;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const email = profile.kind === "own" ? profile.me.email : null;
  const { stats } = profile;

  return (
    <section className="profile-header" aria-labelledby="profile-title">
      <h1 id="profile-title" className="title">
        {stats.displayName}
      </h1>

      <dl className="profile-stats">
        {email ? (
          <>
            <dt>Email</dt>
            <dd>{email}</dd>
          </>
        ) : null}
        <dt>Rating</dt>
        <dd>{stats.rating}</dd>
        <dt>Matchs joués</dt>
        <dd>{stats.gamesPlayed}</dd>
        <dt>Taux de victoire</dt>
        <dd>{formatWinRate(stats.winRate)}</dd>
        <dt>Inscription</dt>
        <dd>{formatDate(stats.createdAt)}</dd>
      </dl>
    </section>
  );
}
