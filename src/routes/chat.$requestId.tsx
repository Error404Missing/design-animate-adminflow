import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat/$requestId")({ component: ChatPage });

type Message = {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Request = {
  id: string;
  user_id: string;
  tester_id: string | null;
  ign: string;
  mode: string;
  status: string;
};

function ChatPage() {
  const { requestId } = Route.useParams();
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav({ to: "/login" }); return; }
      setUserId(session.user.id);

      // Load the request
      const { data: req } = await supabase
        .from("test_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

      if (!req) { setDenied(true); setLoading(false); return; }

      // Check if user is participant or admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isAdmin = !!adminRole;
      const isParticipant = req.user_id === session.user.id || req.tester_id === session.user.id;

      if (!isParticipant && !isAdmin) { setDenied(true); setLoading(false); return; }

      setRequest(req as Request);

      // Load messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Message[]);
      setLoading(false);
    })();
  }, [requestId]);

  // Realtime subscription using Broadcast for instant delivery
  useEffect(() => {
    const channel = supabase.channel(`chat-${requestId}`);
    
    channel
      .on("broadcast", { event: "new_message" }, (payload) => {
        const newMsg = payload.payload as Message;
        // Check if we already have it to avoid duplicates
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id || m.content === newMsg.content)) return prev;
          return [...prev, newMsg];
        });
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `request_id=eq.${requestId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages((prev) => {
          if (prev.some(m => m.id === newMsg.id || m.content === newMsg.content)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !userId || !request) return;
    setSending(true);
    // Optimistic update
    const tempId = crypto.randomUUID();
    const newMsg: Message = {
      id: tempId,
      request_id: requestId,
      sender_id: userId,
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMsg]);
    setText("");

    const { error, data } = await supabase.from("messages").insert({
      request_id: requestId,
      sender_id: userId,
      content: newMsg.content,
    }).select().single();
    
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId)); // remove if failed
    } else if (data) {
      const confirmedMsg = data as Message;
      // replace temp id with real one
      setMessages(prev => prev.map(m => m.id === tempId ? confirmedMsg : m));
      // Broadcast to other users in the channel instantly
      supabase.channel(`chat-${requestId}`).send({
        type: "broadcast",
        event: "new_message",
        payload: confirmedMsg,
      });
    }
    
    setSending(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
      Loading chat...
    </div>
  );

  if (denied || !request) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <p style={{ color: "#ff5050" }}>You don't have access to this chat.</p>
      <Link to="/waitlist" style={primaryBtn}>← Back to Waitlist</Link>
    </div>
  );

  const isClosed = request.status === "completed" || request.status === "rejected";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(5,5,8,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/waitlist" style={{ color: "#666", textDecoration: "none", fontSize: ".85rem", display: "flex", alignItems: "center", gap: 6 }}>
            ← Waitlist
          </Link>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,.1)" }} />
          <div>
            <span style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: "1rem" }}>
              {request.ign}
            </span>
            <span style={{ color: "#555", fontSize: ".8rem", marginLeft: 10 }}>
              {request.mode.toUpperCase()}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: ".7rem",
            fontWeight: 800,
            letterSpacing: 1,
            fontFamily: "Outfit",
            background: isClosed ? "rgba(100,100,100,.15)" : "rgba(59,130,246,.15)",
            color: isClosed ? "#666" : "#3b82f6",
            border: `1px solid ${isClosed ? "#33333366" : "#3b82f644"}`,
          }}>
            {isClosed ? request.status.toUpperCase() : "● LIVE"}
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 80, paddingBottom: 100 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* System message at top */}
          <div style={systemMsg}>
            Chat started for <strong>{request.ign}</strong> — {request.mode.toUpperCase()} test session
          </div>

          {messages.length === 0 && (
            <div style={systemMsg}>No messages yet. Say hello! 👋</div>
          )}

          {messages.map((m, i) => {
            const isMe = m.sender_id === userId;
            const prevSame = i > 0 && messages[i - 1].sender_id === m.sender_id;
            return (
              <div key={m.id} style={{
                display: "flex",
                flexDirection: isMe ? "row-reverse" : "row",
                alignItems: "flex-end",
                gap: 8,
                marginTop: prevSame ? 2 : 10,
              }}>
                {/* Sender Label & Avatar */}
                {!prevSame && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", flexShrink: 0, width: 45 }}>
                    <div style={{ fontSize: ".55rem", color: "#666", fontWeight: 800, marginBottom: 4, textAlign: "center", width: "100%" }}>
                      {m.sender_id === request.tester_id ? "TESTER" : "PLAYER"}
                    </div>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: isMe ? "#ff000022" : "rgba(255,255,255,.08)",
                      border: `1px solid ${isMe ? "#ff000044" : "rgba(255,255,255,.1)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: ".65rem",
                      color: isMe ? "#ff8080" : "#888",
                      fontWeight: 800,
                      margin: "0 auto"
                    }}>
                      {isMe ? "ME" : m.sender_id === request.tester_id ? "T" : "P"}
                    </div>
                  </div>
                )}
                {prevSame && <div style={{ width: 45, flexShrink: 0 }} />}

                <div style={{
                  maxWidth: "72%",
                  background: isMe
                    ? "linear-gradient(135deg, #ff0000, #cc0000)"
                    : "rgba(255,255,255,.06)",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: isMe
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                  fontSize: ".9rem",
                  lineHeight: 1.5,
                  border: isMe ? "none" : "1px solid rgba(255,255,255,.08)",
                  boxShadow: isMe ? "0 4px 20px rgba(255,0,0,.2)" : "none",
                }}>
                  {m.content}
                  <div style={{ fontSize: ".65rem", opacity: .5, marginTop: 4, textAlign: isMe ? "right" : "left" }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(5,5,8,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,.07)", padding: "12px 16px" }}>
        <form onSubmit={send} style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={isClosed ? "This session is closed." : "Type a message..."}
            disabled={isClosed}
            style={{
              flex: 1,
              padding: "14px 18px",
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 16,
              color: "#fff",
              fontSize: ".9rem",
              outline: "none",
              fontFamily: "inherit",
              opacity: isClosed ? 0.5 : 1,
            }}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending || isClosed}
            style={{
              padding: "14px 24px",
              background: text.trim() && !isClosed ? "#ff0000" : "rgba(255,255,255,.06)",
              color: "#fff",
              border: "none",
              borderRadius: 16,
              fontWeight: 900,
              fontSize: ".8rem",
              letterSpacing: 1,
              cursor: text.trim() && !isClosed ? "pointer" : "default",
              fontFamily: "Outfit",
              transition: "background .2s",
            }}
          >
            SEND
          </button>
        </form>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { padding: "10px 20px", background: "#ff0000", color: "#fff", border: "none", borderRadius: 10, fontWeight: 900, fontSize: ".75rem", letterSpacing: 2, cursor: "pointer", fontFamily: "Outfit", textDecoration: "none", display: "inline-flex", alignItems: "center" };
const systemMsg: React.CSSProperties = { textAlign: "center", color: "#444", fontSize: ".75rem", padding: "8px 16px", background: "rgba(255,255,255,.02)", borderRadius: 20, margin: "4px auto", maxWidth: 400 };
