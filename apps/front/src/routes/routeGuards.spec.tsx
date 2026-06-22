import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../auth/AuthContext.js", () => ({ useAuth: useAuthMock }));

import { ProtectedRoute } from "./ProtectedRoute.js";
import { PublicOnlyRoute } from "./PublicOnlyRoute.js";

beforeEach(() => {
  useAuthMock.mockReset();
});

function renderProtected(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/lobby" element={<div>Protected lobby</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPublicOnly(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
        <Route path="/lobby" element={<div>Lobby page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute (AC4)", () => {
  it("renders the protected content when authenticated", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderProtected("/lobby");
    expect(screen.getByText("Protected lobby")).toBeInTheDocument();
  });

  it("redirects to /login when anonymous", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderProtected("/lobby");
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("shows a loader while the session is initializing", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: true });
    renderProtected("/lobby");
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });
});

describe("PublicOnlyRoute (AC5)", () => {
  it("redirects authenticated users to /lobby", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderPublicOnly("/login");
    expect(screen.getByText("Lobby page")).toBeInTheDocument();
  });

  it("renders the public page for anonymous users", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderPublicOnly("/login");
    expect(screen.getByText("Login form")).toBeInTheDocument();
  });
});
