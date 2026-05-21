import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/waitlist")({ component: WaitlistPage });

type Request = {
  id: string;
  user_id: string;
  tester_id: string | null;
  ign: string;
  mode: string;
  note: string;
  status: string;
  discord_username: string;
  created_at: string;
};

const WAITLIST_MODES = [
  { id: "vanilla", label: "Vanilla" },
  { id: "uhc", label: "UHC" },
  { id: "pot", label: "Pot" },
  { id: "nethop", label: "NethOP" },
  { id: "smp", label: "SMP" },
  { id: "sword", label: "Sword" },
  { id: "axe", label: "Axe" },
  { id: "mace", label: "Mace" },
  { id: "ltm", label: "LTMs" },
];

const MODE_ICONS: Record<string, string> = {
  vanilla: "https://mctiers.com/tier_icons/vanilla.svg",
  uhc: "https://mctiers.com/tier_icons/uhc.svg",
  pot: "https://mctiers.com/tier_icons/pot.svg",
  nethop: "https://mctiers.com/tier_icons/nethop.svg",
  smp: "https://mctiers.com/tier_icons/smp.svg",
  sword: "https://mctiers.com/tier_icons/sword.svg",
  axe: "https://mctiers.com/tier_icons/axe.svg",
  mace: "https://mctiers.com/tier_icons/mace.svg",
  ltm: "https://mctiers.com/tier_icons/overall.svg",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  rejected: "#ef4444",
};

function WaitlistPage() {
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ign, setIgn] = useState("");
  const [mode, setMode] = useState("vanilla");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let ch: any;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav({ to: "/login" }); return; }
      setUserId(session.user.id);
      
      const discord = session.user.user_metadata?.custom_claims?.global_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || "Unknown Discord";
      setDiscordUsername(discord);
      setUserEmail(discord); // Display discord name instead of email in header

      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (!active) return;
      
      const isAdm = !!data;
      if (isAdm) setIsAdmin(true);
      await loadRequests(session.user.id, isAdm);

      ch = supabase
        .channel("waitlist-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "test_requests" }, () => {
          loadRequests(session.user.id, isAdm);
        })
        .subscribe();
    })();

    return () => {
      active = false;
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  const loadRequests = async (uid: string, admin: boolean) => {
    const { data } = await supabase
      .from("test_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data ?? []) as Request[]);
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !ign.trim()) return;
    setSubmitting(true);
    setMsg("");

    // Check if IGN is already linked (case insensitive)
    const { data: linkData, error: linkErr } = await supabase
      .from("linked_accounts")
      .select("*")
      .ilike("ign", ign.trim())
      .maybeSingle();

    if (linkData) {
      if (linkData.user_id !== userId) {
        setMsg("This Minecraft name is already linked to another Discord account. If this is yours, contact an admin.");
        setSubmitting(false);
        return;
      }
    } else {
      // Try to link it
      const { error: insertLinkErr } = await supabase.from("linked_accounts").insert({
        user_id: userId,
        ign: ign.trim()
      });
      if (insertLinkErr) {
        setMsg("Failed to link this Minecraft name. It might be taken.");
        setSubmitting(false);
        return;
      }
    }

    const { error } = await supabase.from("test_requests").insert({
      user_id: userId,
      ign,
      mode,
      note,
      discord_username: discordUsername,
    });
    setSubmitting(false);
    if (error) { setMsg(error.message); return; }
    setShowForm(false);
    setIgn(""); setMode("vanilla"); setNote("");
    await loadRequests(userId, isAdmin);
  };

  const accept = async (id: string) => {
    if (!userId) return;
    await supabase.from("test_requests").update({ status: "in_progress", tester_id: userId }).eq("id", id);
    await loadRequests(userId, isAdmin);
  };

  const updateStatus = async (id: string, status: string) => {
    if (!userId) return;
    await supabase.from("test_requests").update({ status }).eq("id", id);
    await loadRequests(userId, isAdmin);
  };

  const confirmComplete = async (action: 'now' | 'later') => {
    if (!completingId || !userId) return;
    await supabase.from("test_requests").update({ status: "completed" }).eq("id", completingId);
    setCompletingId(null);
    if (action === 'now') {
      nav({ to: "/admin" });
    } else {
      await loadRequests(userId, isAdmin);
    }
  };

  const myRequests = requests.filter(r => r.user_id === userId);
  const pendingRequests = requests.filter(r => r.status === "pending");
  const myActiveAsAdmin = requests.filter(r => r.tester_id === userId && r.status === "in_progress");

  return (
    <div style={{ minHeight: "100vh", paddingTop: 80, paddingBottom: 60 }}>
      {/* Navbar */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(5,5,8,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", height: 64, display: "flex", alignItems: "center", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32, width: "100%", maxWidth: 1200, margin: "0 auto" }}>
          <Link to="/" style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "1.3rem", color: "#fff", textDecoration: "none" }}>
            TIER<span style={{ color: "#ff0000" }}>HUB</span>
          </Link>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Link to="/" style={navLink}>Home</Link>
            <Link to="/waitlist" style={{ ...navLink, color: "#ff0000" }}>Waitlist</Link>
            {isAdmin && <Link to="/admin" style={navLink}>Admin</Link>}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#666", fontSize: ".8rem" }}>{userEmail}</span>
            <button onClick={() => supabase.auth.signOut().then(() => nav({ to: "/" }))} style={ghostBtnSm}>Sign Out</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "2.8rem", marginBottom: 8 }}>
            TEST <span style={{ color: "#ff0000" }}>WAITLIST</span>
          </h1>
          <p style={{ color: "#666", fontSize: ".95rem" }}>Request a tier test from one of our admins/testers.</p>
        </div>

        {/* Error message */}
        {msg && <div style={{ background: "rgba(255,0,0,.1)", color: "#ff8080", padding: 12, borderRadius: 12, marginBottom: 16 }}>{msg}</div>}

        {/* ─── USER SECTION ─── */}
        <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: "1.1rem", color: "#aaa", letterSpacing: 2 }}>YOUR REQUESTS</h2>
              <button onClick={() => setShowForm(true)} style={primaryBtn}>+ REQUEST TEST</button>
            </div>

            {loading ? (
              <div style={{ color: "#555", padding: 40, textAlign: "center" }}>Loading...</div>
            ) : myRequests.length === 0 ? (
              <div style={emptyBox}>
                <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>📋</span>
                <p style={{ color: "#555" }}>You haven't requested a test yet.</p>
                <button onClick={() => setShowForm(true)} style={{ ...primaryBtn, marginTop: 16 }}>Request Your First Test</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myRequests.map(r => (
                  <div key={r.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: "1.1rem" }}>{r.ign}</div>
                        <div style={{ color: "#666", fontSize: ".8rem", marginTop: 4 }}>
                          Mode: <span style={{ color: "#aaa" }}>{r.mode.toUpperCase()}</span>
                          {r.note && <> · Note: <span style={{ color: "#aaa" }}>{r.note}</span></>}
                        </div>
                        <div style={{ color: "#555", fontSize: ".75rem", marginTop: 4 }}>{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ ...statusBadge, background: STATUS_COLOR[r.status] + "22", color: STATUS_COLOR[r.status], border: `1px solid ${STATUS_COLOR[r.status]}44` }}>
                          {STATUS_LABEL[r.status]}
                        </span>
                        {(r.status === "in_progress") && (
                          <Link to="/chat/$requestId" params={{ requestId: r.id }} style={primaryBtn}>💬 Open Chat</Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        {/* ─── ADMIN SECTION ─── */}
        {isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 40, marginTop: 40 }}>

            {/* My active tests */}
            {myActiveAsAdmin.length > 0 && (
              <section>
                <h2 style={sectionTitle}>MY ACTIVE TESTS</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {myActiveAsAdmin.map(r => (
                    <div key={r.id} style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: "1.1rem" }}>{r.ign}</div>
                          <div style={{ color: "#666", fontSize: ".8rem", marginTop: 4 }}>Mode: <span style={{ color: "#aaa" }}>{r.mode.toUpperCase()}</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Link to="/chat/$requestId" params={{ requestId: r.id }} style={primaryBtn}>💬 Chat</Link>
                          <button onClick={() => setCompletingId(r.id)} style={greenBtn}>✓ Complete</button>
                          <button onClick={() => updateStatus(r.id, "rejected")} style={redBtn}>✕ Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Pending queue */}
            <section>
              <h2 style={sectionTitle}>PENDING QUEUE <span style={{ color: "#f59e0b", marginLeft: 8 }}>({pendingRequests.length})</span></h2>
              {loading ? (
                <div style={{ color: "#555", padding: 40, textAlign: "center" }}>Loading...</div>
              ) : pendingRequests.length === 0 ? (
                <div style={emptyBox}><p style={{ color: "#555" }}>No pending requests.</p></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pendingRequests.map((r, i) => (
                    <div key={r.id} style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <span style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "1.4rem", color: "#ff0000", minWidth: 30 }}>#{i + 1}</span>
                          <div>
                            <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: "1.05rem" }}>
                              {r.ign}
                              {r.discord_username && (
                                <span style={{ background: "#5865F222", color: "#5865F2", fontSize: ".7rem", padding: "2px 6px", borderRadius: 6, marginLeft: 8, verticalAlign: "middle" }}>
                                  Discord: {r.discord_username}
                                </span>
                              )}
                            </div>
                            <div style={{ color: "#666", fontSize: ".8rem", marginTop: 3 }}>
                              Mode: <span style={{ color: "#aaa" }}>{r.mode.toUpperCase()}</span>
                              {r.note && <> · {r.note}</>}
                            </div>
                            <div style={{ color: "#444", fontSize: ".75rem", marginTop: 3 }}>{new Date(r.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => accept(r.id)} style={primaryBtn}>Accept →</button>
                          <button onClick={() => updateStatus(r.id, "rejected")} style={redBtn}>Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* All requests history */}
            <section>
              <h2 style={sectionTitle}>ALL REQUESTS</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {requests.map(r => (
                  <div key={r.id} style={{ ...card, opacity: r.status === "completed" || r.status === "rejected" ? 0.6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <span style={{ fontFamily: "Outfit", fontWeight: 800 }}>{r.ign}</span>
                        <span style={{ color: "#555", fontSize: ".8rem", marginLeft: 10 }}>{r.mode.toUpperCase()}</span>
                        <span style={{ color: "#444", fontSize: ".75rem", marginLeft: 10 }}>{new Date(r.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ ...statusBadge, background: STATUS_COLOR[r.status] + "22", color: STATUS_COLOR[r.status], border: `1px solid ${STATUS_COLOR[r.status]}44` }}>
                          {STATUS_LABEL[r.status]}
                        </span>
                        {r.status === "in_progress" && (
                          <Link to="/chat/$requestId" params={{ requestId: r.id }} style={ghostBtnSm}>Chat</Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Request form modal */}
      {showForm && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 200 }}>
          <form onSubmit={submit} style={{ background: "#0a0a0e", border: "1px solid rgba(255,255,255,.1)", borderRadius: 24, padding: 36, width: "100%", maxWidth: 480 }}>
            <h2 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "1.6rem", marginBottom: 24 }}>REQUEST A <span style={{ color: "#ff0000" }}>TEST</span></h2>
            <label style={lbl}>
              Your Minecraft IGN *
              <input required value={ign} onChange={e => setIgn(e.target.value)} placeholder="e.g. Steve123" style={inp} />
            </label>
            <label style={lbl}>
              Mode *
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {WAITLIST_MODES.map(m => (
                  <div
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    style={{
                      background: mode === m.id ? "rgba(255,0,0,.15)" : "rgba(255,255,255,.04)",
                      border: `1px solid ${mode === m.id ? "#ff0000" : "rgba(255,255,255,.08)"}`,
                      padding: "8px 14px",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      transition: "all .2s",
                      color: mode === m.id ? "#fff" : "#aaa",
                    }}
                  >
                    <img src={MODE_ICONS[m.id]} alt="" style={{ width: 16, height: 16, opacity: mode === m.id ? 1 : 0.6 }} />
                    <span style={{ fontSize: ".85rem", fontWeight: mode === m.id ? 800 : 500, fontFamily: "Outfit" }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </label>
            <label style={lbl}>
              Note (optional)
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Anything you want to add..." rows={3} style={{ ...inp, resize: "vertical" }} />
            </label>
            {msg && <div style={{ color: "#ff5050", fontSize: ".8rem", marginBottom: 12 }}>{msg}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={submitting} style={{ ...primaryBtn, flex: 1, padding: "14px" }}>{submitting ? "Sending..." : "SEND REQUEST"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...ghostBtnSm, flex: 1, padding: "14px" }}>CANCEL</button>
            </div>
          </form>
        </div>
      )}

      {/* Complete Confirmation Modal */}
      {completingId && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setCompletingId(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 300 }}>
          <div style={{ background: "#0a0a0e", border: "1px solid rgba(255,255,255,.1)", borderRadius: 24, padding: 36, width: "100%", maxWidth: 420, textAlign: "center" }}>
            <h2 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "1.6rem", marginBottom: 16 }}>FINISH <span style={{ color: "#22c55e" }}>TESTING?</span></h2>
            <p style={{ color: "#aaa", fontSize: ".9rem", marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to mark this test as completed? The chat will be closed and the player will be notified.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => confirmComplete('now')} style={{ ...greenBtn, padding: "14px", justifyContent: "center", width: "100%" }}>✓ COMPLETE & GO TO ADMIN PANEL</button>
              <button onClick={() => confirmComplete('later')} style={{ ...ghostBtnSm, padding: "14px", justifyContent: "center", width: "100%" }}>COMPLETE & DO IT LATER</button>
              <button onClick={() => setCompletingId(null)} style={{ ...ghostBtnSm, padding: "14px", justifyContent: "center", width: "100%", marginTop: 8, borderColor: "transparent" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navLink: React.CSSProperties = { color: "#aaa", textDecoration: "none", fontSize: ".85rem", fontWeight: 600, letterSpacing: 1 };
const primaryBtn: React.CSSProperties = { padding: "10px 20px", background: "#ff0000", color: "#fff", border: "none", borderRadius: 10, fontWeight: 900, fontSize: ".75rem", letterSpacing: 2, cursor: "pointer", fontFamily: "Outfit", textDecoration: "none", display: "inline-flex", alignItems: "center" };
const ghostBtnSm: React.CSSProperties = { padding: "8px 16px", background: "rgba(255,255,255,.05)", color: "#fff", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontWeight: 700, fontSize: ".75rem", letterSpacing: 1, cursor: "pointer", fontFamily: "Outfit", textDecoration: "none", display: "inline-flex", alignItems: "center" };
const greenBtn: React.CSSProperties = { ...ghostBtnSm, color: "#22c55e", borderColor: "#22c55e44" };
const redBtn: React.CSSProperties = { ...ghostBtnSm, color: "#ef4444", borderColor: "#ef444444" };
const card: React.CSSProperties = { background: "rgba(10,10,14,.6)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "18px 22px", transition: "border-color .2s" };
const statusBadge: React.CSSProperties = { padding: "4px 12px", borderRadius: 20, fontSize: ".72rem", fontWeight: 800, letterSpacing: 1, fontFamily: "Outfit" };
const sectionTitle: React.CSSProperties = { fontFamily: "Outfit", fontWeight: 800, fontSize: ".9rem", color: "#666", letterSpacing: 2, marginBottom: 16 };
const emptyBox: React.CSSProperties = { background: "rgba(10,10,14,.4)", border: "1px dashed rgba(255,255,255,.08)", borderRadius: 16, padding: 40, textAlign: "center" };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, fontSize: ".75rem", color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: ".9rem", outline: "none", fontFamily: "inherit" };
