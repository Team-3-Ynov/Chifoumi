import type { ProfileData } from "../hooks/useProfile.js";
import { LeagueBadge } from "./LeagueBadge.js";

type ProfileHeaderProps = {
  profile: ProfileData;
  progressToNextLeague?: number;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatWinRate(value: number): string {
  return `${Math.round(value * 100)} %`;
}

export function ProfileHeader({ profile, progressToNextLeague }: ProfileHeaderProps) {
  const email = profile.kind === "own" ? profile.me.email : null;
  const { stats } = profile;
  const progressPercent =
    progressToNextLeague === undefined ? null : Math.round(progressToNextLeague * 100);
  const hasNextLeague = stats.league.tier < 4;

  return (
    <section className="profile-header" aria-labelledby="profile-title">
      <h2 id="profile-title" className="title">
        {stats.displayName}
      </h2>

      <div className="profile-league">
        <LeagueBadge name={stats.league.name} tier={stats.league.tier} />
        {progressPercent !== null && hasNextLeague ? (
          <div className="league-progress">
            <div className="league-progress-label">
              <span>Progression</span>
              <strong>{progressPercent} %</strong>
            </div>
            <div
              className="league-progress-bar"
              role="progressbar"
              aria-label="Progression vers la prochaine ligue"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        ) : progressPercent !== null ? (
          <p className="league-progress-max">Ligue maximale atteinte</p>
        ) : null}
      </div>

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
