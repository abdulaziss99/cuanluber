import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Home, Coins, LineChart as LineChartIcon, BookOpen, BarChart2, Calendar,
  Filter, Bell, Info, Sun, Star, RefreshCw, ArrowUp, ArrowDown, User,
} from "lucide-react";

/* ============================================================================
   DATA SOURCE MAPPING (mengikuti "FLOWCHART SOURCE DATA - DASHBOARD SAHAM AGS")

   1. SUMBER DATA (EXTERNAL)
      - Yahoo Finance / TwelveData / Alpha Vantage -> harga IHSG, saham, top movers
      - IDX (idx.co.id)                            -> index, sektor, corporate action
      - RSS (Bloomberg Technoz, Investor.id, Kontan, CNBC ID, Bisnis.com) -> berita

   2. PENGAMBILAN DATA (Data Collector / Scheduler)
      - Price/Index/TopMovers : interval 1-5 menit
      - News                  : interval 5-15 menit
      - Corporate Action      : 1x/hari
      - Foreign Flow          : 1x/hari

   3. BACKEND AGS (DATA HUB) -> di file ini direpresentasikan sebagai
      objek `agsBackend` berisi 5 service: marketService, stockService,
      corporateActionService, newsService, analyticsService (+ cacheService).
      Saat ini semua service masih MOCK (data acak/simulasi) supaya UI bisa
      langsung dipakai. Tinggal ganti isi tiap fungsi dengan `fetch()` ke
      REST API backend AGS kamu (lihat komentar GET di tiap fungsi).

   4. API RESPONSE -> bentuk object yang dikembalikan tiap fungsi mock sudah
      disamakan dengan payload JSON yang disebut di flowchart (REST API).

   5. DASHBOARD (FRONTEND) -> komponen React di bawah.
   ========================================================================== */

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------
const fmtIDR = (n, opts = {}) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2, ...opts }).format(n);

const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const rand = (min, max) => Math.random() * (max - min) + min;

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ---------------------------------------------------------------------------
// MOCK "AGS BACKEND" — struktur service sesuai kotak #3 di flowchart
// ---------------------------------------------------------------------------
let ihsgSeed = 7285.32;

const marketService = {
  // GET /api/market/overview  (source: Yahoo Finance / TwelveData, tiap 1-5 menit)
  async overview() {
    await delay(250);
    ihsgSeed += rand(-4, 6);
    const chart = buildIhsgSeries();
    const last = chart[chart.length - 1].value;
    const first = chart[0].value;
    const change = last - first;
    return {
      index: "IHSG",
      value: last,
      change,
      changePct: (change / first) * 100,
      asOf: new Date(),
      advancers: Math.round(rand(380, 430)),
      decliners: Math.round(rand(170, 220)),
      unchanged: Math.round(rand(140, 170)),
      volumeT: rand(11, 14),
      valueT: rand(8.5, 10.5),
      foreignNetBuyT: rand(0.8, 1.6),
      chart,
    };
  },
  // GET /api/market/top-movers (source: Alpha Vantage / TwelveData)
  async topMovers() {
    await delay(200);
    const base = [
      ["BRPT", "Barito Pacific Tbk.", 1185, 18.25],
      ["BBTN", "Bank Tabungan Negara", 1340, 9.02],
      ["ANTM", "Aneka Tambang Tbk.", 3450, 8.11],
      ["PGEO", "Pertamina Geothermal", 1245, 7.21],
      ["TPIA", "Chandra Asri Pacific", 8950, 6.38],
    ];
    const losers = [
      ["BUKA", "Bukalapak.com Tbk.", 142, -7.79],
      ["SIDO", "Sido Muncul Tbk.", 565, -5.85],
      ["ICBP", "Indofood CBP", 11750, -3.28],
      ["TLKM", "Telkom Indonesia", 2830, -1.05],
      ["EXCL", "XL Axiata Tbk.", 2210, -0.9],
    ];
    const active = [
      ["BBRI", "Bank Rakyat Indonesia", 4820, -0.41],
      ["BBCA", "Bank Central Asia", 10250, 1.49],
      ["ASII", "Astra International", 5150, 0.62],
      ["TLKM", "Telkom Indonesia", 2830, -1.05],
      ["GOTO", "GoTo Gojek Tokopedia", 68, -2.31],
    ];
    const mk = (rows) => rows.map(([symbol, name, last, chg]) => ({ symbol, name, last, chg }));
    return { gainers: mk(base), losers: mk(losers), active: mk(active) };
  },
  // GET /api/market/sector
  async sector() {
    await delay(180);
    return [
      { name: "Technology", chg: 3.2 },
      { name: "Finance", chg: 1.8 },
      { name: "Energy", chg: 1.45 },
      { name: "Industrials", chg: 0.65 },
      { name: "Healthcare", chg: 0.32 },
      { name: "Consumer Cyclical", chg: -0.25 },
      { name: "Property", chg: -1.1 },
      { name: "Basic Materials", chg: -1.35 },
    ];
  },
  // GET /api/market/foreign-flow (source: IDX, 1x/hari)
  async foreignFlow() {
    await delay(180);
    return {
      netBuyYtdT: 23.45,
      netBuyTodayT: 1.25,
      spark: Array.from({ length: 8 }, () => rand(-1.2, 1.6)),
      topBuy: [
        ["BBCA", 356.8], ["BBRI", 278.6], ["BMRI", 212.4], ["TLKM", 189.7], ["ASII", 165.2],
      ],
      topSell: [
        ["TLKM", -178.6], ["ASII", -121.8], ["AMMN", -115.6], ["GOTO", -98.3], ["UNVR", -76.5],
      ],
    };
  },
  // GET /api/heatmap/ihsg
  async heatmap() {
    await delay(180);
    return [
      ["BBCA", 1.49], ["BBRI", -0.41], ["BMRI", 0.99], ["TLKM", -1.05],
      ["ASII", 0.62], ["ANTM", 5.18], ["UNVR", 0.28], ["ICBP", -0.35],
      ["AMMN", 1.12], ["GOTO", -2.31], ["PGAS", 0.74], ["CPIN", 0.18], ["TOWR", -0.22],
    ];
  },
};

const newsService = {
  // GET /api/news/indonesia (source: RSS Bloomberg Technoz, Investor.id, Kontan, CNBC ID, Bisnis.com — 5-15 menit)
  async indonesia() {
    await delay(200);
    return [
      { title: "IHSG Menguat Didukung Sektor Perbankan dan Energi, Asing Catat Net Buy Rp1,2 T", source: "Bloomberg Technoz", time: "10 menit lalu", tag: "market" },
      { title: "Rupiah Menguat ke Level 16.200, Didorong Arus Masuk Investor Asing", source: "Investor.id", time: "25 menit lalu", tag: "macro" },
      { title: "Harga Komoditas Naik, Saham Tambang Jadi Pendorong IHSG Hari Ini", source: "Kontan", time: "35 menit lalu", tag: "commodities" },
      { title: "Emiten Perbankan Catat Kinerja Positif Semester I/2026", source: "CNBC Indonesia", time: "1 jam lalu", tag: "corporate" },
      { title: "BI Pertahankan Suku Bunga, IHSG Berpotensi Lanjutkan Penguatan", source: "Bisnis.com", time: "1 jam lalu", tag: "market" },
    ];
  },
};

const corporateActionService = {
  // GET /api/corporate-action (source: IDX Corporate Action API, 1x/hari)
  async list() {
    await delay(180);
    return {
      dividend: [
        { code: "BBCA", note: "Cum Date: 08 Jul 2026" },
        { code: "ADRO", note: "Cum Date: 10 Jul 2026" },
      ],
      rightIssue: [
        { code: "WIKA", note: "Cum Date: 15 Jul 2026" },
        { code: "SMGR", note: "Cum Date: 20 Jul 2026" },
      ],
      stockSplit: [
        { code: "BRIS", note: "Ratio: 1:2" },
        { code: "NCKL", note: "Ratio: 1:2" },
      ],
      ipo: [
        { code: "ABCD", note: "Listing: 07 Jul 2026" },
        { code: "EFGH", note: "Listing: 09 Jul 2026" },
      ],
    };
  },
};

const analyticsService = {
  // GET /api/analytics/sentiment (AI Sentiment — berita, foreign flow, sektor)
  async sentiment() {
    await delay(180);
    return { bullish: 72, neutral: 20, bearish: 8, bullishDelta: 5, neutralDelta: -3, bearishDelta: -2 };
  },
  // GET /api/earnings-calendar
  async earningsCalendar() {
    await delay(180);
    return [
      { company: "Bank Central Asia", ticker: "BBCA", time: "13:00 WIB" },
      { company: "Bank Rakyat Indonesia", ticker: "BBRI", time: "14:00 WIB" },
      { company: "Telkom Indonesia", ticker: "TLKM", time: "15:00 WIB" },
      { company: "Unilever Indonesia", ticker: "UNVR", time: "16:00 WIB" },
      { company: "Indofood CBP", ticker: "ICBP", time: "16:30 WIB" },
    ];
  },
};

const stockService = {
  // GET /api/watchlist (source: TwelveData / Yahoo Finance)
  async watchlist() {
    await delay(180);
    return [
      { symbol: "BBCA", name: "Bank Central Asia", last: 10250, chg: 150, chgPct: 1.49 },
      { symbol: "BBRI", name: "Bank Rakyat Indonesia", last: 4820, chg: -20, chgPct: -0.41 },
      { symbol: "BMRI", name: "Bank Mandiri", last: 6100, chg: 60, chgPct: 0.99 },
      { symbol: "ANTM", name: "Aneka Tambang", last: 3450, chg: 170, chgPct: 5.18 },
      { symbol: "TLKM", name: "Telkom Indonesia", last: 2830, chg: -30, chgPct: -1.05 },
    ];
  },
};

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function buildIhsgSeries() {
  const points = [];
  let v = ihsgSeed - rand(60, 100);
  const times = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
  for (let i = 0; i < times.length; i++) {
    v += rand(-25, 35);
    points.push({ t: times[i], value: Math.round(v * 100) / 100 });
  }
  points[points.length - 1].value = ihsgSeed;
  return points;
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------
function Card({ title, icon: Icon, action, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-gray-500 uppercase">
            {Icon && <Icon size={14} className="text-gray-400" />}
            {title}
            <Info size={13} className="text-gray-300" />
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Chip({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-600",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

function Change({ value, suffix = "%" }) {
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {up ? "+" : ""}{value.toFixed(2)}{suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar() {
  const items = [
    { icon: Home, label: "Dashboard", active: true },
    { icon: Coins, label: "Gold" },
    { icon: LineChartIcon, label: "Saham", active: true },
    { icon: BookOpen, label: "Trading Journal" },
    { icon: BarChart2, label: "Statistics" },
    { icon: Calendar, label: "Calendar" },
    { icon: Filter, label: "Screener" },
    { icon: Bell, label: "Alerts" },
    { icon: Info, label: "About" },
  ];
  return (
    <aside className="w-[220px] shrink-0 bg-white border-r border-gray-100 flex flex-col justify-between h-full">
      <div>
        <div className="px-5 pt-6 pb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
              <BarChart2 size={17} />
            </div>
            <div className="font-bold text-gray-800 text-[15px]">AGS</div>
          </div>
          <div className="text-[10px] tracking-wide text-gray-400 mt-1 ml-10">ANALYSIS &amp; GROWTH SYSTEM</div>
        </div>
        <nav className="px-3 space-y-0.5">
          {items.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
                active ? "bg-emerald-50 text-emerald-700" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="px-4 pb-5 space-y-3">
        <div className="rounded-xl border border-gray-100 p-3">
          <div className="text-[11px] text-gray-400">Market Status</div>
          <div className="flex items-center gap-1.5 mt-1 text-emerald-600 font-semibold text-[13px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Market Open
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">09:05 - 15:49 WIB</div>
        </div>

        <div className="rounded-xl border border-gray-100 p-3">
          <div className="text-[11px] text-gray-400 mb-2">Discipline Today</div>
          <div className="flex items-center justify-center">
            <DisciplineRing value={85} />
          </div>
          <div className="text-center text-[11px] text-gray-400 mt-1">Keep it up, Azis! 🔥</div>
        </div>

        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:bg-gray-50">
          <Sun size={15} /> Light
        </button>

        <div className="flex items-center gap-2 px-1 pt-1">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <User size={15} />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-gray-800">Azis</div>
            <div className="text-[11px] text-gray-400">Premium Member</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DisciplineRing({ value }) {
  const r = 30, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} stroke="#E5E7EB" strokeWidth="8" fill="none" />
      <circle
        cx="40" cy="40" r={r} stroke="#10B981" strokeWidth="8" fill="none"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">{value}%</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header() {
  const now = useNow();
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour12: false });
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Good Morning, Azis 👋</h1>
        <p className="text-gray-400 text-[13px] mt-0.5">Focus, Plan, Execute, Review, Improve.</p>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold text-gray-800 tabular-nums">{timeStr}</div>
        <div className="text-[12px] text-gray-400">{dateStr}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market Overview
// ---------------------------------------------------------------------------
function MarketOverview({ data, onRefresh, loading }) {
  const [range, setRange] = useState("1D");
  if (!data) return <Card title="Market Overview (IHSG)"><Skeleton h={280} /></Card>;
  const up = data.change >= 0;

  return (
    <Card
      title="Market Overview (IHSG)"
      action={
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-400 font-medium">IHSG</div>
          <div className="text-[34px] font-bold text-gray-800 leading-tight tabular-nums">
            {fmtIDR(data.value)}
          </div>
          <div className="mt-1"><Change value={data.changePct} /> <span className="text-gray-400 text-[13px] ml-1">({up ? "+" : ""}{data.change.toFixed(2)})</span></div>
        </div>
        <div className="flex gap-1">
          {["1D", "1W", "1M", "3M", "1Y", "YTD", "All"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium ${
                r === range ? "bg-emerald-600 text-white" : "text-gray-400 hover:bg-gray-50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px] mt-3 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ihsgFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis domain={["dataMin - 40", "dataMax + 40"]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={55} />
            <Tooltip
              formatter={(v) => [fmtIDR(v), "IHSG"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12 }}
            />
            <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} fill="url(#ihsgFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-6 gap-3 mt-4 pt-4 border-t border-gray-100">
        <Stat label="Advancers" value={data.advancers} tone="green" />
        <Stat label="Decliners" value={data.decliners} tone="red" />
        <Stat label="Unchanged" value={data.unchanged} />
        <Stat label="Volume" value={`Rp ${data.volumeT.toFixed(1)} T`} />
        <Stat label="Value" value={`Rp ${data.valueT.toFixed(1)} T`} />
        <Stat label="Foreign Net Buy" value={`+ Rp ${data.foreignNetBuyT.toFixed(2)} T`} tone="green" />
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }) {
  const colors = { green: "text-emerald-600", red: "text-red-500" };
  return (
    <div>
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`text-[15px] font-bold mt-0.5 ${colors[tone] || "text-gray-800"}`}>{value}</div>
    </div>
  );
}

function Skeleton({ h = 100 }) {
  return <div className="animate-pulse bg-gray-100 rounded-xl w-full" style={{ height: h }} />;
}

// ---------------------------------------------------------------------------
// Market News
// ---------------------------------------------------------------------------
function MarketNews({ news }) {
  const tagTone = { market: "green", macro: "blue", commodities: "amber", corporate: "purple" };
  return (
    <Card title="Market News Indonesia" action={<button className="text-[12px] text-emerald-700 font-medium hover:underline">Lihat Semua</button>}>
      <div className="space-y-3">
        {!news && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={48} />)}
        {news && news.map((n, i) => (
          <div key={i} className="flex items-start justify-between gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <div>
              <div className="text-[13px] font-semibold text-gray-700 leading-snug">{n.title}</div>
              <div className="text-[11.5px] text-gray-400 mt-1">{n.source} • {n.time}</div>
            </div>
            <Chip tone={tagTone[n.tag] || "gray"}>{n.tag}</Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Top Movers
// ---------------------------------------------------------------------------
function TopMovers({ movers }) {
  const [tab, setTab] = useState("gainers");
  const rows = movers ? movers[tab] : null;
  return (
    <Card title="Top Movers">
      <div className="flex gap-1 bg-gray-50 rounded-lg p-1 mb-3 w-fit">
        {[["gainers", "Top Gainers"], ["losers", "Top Losers"], ["active", "Most Active"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium ${
              tab === key ? "bg-emerald-600 text-white" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <table className="w-full text-[13px]">
        <tbody>
          {!rows && Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}><td colSpan={4}><Skeleton h={24} /></td></tr>
          ))}
          {rows && rows.map((r, i) => (
            <tr key={r.symbol} className="border-b border-gray-50 last:border-0">
              <td className="py-2 text-gray-400 w-5">{i + 1}</td>
              <td className="py-2 font-semibold text-gray-800">{r.symbol}
                <div className="text-[11px] font-normal text-gray-400">{r.name}</div>
              </td>
              <td className="py-2 text-right tabular-nums text-gray-700">{fmtIDR(r.last)}</td>
              <td className="py-2 text-right"><Change value={r.chg} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sector Performance
// ---------------------------------------------------------------------------
function SectorPerformance({ sectors }) {
  const max = 3.5;
  return (
    <Card title="Sector Performance">
      <div className="space-y-2.5">
        {!sectors && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={16} />)}
        {sectors && sectors.map((s) => {
          const up = s.chg >= 0;
          const w = Math.min(100, (Math.abs(s.chg) / max) * 100);
          return (
            <div key={s.name} className="flex items-center gap-3">
              <div className="w-[110px] text-[12.5px] text-gray-600 shrink-0">{s.name}</div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${up ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${w}%` }} />
              </div>
              <div className={`w-14 text-right text-[12.5px] font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
                {pct(s.chg)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Foreign Flow
// ---------------------------------------------------------------------------
function ForeignFlow({ flow }) {
  if (!flow) return <Card title="Foreign Flow (IDX)"><Skeleton h={220} /></Card>;
  const maxAbs = Math.max(...flow.spark.map((v) => Math.abs(v)));
  return (
    <Card title="Foreign Flow (IDX)">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-gray-400">Net Buy (YTD)</div>
          <div className="text-emerald-600 font-bold text-[18px]">+ Rp {flow.netBuyYtdT.toFixed(2)} T</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-gray-400">Net Buy Today</div>
          <div className="text-emerald-600 font-bold text-[15px]">+ Rp {flow.netBuyTodayT.toFixed(2)} T</div>
        </div>
      </div>

      <div className="flex items-end gap-1 h-14 mt-3">
        {flow.spark.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className={`w-full rounded-sm ${v >= 0 ? "bg-emerald-500" : "bg-red-400"}`}
              style={{ height: `${Math.max(6, (Math.abs(v) / maxAbs) * 100)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-gray-100 text-[12px]">
        <div>
          <div className="text-gray-400 mb-1.5 font-medium">Top Foreign Buy</div>
          {flow.topBuy.map(([code, val]) => (
            <div key={code} className="flex justify-between py-0.5">
              <span className="text-gray-600">{code}</span>
              <span className="text-emerald-600 font-medium">+Rp {val.toFixed(1)} M</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-gray-400 mb-1.5 font-medium">Top Foreign Sell</div>
          {flow.topSell.map(([code, val]) => (
            <div key={code} className="flex justify-between py-0.5">
              <span className="text-gray-600">{code}</span>
              <span className="text-red-500 font-medium">Rp {val.toFixed(1)} M</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Corporate Action
// ---------------------------------------------------------------------------
function CorporateAction({ data }) {
  const groups = data
    ? [
        { key: "dividend", label: "Dividend", tone: "green", items: data.dividend },
        { key: "rightIssue", label: "Right Issue", tone: "amber", items: data.rightIssue },
        { key: "stockSplit", label: "Stock Split", tone: "blue", items: data.stockSplit },
        { key: "ipo", label: "IPO", tone: "purple", items: data.ipo },
      ]
    : [];
  const dot = { green: "bg-emerald-500", amber: "bg-amber-500", blue: "bg-blue-500", purple: "bg-purple-500" };
  return (
    <Card title="Corporate Action" action={<button className="text-[12px] text-emerald-700 font-medium hover:underline">Lihat Semua</button>}>
      {!data && <Skeleton h={220} />}
      <div className="space-y-3.5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full ${dot[g.tone]}`} />
              <span className="text-[13px] font-semibold text-gray-700">{g.label}</span>
            </div>
            {g.items.map((it) => (
              <div key={it.code} className="flex justify-between text-[12.5px] pl-4 py-0.5">
                <span className="font-medium text-gray-600">{it.code}</span>
                <span className="text-gray-400">{it.note}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------
function Watchlist({ items }) {
  return (
    <Card title="Watchlist Saya" action={<button className="text-[12px] text-emerald-700 font-medium hover:underline">Kelola Watchlist</button>}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] text-gray-400">
            <th className="text-left font-medium pb-2">SYMBOL</th>
            <th className="text-right font-medium pb-2">LAST</th>
            <th className="text-right font-medium pb-2">CHANGE</th>
            <th className="text-right font-medium pb-2">%</th>
          </tr>
        </thead>
        <tbody>
          {!items && Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}><td colSpan={4}><Skeleton h={22} /></td></tr>
          ))}
          {items && items.map((it) => (
            <tr key={it.symbol} className="border-t border-gray-50">
              <td className="py-2">
                <div className="font-semibold text-gray-800">{it.symbol}</div>
                <div className="text-[11px] text-gray-400">{it.name}</div>
              </td>
              <td className="py-2 text-right tabular-nums">{fmtIDR(it.last)}</td>
              <td className={`py-2 text-right font-medium ${it.chg >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {it.chg >= 0 ? "+" : ""}{it.chg}
              </td>
              <td className="py-2 text-right">
                <span className={`inline-flex items-center gap-0.5 ${it.chgPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {it.chgPct >= 0 ? "▲" : "▼"} {Math.abs(it.chgPct).toFixed(2)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------
function Heatmap({ tiles }) {
  const colorFor = (v) => {
    if (v > 2) return "bg-emerald-600";
    if (v > 0.5) return "bg-emerald-400";
    if (v >= -0.5) return "bg-amber-300 text-amber-900";
    if (v >= -2) return "bg-red-400";
    return "bg-red-600";
  };
  return (
    <Card title="Heatmap IHSG" action={<button className="text-[12px] text-emerald-700 font-medium hover:underline">Lihat Semua</button>}>
      <div className="grid grid-cols-4 gap-2">
        {!tiles && Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} h={56} />)}
        {tiles && tiles.map(([code, v]) => (
          <div key={code} className={`rounded-lg p-2.5 text-white ${colorFor(v)}`}>
            <div className="text-[12.5px] font-bold">{code}</div>
            <div className="text-[11px] font-medium">{pct(v)}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10.5px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> &gt;2%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-300 inline-block" /> -0.5%-0.5%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-600 inline-block" /> &lt;-2%</span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AI Market Sentiment
// ---------------------------------------------------------------------------
function AISentiment({ s }) {
  if (!s) return <Card title="AI Market Sentiment"><Skeleton h={220} /></Card>;
  const r = 60, c = Math.PI * r;
  const bullOff = c - (s.bullish / 100) * c;
  return (
    <Card title="AI Market Sentiment" action={<span className="text-[11px] text-gray-400">Update 11:05 WIB</span>}>
      <div className="flex flex-col items-center">
        <svg width="180" height="100" viewBox="0 0 180 100">
          <path d="M 15 90 A 75 75 0 0 1 165 90" stroke="#E5E7EB" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path
            d="M 15 90 A 75 75 0 0 1 165 90"
            stroke="#10B981" strokeWidth="14" fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={bullOff}
          />
          <text x="90" y="70" textAnchor="middle" fontSize="26" fontWeight="800" fill="#111827">{s.bullish}%</text>
          <text x="90" y="88" textAnchor="middle" fontSize="12" fill="#10B981" fontWeight="600">Bullish</text>
        </svg>

        <div className="grid grid-cols-3 gap-2 w-full mt-2">
          <SentBox label="Bullish" val={s.bullish} delta={s.bullishDelta} tone="green" />
          <SentBox label="Neutral" val={s.neutral} delta={s.neutralDelta} tone="gray" />
          <SentBox label="Bearish" val={s.bearish} delta={s.bearishDelta} tone="red" />
        </div>
        <p className="text-[11px] text-gray-400 mt-3 text-center leading-snug">
          Sentimen didasarkan pada analisis berita, pergerakan indeks, foreign flow, dan sektor.
        </p>
      </div>
    </Card>
  );
}

function SentBox({ label, val, delta, tone }) {
  const bg = { green: "bg-emerald-50", gray: "bg-gray-50", red: "bg-red-50" }[tone];
  const text = { green: "text-emerald-700", gray: "text-gray-600", red: "text-red-600" }[tone];
  return (
    <div className={`rounded-lg ${bg} p-2 text-center`}>
      <div className={`font-bold text-[15px] ${text}`}>{val}%</div>
      <div className="text-[10.5px] text-gray-400">{label}</div>
      <div className={`text-[10.5px] font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Earnings Calendar
// ---------------------------------------------------------------------------
function EarningsCalendar({ items }) {
  const [tab, setTab] = useState("hari");
  return (
    <Card title="Earnings Calendar" action={<button className="text-[12px] text-emerald-700 font-medium hover:underline">Lihat Semua</button>}>
      <div className="flex gap-1 bg-gray-50 rounded-lg p-1 mb-3 w-fit">
        {[["hari", "Hari Ini"], ["besok", "Besok"], ["7hari", "7 Hari"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium ${
              tab === key ? "bg-emerald-600 text-white" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] text-gray-400">
            <th className="text-left font-medium pb-2">COMPANY</th>
            <th className="text-left font-medium pb-2">TICKER</th>
            <th className="text-right font-medium pb-2">TIME</th>
          </tr>
        </thead>
        <tbody>
          {!items && Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}><td colSpan={3}><Skeleton h={20} /></td></tr>
          ))}
          {items && items.map((it) => (
            <tr key={it.ticker} className="border-t border-gray-50">
              <td className="py-2 text-gray-700">{it.company}</td>
              <td className="py-2 font-semibold text-gray-800">{it.ticker}</td>
              <td className="py-2 text-right text-gray-500">{it.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// APP
// ---------------------------------------------------------------------------
export default function AGSDashboard() {
  const [overview, setOverview] = useState(null);
  const [movers, setMovers] = useState(null);
  const [sectors, setSectors] = useState(null);
  const [flow, setFlow] = useState(null);
  const [news, setNews] = useState(null);
  const [ca, setCa] = useState(null);
  const [watch, setWatch] = useState(null);
  const [heat, setHeat] = useState(null);
  const [sent, setSent] = useState(null);
  const [earn, setEarn] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    const o = await marketService.overview();
    setOverview(o);
    setLoadingOverview(false);
  }, []);

  // Initial load — satu kali panggil semua "service" mock (setara REST API GET di flowchart)
  useEffect(() => {
    loadOverview();
    marketService.topMovers().then(setMovers);
    marketService.sector().then(setSectors);
    marketService.foreignFlow().then(setFlow);
    newsService.indonesia().then(setNews);
    corporateActionService.list().then(setCa);
    stockService.watchlist().then(setWatch);
    marketService.heatmap().then(setHeat);
    analyticsService.sentiment().then(setSent);
    analyticsService.earningsCalendar().then(setEarn);
  }, [loadOverview]);

  // Scheduler simulasi: price/index tiap 15s (demo, mewakili "1-5 menit" di flowchart)
  useEffect(() => {
    const t = setInterval(loadOverview, 15000);
    return () => clearInterval(t);
  }, [loadOverview]);

  return (
    <div className="h-screen w-full flex bg-[#F4F6F5] text-gray-800" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Header />

        <div className="grid grid-cols-3 gap-5 mb-5">
          <div className="col-span-2">
            <MarketOverview data={overview} onRefresh={loadOverview} loading={loadingOverview} />
          </div>
          <MarketNews news={news} />
        </div>

        <div className="grid grid-cols-4 gap-5 mb-5">
          <TopMovers movers={movers} />
          <SectorPerformance sectors={sectors} />
          <ForeignFlow flow={flow} />
          <CorporateAction data={ca} />
        </div>

        <div className="grid grid-cols-4 gap-5">
          <Watchlist items={watch} />
          <Heatmap tiles={heat} />
          <AISentiment s={sent} />
          <EarningsCalendar items={earn} />
        </div>

        <div className="text-center text-[11px] text-gray-400 mt-6 pb-2">
          AGS © 2026 - Analysis &amp; Growth System. All rights reserved.
        </div>
      </main>
    </div>
  );
}
