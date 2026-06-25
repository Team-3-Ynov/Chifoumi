import { Link } from "react-router-dom";
import type { TournamentSummary } from "../api/types.js";
import {
  formatTournamentFormat,
  formatTournamentStatus,
} from "../tournaments/tournamentFilters.js";

type TournamentListProps = {
  items: TournamentSummary[];
};

export function TournamentList({ items }: TournamentListProps) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Format</th>
            <th scope="col">Statut</th>
            <th scope="col">Inscrits</th>
          </tr>
        </thead>
        <tbody>
          {items.map((tournament) => (
            <tr key={tournament.id}>
              <td>
                <Link to={`/tournaments/${tournament.id}`} className="table-link">
                  {tournament.name}
                </Link>
              </td>
              <td>{formatTournamentFormat(tournament.format)}</td>
              <td>{formatTournamentStatus(tournament.status)}</td>
              <td>
                {tournament.registrationsCount} / {tournament.bracketSize}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
