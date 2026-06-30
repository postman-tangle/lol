/**
 * Cloudflare Worker - Lịch thi đấu MSI & LCK
 * - GET /          → trả HTML frontend
 * - GET /api/schedule?tournament=MSI|LCK → JSON
 * - POST /api/sync?token=... → sync thủ công
 * - Cron: mỗi phút sync nếu có live
 */

const MIN_IDLE_SYNC_SECONDS = 30 * 60;
const CARGO_ENDPOINT = "https://lol.fandom.com/api.php";
const TOURNAMENTS = {
  MSI: "MSI 2026",
  LCK: "LCK 2026",
};

const HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lịch thi đấu LoL Esports</title>
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: radial-gradient(ellipse at top, #1A1D29 0%, #0B0C12 60%), #0B0C12;
      font-family: 'Inter', sans-serif;
      padding: 32px 16px 60px;
      color: #F4EFE3;
    }
    .container { max-width: 760px; margin: 0 auto; }
    .eyebrow { font-size: 12px; letter-spacing: 0.25em; color: #D8B65C; font-weight: 600; margin-bottom: 6px; }
    h1 { font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 36px; letter-spacing: 0.01em; }
    .subtitle { color: #7C7F8E; margin-top: 6px; font-size: 14px; }
    header { margin-bottom: 28px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; }
    .tab {
      font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 15px;
      letter-spacing: 0.04em; padding: 10px 22px; border-radius: 10px;
      cursor: pointer; background: transparent; color: #8A8D9C;
      border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s;
    }
    .tab.active { border-color: #D8B65C; background: rgba(216,182,92,0.12); color: #D8B65C; }
    .mock-banner {
      font-size: 12px; color: #8A8D9C; margin-bottom: 16px;
      padding: 8px 12px; background: rgba(255,255,255,0.04); border-radius: 8px;
    }
    .section-title {
      font-family: 'Rajdhani', sans-serif; font-size: 14px; letter-spacing: 0.18em;
      color: #7C7F8E; font-weight: 700; margin-bottom: 12px;
    }
    section { margin-bottom: 32px; }
    .match-list { display: flex; flex-direction: column; gap: 10px; }
    .match-row {
      display: grid;
      grid-template-columns: 78px 1fr auto 1fr 120px;
      align-items: center; gap: 14px; padding: 16px 18px;
      background: rgba(20,22,30,0.7); border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .match-time { text-align: center; }
    .match-time .time { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 18px; color: #F4EFE3; }
    .match-time .date { font-size: 11px; color: #7C7F8E; text-transform: capitalize; }
    .team { display: flex; align-items: center; gap: 10px; }
    .team.left { justify-content: flex-end; }
    .team-name { font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 15px; color: #E8E6DC; }
    .team-badge {
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 4px 14px rgba(0,0,0,0.45);
      width: 44px; height: 44px;
    }
    .team-badge span { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 15px; color: #F4EFE3; letter-spacing: 0.02em; }
    .score { text-align: center; min-width: 56px; }
    .score .score-val { font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 20px; color: #D8B65C; }
    .score .vs { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 14px; color: #5C5F6E; }
    .score .bo { font-size: 10px; color: #5C5F6E; margin-top: 2px; }
    .status-wrap { display: flex; justify-content: flex-end; }
    .pill {
      font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700;
      letter-spacing: 0.12em; padding: 4px 10px; border-radius: 999px;
    }
    .pill-live { color: #FFE3E8; background: #C81E3A; box-shadow: 0 0 14px rgba(200,30,58,0.55); }
    .pill-upcoming { color: #9A9DAE; background: #2A2D3A; }
    .pill-finished { color: #9A9DAE; background: #1E2128; }
    .empty { color: #5C5F6E; font-size: 14px; }
    .loading { color: #7C7F8E; font-size: 14px; padding: 16px 0; }
    @media (max-width: 600px) {
      .match-row { grid-template-columns: 60px 1fr auto 1fr auto; gap: 8px; padding: 12px 10px; }
      h1 { font-size: 26px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="eyebrow">LỊCH THI ĐẤU</div>
      <h1>League of Legends Esports</h1>
      <p class="subtitle">Giờ Việt Nam (UTC+7) · Tự động cập nhật mỗi phút khi có trận live</p>
    </header>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('MSI')" id="tab-MSI">MSI 2026</button>
      <button class="tab" onclick="switchTab('LCK')" id="tab-LCK">LCK 2026</button>
    </div>

    <div id="mock-banner" class="mock-banner" style="display:none">
      Đang hiển thị dữ liệu mẫu — Worker chưa có dữ liệu thật (cron chưa chạy lần đầu).
    </div>

    <section>
      <div class="section-title">SẮP DIỄN RA & ĐANG DIỄN RA</div>
      <div class="match-list" id="upcoming-list"><div class="loading">Đang tải...</div></div>
    </section>
    <section id="finished-section" style="display:none">
      <div class="section-title">KẾT QUẢ GẦN ĐÂY</div>
      <div class="match-list" id="finished-list"></div>
    </section>
  </div>

  <script>
    const TEAM_STYLE = {
      "T1":                    { abbr: "T1",  color: "#E2012D" },
      "Gen.G":                 { abbr: "GEN", color: "#AA8A00" },
      "Hanwha Life Esports":   { abbr: "HLE", color: "#F37321" },
      "Dplus KIA":             { abbr: "DK",  color: "#1F3C88" },
      "KT Rolster":            { abbr: "KT",  color: "#FF3300" },
      "Karmine Corp":          { abbr: "KC",  color: "#1C8AD9" },
      "Team Liquid":           { abbr: "TL",  color: "#1A1F71" },
      "Deep Cross Gaming":     { abbr: "DCG", color: "#2E2E2E" },
      "G2 Esports":            { abbr: "G2",  color: "#9A1B1B" },
      "Top Esports":           { abbr: "TES", color: "#1761A0" },
      "Bilibili Gaming":       { abbr: "BLG", color: "#3F8FE0" },
      "FURIA":                 { abbr: "FUR", color: "#1A1A1A" },
      "TBD":                   { abbr: "TBD", color: "#4A4A52" },
    };

    const MOCK_DATA = [
      { id:"1", tournament:"MSI 2026", team1:"T1", team2:"Team Liquid", team1_score:3, team2_score:0, datetime_utc:"2026-06-29T08:00:00", best_of:5, status:"finished" },
      { id:"2", tournament:"MSI 2026", team1:"Karmine Corp", team2:"Deep Cross Gaming", team1_score:3, team2_score:0, datetime_utc:"2026-06-29T12:00:00", best_of:5, status:"finished" },
      { id:"3", tournament:"MSI 2026", team1:"Karmine Corp", team2:"Team Liquid", team1_score:null, team2_score:null, datetime_utc:"2026-06-30T08:00:00", best_of:5, status:"upcoming" },
      { id:"4", tournament:"MSI 2026", team1:"T1", team2:"TBD", team1_score:null, team2_score:null, datetime_utc:"2026-07-01T08:00:00", best_of:5, status:"upcoming" },
      { id:"5", tournament:"MSI 2026", team1:"G2 Esports", team2:"Top Esports", team1_score:null, team2_score:null, datetime_utc:"2026-07-04T08:00:00", best_of:5, status:"upcoming" },
    ];

    let currentTab = "MSI";

    function shade(hex, pct) {
      const n = parseInt(hex.slice(1), 16);
      const clamp = v => Math.max(0, Math.min(255, v));
      const r = clamp((n >> 16) + pct), g = clamp(((n >> 8) & 0xff) + pct), b = clamp((n & 0xff) + pct);
      return "#" + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
    }

    function badge(name) {
      const s = TEAM_STYLE[name] || { abbr: (name||"?").slice(0,3).toUpperCase(), color: "#4A4A52" };
      return \`<div class="team-badge" style="background:linear-gradient(155deg,\${s.color},\${shade(s.color,-28)})">
        <span style="font-size:15px">\${s.abbr}</span></div>\`;
    }

    function formatVN(utc) {
      const d = new Date(utc.endsWith("Z") ? utc : utc + "Z");
      return {
        time: d.toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Ho_Chi_Minh" }),
        date: d.toLocaleDateString("vi-VN", { weekday:"short", day:"2-digit", month:"2-digit", timeZone:"Asia/Ho_Chi_Minh" })
      };
    }

    function pillHtml(status) {
      const map = { live:"pill-live", upcoming:"pill-upcoming", finished:"pill-finished" };
      const label = { live:"ĐANG DIỄN RA", upcoming:"SẮP DIỄN RA", finished:"ĐÃ KẾT THÚC" };
      return \`<span class="pill \${map[status]||'pill-upcoming'}">\${label[status]||status}</span>\`;
    }

    function matchHtml(m) {
      const {time, date} = formatVN(m.datetime_utc);
      const hasScore = m.team1_score !== null && m.team1_score !== undefined;
      const scoreHtml = hasScore
        ? \`<div class="score-val">\${m.team1_score} – \${m.team2_score}</div>\`
        : \`<div class="vs">VS</div>\`;
      return \`<div class="match-row">
        <div class="match-time"><div class="time">\${time}</div><div class="date">\${date}</div></div>
        <div class="team left">\${badge(m.team1)}<span class="team-name">\${m.team1}</span></div>
        <div class="score">\${scoreHtml}\${m.best_of ? \`<div class="bo">BO\${m.best_of}</div>\` : ""}</div>
        <div class="team">\${badge(m.team2)}<span class="team-name">\${m.team2}</span></div>
        <div class="status-wrap">\${pillHtml(m.status)}</div>
      </div>\`;
    }

    function render(matches, isMock) {
      document.getElementById("mock-banner").style.display = isMock ? "" : "none";
      const upcoming = matches.filter(m => m.status !== "finished");
      const finished = matches.filter(m => m.status === "finished");

      const upEl = document.getElementById("upcoming-list");
      upEl.innerHTML = upcoming.length ? upcoming.map(matchHtml).join("") : '<div class="empty">Chưa có lịch được cập nhật.</div>';

      const finSection = document.getElementById("finished-section");
      const finEl = document.getElementById("finished-list");
      if (finished.length) {
        finSection.style.display = "";
        finEl.innerHTML = finished.map(matchHtml).join("");
      } else {
        finSection.style.display = "none";
      }
    }

    async function load(tab) {
      document.getElementById("upcoming-list").innerHTML = '<div class="loading">Đang tải...</div>';
      try {
        const res = await fetch("/api/schedule?tournament=" + tab);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          render(data, false);
        } else {
          render(MOCK_DATA.filter(m => m.tournament === (tab === "MSI" ? "MSI 2026" : "LCK 2026")), true);
        }
      } catch {
        render(MOCK_DATA.filter(m => m.tournament === (tab === "MSI" ? "MSI 2026" : "LCK 2026")), true);
      }
    }

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.getElementById("tab-" + tab).classList.add("active");
      load(tab);
    }

    load(currentTab);
    setInterval(() => load(currentTab), 60000);
  </script>
</body>
</html>`;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledTick(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Trang chủ → trả HTML
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/schedule") {
      const t = (url.searchParams.get("tournament") || "ALL").toUpperCase();
      let data = await getSchedule(env, t);
      if (data.length === 0) {
        // DB chưa từng được sync (cron chưa chạy lần nào) → tự sync ngay lần đầu
        // để không phải chờ cron hoặc gọi /api/sync bằng tay.
        await syncAll(env);
        data = await getSchedule(env, t);
      }
      return Response.json(data, { headers: cors });
    }

    if (url.pathname === "/api/sync" && request.method === "POST") {
      const token = url.searchParams.get("token");
      if (token !== env.SYNC_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const result = await syncAll(env);
      return Response.json(result, { headers: cors });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function scheduledTick(env) {
  const hasLive = await hasLiveMatch(env);
  if (hasLive) { await syncAll(env); return; }
  const last = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'last_sync_ts'`).first();
  const lastTs = last ? Number(last.value) : 0;
  if (Math.floor(Date.now() / 1000) - lastTs >= MIN_IDLE_SYNC_SECONDS) {
    await syncAll(env);
  }
}

async function hasLiveMatch(env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) as c FROM matches WHERE status = 'live'`).first();
  return (row?.c ?? 0) > 0;
}

async function setLastSyncNow(env) {
  const nowSec = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO meta (key, value) VALUES ('last_sync_ts', ?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).bind(String(nowSec)).run();
}

async function syncAll(env) {
  const results = {};
  for (const [key, tournamentName] of Object.entries(TOURNAMENTS)) {
    try {
      const matches = await fetchCargoMatches(tournamentName);
      await upsertMatches(env, matches, tournamentName);
      results[key] = { ok: true, count: matches.length };
    } catch (err) {
      results[key] = { ok: false, error: String(err) };
    }
  }
  await setLastSyncNow(env);
  return results;
}

async function fetchCargoMatches(tournamentName) {
  const fields = ["Team1","Team2","Team1Score","Team2Score","DateTime_UTC","Tournament","BestOf","Team1Final","Team2Final"].join(",");
  const params = new URLSearchParams({
    action: "cargoquery", format: "json", tables: "MatchSchedule", fields,
    where: `Tournament="${tournamentName}"`, order_by: "DateTime_UTC", limit: "200",
  });
  const res = await fetch(`${CARGO_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": "lol-schedule-worker/1.0" },
  });
  if (!res.ok) throw new Error(`Cargo API lỗi: ${res.status}`);
  const json = await res.json();
  return (json?.cargoquery ?? []).map((r) => r.title);
}

async function upsertMatches(env, rows, tournamentName) {
  const stmts = [];
  for (const row of rows) {
    const team1 = row.Team1 || "TBD";
    const team2 = row.Team2 || "TBD";
    const datetimeUtc = row["DateTime UTC"] || row.DateTime_UTC;
    if (!datetimeUtc) continue;
    const id = await hashId(`${tournamentName}-${team1}-${team2}-${datetimeUtc}`);
    const t1score = row.Team1Score !== "" ? Number(row.Team1Score) : null;
    const t2score = row.Team2Score !== "" ? Number(row.Team2Score) : null;
    const matchTime = new Date(datetimeUtc + "Z");
    const hoursSinceMatch = (Date.now() - matchTime.getTime()) / 3600000;
    const LIVE_WINDOW_HOURS = 4; // BO5 hiếm khi kéo dài quá 4h
    const status = t1score !== null && t2score !== null
      ? "finished"
      : hoursSinceMatch > 0 && hoursSinceMatch <= LIVE_WINDOW_HOURS
        ? "live"
        : hoursSinceMatch > LIVE_WINDOW_HOURS
          ? "finished" // qua khung live mà vẫn chưa có điểm -> coi như đã kết thúc, chờ API cập nhật điểm
          : "upcoming";
    stmts.push(env.DB.prepare(
      `INSERT INTO matches (id, tournament, team1, team2, best_of, datetime_utc, team1_score, team2_score, status)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
       ON CONFLICT(id) DO UPDATE SET team1_score=excluded.team1_score, team2_score=excluded.team2_score, status=excluded.status`
    ).bind(id, tournamentName, team1, team2, Number(row.BestOf)||null, datetimeUtc, t1score, t2score, status));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

async function getSchedule(env, tournamentKey) {
  let query = "SELECT * FROM matches";
  const binds = [];
  if (tournamentKey !== "ALL" && TOURNAMENTS[tournamentKey]) {
    query += " WHERE tournament = ?1";
    binds.push(TOURNAMENTS[tournamentKey]);
  }
  query += " ORDER BY datetime_utc ASC";
  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return results;
}

async function hashId(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,32);
}
