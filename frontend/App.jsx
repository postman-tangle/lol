import React, { useEffect, useState, useMemo } from "react";

// === CẤU HÌNH ===
// Đổi URL này thành Worker bạn vừa deploy, vd: https://lol-schedule-worker.<subdomain>.workers.dev
const API_BASE = "https://lol-schedule-worker.YOUR-SUBDOMAIN.workers.dev";

// Màu thương hiệu + chữ viết tắt cho badge khi không có logo ảnh thật
const TEAM_STYLE = {
  "T1": { abbr: "T1", color: "#E2012D" },
  "Gen.G": { abbr: "GEN", color: "#AA8A00" },
  "Hanwha Life Esports": { abbr: "HLE", color: "#F37321" },
  "Dplus KIA": { abbr: "DK", color: "#1F3C88" },
  "KT Rolster": { abbr: "KT", color: "#FF3300" },
  "Karmine Corp": { abbr: "KC", color: "#1C8AD9" },
  "Team Liquid": { abbr: "TL", color: "#1A1F71" },
  "Deep Cross Gaming": { abbr: "DCG", color: "#2E2E2E" },
  "G2 Esports": { abbr: "G2", color: "#9A1B1B" },
  "Top Esports": { abbr: "TES", color: "#1761A0" },
  "Bilibili Gaming": { abbr: "BLG", color: "#3F8FE0" },
  "FURIA": { abbr: "FUR", color: "#1A1A1A" },
  "TBD": { abbr: "TBD", color: "#4A4A52" },
};

function TeamBadge({ name, size = 44 }) {
  const style = TEAM_STYLE[name] || { abbr: name?.slice(0, 3)?.toUpperCase() || "?", color: "#4A4A52" };
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(155deg, ${style.color}, ${shade(style.color, -28)})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 4px 14px rgba(0,0,0,0.45)",
      }}
    >
      <span
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.34,
          color: "#F4EFE3",
          letterSpacing: "0.02em",
        }}
      >
        {style.abbr}
      </span>
    </div>
  );
}

function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + percent;
  let g = ((n >> 8) & 0xff) + percent;
  let b = (n & 0xff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function formatVNDateTime(utcString) {
  const d = new Date(utcString.endsWith("Z") ? utcString : utcString + "Z");
  const time = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const date = d.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return { time, date };
}

function StatusPill({ status }) {
  const map = {
    live: { label: "ĐANG DIỄN RA", bg: "#C81E3A", glow: true },
    upcoming: { label: "SẮP DIỄN RA", bg: "#2A2D3A", glow: false },
    finished: { label: "ĐÃ KẾT THÚC", bg: "#1E2128", glow: false },
  };
  const s = map[status] || map.upcoming;
  return (
    <span
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: s.glow ? "#FFE3E8" : "#9A9DAE",
        background: s.bg,
        padding: "4px 10px",
        borderRadius: 999,
        boxShadow: s.glow ? "0 0 14px rgba(200,30,58,0.55)" : "none",
      }}
    >
      {s.label}
    </span>
  );
}

function MatchRow({ m }) {
  const { time, date } = formatVNDateTime(m.datetime_utc);
  const hasScore = m.team1_score !== null && m.team1_score !== undefined;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "78px 1fr auto 1fr 110px",
        alignItems: "center",
        gap: 14,
        padding: "16px 18px",
        background: "rgba(20,22,30,0.7)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Rajdhani'", fontWeight: 700, fontSize: 18, color: "#F4EFE3" }}>
          {time}
        </div>
        <div style={{ fontSize: 11, color: "#7C7F8E", textTransform: "capitalize" }}>{date}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
        <span style={{ fontFamily: "'Rajdhani'", fontWeight: 600, fontSize: 15, color: "#E8E6DC" }}>
          {m.team1}
        </span>
        <TeamBadge name={m.team1} />
      </div>

      <div style={{ textAlign: "center", minWidth: 56 }}>
        {hasScore ? (
          <span style={{ fontFamily: "'Rajdhani'", fontWeight: 800, fontSize: 20, color: "#D8B65C" }}>
            {m.team1_score} – {m.team2_score}
          </span>
        ) : (
          <span style={{ fontFamily: "'Rajdhani'", fontWeight: 700, fontSize: 14, color: "#5C5F6E" }}>
            VS
          </span>
        )}
        {m.best_of ? (
          <div style={{ fontSize: 10, color: "#5C5F6E", marginTop: 2 }}>BO{m.best_of}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TeamBadge name={m.team2} />
        <span style={{ fontFamily: "'Rajdhani'", fontWeight: 600, fontSize: 15, color: "#E8E6DC" }}>
          {m.team2}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <StatusPill status={m.status} />
      </div>
    </div>
  );
}

const MOCK_DATA = [
  {
    id: "1",
    tournament: "MSI 2026",
    team1: "T1",
    team2: "Team Liquid",
    team1_score: 3,
    team2_score: 0,
    datetime_utc: "2026-06-29T08:00:00",
    best_of: 5,
    status: "finished",
  },
  {
    id: "2",
    tournament: "MSI 2026",
    team1: "Karmine Corp",
    team2: "Deep Cross Gaming",
    team1_score: 3,
    team2_score: 0,
    datetime_utc: "2026-06-29T12:00:00",
    best_of: 5,
    status: "finished",
  },
  {
    id: "3",
    tournament: "MSI 2026",
    team1: "Karmine Corp",
    team2: "Team Liquid",
    team1_score: null,
    team2_score: null,
    datetime_utc: "2026-06-30T08:00:00",
    best_of: 5,
    status: "upcoming",
  },
  {
    id: "4",
    tournament: "MSI 2026",
    team1: "T1",
    team2: "TBD",
    team1_score: null,
    team2_score: null,
    datetime_utc: "2026-07-01T08:00:00",
    best_of: 5,
    status: "upcoming",
  },
  {
    id: "5",
    tournament: "MSI 2026",
    team1: "G2 Esports",
    team2: "Top Esports",
    team1_score: null,
    team2_score: null,
    datetime_utc: "2026-07-04T08:00:00",
    best_of: 5,
    status: "upcoming",
  },
];

export default function App() {
  const [tab, setTab] = useState("MSI 2026");
  const [matches, setMatches] = useState(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const key = tab.startsWith("MSI") ? "MSI" : "LCK";
        const res = await fetch(`${API_BASE}/api/schedule?tournament=${key}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length) {
          setMatches(data);
          setUsingMock(false);
        }
      } catch (e) {
        // Worker chưa deploy / chưa có data thật -> giữ mock để demo giao diện
        if (!cancelled) setUsingMock(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const filtered = useMemo(
    () => matches.filter((m) => m.tournament === tab || (usingMock && tab === "MSI 2026")),
    [matches, tab, usingMock]
  );

  const upcoming = filtered.filter((m) => m.status !== "finished");
  const finished = filtered.filter((m) => m.status === "finished");

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #1A1D29 0%, #0B0C12 60%), #0B0C12",
        fontFamily: "'Inter', sans-serif",
        padding: "32px 16px 60px",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.25em", color: "#D8B65C", fontWeight: 600, marginBottom: 6 }}>
            LỊCH THI ĐẤU
          </div>
          <h1
            style={{
              fontFamily: "'Rajdhani'",
              fontWeight: 800,
              fontSize: 36,
              color: "#F4EFE3",
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            League of Legends Esports
          </h1>
          <p style={{ color: "#7C7F8E", marginTop: 6, fontSize: 14 }}>
            Giờ Việt Nam (UTC+7) · Tự động cập nhật mỗi phút khi có trận live
          </p>
        </header>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["MSI 2026", "LCK 2026"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontFamily: "'Rajdhani'",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.04em",
                padding: "10px 22px",
                borderRadius: 10,
                border: tab === t ? "1px solid #D8B65C" : "1px solid rgba(255,255,255,0.08)",
                background: tab === t ? "rgba(216,182,92,0.12)" : "transparent",
                color: tab === t ? "#D8B65C" : "#8A8D9C",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {usingMock && (
          <div
            style={{
              fontSize: 12,
              color: "#8A8D9C",
              marginBottom: 16,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
            }}
          >
            Đang hiển thị dữ liệu mẫu — nối API_BASE tới Worker thật để xem dữ liệu live.
          </div>
        )}

        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "'Rajdhani'",
              fontSize: 14,
              letterSpacing: "0.18em",
              color: "#7C7F8E",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            SẮP DIỄN RA
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcoming.length === 0 && !loading && (
              <div style={{ color: "#5C5F6E", fontSize: 14 }}>Chưa có lịch được cập nhật.</div>
            )}
            {upcoming.map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
          </div>
        </section>

        {finished.length > 0 && (
          <section>
            <h2
              style={{
                fontFamily: "'Rajdhani'",
                fontSize: 14,
                letterSpacing: "0.18em",
                color: "#7C7F8E",
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              KẾT QUẢ GẦN ĐÂY
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {finished.map((m) => (
                <MatchRow key={m.id} m={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
