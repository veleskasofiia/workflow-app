"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import NavBar from "@/components/NavBar";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type EmailItem = { id: string; threadId?: string; subject: string; from: string; snippet: string; date: string; source: "gmail" | "outlook"; isRead: boolean };

type Meeting = { title: string; start: string; source: string };
type Summary = {
  meetings_count: number | null;
  meetings: Meeting[];
  next_meeting: Meeting | null;
  gmail_unread: number | null;
  gmail_has_more: boolean;
  outlook_unread: number | null;
  connected: string[];
  error?: string;
};

const SUMMARY_CACHE_KEY = "flowboard_summary";
const SUMMARY_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_KEY = "flowboard_activity";
const REPLIED_IDS_KEY = "flowboard_replied_ids";

type ActivityEntry = { ts: string; text: string; icon: string };

function logActivity(icon: string, text: string) {
  const prev: ActivityEntry[] = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
  const next = [{ ts: new Date().toISOString(), text, icon }, ...prev].slice(0, 20);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
}

type Toast = { id: number; icon: string; text: string };


// ── Tracker types ─────────────────────────────────────────────────────────
type Habit     = { id: string; name: string; color: string };
type HabitLog  = { habit_id: string; date: string };
type TTask     = { id: string; title: string; date: string | null; completed: boolean; is_weekly_goal: boolean };
type PulseEntry = { date: string; sleep: number; energy: number; mood: number };
type BudgetRow  = { id: string; amount: number; category: string; type: "income" | "expense"; date: string; note: string };

const HABIT_COLORS  = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#8b5cf6","#14b8a6"];
const EXPENSE_CATS  = ["Food","Transport","Shopping","Health","Entertainment","Bills","Other"];
const INCOME_CATS   = ["Salary","Freelance","Gift","Other"];
const todayStr = () => new Date().toISOString().split("T")[0];
const fmtDate  = (d: Date) => d.toISOString().split("T")[0];

// ── Habits Tab ────────────────────────────────────────────────────────────
const PIE_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#8b5cf6","#14b8a6"];

// ── Habits Tab ────────────────────────────────────────────────────────────
function HabitsTab({ userId }: { userId: string }) {
  const [habits, setHabits]     = useState<Habit[]>([]);
  const [logs, setLogs]         = useState<HabitLog[]>([]);
  const [logs30, setLogs30]     = useState<HabitLog[]>([]);
  const [newName, setNewName]   = useState("");
  const [newColor, setNewColor] = useState(HABIT_COLORS[0]);
  const [showColors, setShowColors] = useState(false);

  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart  = fmtDate(new Date(year, month, 1));
  const monthEnd    = fmtDate(new Date(year, month, daysInMonth));
  const since30     = fmtDate(new Date(Date.now() - 29 * 86400000));
  const today       = todayStr();

  const load = useCallback(async () => {
    const [{ data: h }, { data: l }, { data: l30 }] = await Promise.all([
      supabase.from("habits").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("habit_logs").select("habit_id,date").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
      supabase.from("habit_logs").select("habit_id,date").eq("user_id", userId).gte("date", since30),
    ]);
    if (h) setHabits(h);
    if (l) setLogs(l);
    if (l30) setLogs30(l30 as HabitLog[]);
  }, [userId, monthStart, monthEnd, since30]);

  useEffect(() => { load(); }, [load]);

  const isDone = (hId: string, day: number) => logs.some(l => l.habit_id === hId && l.date === fmtDate(new Date(year, month, day)));

  const toggle = async (hId: string, day: number) => {
    const d = fmtDate(new Date(year, month, day));
    if (d > today) return;
    if (isDone(hId, day)) await supabase.from("habit_logs").delete().eq("habit_id", hId).eq("date", d);
    else await supabase.from("habit_logs").insert({ user_id: userId, habit_id: hId, date: d });
    load();
  };

  const streak = (hId: string) => {
    let count = 0; const d = new Date(today);
    while (logs.some(l => l.habit_id === hId && l.date === fmtDate(d))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  };

  const addHabit = async () => {
    if (!newName.trim()) return;
    await supabase.from("habits").insert({ user_id: userId, name: newName.trim(), color: newColor });
    setNewName(""); setShowColors(false); load();
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const colW = `${100 / (daysInMonth + 3)}%`;
  const nameW = `calc(${colW} * 2.5)`;

  // Chart: 30-day completion rate
  const completionData = Array.from({ length: 30 }, (_, i) => {
    const d = fmtDate(new Date(Date.now() - (29 - i) * 86400000));
    const done = logs30.filter(l => l.date === d).length;
    return {
      date: new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Completion: habits.length > 0 ? Math.round((done / habits.length) * 100) : 0,
    };
  });

  // Chart: current streaks per habit
  const streakData = habits.map(h => ({ name: h.name, Streak: streak(h.id), fill: h.color }));

  return (<>
    <div className="tr-card">
      <div className="tr-card-title">Habit Tracker</div>
      <div className="tr-card-sub">Check off habits daily and build your streak.</div>
      <div className="habit-add-row">
        <input className="habit-add-input" placeholder="New habit name…" value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addHabit()} />
        <div className="habit-color-swatch" style={{ background: newColor }} onClick={() => setShowColors(v => !v)} />
        <button className="habit-add-btn" onClick={addHabit}>+ Add Habit</button>
      </div>
      {showColors && (
        <div className="habit-color-picker">
          {HABIT_COLORS.map(c => (
            <div key={c} className={`habit-color-dot${newColor === c ? " selected" : ""}`}
              style={{ background: c }} onClick={() => { setNewColor(c); setShowColors(false); }} />
          ))}
        </div>
      )}
      {habits.length === 0 ? (
        <div className="habit-empty">No habits yet. Add one above to start tracking.</div>
      ) : (
        <div className="habit-grid">
          <div className="habit-month-label">{now.toLocaleString("default", { month: "long" })} {year}</div>
          <div className="habit-grid-inner">
            <div className="habit-grid-days" style={{ gridTemplateColumns: `${nameW} repeat(${daysInMonth}, ${colW}) calc(${colW} * 0.5)` }}>
              <div />
              {days.map(d => <div key={d} className="habit-day-label">{d}</div>)}
              <div />
            </div>
            {habits.map(h => {
              const s = streak(h.id);
              return (
                <div key={h.id} className="habit-row" style={{ gridTemplateColumns: `${nameW} repeat(${daysInMonth}, ${colW}) calc(${colW} * 0.5)` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <span className="habit-row-name">{h.name}</span>
                    <button className="habit-delete-btn" onClick={async () => { await supabase.from("habits").delete().eq("id", h.id); load(); }}>×</button>
                  </div>
                  {days.map(d => {
                    const dStr = fmtDate(new Date(year, month, d));
                    const done = isDone(h.id, d), future = dStr > today;
                    return (
                      <button key={d} className={`habit-cell${done ? " done" : ""}${future ? " future" : ""}${dStr === today ? " today" : ""}`}
                        style={{ "--habit-color": h.color } as React.CSSProperties}
                        onClick={() => toggle(h.id, d)} disabled={future} />
                    );
                  })}
                  <div className="habit-row-streak">{s > 0 ? `🔥${s}` : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

    {habits.length > 0 && (
      <div className="tr-charts-row">
        <div className="tr-card tr-chart-card">
          <div className="tr-card-title">30-Day Completion Rate</div>
          <div className="tr-card-sub">% of habits done each day</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={completionData}>
              <defs>
                <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Completion"]} />
              <Area type="monotone" dataKey="Completion" stroke="#6366f1" strokeWidth={2} fill="url(#compGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="tr-card tr-chart-card">
          <div className="tr-card-title">Current Streaks</div>
          <div className="tr-card-sub">Consecutive days per habit</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={streakData} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={80} />
              <Tooltip formatter={(v: number) => [`${v} days`, "Streak"]} />
              <Bar dataKey="Streak" radius={[0, 4, 4, 0]}>
                {streakData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
  </>);
}

// ── Planner Tab ───────────────────────────────────────────────────────────
type PlannerView = "this-week" | "charts" | "goals";

function PlannerTab({ userId, view }: { userId: string; view: PlannerView }) {
  const [tasks, setTasks]       = useState<TTask[]>([]);
  const [allTasks, setAllTasks] = useState<TTask[]>([]);
  const [newTask, setNewTask]   = useState("");
  const [dayInputs, setDayInputs] = useState<Record<string, string>>({});
  const [weekOffset, setWeekOffset] = useState(0);

  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow) + weekOffset * 7);
  const weekDays  = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const weekStart = fmtDate(weekDays[0]), weekEnd = fmtDate(weekDays[6]);
  const since8w   = fmtDate(new Date(Date.now() - 56 * 86400000));
  const today     = todayStr();

  const load = useCallback(async () => {
    const [{ data: w }, { data: all }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", userId)
        .gte("date", weekStart).lte("date", weekEnd).order("created_at"),
      supabase.from("tasks").select("date,completed,is_weekly_goal").eq("user_id", userId).gte("date", since8w),
    ]);
    if (w) setTasks(w as TTask[]);
    if (all) setAllTasks(all as TTask[]);
  }, [userId, weekStart, weekEnd, since8w]);

  const broadcast = () => window.dispatchEvent(new Event("planner-refresh"));

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("planner-refresh", handler);
    return () => window.removeEventListener("planner-refresh", handler);
  }, [load]);

  const addTask = async () => {
    const title = newTask.trim();
    if (!title) return;
    await supabase.from("tasks").insert({ user_id: userId, title, date: today, completed: false, is_weekly_goal: false });
    setNewTask(""); broadcast();
  };

  const toggle = async (t: TTask) => { await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id); broadcast(); };
  const del    = async (id: string) => { await supabase.from("tasks").delete().eq("id", id); broadcast(); };

  const todayTasks = tasks.filter(t => t.date === today);
  const showYear = weekDays[0].getFullYear() !== now.getFullYear() || weekDays[6].getFullYear() !== now.getFullYear();
  const fmtOpt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(showYear ? { year: "numeric" } : {}) });
  const weekLabel  = `${fmtOpt(weekDays[0])} – ${fmtOpt(weekDays[6])}`;
  const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const weeklyData = Array.from({ length: 8 }, (_, wi) => {
    const wEnd = new Date(Date.now() - (7 - wi) * 7 * 86400000);
    const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6);
    const ws = fmtDate(wStart), we = fmtDate(wEnd);
    const wt = allTasks.filter(t => !t.is_weekly_goal && t.date && t.date >= ws && t.date <= we);
    const monthShort = wStart.toLocaleDateString("en-US", { month: "short" });
    const weekOfMonth = Math.ceil(wStart.getDate() / 7);
    return {
      week: `${monthShort} W${weekOfMonth}`,
      Done: wt.filter(t => t.completed).length,
      Todo: wt.filter(t => !t.completed).length,
    };
  });

  const todayDone    = todayTasks.filter(t => t.completed).length;
  const todayPieData = todayTasks.length > 0
    ? [{ name: "Done", value: todayDone }, { name: "Remaining", value: todayTasks.filter(t => !t.completed).length }]
    : [{ name: "No tasks", value: 1 }];

  // ── This Week view ────────────────────────────────────────────────────
  if (view === "this-week") {
    const addDayTask = async (dStr: string) => {
      const title = (dayInputs[dStr] || "").trim();
      if (!title) return;
      await supabase.from("tasks").insert({ user_id: userId, title, date: dStr, completed: false, is_weekly_goal: false });
      setDayInputs(prev => ({ ...prev, [dStr]: "" }));
      broadcast();
    };

    const copyToNext = async (title: string, fromDate: string) => {
      const d = new Date(fromDate + "T12:00:00");
      d.setDate(d.getDate() + 1);
      await supabase.from("tasks").insert({ user_id: userId, title, date: fmtDate(d), completed: false, is_weekly_goal: false });
      broadcast();
    };

    return (
      <div className="tr-card" style={{ marginBottom: "1.5rem", overflow: "hidden" }}>
        <div className="week-nav-header">
          <div>
            <div className="tr-card-title">Calendar</div>
            <div className="tr-card-sub">{weekLabel}</div>
          </div>
          <div className="week-nav-btns">
            <button className="week-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>◀</button>
            {weekOffset !== 0 && <button className="week-nav-today" onClick={() => setWeekOffset(0)}>Today</button>}
            <button className="week-nav-btn" onClick={() => setWeekOffset(o => o + 1)}>▶</button>
          </div>
        </div>
        <div className="week-days-scroll">
        <div className="week-days-grid">
          {weekDays.map((d, i) => {
            const dStr = fmtDate(d);
            const dayTasks = tasks.filter(t => t.date === dStr);
            const isToday = dStr === today;
            return (
              <div key={i} className={`week-day-col${isToday ? " today-col" : ""}`}>
                <div className="week-day-name">{dayNames[d.getDay()]}</div>
                <div className="week-day-num">{d.getDate()}{isToday && <span className="today-dot" />}</div>
                {dayTasks.map(t => (
                  <div key={t.id} className={`week-task-chip${t.completed ? " done" : ""}`}>
                    <button className="week-chip-check" onClick={() => toggle(t)}>{t.completed ? "✓" : "○"}</button>
                    <span className="week-chip-title">{t.title}</span>
                    <button className="week-chip-copy" title="Copy to next day" onClick={() => copyToNext(t.title, dStr)}>→</button>
                    <button className="week-chip-del" onClick={() => del(t.id)}>×</button>
                  </div>
                ))}
                <input
                  className="week-day-input"
                  placeholder="+ goal"
                  value={dayInputs[dStr] || ""}
                  onChange={e => setDayInputs(prev => ({ ...prev, [dStr]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addDayTask(dStr)}
                />
              </div>
            );
          })}
        </div>
        </div>
      </div>
    );
  }

  // ── Charts view ───────────────────────────────────────────────────────
  if (view === "charts") {
    return (<>
      <div className="tr-card tr-chart-card">
        <div className="tr-card-title">Weekly Task Completion</div>
        <div className="tr-card-sub">Tasks done vs remaining — last 8 weeks</div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={weeklyData} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
            <Bar dataKey="Done" fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="Todo" fill="#e2e8f0" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="tr-card tr-chart-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="tr-card-title" style={{ alignSelf: "flex-start" }}>Today&apos;s Progress</div>
        <div className="tr-card-sub" style={{ alignSelf: "flex-start" }}>{todayDone} of {todayTasks.length} tasks done</div>
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={todayPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
              {todayPieData.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "#10b981" : todayTasks.length === 0 ? "#f1f5f9" : "#e2e8f0"} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ textAlign: "center", marginTop: "-0.5rem", fontSize: "1.4rem", fontWeight: 700, color: "#10b981" }}>
          {todayTasks.length > 0 ? `${Math.round((todayDone / todayTasks.length) * 100)}%` : "—"}
        </div>
      </div>
    </>);
  }

  return (<>
    <div className="tr-card">
      <div className="tr-card-title">Today&apos;s Tasks</div>
      <div className="tr-card-sub">{new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
      <div className="task-add-row">
        <input className="task-add-input" placeholder="Add a task for today…" value={newTask}
          onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} />
        <button className="task-add-btn" onClick={() => addTask()}>+ Add</button>
      </div>
      <div className="task-list">
        {todayTasks.length === 0 && <div className="task-empty">No tasks for today yet.</div>}
        {todayTasks.map(t => (
          <div key={t.id} className="task-item">
            <div className={`task-check${t.completed ? " done" : ""}`} onClick={() => toggle(t)}>{t.completed && "✓"}</div>
            <span className={`task-label${t.completed ? " done" : ""}`}>{t.title}</span>
            <button className="task-delete" onClick={() => del(t.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  </>);
}

// ── Pulse Tab ─────────────────────────────────────────────────────────────
function PulseTab({ userId }: { userId: string }) {
  const [sleep, setSleep]       = useState(0);
  const [energy, setEnergy]     = useState(0);
  const [mood, setMood]         = useState(0);
  const [saved, setSaved]       = useState(false);
  const [history, setHistory]   = useState<PulseEntry[]>([]);
  const today = todayStr();
  const sleepEmojis  = ["😴","🛌","😪","😊","⚡"];
  const energyEmojis = ["🪫","😩","😐","💪","🚀"];
  const moodEmojis   = ["😢","😕","😐","🙂","😄"];

  const load = useCallback(async () => {
    const since = fmtDate(new Date(Date.now() - 13 * 86400000));
    const { data } = await supabase.from("daily_pulse").select("*").eq("user_id", userId).gte("date", since).order("date");
    if (data) {
      setHistory(data as PulseEntry[]);
      const t = (data as PulseEntry[]).find(d => d.date === today);
      if (t) { setSleep(t.sleep); setEnergy(t.energy); setMood(t.mood); setSaved(true); }
    }
  }, [userId, today]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!sleep || !energy || !mood) return;
    await supabase.from("daily_pulse").upsert({ user_id: userId, date: today, sleep, energy, mood }, { onConflict: "user_id,date" });
    setSaved(true); load();
  };

  const Metric = ({ label, icon, emojis, selected, onSelect }: { label: string; icon: string; emojis: string[]; selected: number; onSelect: (v: number) => void }) => (
    <div className="pulse-metric">
      <div className="pulse-metric-label"><span>{icon}</span>{label}</div>
      <div className="pulse-emoji-row">
        {emojis.map((e, i) => (
          <button key={i} className={`pulse-emoji-btn${selected === i + 1 ? " selected" : ""}`}
            onClick={() => { onSelect(i + 1); setSaved(false); }}>{e}</button>
        ))}
      </div>
    </div>
  );

  // Chart data
  const chartData = history.map(p => ({
    date: new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Sleep: p.sleep, Energy: p.energy, Mood: p.mood,
  }));

  const avg = (key: "sleep" | "energy" | "mood") =>
    history.length ? (history.reduce((s, p) => s + p[key], 0) / history.length).toFixed(1) : "—";

  return (<>
    <div className="tr-card">
      <div className="tr-card-title">Daily Check-in</div>
      <div className="tr-card-sub">How are you doing today?</div>
      <div className="pulse-metrics">
        <Metric label="Sleep quality" icon="🌙" emojis={sleepEmojis}  selected={sleep}  onSelect={setSleep} />
        <Metric label="Energy level"  icon="⚡" emojis={energyEmojis} selected={energy} onSelect={setEnergy} />
        <Metric label="Mood"          icon="😊" emojis={moodEmojis}   selected={mood}   onSelect={setMood} />
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button className="pulse-save-btn" onClick={save} disabled={!sleep || !energy || !mood}>Save today&apos;s check-in</button>
        {saved && <span className="pulse-saved-msg">✓ Saved</span>}
      </div>
    </div>

    {history.length > 0 && (<>
      {/* Avg stats */}
      <div className="tr-card">
        <div className="tr-card-title">14-Day Averages</div>
        <div className="tr-card-sub">Your average sleep, energy, and mood this period.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {[
            { label: "Sleep",  icon: "🌙", val: avg("sleep"),  color: "#3b82f6" },
            { label: "Energy", icon: "⚡", val: avg("energy"), color: "#f59e0b" },
            { label: "Mood",   icon: "😊", val: avg("mood"),   color: "#10b981" },
          ].map(s => (
            <div key={s.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "1rem", textAlign: "center", borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Line chart */}
      <div className="tr-card">
        <div className="tr-card-title">Trends — Last 14 Days</div>
        <div className="tr-card-sub">Sleep, energy, and mood on a 1–5 scale</div>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          {[["#3b82f6","Sleep"],["#f59e0b","Energy"],["#10b981","Mood"]].map(([c,l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#64748b" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />{l}
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={2} />
            <YAxis domain={[0, 5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip />
            <Line type="monotone" dataKey="Sleep"  stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Energy" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Mood"   stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>)}
  </>);
}

// ── Budget Tab ────────────────────────────────────────────────────────────
const CURRENCIES = { USD: "$", EUR: "€", CZK: "Kč" } as const;
type Currency = keyof typeof CURRENCIES;

function BudgetTab({ userId }: { userId: string }) {
  const [entries, setEntries]       = useState<BudgetRow[]>([]);
  const [allEntries, setAllEntries] = useState<BudgetRow[]>([]);
  const [type, setType]             = useState<"income" | "expense">("expense");
  const [amount, setAmount]         = useState("");
  const [category, setCategory]     = useState("Food");
  const [date, setDate]             = useState(todayStr());
  const [note, setNote]             = useState("");
  const [currency, setCurrency]     = useState<Currency>("USD");

  useEffect(() => {
    const saved = localStorage.getItem(`budget_currency_${userId}`);
    if (saved && saved in CURRENCIES) setCurrency(saved as Currency);
  }, [userId]);

  const changeCurrency = (c: Currency) => {
    setCurrency(c);
    localStorage.setItem(`budget_currency_${userId}`, c);
  };

  const sym = CURRENCIES[currency];

  const now = new Date();
  const monthStart = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd   = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const since6m    = fmtDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));

  const load = useCallback(async () => {
    const [{ data: m }, { data: all }] = await Promise.all([
      supabase.from("budget_entries").select("*").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false }),
      supabase.from("budget_entries").select("date,amount,type,category").eq("user_id", userId).gte("date", since6m),
    ]);
    if (m) setEntries(m as BudgetRow[]);
    if (all) setAllEntries(all as BudgetRow[]);
  }, [userId, monthStart, monthEnd, since6m]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCategory(type === "income" ? "Salary" : "Food"); }, [type]);

  const add = async () => {
    const amt = parseFloat(amount);
    if (!amt || isNaN(amt) || amt <= 0) return;
    await supabase.from("budget_entries").insert({ user_id: userId, amount: amt, category, type, date, note: note.trim() });
    setAmount(""); setNote(""); load();
  };

  const totalIncome  = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance      = totalIncome - totalExpense;

  // Pie: expense by category this month
  const pieData = EXPENSE_CATS.map(cat => ({
    name: cat,
    value: entries.filter(e => e.type === "expense" && e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(d => d.value > 0);

  // Bar: income vs expense last 6 months
  const barData = Array.from({ length: 6 }, (_, mi) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - mi), 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const inc = allEntries.filter(e => e.date.startsWith(ym) && e.type === "income").reduce((s, e) => s + e.amount, 0);
    const exp = allEntries.filter(e => e.date.startsWith(ym) && e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { month: d.toLocaleString("default", { month: "short" }), Income: Math.round(inc), Expenses: Math.round(exp) };
  });

  return (<>
    <div className="tr-card">
      <div className="tr-card-title">Budget — {now.toLocaleString("default", { month: "long", year: "numeric" })}</div>
      <div className="tr-card-sub">Track your income and expenses this month.</div>
      <div className="budget-summary">
        <div className="budget-summary-card income"><div className="budget-summary-label">Income</div><div className="budget-summary-value">+{sym}{totalIncome.toFixed(2)}</div></div>
        <div className="budget-summary-card expense"><div className="budget-summary-label">Expenses</div><div className="budget-summary-value">-{sym}{totalExpense.toFixed(2)}</div></div>
        <div className="budget-summary-card balance"><div className="budget-summary-label">Balance</div><div className="budget-summary-value" style={{ color: balance >= 0 ? "#10b981" : "#ef4444" }}>{balance >= 0 ? "+" : ""}{sym}{balance.toFixed(2)}</div></div>
      </div>
      <div className="budget-form">
        <div className="budget-field"><label>Currency</label>
          <select className="budget-select" value={currency} onChange={e => changeCurrency(e.target.value as Currency)}>
            {(Object.keys(CURRENCIES) as Currency[]).map(c => <option key={c} value={c}>{c} {CURRENCIES[c]}</option>)}
          </select>
        </div>
        <div className="budget-field"><label>Type</label>
          <select className="budget-select" value={type} onChange={e => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Expense</option><option value="income">Income</option>
          </select>
        </div>
        <div className="budget-field"><label>Amount ({sym})</label>
          <input className="budget-input" type="number" placeholder="0.00" value={amount}
            onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} style={{ width: 110 }} />
        </div>
        <div className="budget-field"><label>Category</label>
          <select className="budget-select" value={category} onChange={e => setCategory(e.target.value)}>
            {(type === "income" ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="budget-field"><label>Date</label>
          <input className="budget-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 140 }} />
        </div>
        <div className="budget-field"><label>Note</label>
          <input className="budget-input" placeholder="Optional…" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <button className="budget-add-btn" onClick={add}>+ Add</button>
      </div>
      <div className="budget-list">
        {entries.length === 0 && <div className="budget-empty">No entries this month yet.</div>}
        {entries.map(e => (
          <div key={e.id} className="budget-entry">
            <div className={`budget-entry-type ${e.type}`}>{e.type === "income" ? "+" : "−"}</div>
            <div className="budget-entry-cat">{e.category}{e.note ? ` · ${e.note}` : ""}</div>
            <div className={`budget-entry-amount ${e.type}`}>{e.type === "income" ? "+" : "-"}{sym}{Number(e.amount).toFixed(2)}</div>
            <div className="budget-entry-date">{new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            <button className="budget-entry-delete" onClick={async () => { await supabase.from("budget_entries").delete().eq("id", e.id); load(); }}>×</button>
          </div>
        ))}
      </div>
    </div>

    <div className="tr-charts-row">
      <div className="tr-card tr-chart-card">
        <div className="tr-card-title">Expenses by Category</div>
        <div className="tr-card-sub">This month&apos;s spending breakdown</div>
        {pieData.length === 0 ? (
          <div className="budget-empty">No expenses recorded yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${sym}${v.toFixed(2)}`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="tr-card tr-chart-card">
        <div className="tr-card-title">Income vs Expenses</div>
        <div className="tr-card-sub">Last 6 months</div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={barData} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip formatter={(v: number) => `${sym}${v}`} />
            <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
            <Bar dataKey="Income"   fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </>);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type Connection = { id: string; appName: string; status: string };

const CONNECTABLE_APPS = [
  { key: "gmail",          label: "Gmail",            icon: "📧", color: "#ea4335", composioApp: "gmail" },
  { key: "googlecalendar", label: "Google Calendar",  icon: "📅", color: "#4285f4", composioApp: "googlecalendar" },
  { key: "outlook",        label: "Outlook",          icon: "📨", color: "#0078d4", composioApp: "outlook" },
  { key: "googledrive",    label: "Google Drive",     icon: "📁", color: "#34a853", composioApp: "googledrive" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [daysAsMember, setDaysAsMember] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectingApp, setConnectingApp] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailItem[] | null>(null);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailTab, setEmailTab] = useState<"all" | "gmail" | "outlook">("all");
  const [emailSources, setEmailSources] = useState<{ gmail: boolean; outlook: boolean }>({ gmail: false, outlook: false });
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<{ id: number; name: string; completed: boolean }[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "done">("all");
  const [taskError, setTaskError] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevUnreadRef = useRef<number | null>(null);
  const [dashTab, setDashTab] = useState<"overview" | "apps" | "tracker" | "finance" | "settings">("tracker");
  const notifiedMeetingsRef = useRef<Set<string>>(new Set());
  const toastIdRef = useRef(0);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/signup"); return; }
      setUser(user);

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setMessageCount(count ?? 0);

      const joined = new Date(user.created_at);
      const days = Math.floor((Date.now() - joined.getTime()) / 86_400_000);
      setDaysAsMember(days);

      setLoading(false);

setActivityLog(JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"));
      setRepliedIds(new Set(JSON.parse(localStorage.getItem(REPLIED_IDS_KEY) || "[]")));
      fetchConnections(user.id);
      fetchEmails(user.id);
      fetchTasks(user.id);

      // Request browser notification permission
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }

      // Load summary — use cache if fresh, else fetch
      const cached = localStorage.getItem(SUMMARY_CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < SUMMARY_TTL_MS) { setSummary(data); return; }
      }
      fetchSummary(user.id);
    }
    init();
  }, [router]);

  async function fetchConnections(entityId: string) {
    try {
      const res = await fetch(`/api/connect?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      setConnections(data.connections ?? []);
    } catch { setConnections([]); }
  }

  async function handleConnect(composioApp: string) {
    if (!user) return;
    setConnectingApp(composioApp);
    try {
      const callbackUrl = `${window.location.origin}/connect/callback?app=${composioApp}`;
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName: composioApp, entityId: user.id, callbackUrl }),
      });
      const data = await res.json();
      if (data.redirectUrl) window.location.href = data.redirectUrl;
    } catch { /* ignore */ }
    setConnectingApp(null);
  }

  async function handleDisconnect(connectionId: string) {
    setDisconnectingId(connectionId);
    try {
      await fetch("/api/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (user) fetchConnections(user.id);
    } catch { /* ignore */ }
    setDisconnectingId(null);
  }

  function getConnection(composioApp: string) {
    return connections.find(
      (c) => c.appName?.toLowerCase() === composioApp.toLowerCase() && c.status !== "FAILED"
    ) ?? null;
  }

  async function fetchSummary(entityId: string) {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      const data: Summary = await res.json();
      setSummary(data);
      localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      logActivity("📅", "Synced calendar & email counts");
      setActivityLog(JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"));
    } catch {
      setSummary({ meetings_count: null, meetings: [], next_meeting: null, gmail_unread: null, gmail_has_more: false, outlook_unread: null, connected: [], error: "failed" });
    }
    setSummaryLoading(false);
  }

  async function fetchEmails(entityId: string) {
    setEmailsLoading(true);
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      const data = await res.json();
      setEmails(data.emails ?? []);
      if (data.sources) setEmailSources(data.sources);
      logActivity("📧", "Fetched inbox emails");
      setActivityLog(JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"));
    } catch {
      setEmails([]);
    }
    setEmailsLoading(false);
  }

  async function toggleEmailRead(email: EmailItem) {
    if (!user) return;
    const markAsRead = !email.isRead;
    // Optimistic update
    setEmails((prev) =>
      prev ? prev.map((e) => e.id === email.id ? { ...e, isRead: markAsRead } : e) : prev
    );
    try {
      await fetch("/api/emails/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: user.id, emailId: email.id, threadId: email.threadId, source: email.source, markAsRead }),
      });
    } catch {
      // Revert on failure
      setEmails((prev) =>
        prev ? prev.map((e) => e.id === email.id ? { ...e, isRead: email.isRead } : e) : prev
      );
    }
  }

  async function sendReply(email: EmailItem) {
    if (!user || !replyText.trim()) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch("/api/emails/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: user.id,
          emailId: email.id,
          threadId: email.threadId,
          source: email.source,
          body: replyText,
          recipientEmail: email.from,
        }),
      });
      const data = await res.json();
      if (data.error) { setReplyError(data.error); return; }
      setReplyingTo(null);
      setReplyText("");
      setRepliedIds((prev) => {
        const next = new Set(prev);
        next.add(email.id);
        localStorage.setItem(REPLIED_IDS_KEY, JSON.stringify([...next]));
        return next;
      });
      logActivity("✉️", `Replied to: ${email.subject}`);
    } catch {
      setReplyError("Failed to send reply. Please try again.");
    } finally {
      setReplySending(false);
    }
  }

  async function fetchTasks(userId: string) {
    // Try with user_id filter first; fall back to unfiltered if column missing
    let { data, error } = await supabase
      .from("todos")
      .select("id, name, completed")
      .eq("user_id", userId)
      .order("id", { ascending: true });
    if (error) {
      ({ data } = await supabase
        .from("todos")
        .select("id, name, completed")
        .order("id", { ascending: true }));
    }
    setTasks(data ?? []);
  }

  async function addTask() {
    const name = taskInput.trim();
    if (!name || !user) return;
    setTaskError(null);

    // Try inserting with user_id; fall back without it if the column doesn't exist
    let { data, error } = await supabase
      .from("todos")
      .insert({ name, completed: false, user_id: user.id })
      .select("id, name, completed")
      .single();

    if (error) {
      ({ data, error } = await supabase
        .from("todos")
        .insert({ name, completed: false })
        .select("id, name, completed")
        .single());
    }

    if (error || !data) {
      setTaskError("Could not save task. Check your Supabase todos table exists.");
      return;
    }

    setTaskInput("");
    setTasks((prev) => [...prev, data]);
  }

  async function toggleTask(id: number, completed: boolean) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed } : t));
    await supabase.from("todos").update({ completed }).eq("id", id);
  }

  async function deleteTask(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("todos").delete().eq("id", id);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.error) { setDeleteError(data.error); setDeleting(false); return; }
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setDeleteError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  function showToast(icon: string, text: string) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, icon, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }

  // Polling for notifications every 3 minutes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId: user.id }),
        });
        const data: Summary = await res.json();
        setSummary(data);
        localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));

        // Check unread email increase
        if (data.gmail_unread !== null) {
          if (prevUnreadRef.current !== null && data.gmail_unread > prevUnreadRef.current) {
            const msg = "New email arrived";
            showToast("📧", msg);
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("📧 " + msg);
            }
          }
          prevUnreadRef.current = data.gmail_unread;
        }

        // Check meetings starting within 15 minutes
        const now = Date.now();
        for (const meeting of data.meetings ?? []) {
          const start = new Date(meeting.start).getTime();
          const diff = start - now;
          if (diff > 0 && diff <= 15 * 60 * 1000) {
            const key = meeting.title + meeting.start;
            if (!notifiedMeetingsRef.current.has(key)) {
              notifiedMeetingsRef.current.add(key);
              const msg = `Meeting in 15 min: ${meeting.title}`;
              showToast("📅", msg);
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("📅 " + msg);
              }
            }
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return <div className="dash-loading"><div className="dash-spinner" /></div>;
  }

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="dash-page">
      <NavBar onSignOut={handleSignOut} onSettings={() => setDashTab("settings")} />

      <main className="dash-main">

        {/* Welcome */}
        <div className="dash-top-row">
          <div className="dash-welcome">
            <h1>{greeting()}, <span>{user?.email?.split("@")[0]}</span> 👋</h1>
            <p>Member since {joinedDate} · {daysAsMember} days with FlowBoard · {messageCount} AI messages</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="tracker-tabs" style={{ marginBottom: "2rem" }}>
          {([
            { key: "tracker",  label: "Tracker" },
            { key: "finance",  label: "Finance" },
            { key: "overview", label: "Overview" },
            { key: "apps",     label: "Apps" },
          ] as const).map(t => (
            <button
              key={t.key}
              className={`tracker-tab-btn${dashTab === t.key ? " active" : ""}`}
              onClick={() => setDashTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {dashTab === "overview" && <>
        {/* Your Week — real data from connected apps */}
        <section className="dash-card dash-week">

          <div className="dash-week-header">
            <h2 className="dash-card-title" style={{ margin: 0 }}>Your Week at a Glance</h2>
            <button
              className="dash-week-refresh"
              onClick={() => { if (user) { localStorage.removeItem(SUMMARY_CACHE_KEY); fetchSummary(user.id); fetchEmails(user.id); } }}
              disabled={summaryLoading}
            >
              {summaryLoading ? "Loading…" : "↺ Refresh"}
            </button>
          </div>

          {summaryLoading && !summary && (
            <div className="dash-week-loading">
              <div className="dash-spinner" style={{ width: 28, height: 28 }} />
              <span>Fetching your meetings and emails…</span>
            </div>
          )}

          {!summaryLoading && !summary && (
            <div className="dash-how-to">
              <p className="dash-how-to-title">To see your real meetings and emails here:</p>
              <ol className="dash-how-to-steps">
                <li>Go to <a href="/connect"><strong>Connect Apps</strong></a> in the top navigation.</li>
                <li>Click <strong>Connect Gmail</strong> and sign in with your Google account.</li>
                <li>Click <strong>Connect Outlook Mail</strong> and sign in with your Microsoft account.</li>
                <li>Click <strong>Connect Google Calendar</strong> and/or <strong>Connect Outlook Mail</strong> (Outlook Calendar is included automatically).</li>
                <li>Come back here and click <strong>↺ Refresh</strong>.</li>
              </ol>
              <a href="/connect" className="dash-action-btn primary" style={{ display: "inline-flex", marginTop: "0.75rem" }}>🔗 Go to Connect Apps</a>
            </div>
          )}

          {summary && !summary.error && (
            <>
              <div className="dash-week-stats">
                {/* Meetings this week */}
                <div className="dash-week-stat" style={{ borderColor: "#4285f4" }}>
                  <span className="dash-week-icon">📅</span>
                  <span className="dash-week-val">
                    {summary.meetings_count !== null ? summary.meetings_count : "—"}
                  </span>
                  <span className="dash-week-label">upcoming meetings</span>
                  {summary.next_meeting && (
                    <span className="dash-week-sub">
                      Next: {String(summary.next_meeting.title)}<br />
                      {new Date(summary.next_meeting.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
                      {new Date(summary.next_meeting.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                {/* Gmail unread */}
                <div className="dash-week-stat" style={{ borderColor: "#ea4335" }}>
                  <span className="dash-week-icon">📧</span>
                  <span className="dash-week-val">
                    {summary.gmail_unread !== null
                      ? `${summary.gmail_unread}${summary.gmail_has_more ? "+" : ""}`
                      : "—"}
                  </span>
                  <span className="dash-week-label">unread Gmail</span>
                  {summary.gmail_unread === null && (
                    <a href="/connect" className="dash-week-connect">Connect Gmail →</a>
                  )}
                </div>

                {/* Outlook unread */}
                <div className="dash-week-stat" style={{ borderColor: "#0078d4" }}>
                  <span className="dash-week-icon">📨</span>
                  <span className="dash-week-val">
                    {summary.outlook_unread !== null ? summary.outlook_unread : "—"}
                  </span>
                  <span className="dash-week-label">unread Outlook</span>
                  {summary.outlook_unread === null && (
                    <a href="/connect" className="dash-week-connect">Connect Outlook →</a>
                  )}
                </div>
              </div>

              {/* Meeting list */}
              {summary.meetings.length > 0 && (
                <div className="dash-meeting-list">
                  <p className="dash-meeting-list-title">Upcoming meetings (next 14 days)</p>
                  {summary.meetings.slice(0, 8).map((m, i) => (
                    <div key={i} className="dash-meeting-row">
                      <span className="dash-meeting-src">{m.source === "google" ? "📅" : "📆"}</span>
                      <span className="dash-meeting-title">{String(m.title)}</span>
                      <span className="dash-meeting-time">
                        {new Date(m.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
                        {new Date(m.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {summary.meetings_count === null && summary.gmail_unread === null && summary.outlook_unread === null && (
                <div className="dash-how-to" style={{ marginTop: "0.75rem" }}>
                  <p className="dash-how-to-title">No apps connected yet. Here&apos;s how to fix that:</p>
                  <ol className="dash-how-to-steps">
                    <li>Go to <a href="/connect"><strong>Connect Apps</strong></a> in the navigation bar.</li>
                    <li>Click <strong>Connect Gmail</strong> → sign in with Google → come back.</li>
                    <li>Click <strong>Connect Outlook Mail</strong> → sign in with Microsoft → come back.</li>
                    <li>Click <strong>Connect Google Calendar</strong> if you use it.</li>
                    <li>Click <strong>↺ Refresh</strong> on this card.</li>
                  </ol>
                  <a href="/connect" className="dash-action-btn primary" style={{ display: "inline-flex", marginTop: "0.75rem" }}>🔗 Connect Apps</a>
                </div>
              )}
            </>
          )}

          {summary?.error && (
            <div className="dash-week-empty">
              <p>Could not load your data. <button className="dash-week-retry" onClick={() => user && fetchSummary(user.id)}>Try again</button></p>
            </div>
          )}
        </section>
        {/* Inbox + Tasks two-column row */}
        <div className="dash-inbox-tasks-row">

        {/* Inbox */}
        <section className="dash-card dash-col-inbox">
          <div className="dash-inbox-header">
            <h2 className="dash-card-title" style={{ margin: 0 }}>Inbox</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="dash-inbox-tabs">
                {(["all", "gmail", "outlook"] as const).map((t) => (
                  <button
                    key={t}
                    className={`dash-inbox-tab${emailTab === t ? " active" : ""}`}
                    onClick={() => setEmailTab(t)}
                  >
                    {t === "all" ? "All" : t === "gmail" ? "📧 Gmail" : "📨 Outlook"}
                  </button>
                ))}
              </div>
              <button
                className="dash-week-refresh"
                onClick={() => user && fetchEmails(user.id)}
                disabled={emailsLoading}
                title="Refresh inbox"
              >
                {emailsLoading ? "…" : "↺"}
              </button>
            </div>
          </div>

          {emailsLoading && !emails && (
            <div className="dash-week-loading">
              <div className="dash-spinner" style={{ width: 24, height: 24 }} />
              <span>Fetching your emails…</span>
            </div>
          )}

          {!emailsLoading && emails !== null && (() => {
            const filtered = emailTab === "all" ? emails : emails.filter((e) => e.source === emailTab);
            if (filtered.length === 0) return (
              <div className="dash-inbox-empty">
                {emailTab !== "all" && emails.length > 0
                  ? <span>No {emailTab === "gmail" ? "Gmail" : "Outlook"} emails to show.</span>
                  : !emailSources.gmail && !emailSources.outlook
                  ? <span>No connected mail apps. <a href="/connect">Connect Gmail or Outlook →</a></span>
                  : <span>Your inbox is empty.</span>}
              </div>
            );
            return (
              <div className="dash-inbox-list">
                {filtered.map((email) => (
                  <div key={email.id} className={`dash-inbox-row${email.isRead ? " read" : ""}${replyingTo === email.id ? " replying" : ""}${repliedIds.has(email.id) ? " replied" : ""}`}>
                    <button
                      className="dash-inbox-read-dot"
                      title={email.isRead ? "Mark as unread" : "Mark as read"}
                      onClick={() => toggleEmailRead(email)}
                    />
                    <span className="dash-inbox-src">{email.source === "gmail" ? "📧" : "📨"}</span>
                    <div className="dash-inbox-body">
                      <div className="dash-inbox-top">
                        <span className="dash-inbox-from">{email.from.replace(/<.*>/, "").trim() || email.from}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="dash-inbox-date">
                            {email.date ? new Date(email.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </span>
                          {repliedIds.has(email.id) && (
                            <span className="dash-inbox-replied-badge">↩ Replied</span>
                          )}
                          <button
                            className="dash-inbox-reply-btn"
                            title={repliedIds.has(email.id) ? "Reply again" : "Reply"}
                            onClick={() => {
                              if (replyingTo === email.id) { setReplyingTo(null); setReplyText(""); setReplyError(null); }
                              else { setReplyingTo(email.id); setReplyText(""); setReplyError(null); }
                            }}
                          >↩ {repliedIds.has(email.id) ? "Again" : "Reply"}</button>
                        </div>
                      </div>
                      <div className="dash-inbox-subject">{String(email.subject)}</div>
                      <div className="dash-inbox-snippet">{email.snippet}</div>
                      {replyingTo === email.id && (
                        <div className="dash-reply-box">
                          <textarea
                            className="dash-reply-textarea"
                            placeholder={`Reply to ${email.from.replace(/<.*>/, "").trim() || email.from}…`}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={3}
                            autoFocus
                          />
                          {replyError && <div className="dash-reply-error">{replyError}</div>}
                          <div className="dash-reply-actions">
                            <button
                              className="dash-reply-send"
                              onClick={() => sendReply(email)}
                              disabled={replySending || !replyText.trim()}
                            >
                              {replySending ? "Sending…" : "Send ↗"}
                            </button>
                            <button
                              className="dash-reply-cancel"
                              onClick={() => { setReplyingTo(null); setReplyText(""); setReplyError(null); }}
                            >Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {!emailsLoading && emails === null && (
            <div className="dash-inbox-empty">
              <span>Connect Gmail or Outlook to see your inbox. <a href="/connect">Go to Connect Apps →</a></span>
            </div>
          )}
        </section>

        {/* Task Panel */}
        <section className="dash-card dash-col-tasks">
          <div className="dash-tasks-header">
            <h2 className="dash-card-title" style={{ margin: 0 }}>My Tasks</h2>
            <div className="dash-inbox-tabs">
              {(["all", "active", "done"] as const).map((f) => (
                <button
                  key={f}
                  className={`dash-inbox-tab${taskFilter === f ? " active" : ""}`}
                  onClick={() => setTaskFilter(f)}
                >
                  {f === "all" ? "All" : f === "active" ? "Active" : "Done"}
                </button>
              ))}
            </div>
          </div>

          <form
            className="dash-task-form"
            onSubmit={(e) => { e.preventDefault(); addTask(); }}
          >
            <input
              className="dash-task-input"
              placeholder="Add a task…"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
            />
            <button className="dash-task-add" type="submit" disabled={!taskInput.trim()}>Add</button>
          </form>
          {taskError && <p className="dash-task-error">{taskError}</p>}

          <ul className="dash-task-list">
            {tasks
              .filter((t) => taskFilter === "all" ? true : taskFilter === "active" ? !t.completed : t.completed)
              .map((task) => (
                <li key={task.id} className={`dash-task-item${task.completed ? " done" : ""}`}>
                  <input
                    type="checkbox"
                    className="dash-task-check"
                    checked={task.completed}
                    onChange={(e) => toggleTask(task.id, e.target.checked)}
                  />
                  <span className="dash-task-name">{task.name}</span>
                  <button className="dash-task-del" onClick={() => deleteTask(task.id)} title="Delete task">×</button>
                </li>
              ))}
            {tasks.filter((t) => taskFilter === "all" ? true : taskFilter === "active" ? !t.completed : t.completed).length === 0 && (
              <li className="dash-task-empty">
                {taskFilter === "done" ? "No completed tasks yet." : taskFilter === "active" ? "All done! 🎉" : "No tasks yet. Add one above."}
              </li>
            )}
          </ul>
        </section>

        </div>{/* end dash-inbox-tasks-row */}

        {/* Activity History */}
        <section className="dash-card dash-activity-card">
          <h2 className="dash-card-title">Activity History</h2>
          <p className="dash-card-sub">Recent events from your connected apps and workflows.</p>
          {activityLog.length === 0 ? (
            <div className="dash-activity-empty">No activity yet. Refresh your inbox or calendar to get started.</div>
          ) : (
            <ul className="dash-activity-list">
              {activityLog.slice(0, 10).map((entry, i) => (
                <li key={i} className="dash-activity-row">
                  <span className="dash-activity-icon">{entry.icon}</span>
                  <span className="dash-activity-text">{entry.text}</span>
                  <span className="dash-activity-ts">
                    {new Date(entry.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    {new Date(entry.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </>}{/* end overview tab */}

        {/* ── APPS TAB ─────────────────────────────────────────────── */}
        {dashTab === "apps" && <>
        {/* Connected Apps — link / unlink */}
        <section className="dash-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div>
              <h2 className="dash-card-title" style={{ marginBottom: "0.15rem" }}>Your Connected Apps</h2>
              <p className="dash-card-sub" style={{ margin: 0 }}>Connect apps so the AI and workflows can act on your real accounts.</p>
            </div>
          </div>
          <div className="dash-conn-grid">
            {CONNECTABLE_APPS.map((app) => {
              const conn = getConnection(app.composioApp);
              const isConn = !!conn;
              const isConnecting = connectingApp === app.composioApp;
              const isDisconn = disconnectingId === conn?.id;
              return (
                <div key={app.key} className="dash-conn-card" style={{ borderColor: isConn ? app.color + "55" : "#e2e8f0" }}>
                  <div className="dash-conn-card-top">
                    <span className="dash-conn-icon">{app.icon}</span>
                    <div>
                      <div className="dash-conn-label">{app.label}</div>
                      <div className={`dash-conn-status ${isConn ? "connected" : ""}`}>
                        {isConn ? "✓ Connected" : "Not connected"}
                      </div>
                    </div>
                  </div>
                  {isConn ? (
                    <button
                      className="dash-conn-btn disconnect"
                      onClick={() => conn && handleDisconnect(conn.id)}
                      disabled={isDisconn}
                    >
                      {isDisconn ? "Removing…" : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      className="dash-conn-btn connect"
                      style={{ background: app.color }}
                      onClick={() => handleConnect(app.composioApp)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? "Redirecting…" : "Connect"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        </>}{/* end apps tab */}


        {/* ── SETTINGS TAB ─────────────────────────────────────────── */}
        {dashTab === "settings" && <>
        {/* Danger Zone */}
        <section className="dash-card dash-danger-zone">
          <h2 className="dash-card-title" style={{ color: "#dc2626" }}>Danger Zone</h2>
          <p className="dash-card-sub">Permanently delete your account and all associated data. This cannot be undone.</p>
          {deleteError && <p className="dash-danger-error">{deleteError}</p>}
          <button className="dash-danger-btn" onClick={() => setShowDeleteConfirm(true)}>
            Delete My Account
          </button>
        </section>
        </>}{/* end settings tab */}

        {/* ── TRACKER TAB ───────────────────────────────────────────── */}
        {dashTab === "tracker" && user && <>
          {/* This Week — full-width strip */}
          <PlannerTab userId={user.id} view="this-week" />

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
            <PlannerTab userId={user.id} view="charts" />
          </div>

          {/* Weekly Goals + Habit Tracker */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start", marginBottom: "1.5rem" }}>
            <div><PlannerTab userId={user.id} view="goals" /></div>
            <div><HabitsTab  userId={user.id} /></div>
          </div>

          {/* Daily Pulse */}
          <PulseTab userId={user.id} />
        </>}

        {/* ── FINANCE TAB ───────────────────────────────────────────── */}
        {dashTab === "finance" && user && <BudgetTab userId={user.id} />}

      </main>

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              <span className="toast-icon">{t.icon}</span>
              <span className="toast-text">{t.text}</span>
              <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="dash-modal-overlay">
          <div className="dash-modal">
            <h3 className="dash-modal-title">Delete your account?</h3>
            <p className="dash-modal-body">
              This will permanently delete your FlowBoard account, all your messages, and workflow data. <strong>This cannot be undone.</strong>
            </p>
            {deleteError && <p className="dash-danger-error">{deleteError}</p>}
            <div className="dash-modal-actions">
              <button className="dash-modal-cancel" onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }} disabled={deleting}>
                Cancel
              </button>
              <button className="dash-modal-confirm" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="dash-footer">
        <p>© 2026 FlowBoard · <a href="/docs">Documentation</a> · <a href="/">Home</a></p>
      </footer>
    </div>
  );
}
