import { useEffect, useState } from "react";
import "./App.css";

type HealthResponse = {
  status: string;
  service: string;
  version: string;
};

type HealthState =
  | { state: "loading" }
  | { state: "ready"; data: HealthResponse }
  | { state: "error"; message: string };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export function App() {
  const [health, setHealth] = useState<HealthState>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchHealth() {
      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = (await response.json()) as HealthResponse;
        setHealth({ state: "ready", data });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setHealth({
          state: "error",
          message: error instanceof Error ? error.message : "API unavailable",
        });
      }
    }

    void fetchHealth();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="app">
      <section className="panel" aria-labelledby="app-title">
        <h1 className="title" id="app-title">
          Chifoumi Ranked
        </h1>
        <p className="subtitle">Sprint 0 application shell</p>

        {health.state === "loading" ? (
          <div className="health">
            <span className="label">API health</span>
            <span className="value">Loading</span>
          </div>
        ) : null}

        {health.state === "ready" ? (
          <div className="health">
            <span className="label">API health</span>
            <span className="value">
              {health.data.service} {health.data.version}: {health.data.status}
            </span>
          </div>
        ) : null}

        {health.state === "error" ? (
          <div className="health error">
            <span className="label">API health</span>
            <span className="value">{health.message}</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}
