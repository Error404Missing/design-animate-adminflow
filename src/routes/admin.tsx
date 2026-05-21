import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Player = { id: string; name: string; region: string; title: string; points: number; tiers: Record<string, string> };

const MODES = ["overall","vanilla","uhc","pot","nethop","smp","sword","axe","mace","ltm"];
const REGIONS = ["EU","NA","AS","SA","OCE"];
const TITLES = ["Combat Grandmaster","Combat Master","Combat Ace","Combat Specialist","Combat Cadet","Combat Novice","Rookie"];
const TIERS = ["","HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];

const TIER_POINTS: Record<string, number> = {
  HT1: 50, LT1: 45, HT2: 35, LT2: 30, HT3: 20, LT3: 15,
  HT4: 10, LT4: 5, HT5: 2, LT5: 1,
};

function calcStats(tiers: Record<string, string>) {
  let pts = 0;
  for (const m of MODES) {
    if (m === "overall") continue;
    if (tiers[m]) pts += TIER_POINTS[tiers[m]] || 0;
  }
  let title = "Rookie";
  if (pts >= 400) title = "Combat Grandmaster";
  else if (pts >= 250) title = "Combat Master";
  else if (pts >= 100) title = "Combat Ace";
  else if (pts >= 50) title = "Combat Specialist";
  else if (pts >= 20) title = "Combat Cadet";
  else if (pts >= 10) title = "Combat Novice";
  
  return { points: pts, title };
}

const empty = (): Player => ({ id: "", name: "", region: "EU", title: "Rookie", points: 0, tiers: {} });

function AdminPage() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [editing, setEditing] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav({ to: "/login" }); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (!data) { setMsg("You are not an admin."); setChecking(false); return; }
      setIsAdmin(true); setChecking(false);
      loadPlayers();

      const params = new URLSearchParams(window.location.search);
      const addPlayer = params.get("add_player");
      if (addPlayer) {
        setEditing({ ...empty(), name: addPlayer });
        nav({ to: "/admin", replace: true });
      }
    })();
  }, []);

  const loadPlayers = async () => {
    const { data } = await supabase.from("players").select("*").order("points", { ascending: false });
    setPlayers((data ?? []) as unknown as Player[]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const payload = { name: editing.name, region: editing.region, title: editing.title, points: Number(editing.points), tiers: editing.tiers || {} };
    const { error } = editing.id
      ? await supabase.from("players").update(payload).eq("id", editing.id)
      : await supabase.from("players").insert(payload);
    if (error) { setMsg(error.message); return; }
    setEditing(null); setMsg(""); loadPlayers();
  };

  const del = async (id: string) => {
    setDeleting(id);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await supabase.from("players").delete().eq("id", deleting);
    setDeleting(null);
    loadPlayers();
  };

  const logout = async () => { await supabase.auth.signOut(); nav({ to: "/" }); };

  if (checking) return <div style={{ padding: 120, textAlign: "center", color: "#888" }}>Loading...</div>;
  if (!isAdmin) return (
    <div style={{ padding: 120, textAlign: "center" }}>
      <p style={{ color: "#ff5050" }}>{msg || "Access denied"}</p>
      <Link to="/" style={linkStyle}>← Back home</Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 20px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "2.5rem" }}>ADMIN <span style={{ color: "#ff0000" }}>PANEL</span></h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setEditing(empty())} style={primaryBtn}>+ NEW PLAYER</button>
          <Link to="/" style={ghostBtn}>HOME</Link>
          <button onClick={logout} style={ghostBtn}>SIGN OUT</button>
        </div>
      </div>

      {msg && <div style={{ background: "rgba(255,0,0,.1)", color: "#ff8080", padding: 12, borderRadius: 12, marginBottom: 16 }}>{msg}</div>}

      <div style={{ background: "rgba(10,10,14,.6)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,.04)" }}>
              {["Name","Region","Title","Points","Overall","Actions"].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                <td style={td}><strong>{p.name}</strong></td>
                <td style={td}>{p.region}</td>
                <td style={td}>{p.title}</td>
                <td style={td}>{p.points}</td>
                <td style={td}>{p.tiers?.overall ?? "—"}</td>
                <td style={td}>
                  <button onClick={() => setEditing(p)} style={smallBtn}>Edit</button>
                  <button onClick={() => del(p.id)} style={{ ...smallBtn, color: "#ff5050", marginLeft: 8 }}>Delete</button>
                </td>
              </tr>
            ))}
            {players.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#666" }}>No players yet</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <form onSubmit={save} style={{ background: "#0a0a0e", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "1.5rem", marginBottom: 20 }}>{editing.id ? "EDIT" : "NEW"} PLAYER</h2>
            <label style={lbl}>Name<input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={inp} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={lbl}>Region<select value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })} style={inp}>{REGIONS.map(r => <option key={r} style={{ background: "#0a0a0e", color: "#fff" }}>{r}</option>)}</select></label>
              <label style={lbl}>Points<input type="number" value={editing.points} onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) })} style={inp} /></label>
            </div>
            <label style={lbl}>Title<select value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={inp}>{TITLES.map(t => <option key={t} style={{ background: "#0a0a0e", color: "#fff" }}>{t}</option>)}</select></label>
            <div style={{ fontSize: ".7rem", color: "#888", letterSpacing: 2, margin: "12px 0 8px" }}>TIERS PER MODE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MODES.map(m => (
                <label key={m} style={{ ...lbl, marginBottom: 0 }}>
                  <span style={{ fontSize: ".7rem", color: "#aaa", textTransform: "uppercase" }}>{m}</span>
                  <select 
                    value={(editing.tiers || {})[m] ?? ""} 
                    onChange={(e) => {
                      const newTiers = { ...(editing.tiers || {}), [m]: e.target.value };
                      if (m !== "overall") {
                        const { points, title } = calcStats(newTiers);
                        setEditing({ ...editing, tiers: newTiers, points, title });
                      } else {
                        setEditing({ ...editing, tiers: newTiers });
                      }
                    }} 
                    style={inp}
                  >
                    {TIERS.map(t => <option key={t} value={t} style={{ background: "#0a0a0e", color: "#fff" }}>{t || "—"}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="submit" style={{ ...primaryBtn, flex: 1 }}>SAVE</button>
              <button type="button" onClick={() => setEditing(null)} style={{ ...ghostBtn, flex: 1 }}>CANCEL</button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setDeleting(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ background: "#0a0a0e", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 400, textAlign: "center" }}>
            <h2 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "1.5rem", marginBottom: 16 }}>DELETE PLAYER?</h2>
            <p style={{ color: "#aaa", fontSize: ".85rem", marginBottom: 24 }}>Are you sure you want to delete this player? This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={confirmDelete} style={{ ...primaryBtn, flex: 1 }}>YES, DELETE</button>
              <button onClick={() => setDeleting(null)} style={{ ...ghostBtn, flex: 1, justifyContent: "center" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: ".7rem", letterSpacing: 1.5, color: "#888", fontWeight: 800, textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "12px 16px", fontSize: ".85rem", color: "#ddd" };
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: ".85rem", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: ".7rem", color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 };
const primaryBtn: React.CSSProperties = { padding: "10px 20px", background: "#ff0000", color: "#fff", border: "none", borderRadius: 10, fontWeight: 900, fontSize: ".75rem", letterSpacing: 2, cursor: "pointer", fontFamily: "Outfit" };
const ghostBtn: React.CSSProperties = { padding: "10px 20px", background: "rgba(255,255,255,.05)", color: "#fff", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontWeight: 800, fontSize: ".75rem", letterSpacing: 2, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", fontFamily: "Outfit" };
const smallBtn: React.CSSProperties = { padding: "6px 12px", background: "rgba(255,255,255,.06)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".75rem", cursor: "pointer" };
const linkStyle: React.CSSProperties = { color: "#888", fontSize: ".85rem", marginTop: 16, display: "inline-block" };
