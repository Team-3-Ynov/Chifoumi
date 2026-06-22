import { Link } from "react-router-dom";
import type { LeaderboardEntry } from "../api/types.js";

type LeaderboardTableProps = {
  items: LeaderboardEntry[];
};

export function LeaderboardTable({ items }: LeaderboardTableProps) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Rang</th>
            <th scope="col">Joueur</th>
            <th scope="col">Rating</th>
            <th scope="col">Matchs joués</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.userId}>
              <td>{entry.rank}</td>
              <td>
                <Link to={`/profile/${entry.userId}`} className="table-link">
                  {entry.displayName}
                </Link>
              </td>
              <td>{entry.rating}</td>
              <td>{entry.gamesPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
