/**
 * Scaffold shell. The full implementation is built task-by-task by Kiro CLI
 * from the spec in `.kiro/specs/seance/` — see `tasks.md` for the plan.
 */
export default function App() {
  return (
    <div className="app-shell">
      <header className="hero">
        <p className="hero-eyebrow">Kiroween 2026 · Resurrection</p>
        <h1>Séance</h1>
        <p className="hero-tagline">Paste a dead link. Watch it come back to life.</p>
      </header>

      <main>
        <section className="placeholder-card" aria-label="Build status">
          <h2>The séance is being prepared</h2>
          <p>
            The summoning circle is drawn and the spec is written — the app
            itself is built by Kiro CLI from{" "}
            <code>.kiro/specs/seance/tasks.md</code>. Come back after the first
            implementation wave.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Séance resurrects dead web pages from the Wayback Machine. No account,
          no API key, no tracking.
        </p>
      </footer>
    </div>
  );
}
