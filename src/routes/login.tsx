import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const fn = mode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
    const { error } = await fn;
    
    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (data) {
        nav({ to: "/admin" });
      } else {
        nav({ to: "/waitlist" });
      }
    } else {
      // If email confirmation is required, session might be null
      setErr("Check your email to confirm registration.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 420, background: "rgba(10,10,14,.6)", backdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: 40, boxShadow: "0 40px 80px rgba(0,0,0,.6)" }}>
        <h1 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "2rem", marginBottom: 6 }}>TIER<span style={{ color: "#ff0000" }}>HUB</span></h1>
        <p style={{ color: "#808080", marginBottom: 28, fontSize: ".85rem" }}>{mode === "signin" ? "Sign in to access admin panel" : "Create the first admin account"}</p>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        {err && <div style={{ color: "#ff5050", fontSize: ".8rem", marginBottom: 12 }}>{err}</div>}
        <button type="submit" disabled={loading} style={btnStyle}>{loading ? "..." : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}</button>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} style={{ background: "none", color: "#808080", fontSize: ".8rem", marginTop: 16, width: "100%" }}>
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <Link to="/" style={{ display: "block", textAlign: "center", color: "#555", fontSize: ".75rem", marginTop: 20 }}>← Back to rankings</Link>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "14px 16px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#fff", fontSize: ".9rem", marginBottom: 12, outline: "none", fontFamily: "inherit" };
const btnStyle: React.CSSProperties = { width: "100%", padding: "14px", background: "#ff0000", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: ".85rem", letterSpacing: 2, cursor: "pointer", fontFamily: "Outfit" };
