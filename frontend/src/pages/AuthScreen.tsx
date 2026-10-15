import type { FormEvent } from "react";
import { Notice } from "../components/Notice";

export function AuthScreen({
  mode,
  setMode,
  error,
  setError,
  busy,
  authenticate,
}: {
  mode: "login" | "register";
  setMode: (mode: "login" | "register") => void;
  error: string;
  setError: (message: string) => void;
  busy: boolean;
  authenticate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <span className="brand">
          the hangover<span>.</span>
        </span>
        <span className="auth-tag">GOOD PLANS, MADE TOGETHER</span>
      </div>
      <section className="auth-card">
        <p className="eyebrow">A BETTER WAY TO MAKE PLANS</p>
        <h1>
          {mode === "register" ? "Make room for" : "Welcome"}
          <br />
          <em>{mode === "register" ? "new stories." : "back."}</em>
        </h1>
        <p className="muted">Discover new group experiences that suit everyone.</p>
        {error && <Notice type="error">{error}</Notice>}
        <form className="stack" onSubmit={authenticate}>
          {mode === "register" && (
            <label>
              Your name
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={mode === "register" ? 10 : 1}
              maxLength={128}
            />
            {mode === "register" && <small>At least 10 characters</small>}
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Please wait\u2026" : mode === "register" ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="switch-auth">
          {mode === "register" ? "Already have an account?" : "New here?"}{" "}
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register");
              setError("");
            }}
          >
            {mode === "register" ? "Log in" : "Create account"}
          </button>
        </p>
      </section>
      <p className="auth-foot">Experiences for the group, not just the algorithm.</p>
    </main>
  );
}
