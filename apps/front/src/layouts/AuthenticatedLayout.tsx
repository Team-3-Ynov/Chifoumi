import { Outlet } from "react-router-dom";
import { Header } from "../components/Header.js";

// Shared chrome for authenticated pages: header (with logout) + routed content.
export function AuthenticatedLayout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
