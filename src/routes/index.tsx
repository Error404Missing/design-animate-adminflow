import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

type Player = {
  id: string;
  name: string;
  region: string;
  title: string;
  points: number;
  tiers: Record<string, string>;
};

const TIER_WEIGHT: Record<string, number> = {
  HT1: 10, LT1: 9, HT2: 8, LT2: 7, HT3: 6, LT3: 5,
  HT4: 4, LT4: 3, HT5: 2, LT5: 1,
};

const MODE_LABELS: Record<string, string> = {
  overall: "OVERALL RANKINGS", vanilla: "VANILLA RANKINGS", uhc: "UHC RANKINGS",
  pot: "POT PVP RANKINGS", nethop: "NETHOP RANKINGS", smp: "SMP RANKINGS",
  sword: "SWORD RANKINGS", axe: "AXE RANKINGS", mace: "MACE RANKINGS", ltm: "LTM RANKINGS",
};

const MODES = [
  { id: "overall", label: "Overall" }, { id: "vanilla", label: "Vanilla" },
  { id: "uhc", label: "UHC" }, { id: "pot", label: "Pot" },
  { id: "nethop", label: "NethOP" }, { id: "smp", label: "SMP" },
  { id: "sword", label: "Sword" }, { id: "axe", label: "Axe" },
  { id: "mace", label: "Mace" }, { id: "ltm", label: "LTMs" },
] as const;

const REGIONS = ["ALL", "EU", "NA", "AS", "SA", "OCE"] as const;

const tierNum = (t: string) => parseInt((t || "LT5").substring(2), 10);
const tierClass = (t: string) => "tier-t" + tierNum(t);
const avatarUrl = (name: string) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/36`;
const skinUrl = (name: string) => `https://mc-heads.net/body/${encodeURIComponent(name)}/200`;

function Index() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<string>("overall");
  const [region, setRegion] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [profile, setProfile] = useState<Player | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("players").select("*");
      if (!active) return;
      setPlayers(((data ?? []) as unknown) as Player[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("players-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setProfile(null); setInfoOpen(false); }
      if (e.key === "/" && (document.activeElement as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault();
        document.getElementById("main-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = profile ? "hidden" : "";
  }, [profile]);

  const columns = useMemo(() => {
    const cols: Record<number, { p: Player; tier: string; rank: number }[]> = { 1:[],2:[],3:[],4:[],5:[] };
    const q = search.trim().toLowerCase();
    const list = players
      .filter((p) => {
        if (region !== "ALL" && p.region.toUpperCase() !== region) return false;
        if (q && !p.name.toLowerCase().includes(q)) return false;
        return !!p.tiers?.[mode];
      })
      .sort((a, b) => {
        const wa = TIER_WEIGHT[a.tiers[mode]] || 0;
        const wb = TIER_WEIGHT[b.tiers[mode]] || 0;
        if (wb !== wa) return wb - wa;
        return b.points - a.points;
      });
    const rk = { 1:0,2:0,3:0,4:0,5:0 } as Record<number, number>;
    list.forEach((p) => {
      const t = p.tiers[mode];
      const n = tierNum(t);
      if (n >= 1 && n <= 5) { rk[n]++; cols[n].push({ p, tier: t, rank: rk[n] }); }
    });
    return cols;
  }, [players, mode, region, search]);

  const copyIp = async () => {
    try { await navigator.clipboard.writeText("mcpvp.club"); } catch {}
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  return (
    <>
      {/* Floating Navbar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand">TIER<span>HUB</span></div>
          <div className="nav-links">
            <a href="#" className="nav-link active">
              <span>Home</span>
            </a>
            <a href="#tiers" className="nav-link">
              <span>Rankings</span>
            </a>
            <Link to="/admin" className="nav-link admin-link">
              <span>Admin</span>
            </Link>
          </div>
          <div className="nav-search-wrap">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search player..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </nav>

      <div className="gt-root">
        <div className="gt-top-row">
          <div className="gt-logo-text">TIER<span>HUB</span></div>
          <div className="gt-controls">
            <div className="gt-search-wrap">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input id="main-search" placeholder="Search player..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className={`gt-info-btn ${infoOpen ? "active" : ""}`} onClick={() => setInfoOpen(true)}>INFORMATION</button>
            <div className="region-filter">
              {REGIONS.map((r) => (
                <button key={r} className={`region-btn ${region === r ? "active" : ""}`} onClick={() => setRegion(r)}>
                  {r === "ALL" ? "All" : r}
                </button>
              ))}
            </div>
            <button className="server-ip-btn" onClick={copyIp}>mcpvp.club</button>
          </div>
        </div>

        <div className="gt-wrap" id="tiers">
          <div className="gt-leaderboard-container">
            <div className="gt-tabs">
              {MODES.map((m) => (
                <button key={m.id} className={`gt-tab ${mode === m.id ? "gt-tab-active" : ""}`} onClick={() => setMode(m.id)}>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <div className="gt-board-header">
              <span className="gt-board-title">{MODE_LABELS[mode]}</span>
              <span className="gt-live-pill"><span className="gt-live-dot" />Live</span>
            </div>

            <div className="gt-tier-columns">
              {[1,2,3,4,5].map((n) => (
                <div key={n} className="gt-tier-col">
                  <div className={`gt-tier-col-header t${n}-header`}>TIER {n}</div>
                  <div className="gt-tier-col-body">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => <div key={i} className="gt-skeleton" />)
                    ) : columns[n].length === 0 ? (
                      <div className="gt-empty">No players</div>
                    ) : (
                      columns[n].map(({ p, tier, rank }) => (
                        <div
                          key={p.id}
                          className={`gt-compact-card ${rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : ""} ${n === 1 ? "prestige-card" : ""}`}
                          onClick={() => setProfile(p)}
                        >
                          <em className="gt-compact-rank">{rank}</em>
                          <img className="gt-compact-avatar" src={avatarUrl(p.name)} alt={p.name} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = avatarUrl("steve"); }} />
                          <div className="gt-compact-info">
                            <div className="gt-compact-name">{p.name}</div>
                            <div className="gt-compact-meta">{p.region} · {p.points} pts</div>
                          </div>
                          <span className={`gt-compact-tier ${tierClass(tier)}`}>{tier}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="gt-swipe-hint">
              <div className="swipe-line" />
              <span>SWIPE TO EXPLORE</span>
            </div>
          </div>
        </div>

        <footer className="gt-footer">
          <div className="gt-footer-inner">
            <div className="gt-footer-brand">TIER<span>HUB</span></div>
            <div className="gt-footer-copy">© 2026 TierHub — Competitive PvP Rankings</div>
            <div className="gt-footer-links">
              <Link to="/admin">Admin</Link>
              <span>·</span>
              <span>mcpvp.club</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Information modal */}
      <div className={`modal-overlay ${infoOpen ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setInfoOpen(false); }}>
        <div className="modal-card">
          <button className="modal-close" onClick={() => setInfoOpen(false)}>✕</button>
          <h2 className="modal-title">How Tiers Work</h2>
          <p className="modal-subtitle">Combat titles are assigned based on cumulative tier points across all active game modes.</p>
          <div className="modal-body">
            <div className="modal-section">
              <h3 className="modal-section-title">Tier Point Values</h3>
              <ul className="modal-list">
                {[
                  ["HT1","50 pts","t1b"],["LT1","45 pts","t1b"],["HT2","35 pts","t2b"],["LT2","30 pts","t2b"],
                  ["HT3","20 pts","t3b"],["LT3","15 pts","t3b"],["HT4","10 pts","t4b"],["LT4","5 pts","t4b"],
                  ["HT5","2 pts","t5b"],["LT5","1 pt","t5b"],
                ].map(([l,p,c]) => (
                  <li key={l}><span className={`tbadge ${c}`}>{l}</span><span>{p}</span></li>
                ))}
              </ul>
            </div>
            <div className="modal-section">
              <h3 className="modal-section-title">Combat Titles</h3>
              <ul className="modal-list">
                <li><strong className="cgm">Combat Grandmaster</strong><span>400+ pts</span></li>
                <li><strong className="cm">Combat Master</strong><span>250–399 pts</span></li>
                <li><strong className="ca">Combat Ace</strong><span>100–249 pts</span></li>
                <li><strong className="cs">Combat Specialist</strong><span>50–99 pts</span></li>
                <li><strong className="cc">Combat Cadet</strong><span>20–49 pts</span></li>
                <li><strong className="cn">Combat Novice</strong><span>10–19 pts</span></li>
                <li><strong className="cr">Rookie</strong><span>0–9 pts</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Player Profile */}
      <div className={`profile-overlay ${profile ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setProfile(null); }}>
        {profile && (
          <div className="profile-view-card">
            <button className="profile-back-btn" onClick={() => setProfile(null)}>← BACK</button>
            <div className="profile-inner">
              <div className="profile-left">
                <img className="profile-skin" src={skinUrl(profile.name)} alt={profile.name} onError={(e) => { (e.target as HTMLImageElement).src = skinUrl("steve"); }} />
              </div>
              <div className="profile-right">
                <div className="profile-region-tag">{profile.region}</div>
                <h1 className="profile-username">{profile.name}</h1>
                <div className="profile-combat-title">{profile.title}</div>
                <div className="profile-stats-row">
                  <div className="profile-stat"><label>POINTS</label><span>{profile.points}</span></div>
                  <div className="profile-stat"><label>OVERALL</label><span className={`gt-compact-tier ${tierClass(profile.tiers.overall ?? "LT5")}`} style={{ fontSize: "1.1rem" }}>{profile.tiers.overall ?? "—"}</span></div>
                  <div className="profile-stat"><label>REGION</label><span>{profile.region}</span></div>
                </div>
                <div className="profile-tiers-list">
                  <div className="profile-tiers-title" style={{ width: "100%" }}>MODE TIERS</div>
                  {MODES.filter((m) => m.id !== "overall").map((m) => {
                    const t = profile.tiers[m.id];
                    if (!t) return null;
                    return (
                      <div key={m.id} className="profile-tier-pill">
                        <span className="profile-tier-pill-label">{m.label}</span>
                        <span className={`profile-tier-pill-val ${tierClass(t)}`}>{t}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`copy-toast ${toast ? "show" : ""}`}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        Copied to clipboard!
      </div>
    </>
  );
}
