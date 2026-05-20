import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) nav({ to: "/waitlist" });
    });
  }, [nav]);

  const loginWithDiscord = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: window.location.origin + "/waitlist" },
    });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(10,10,14,.6)", backdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: 40, boxShadow: "0 40px 80px rgba(0,0,0,.6)", textAlign: "center" }}>
        <h1 style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "2.5rem", marginBottom: 6 }}>TIER<span style={{ color: "#ff0000" }}>HUB</span></h1>
        <p style={{ color: "#808080", marginBottom: 36, fontSize: ".9rem" }}>Connect your Discord account to continue</p>
        
        <button onClick={loginWithDiscord} disabled={loading} style={discordBtn}>
          <svg viewBox="0 0 127.14 96.36" width="24" height="24" style={{ marginRight: 12 }}>
            <path fill="#fff" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.1,46,96,53,91,65.69,84.69,65.69Z"/>
          </svg>
          {loading ? "CONNECTING..." : "LOGIN WITH DISCORD"}
        </button>

        <Link to="/" style={{ display: "block", color: "#555", fontSize: ".8rem", marginTop: 24, textDecoration: "none" }}>← Back to rankings</Link>
      </div>
    </div>
  );
}

const discordBtn: React.CSSProperties = { width: "100%", padding: "16px", background: "#5865F2", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "Outfit", transition: "background .2s" };
