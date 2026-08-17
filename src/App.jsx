import { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Dumbbell, Mountain, Leaf, Plus, Trash2, Check, ChevronLeft, ChevronRight,
  Sparkles, Flame, Footprints, X, TrendingUp, Loader2, PenLine, RotateCcw, Timer,
  Home, ListChecks, Shuffle,
} from "lucide-react";

/* ------------------------------- storage -------------------------------- */
/* Real browser localStorage — this runs as a standalone deployed app, not
   inside a Claude artifact, so there's no window.storage API here. */

const storage = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return { key, value: raw };
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch {
      return null;
    }
  },
};

/* ---------------------------------- data ---------------------------------- */

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

/** Bump this whenever the default plan's structure or exercise list changes.
 *  On load, a mismatched (or missing) stored version means "this is old
 *  data from before the plan changed" — so it's discarded in favor of the
 *  fresh defaults already in state, instead of silently shadowing them. */
const PLAN_VERSION = 2;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Stable, deterministic id for a plan-template exercise (day + name).
 *  Unlike uid(), this is the same every time the app builds the default
 *  plan, so logged history always finds the exercise it belongs to —
 *  even across a fresh reload before storage has loaded. */
function exId(dayKey, name) {
  return `${dayKey}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function makeDefaultPlan() {
  return {
    mon: {
      type: "strength", title: "Leg Day A", subtitle: "Glutes & hamstrings",
      durationBudget: { warmup: 10, training: 65, cooldown: 15 },
      warmup: [
        "5 min easy bike or brisk walk",
        "Glute bridges — 15 reps",
        "Banded lateral walks — 10 steps/side",
        "Bodyweight RDL — 10 reps",
      ],
      cooldown: [
        "Kneeling hip flexor stretch — 30s/side",
        "Seated hamstring stretch — 30s/side",
        "Figure-4 glute stretch — 30s/side",
        "Child's pose — 45s",
      ],
      exercises: [
        { id: exId("mon", "Romanian Deadlift"), name: "Romanian Deadlift", sets: 4, reps: "8", equipment: "Dumbbells" },
        { id: exId("mon", "Hip Thrust"), name: "Hip Thrust", sets: 4, reps: "10-12", equipment: "Machine" },
        { id: exId("mon", "Cable Pull-Through"), name: "Cable Pull-Through", sets: 3, reps: "12", equipment: "Cable" },
        { id: exId("mon", "Lying Leg Curl"), name: "Lying Leg Curl", sets: 4, reps: "12", equipment: "Machine" },
        { id: exId("mon", "Step-Ups"), name: "Step-Ups", sets: 3, reps: "10 / leg", equipment: "Dumbbells + box" },
        { id: exId("mon", "Hip Abduction"), name: "Hip Abduction", sets: 4, reps: "20", equipment: "Machine" },
        { id: exId("mon", "Hip Adduction"), name: "Hip Adduction", sets: 4, reps: "20", equipment: "Machine (superset w/ abduction)" },
      ],
    },
    tue: {
      type: "strength", title: "Upper Body A", subtitle: "Back, delts & triceps",
      durationBudget: { warmup: 10, training: 65, cooldown: 15 },
      warmup: [
        "5 min arm circles + band pull-aparts",
        "Scapular retractions — 15 reps",
        "Light band external rotations — 12/side",
        "Cat-cow — 10 reps",
      ],
      cooldown: [
        "Cross-body shoulder stretch — 30s/side",
        "Triceps overhead stretch — 30s/side",
        "Doorway chest/shoulder stretch — 30s",
        "Neck & upper-back release — 45s",
      ],
      exercises: [
        { id: exId("tue", "Seated Cable Row"), name: "Seated Cable Row", sets: 4, reps: "10-12", equipment: "Cable" },
        { id: exId("tue", "Single-Arm Dumbbell Row"), name: "Single-Arm Dumbbell Row", sets: 3, reps: "10 / arm", equipment: "Dumbbell" },
        { id: exId("tue", "Lateral Raise"), name: "Lateral Raise", sets: 3, reps: "12-15", equipment: "Dumbbells" },
        { id: exId("tue", "Face Pull"), name: "Face Pull", sets: 3, reps: "15", equipment: "Cable" },
        { id: exId("tue", "Rope Triceps Pushdown"), name: "Rope Triceps Pushdown", sets: 3, reps: "12", equipment: "Cable" },
        { id: exId("tue", "Rear Delt Fly"), name: "Rear Delt Fly", sets: 3, reps: "12-15", equipment: "Dumbbells" },
      ],
    },
    wed: {
      type: "strength", title: "Leg Day B", subtitle: "Quads & glutes",
      durationBudget: { warmup: 10, training: 65, cooldown: 15 },
      warmup: [
        "5 min easy bike or brisk walk",
        "Bodyweight squats to comfortable depth — 10 reps",
        "Glute bridges — 15 reps",
        "Leg swings — 10/side",
      ],
      cooldown: [
        "Standing or lying quad stretch — 30s/side",
        "Seated hamstring stretch — 30s/side",
        "Hip flexor stretch — 30s/side",
        "Child's pose — 45s",
      ],
      exercises: [
        { id: exId("wed", "Leg Press"), name: "Leg Press", sets: 4, reps: "10-12", equipment: "Machine" },
        { id: exId("wed", "Quad Extension"), name: "Quad Extension", sets: 3, reps: "12-15", equipment: "Machine" },
        { id: exId("wed", "Seated Leg Curl"), name: "Seated Leg Curl", sets: 3, reps: "12", equipment: "Machine" },
        { id: exId("wed", "Glute Kickback"), name: "Glute Kickback", sets: 3, reps: "15 / leg", equipment: "Cable" },
        { id: exId("wed", "Hip Abduction"), name: "Hip Abduction", sets: 4, reps: "20", equipment: "Machine" },
        { id: exId("wed", "Hip Adduction"), name: "Hip Adduction", sets: 4, reps: "20", equipment: "Machine (superset w/ abduction)" },
      ],
    },
    thu: {
      type: "strength", title: "Upper Body B", subtitle: "Posture & arms",
      durationBudget: { warmup: 10, training: 65, cooldown: 15 },
      warmup: [
        "5 min arm circles + band pull-aparts",
        "Band rows — 15 reps",
        "Wall slides — 10 reps",
        "Wrist & forearm mobility — 30s",
      ],
      cooldown: [
        "Biceps doorway stretch — 30s/side",
        "Lat stretch — 30s/side",
        "Upper trap stretch — 30s/side",
        "Deep breathing reset — 45s",
      ],
      exercises: [
        { id: exId("thu", "Lat Pulldown"), name: "Lat Pulldown", sets: 4, reps: "10-12", equipment: "Cable" },
        { id: exId("thu", "Chest-Supported Dumbbell Row"), name: "Chest-Supported Dumbbell Row", sets: 3, reps: "10-12", equipment: "Dumbbells" },
        { id: exId("thu", "Overhead Triceps Extension"), name: "Overhead Triceps Extension", sets: 3, reps: "12", equipment: "Dumbbell" },
        { id: exId("thu", "Cable Lateral Raise"), name: "Cable Lateral Raise", sets: 3, reps: "15", equipment: "Cable" },
        { id: exId("thu", "Face Pull"), name: "Face Pull", sets: 3, reps: "15", equipment: "Cable" },
        { id: exId("thu", "Bicep Curl"), name: "Bicep Curl", sets: 3, reps: "12", equipment: "Dumbbells" },
      ],
    },
    fri: {
      type: "strength", title: "Leg Day C", subtitle: "Full posterior chain",
      durationBudget: { warmup: 10, training: 65, cooldown: 15 },
      warmup: [
        "5 min easy bike or brisk walk",
        "Glute bridges — 15 reps",
        "Bodyweight RDL — 10 reps",
        "Banded lateral walks — 10 steps/side",
      ],
      cooldown: [
        "Seated hamstring stretch — 30s/side",
        "Figure-4 glute stretch — 30s/side",
        "Calf stretch — 30s/side",
        "Child's pose — 45s",
      ],
      exercises: [
        { id: exId("fri", "Romanian Deadlift"), name: "Romanian Deadlift", sets: 4, reps: "8", equipment: "Dumbbells" },
        { id: exId("fri", "Leg Press"), name: "Leg Press", sets: 3, reps: "12", equipment: "Machine" },
        { id: exId("fri", "Lying Leg Curl"), name: "Lying Leg Curl", sets: 4, reps: "12", equipment: "Machine" },
        { id: exId("fri", "Cable Pull-Through"), name: "Cable Pull-Through", sets: 3, reps: "12", equipment: "Cable" },
        { id: exId("fri", "Glute Kickback"), name: "Glute Kickback", sets: 3, reps: "15 / leg", equipment: "Cable" },
        { id: exId("fri", "Hip Abduction"), name: "Hip Abduction", sets: 3, reps: "20", equipment: "Machine" },
        { id: exId("fri", "Hip Adduction"), name: "Hip Adduction", sets: 3, reps: "20", equipment: "Machine (superset w/ abduction)" },
      ],
    },
    sat: {
      type: "outdoor", title: "Mountain Route", subtitle: "Long hike / hiking prep",
      warmup: [
        "Ankle circles — 10/side",
        "Leg swings, front-back & side-side — 10/side",
        "5 min brisk walk to ease in",
      ],
      cooldown: [
        "Standing quad stretch — 30s/side",
        "Calf stretch on an incline — 30s/side",
        "Seated forward fold — 45s",
      ],
      exercises: [],
    },
    sun: {
      type: "rest", title: "Active Recovery", subtitle: "Stretch & mobility",
      warmup: ["2 min gentle joint circles"],
      cooldown: [
        "Cat-cow — 10 reps",
        "World's greatest stretch — 5/side",
        "90/90 hip switches — 8/side",
        "Thread the needle — 6/side",
      ],
      exercises: [],
    },
  };
}

function emptyLog() {
  return {
    overrideDayType: null,
    sets: {},
    warmupDone: [],
    cooldownDone: [],
    cardio: { type: "", durationMin: "", steps: "", distanceKm: "" },
    outdoor: { distanceKm: "", elevationM: "", durationMin: "", notes: "" },
    activities: [],
    recovery: { minutes: "" },
    checkin: { energy: 3, soreness: 3, mood: 3, sleepHours: "", notes: "" },
  };
}

/** Seeds the very first run with weights Aitana has already logged in real
 *  sessions, so "last time" isn't empty on day one. Once she logs anything
 *  new in the app, her own entries take over from here. */
function makeSeedLogs(plan) {
  const logs = {};
  const idFor = (dayKey, name) => plan[dayKey]?.exercises.find((e) => e.name === name)?.id;
  const put = (date, dayKey, name, weight, reps) => {
    const id = idFor(dayKey, name);
    if (!id) return;
    if (!logs[date]) logs[date] = emptyLog();
    logs[date].sets[id] = [{ weight: String(weight), reps: reps !== "" ? String(reps) : "" }];
  };

  put("2026-07-28", "tue", "Lateral Raise", 4, "");
  put("2026-07-28", "tue", "Face Pull", 12.5, "");
  put("2026-07-28", "tue", "Rope Triceps Pushdown", 10, "");
  put("2026-07-29", "mon", "Hip Thrust", 35, "10-12");
  put("2026-08-13", "wed", "Hip Abduction", 47.5, "20");
  put("2026-08-13", "wed", "Glute Kickback", 16.5, "15");
  put("2026-08-13", "wed", "Quad Extension", 29.5, "12-15");
  put("2026-08-15", "mon", "Romanian Deadlift", 16, "");
  put("2026-08-15", "mon", "Lying Leg Curl", 32, "8");
  put("2026-08-15", "wed", "Leg Press", 32, "");

  return logs;
}

/* --------------------------------- helpers --------------------------------- */

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function parseISODate(s) {
  return new Date(`${s}T00:00:00`);
}
function getWeekDates(base) {
  const d = new Date(base);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    out.push(dt);
  }
  return out;
}
function dayKeyFromDate(d) {
  return DAY_KEYS[(d.getDay() + 6) % 7];
}
function last14Days() {
  const arr = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(toISODate(d));
  }
  return arr;
}
function isLogged(log) {
  if (!log) return false;
  const hasSets = Object.values(log.sets || {}).some((arr) => arr.some((s) => s.weight || s.reps));
  const hasCardio = log.cardio && (log.cardio.durationMin || log.cardio.steps || log.cardio.distanceKm);
  const hasOutdoor = log.outdoor && (log.outdoor.distanceKm || log.outdoor.durationMin);
  const hasActivities = log.activities && log.activities.length > 0;
  const hasCooldown = log.cooldownDone && log.cooldownDone.length > 0;
  return Boolean(hasSets || hasCardio || hasOutdoor || hasActivities || hasCooldown);
}
function dayIcon(type, size = 16) {
  if (type === "strength") return <Dumbbell size={size} />;
  if (type === "outdoor") return <Mountain size={size} />;
  return <Leaf size={size} />;
}
function buildIdNameMap(plan) {
  const map = {};
  Object.values(plan).forEach((day) => (day.exercises || []).forEach((ex) => (map[ex.id] = ex.name)));
  return map;
}
function uniqueExerciseNames(plan) {
  const set = new Set();
  Object.values(plan).forEach((day) => (day.exercises || []).forEach((ex) => set.add(ex.name)));
  return Array.from(set);
}
function exerciseHistory(plan, logs, name) {
  const idNameMap = buildIdNameMap(plan);
  const points = [];
  Object.entries(logs)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, log]) => {
      let topWeight = 0;
      let hasData = false;
      Object.entries(log.sets || {}).forEach(([exId, setArr]) => {
        if (idNameMap[exId] === name) {
          setArr.forEach((s) => {
            const w = parseFloat(s.weight);
            if (!isNaN(w) && w > topWeight) {
              topWeight = w;
              hasData = true;
            }
          });
        }
      });
      if (hasData) points.push({ date, weight: topWeight });
    });
  return points;
}
/** Full detail (every set) of the most recent session for this exercise
 *  strictly before `beforeDate` — used to show a live "last time" reference
 *  next to today's inputs. */
function lastSessionDetail(plan, logs, name, beforeDate) {
  const idNameMap = buildIdNameMap(plan);
  let best = null;
  Object.entries(logs)
    .filter(([date]) => date < beforeDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, log]) => {
      Object.entries(log.sets || {}).forEach(([exId, setArr]) => {
        if (idNameMap[exId] === name) {
          const hasData = setArr.some((s) => s.weight || s.reps);
          if (hasData) best = { date, sets: setArr };
        }
      });
    });
  return best;
}
function computeQuickTips(plan, logs) {
  const tips = [];
  uniqueExerciseNames(plan).forEach((name) => {
    const hist = exerciseHistory(plan, logs, name);
    if (hist.length >= 2) {
      const last = hist[hist.length - 1];
      const prev = hist[hist.length - 2];
      if (last.weight > prev.weight) {
        tips.push({ type: "up", text: `${name}: up from ${prev.weight}kg to ${last.weight}kg — try holding that next time too.` });
      } else if (last.weight === prev.weight) {
        tips.push({ type: "steady", text: `${name}: steady at ${last.weight}kg for two sessions — add a small jump or an extra rep next time.` });
      } else {
        tips.push({ type: "down", text: `${name}: lighter than last time (${last.weight}kg vs ${prev.weight}kg) — fine if energy was low, worth a note.` });
      }
    }
  });
  return tips.slice(0, 6);
}
function computeStreak(logs) {
  let streak = 0;
  const d = new Date();
  for (;;) {
    const iso = toISODate(d);
    if (isLogged(logs[iso])) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}
function recentAvgSoreness(logs) {
  const dates = last14Days().slice(-5);
  const vals = dates.map((d) => logs[d]?.checkin?.soreness).filter((v) => typeof v === "number");
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* --------------------------------- API call -------------------------------- */
/* Calls our own /api/trainer serverless function (see /api/trainer.js) so the
   Anthropic API key stays server-side. Requires ANTHROPIC_API_KEY to be set
   as an environment variable on Vercel — see the README. */

async function fetchTrainerFeedback(plan, logs) {
  const recentDates = last14Days();
  const recentLogs = {};
  recentDates.forEach((d) => {
    if (logs[d]) recentLogs[d] = logs[d];
  });

  const context = {
    goals: [
      "Lose fat while maintaining or gaining muscle, become more toned",
      "Priority on glutes and legs development",
      "Upper body emphasis on posture, back, delts and triceps rather than chest",
      "Building strength and endurance for mountain hiking",
    ],
    constraints: [
      "Avoids standing squats, lunges and Bulgarian split squats due to an ankle dorsiflexion issue",
      "Comfortable with relatively high training volume",
      "Strength sessions are structured as 90 minutes: warm-up, training, cooldown/mobility",
    ],
    currentPlan: Object.fromEntries(
      Object.entries(plan).map(([k, v]) => [k, { title: v.title, type: v.type, exercises: (v.exercises || []).map((e) => e.name) }])
    ),
    recentLogsLast14Days: recentLogs,
  };

  const prompt = `You are Aitana's personal trainer. Using her goals, constraints and recent training logs (JSON below), give a short weekly check-in.
Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape:
{"summary": "1-2 sentence read on how the week is going", "adjustments": ["specific suggestion", "specific suggestion", "specific suggestion"], "focus": "one sentence on what to prioritize next week", "encouragement": "one warm, specific, non-generic sentence"}

Context:
${JSON.stringify(context)}`;

  const response = await fetch("/api/trainer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed (${response.status})`);
  }
  const data = await response.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

/* --------------------------------- app --------------------------------- */

export default function TrainingTracker() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(makeDefaultPlan);
  const [logs, setLogs] = useState(() => makeSeedLogs(plan));
  const [tab, setTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [trainerFeedback, setTrainerFeedback] = useState(null);
  const [trainerLoading, setTrainerLoading] = useState(false);
  const [trainerError, setTrainerError] = useState(null);
  const didInit = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const versionRes = await storage.get("planVersion").catch(() => null);
        const storedVersion = versionRes?.value ? Number(versionRes.value) : null;

        if (storedVersion === PLAN_VERSION) {
          const [planRes, logsRes, fbRes] = await Promise.allSettled([
            storage.get("plan"),
            storage.get("logs"),
            storage.get("trainerFeedback"),
          ]);
          if (planRes.status === "fulfilled" && planRes.value) setPlan(JSON.parse(planRes.value.value));
          if (logsRes.status === "fulfilled" && logsRes.value) setLogs(JSON.parse(logsRes.value.value));
          if (fbRes.status === "fulfilled" && fbRes.value) setTrainerFeedback(JSON.parse(fbRes.value.value));
        } else {
          // Stale (or first ever) run — keep the freshly generated plan and
          // seeded logs already in state, and stamp the current version so
          // this doesn't get re-discarded on the next load.
          await storage.set("planVersion", String(PLAN_VERSION)).catch(() => {});
        }
      } catch (e) {
        console.error("load error", e);
      } finally {
        setLoading(false);
        didInit.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!didInit.current) return;
    const t = setTimeout(() => {
      storage.set("plan", JSON.stringify(plan)).catch((e) => console.error(e));
    }, 350);
    return () => clearTimeout(t);
  }, [plan]);

  useEffect(() => {
    if (!didInit.current) return;
    const t = setTimeout(() => {
      storage.set("logs", JSON.stringify(logs)).catch((e) => console.error(e));
    }, 350);
    return () => clearTimeout(t);
  }, [logs]);

  const weekDates = useMemo(() => getWeekDates(weekAnchor), [weekAnchor]);
  const getLog = (date) => logs[date] || emptyLog();
  const updateLog = (date, updater) => {
    setLogs((prev) => {
      const current = prev[date] || emptyLog();
      return { ...prev, [date]: updater(current) };
    });
  };

  const log = getLog(selectedDate);
  const nativeDayKey = dayKeyFromDate(parseISODate(selectedDate));
  const effectiveDayKey = log.overrideDayType || nativeDayKey;
  const template = plan[effectiveDayKey];

  const swapExercise = (dayKey, exerciseId) => {
    setPlan((prev) => {
      const day = prev[dayKey];
      const idx = day.exercises.findIndex((e) => e.id === exerciseId);
      if (idx === -1) return prev;
      const current = day.exercises[idx];
      const otherNames = day.exercises.filter((_, i) => i !== idx).map((e) => e.name);
      const alt = pickAlternative(current.name, otherNames);
      if (!alt) return prev;
      const exercises = [...day.exercises];
      exercises[idx] = { ...current, id: exId(dayKey, alt.name), name: alt.name, equipment: alt.equipment };
      return { ...prev, [dayKey]: { ...day, exercises } };
    });
  };

  const handleAskTrainer = async () => {
    setTrainerLoading(true);
    setTrainerError(null);
    try {
      const result = await fetchTrainerFeedback(plan, logs);
      const payload = { ...result, generatedAt: new Date().toISOString() };
      setTrainerFeedback(payload);
      storage.set("trainerFeedback", JSON.stringify(payload)).catch(() => {});
    } catch (e) {
      console.error(e);
      setTrainerError(e.message || "Couldn't reach your trainer just now — try again in a moment.");
    } finally {
      setTrainerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="tt-root min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
          <Loader2 className="animate-spin" size={18} />
          <span className="font-mono text-sm">loading your training space…</span>
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 19 ? "Good afternoon" : "Good evening";

  return (
    <div className="tt-root min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10" style={{ paddingBottom: "6.5rem" }}>
        <header className="mb-7">
          <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--moss)" }}>
            {greeting}, Aitana
          </p>
          <h1 className="font-display text-3xl sm:text-4xl" style={{ fontWeight: 600 }}>
            Your training trail
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--ink-soft)" }}>
            Build muscle, lose fat, get toned — one logged day at a time.
          </p>
        </header>

        <WeekRibbon
          weekDates={weekDates}
          plan={plan}
          logs={logs}
          selectedDate={selectedDate}
          onSelect={(d) => { setSelectedDate(d); setTab("today"); }}
          onPrevWeek={() => setWeekAnchor((d) => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; })}
          onNextWeek={() => setWeekAnchor((d) => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; })}
        />

        {tab === "today" && (
          <TodayView
            date={selectedDate}
            plan={plan}
            template={template}
            effectiveDayKey={effectiveDayKey}
            nativeDayKey={nativeDayKey}
            log={log}
            logs={logs}
            updateLog={(fn) => updateLog(selectedDate, fn)}
            onSwapExercise={(exerciseId) => swapExercise(effectiveDayKey, exerciseId)}
          />
        )}
        {tab === "progress" && <ProgressView plan={plan} logs={logs} />}
        {tab === "trainer" && (
          <TrainerView
            plan={plan}
            logs={logs}
            feedback={trainerFeedback}
            loading={trainerLoading}
            error={trainerError}
            onAsk={handleAskTrainer}
          />
        )}
        {tab === "plan" && <PlanView plan={plan} setPlan={setPlan} onReset={() => setPlan(makeDefaultPlan())} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

/* ------------------------------ week ribbon ------------------------------ */

function WeekRibbon({ weekDates, plan, logs, selectedDate, onSelect, onPrevWeek, onNextWeek }) {
  const today = toISODate(new Date());
  return (
    <div className="tt-card px-4 py-5 sm:px-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevWeek} className="tt-btn-ghost rounded-full p-1.5" aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
          {weekDates[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {weekDates[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
        <button onClick={onNextWeek} className="tt-btn-ghost rounded-full p-1.5" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex items-start justify-between gap-1">
        {weekDates.map((d) => {
          const iso = toISODate(d);
          const dayKey = dayKeyFromDate(d);
          const dayLog = logs[iso];
          const overrideKey = dayLog?.overrideDayType;
          const effKey = overrideKey || dayKey;
          const t = plan[effKey];
          const logged = isLogged(dayLog);
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className="flex flex-col items-center gap-2 flex-1"
            >
              <span
                className="rounded-full flex items-center justify-center"
                style={{
                  width: 36, height: 36,
                  background: logged ? "var(--moss)" : isSelected ? "var(--surface)" : "var(--surface-2)",
                  color: logged ? "#F6F5EF" : "var(--ink-soft)",
                  boxShadow: isSelected ? "var(--shadow-card)" : "none",
                  border: isSelected ? "1.5px solid var(--clay)" : isToday ? "1.5px solid var(--moss)" : "1px solid transparent",
                }}
              >
                {dayIcon(t?.type, 15)}
              </span>
              <span className="font-mono text-[11px]" style={{ color: isSelected ? "var(--ink)" : "var(--ink-soft)", fontWeight: isSelected ? 600 : 400 }}>
                {DAY_LABELS[dayKey]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- bottom nav ------------------------------- */

function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: "today", label: "Today", icon: Home },
    { id: "progress", label: "Progress", icon: TrendingUp },
    { id: "trainer", label: "Trainer", icon: Sparkles },
    { id: "plan", label: "Plan", icon: ListChecks },
  ];
  return (
    <nav className="tt-bottom-nav">
      <div className="tt-bottom-nav-inner">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="tt-nav-item"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
              <span className="tt-nav-label">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* -------------------------------- today view -------------------------------- */

function TodayView({ date, plan, template, effectiveDayKey, nativeDayKey, log, logs, updateLog, onSwapExercise }) {
  const dateObj = parseISODate(date);

  const updateSet = (exId, idx, field, value) => {
    updateLog((cur) => {
      const arr = cur.sets[exId] ? [...cur.sets[exId]] : [];
      while (arr.length <= idx) arr.push({ weight: "", reps: "" });
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...cur, sets: { ...cur.sets, [exId]: arr } };
    });
  };

  const setOverride = (key) => {
    updateLog((cur) => ({ ...cur, overrideDayType: key === nativeDayKey ? null : key }));
  };

  const toggleWarmup = (idx) => {
    updateLog((cur) => {
      const has = cur.warmupDone.includes(idx);
      return { ...cur, warmupDone: has ? cur.warmupDone.filter((i) => i !== idx) : [...cur.warmupDone, idx] };
    });
  };
  const toggleCooldown = (idx) => {
    updateLog((cur) => {
      const has = cur.cooldownDone.includes(idx);
      return { ...cur, cooldownDone: has ? cur.cooldownDone.filter((i) => i !== idx) : [...cur.cooldownDone, idx] };
    });
  };

  const addActivity = () => {
    updateLog((cur) => ({
      ...cur,
      activities: [...cur.activities, { id: uid(), name: "", durationMin: "" }],
    }));
  };
  const updateActivity = (id, field, value) => {
    updateLog((cur) => ({
      ...cur,
      activities: cur.activities.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    }));
  };
  const removeActivity = (id) => {
    updateLog((cur) => ({ ...cur, activities: cur.activities.filter((a) => a.id !== id) }));
  };

  const budget = template?.durationBudget;
  const totalBudget = budget ? budget.warmup + budget.training + budget.cooldown : null;

  return (
    <div className="space-y-5">
      <div className="tt-card p-5 sm:p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "var(--moss)" }}>
              {dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h2 className="font-display text-2xl" style={{ fontWeight: 600 }}>{template?.title}</h2>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{template?.subtitle}</p>
          </div>
          <select
            value={effectiveDayKey}
            onChange={(e) => setOverride(e.target.value)}
            className="tt-input text-xs px-3 py-2"
          >
            {DAY_KEYS.map((k) => (
              <option key={k} value={k}>{plan[k].title}{k === nativeDayKey ? " (planned)" : ""}</option>
            ))}
          </select>
        </div>
        {log.overrideDayType && (
          <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--clay)" }}>
            <PenLine size={12} /> Swapped from your planned {plan[nativeDayKey].title} — flexibility is the point.
          </p>
        )}
        {budget && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Timer size={14} style={{ color: "var(--moss)" }} />
            <span className="tt-inset rounded-full px-3 py-1 text-xs font-mono">Warm-up {budget.warmup}'</span>
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>→</span>
            <span className="tt-inset rounded-full px-3 py-1 text-xs font-mono">Training {budget.training}'</span>
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>→</span>
            <span className="tt-inset rounded-full px-3 py-1 text-xs font-mono">Mobility {budget.cooldown}'</span>
            <span className="text-xs font-mono ml-1" style={{ color: "var(--moss)" }}>= {totalBudget}' total</span>
          </div>
        )}
      </div>

      {template?.warmup?.length > 0 && (
        <ChecklistCard
          title="Warm-up & activation"
          icon={<Flame size={17} style={{ color: "var(--gold)" }} />}
          items={template.warmup}
          doneIndices={log.warmupDone}
          onToggle={toggleWarmup}
        />
      )}

      {template?.type === "strength" && (
        <div className="space-y-4">
          {template.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              log={log}
              onUpdateSet={updateSet}
              lastDetail={lastSessionDetail(plan, logs, ex.name, date)}
              onSwap={() => onSwapExercise(ex.id)}
            />
          ))}
        </div>
      )}

      {template?.type === "outdoor" && (
        <div className="tt-card p-5 sm:p-6">
          <h3 className="font-display text-lg mb-3" style={{ fontWeight: 600 }}>Route details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Distance (km)">
              <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={log.outdoor.distanceKm}
                onChange={(e) => updateLog((cur) => ({ ...cur, outdoor: { ...cur.outdoor, distanceKm: e.target.value } }))} />
            </Field>
            <Field label="Elevation (m)">
              <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={log.outdoor.elevationM}
                onChange={(e) => updateLog((cur) => ({ ...cur, outdoor: { ...cur.outdoor, elevationM: e.target.value } }))} />
            </Field>
            <Field label="Duration (min)">
              <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={log.outdoor.durationMin}
                onChange={(e) => updateLog((cur) => ({ ...cur, outdoor: { ...cur.outdoor, durationMin: e.target.value } }))} />
            </Field>
          </div>
          <Field label="Notes" className="mt-3">
            <textarea className="tt-input w-full px-3 py-2 text-sm" rows={2} value={log.outdoor.notes}
              onChange={(e) => updateLog((cur) => ({ ...cur, outdoor: { ...cur.outdoor, notes: e.target.value } }))} />
          </Field>
        </div>
      )}

      {template?.type === "rest" && (
        <div className="tt-card p-5 sm:p-6 text-sm" style={{ color: "var(--ink-soft)" }}>
          Recovery day — work through the mobility flow below and log how you're feeling. Your body adapts on days like this too.
        </div>
      )}

      {/* Cardio, always available */}
      <div className="tt-card p-5 sm:p-6">
        <h3 className="font-display text-lg mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
          <Footprints size={17} style={{ color: "var(--moss)" }} /> Cardio & steps
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Type">
            <select className="tt-input w-full px-3 py-2 text-sm" value={log.cardio.type}
              onChange={(e) => updateLog((cur) => ({ ...cur, cardio: { ...cur.cardio, type: e.target.value } }))}>
              <option value="">—</option>
              <option>Spin</option>
              <option>Running</option>
              <option>Walk</option>
              <option>Bike</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Duration (min)">
            <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={log.cardio.durationMin}
              onChange={(e) => updateLog((cur) => ({ ...cur, cardio: { ...cur.cardio, durationMin: e.target.value } }))} />
          </Field>
          <Field label="Steps">
            <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={log.cardio.steps}
              onChange={(e) => updateLog((cur) => ({ ...cur, cardio: { ...cur.cardio, steps: e.target.value } }))} />
          </Field>
          <Field label="Distance (km)">
            <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={log.cardio.distanceKm}
              onChange={(e) => updateLog((cur) => ({ ...cur, cardio: { ...cur.cardio, distanceKm: e.target.value } }))} />
          </Field>
        </div>
      </div>

      {/* Extra activities */}
      <div className="tt-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg flex items-center gap-2" style={{ fontWeight: 600 }}>
            <Flame size={17} style={{ color: "var(--clay)" }} /> Extra classes / activities
          </h3>
          <button onClick={addActivity} className="tt-btn-ghost rounded-full p-1.5"><Plus size={15} /></button>
        </div>
        {log.activities.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Nothing extra today — add a class, a walk, anything else.</p>}
        <div className="space-y-2">
          {log.activities.map((a) => (
            <div key={a.id} className="flex gap-2 items-center">
              <input className="tt-input flex-1 px-3 py-2 text-sm" placeholder="e.g. Yoga class" value={a.name}
                onChange={(e) => updateActivity(a.id, "name", e.target.value)} />
              <input type="number" className="tt-input w-24 px-3 py-2 text-sm" placeholder="min" value={a.durationMin}
                onChange={(e) => updateActivity(a.id, "durationMin", e.target.value)} />
              <button onClick={() => removeActivity(a.id)} className="tt-btn-ghost rounded-full p-1.5"><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Cooldown */}
      {template?.cooldown?.length > 0 && (
        <ChecklistCard
          title="Cooldown & mobility"
          icon={<Leaf size={17} style={{ color: "var(--moss)" }} />}
          items={template.cooldown}
          doneIndices={log.cooldownDone}
          onToggle={toggleCooldown}
          footer={
            <Field label="Total minutes stretched" className="mt-3">
              <input type="number" className="tt-input w-28 px-3 py-2 text-sm" value={log.recovery.minutes}
                onChange={(e) => updateLog((cur) => ({ ...cur, recovery: { ...cur.recovery, minutes: e.target.value } }))} />
            </Field>
          }
        />
      )}

      {/* Check-in */}
      <div className="tt-card p-5 sm:p-6">
        <h3 className="font-display text-lg mb-4" style={{ fontWeight: 600 }}>Daily check-in</h3>
        <div className="space-y-4">
          <Slider label="Energy" value={log.checkin.energy} onChange={(v) => updateLog((cur) => ({ ...cur, checkin: { ...cur.checkin, energy: v } }))} />
          <Slider label="Soreness" value={log.checkin.soreness} onChange={(v) => updateLog((cur) => ({ ...cur, checkin: { ...cur.checkin, soreness: v } }))} />
          <Slider label="Mood" value={log.checkin.mood} onChange={(v) => updateLog((cur) => ({ ...cur, checkin: { ...cur.checkin, mood: v } }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sleep (hours)">
              <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={log.checkin.sleepHours}
                onChange={(e) => updateLog((cur) => ({ ...cur, checkin: { ...cur.checkin, sleepHours: e.target.value } }))} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="tt-input w-full px-3 py-2 text-sm" rows={2} value={log.checkin.notes}
              onChange={(e) => updateLog((cur) => ({ ...cur, checkin: { ...cur.checkin, notes: e.target.value } }))} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ChecklistCard({ title, icon, items, doneIndices, onToggle, footer }) {
  return (
    <div className="tt-card p-5 sm:p-6">
      <h3 className="font-display text-lg mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
        {icon} {title}
      </h3>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const done = doneIndices.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => onToggle(idx)}
              className="w-full text-left flex items-center gap-3 rounded-full px-4 py-3 text-sm tt-row"
              style={{ opacity: done ? 0.55 : 1 }}
            >
              <span
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 21, height: 21,
                  background: done ? "var(--moss)" : "var(--surface-2)",
                  border: done ? "none" : "1px solid rgba(33,40,31,0.1)",
                  color: "#F6F5EF",
                }}
              >
                {done && <Check size={13} />}
              </span>
              <span style={{ textDecoration: done ? "line-through" : "none" }}>{item}</span>
            </button>
          );
        })}
      </div>
      {footer}
    </div>
  );
}

/** Trainer-suggested starting points for exercises with no logged history
 *  yet — calibrated against Aitana's actual known numbers (RDL 16kg, hip
 *  thrust 35kg, hip abduction 47.5kg, lateral raise 4kg, etc.), not generic
 *  defaults. Shown only until she logs the exercise for real, at which
 *  point her own data takes over. */
const SUGGESTED_STARTS = {
  "Seated Cable Row": { weight: 20, reps: "10-12" },
  "Lat Pulldown": { weight: 20, reps: "10-12" },
  "Overhead Triceps Extension": { weight: 9, reps: "12" },
  "Cable Lateral Raise": { weight: 3, reps: "15" },
  "Bicep Curl": { weight: 8, reps: "12" },
  "Rear Delt Fly": { weight: 4, reps: "12-15" },
  "Single-Arm Dumbbell Row": { weight: 13, reps: "10" },
  "Chest-Supported Dumbbell Row": { weight: 11, reps: "10-12" },
  "Cable Pull-Through": { weight: 18, reps: "12" },
  "Step-Ups": { weight: 8, reps: "10" },
  "Hip Adduction": { weight: 45, reps: "20" },
  "Seated Leg Curl": { weight: 29, reps: "12" },
};

/** Interchangeable exercise groups for the shuffle button — grouped by
 *  movement pattern and primary muscle so a swap is a fair substitute, not
 *  just a random different exercise. Squats, lunges and split squats are
 *  deliberately excluded from every group (ankle dorsiflexion constraint). */
const EXERCISE_GROUPS = [
  [
    { name: "Romanian Deadlift", equipment: "Dumbbells" },
    { name: "Single-Leg Romanian Deadlift", equipment: "Dumbbell" },
    { name: "Cable Pull-Through", equipment: "Cable" },
    { name: "Good Morning", equipment: "Machine" },
  ],
  [
    { name: "Lying Leg Curl", equipment: "Machine" },
    { name: "Seated Leg Curl", equipment: "Machine" },
    { name: "Single-Leg Leg Curl", equipment: "Machine" },
    { name: "Assisted Nordic Curl", equipment: "Machine" },
  ],
  [
    { name: "Hip Thrust", equipment: "Machine" },
    { name: "Barbell Glute Bridge", equipment: "Barbell" },
    { name: "Single-Leg Hip Thrust", equipment: "Dumbbell" },
    { name: "Smith Machine Hip Thrust", equipment: "Smith machine" },
  ],
  [
    { name: "Glute Kickback", equipment: "Cable" },
    { name: "Cable Donkey Kick", equipment: "Cable" },
    { name: "Reverse Hyperextension", equipment: "Machine" },
    { name: "Standing Cable Kickback", equipment: "Cable" },
  ],
  [
    { name: "Leg Press", equipment: "Machine" },
    { name: "Single-Leg Leg Press", equipment: "Machine" },
    { name: "Vertical Leg Press", equipment: "Machine" },
  ],
  [
    { name: "Quad Extension", equipment: "Machine" },
    { name: "Single-Leg Quad Extension", equipment: "Machine" },
  ],
  [
    { name: "Step-Ups", equipment: "Dumbbells + box" },
    { name: "Box Step-Overs", equipment: "Dumbbells + box" },
    { name: "Reverse Step-Down", equipment: "Box" },
  ],
  [
    { name: "Hip Abduction", equipment: "Machine" },
    { name: "Standing Cable Hip Abduction", equipment: "Cable" },
    { name: "Banded Side-Lying Hip Abduction", equipment: "Band" },
  ],
  [
    { name: "Hip Adduction", equipment: "Machine" },
    { name: "Standing Cable Hip Adduction", equipment: "Cable" },
    { name: "Seated Adductor Squeeze", equipment: "Machine" },
  ],
  [
    { name: "Seated Cable Row", equipment: "Cable" },
    { name: "Chest-Supported Dumbbell Row", equipment: "Dumbbells" },
    { name: "Machine Row", equipment: "Machine" },
    { name: "T-Bar Row", equipment: "Machine" },
  ],
  [
    { name: "Single-Arm Dumbbell Row", equipment: "Dumbbell" },
    { name: "Single-Arm Cable Row", equipment: "Cable" },
    { name: "Single-Arm Machine Row", equipment: "Machine" },
  ],
  [
    { name: "Lat Pulldown", equipment: "Cable" },
    { name: "Assisted Pull-Up", equipment: "Machine" },
    { name: "Straight-Arm Pulldown", equipment: "Cable" },
  ],
  [
    { name: "Lateral Raise", equipment: "Dumbbells" },
    { name: "Cable Lateral Raise", equipment: "Cable" },
    { name: "Machine Lateral Raise", equipment: "Machine" },
    { name: "Lean-Away Cable Lateral Raise", equipment: "Cable" },
  ],
  [
    { name: "Rear Delt Fly", equipment: "Dumbbells" },
    { name: "Reverse Pec Deck", equipment: "Machine" },
    { name: "Bent-Over Cable Rear Delt Fly", equipment: "Cable" },
  ],
  [
    { name: "Face Pull", equipment: "Cable" },
    { name: "Band Pull-Apart", equipment: "Band" },
    { name: "Reverse Fly Machine", equipment: "Machine" },
  ],
  [
    { name: "Rope Triceps Pushdown", equipment: "Cable" },
    { name: "Straight-Bar Pushdown", equipment: "Cable" },
    { name: "Single-Arm Cable Pushdown", equipment: "Cable" },
  ],
  [
    { name: "Overhead Triceps Extension", equipment: "Dumbbell" },
    { name: "Cable Overhead Extension", equipment: "Cable" },
    { name: "EZ-Bar Overhead Extension", equipment: "EZ-bar" },
  ],
  [
    { name: "Bicep Curl", equipment: "Dumbbells" },
    { name: "Hammer Curl", equipment: "Dumbbells" },
    { name: "Cable Curl", equipment: "Cable" },
    { name: "EZ-Bar Curl", equipment: "EZ-bar" },
  ],
];

function findExerciseGroup(name) {
  return EXERCISE_GROUPS.find((group) => group.some((e) => e.name.toLowerCase() === name.toLowerCase())) || null;
}

/** Picks a random same-group alternative, steering away from exercises
 *  already scheduled elsewhere that day so a swap never creates a
 *  duplicate. Falls back to allowing that overlap if it's the only option. */
function pickAlternative(currentName, namesToAvoid) {
  const group = findExerciseGroup(currentName);
  if (!group) return null;
  const avoid = new Set(namesToAvoid.map((n) => n.toLowerCase()));
  avoid.add(currentName.toLowerCase());
  let candidates = group.filter((e) => !avoid.has(e.name.toLowerCase()));
  if (candidates.length === 0) {
    candidates = group.filter((e) => e.name.toLowerCase() !== currentName.toLowerCase());
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function ExerciseCard({ exercise, log, onUpdateSet, lastDetail, onSwap }) {
  const rows = Array.from({ length: exercise.sets });
  const currentTop = Math.max(
    0,
    ...(log.sets[exercise.id] || []).map((s) => parseFloat(s.weight)).filter((n) => !isNaN(n))
  );

  const suggestion = !lastDetail ? SUGGESTED_STARTS[exercise.name] : null;
  let referenceLabel = null;
  let referenceText = null;
  if (lastDetail) {
    const parts = lastDetail.sets
      .filter((s) => s.weight || s.reps)
      .map((s) => `${s.weight || "–"}kg × ${s.reps || "–"}`)
      .join(", ");
    referenceLabel = `Last logged ${parseISODate(lastDetail.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    referenceText = parts;
  } else if (suggestion) {
    referenceLabel = "Trainer suggestion — no history yet";
    referenceText = `${suggestion.weight}kg × ${suggestion.reps}`;
  }

  const hasAlternatives = Boolean(findExerciseGroup(exercise.name));

  return (
    <div className="tt-card p-5 sm:p-6">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-start gap-2">
          <div>
            <h4 className="font-display text-lg" style={{ fontWeight: 600 }}>{exercise.name}</h4>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{exercise.sets} sets × {exercise.reps} reps · {exercise.equipment}</p>
          </div>
          {hasAlternatives && (
            <button
              onClick={onSwap}
              className="tt-btn-ghost rounded-full p-1.5 flex-shrink-0"
              aria-label={`Swap ${exercise.name} for a similar exercise`}
              title="Swap for a similar exercise"
            >
              <Shuffle size={13} />
            </button>
          )}
        </div>
        {currentTop > 0 && (
          <span className="tt-tag-up rounded-full px-3 py-1 text-xs font-mono">top set {currentTop}kg</span>
        )}
      </div>

      {referenceText && (
        <div className="mb-4">
          <label className="block font-mono text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--ink-soft)" }}>
            {referenceLabel}
          </label>
          <div
            className="tt-input w-full px-3 py-2 text-sm"
            style={{ opacity: 0.85, cursor: "default" }}
            role="textbox"
            aria-readonly="true"
          >
            {referenceText}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((_, idx) => {
          const row = log.sets[exercise.id]?.[idx] || { weight: "", reps: "" };
          return (
            <div key={idx} className="flex items-end gap-3">
              <span className="w-5 font-mono text-sm pb-2.5" style={{ color: "var(--ink-soft)" }}>{idx + 1}</span>
              <div className="flex-1">
                <label className="block font-mono text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--ink-soft)" }}>
                  Weight (kg)
                </label>
                <input type="number" step="0.5" className="tt-input w-full px-3 py-2 text-sm" value={row.weight}
                  onChange={(e) => onUpdateSet(exercise.id, idx, "weight", e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block font-mono text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--ink-soft)" }}>
                  Reps
                </label>
                <input type="number" className="tt-input w-full px-3 py-2 text-sm" value={row.reps}
                  onChange={(e) => onUpdateSet(exercise.id, idx, "reps", e.target.value)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="tt-label text-xs font-mono uppercase tracking-wide block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Slider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-mono" style={{ color: "var(--moss)" }}>{value}/5</span>
      </div>
      <input type="range" min={1} max={5} step={1} value={value} className="tt-slider w-full"
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/* ------------------------------- progress view ------------------------------- */

function ProgressView({ plan, logs }) {
  const names = useMemo(() => uniqueExerciseNames(plan), [plan]);
  const [selected, setSelected] = useState(names[0] || "");
  useEffect(() => {
    if (!names.includes(selected) && names.length) setSelected(names[0]);
  }, [names]); // eslint-disable-line

  const history = useMemo(() => exerciseHistory(plan, logs, selected), [plan, logs, selected]);
  const streak = useMemo(() => computeStreak(logs), [logs]);
  const totalLoggedDays = Object.values(logs).filter(isLogged).length;

  const chartData = history.map((p) => ({ ...p, label: p.date.slice(5) }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={<Flame size={17} />} label="Current streak" value={`${streak}d`} />
        <StatCard icon={<Check size={17} />} label="Days logged" value={totalLoggedDays} />
        <StatCard icon={<TrendingUp size={17} />} label="Exercises tracked" value={names.length} />
      </div>

      <div className="tt-card p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="font-display text-lg" style={{ fontWeight: 600 }}>Weight progression</h3>
          <select className="tt-input px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "var(--ink-soft)" }}>
            No sets logged for this exercise yet — log a session to see it climb here.
          </p>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#DCD8CB" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7062" }} axisLine={{ stroke: "#DCD8CB" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7062" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "#FBFAF6", border: "1px solid #DCD8CB", borderRadius: 10, fontSize: 12 }}
                  formatter={(v) => [`${v} kg`, "top set"]}
                />
                <Line type="monotone" dataKey="weight" stroke="#4A5D43" strokeWidth={2.5} dot={{ r: 3, fill: "#4A5D43" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="tt-card p-4 flex flex-col gap-2">
      <span style={{ color: "var(--moss)" }}>{icon}</span>
      <div>
        <p className="font-display text-2xl" style={{ fontWeight: 600 }}>{value}</p>
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{label}</p>
      </div>
    </div>
  );
}

/* -------------------------------- trainer view -------------------------------- */

function TrainerView({ plan, logs, feedback, loading, error, onAsk }) {
  const tips = useMemo(() => computeQuickTips(plan, logs), [plan, logs]);
  const soreness = recentAvgSoreness(logs);

  return (
    <div className="space-y-5">
      {soreness !== null && soreness >= 3.6 && (
        <div className="tt-card p-4 flex items-start gap-3" style={{ borderColor: "var(--clay)" }}>
          <Leaf size={18} style={{ color: "var(--clay)" }} className="mt-0.5" />
          <p className="text-sm">
            Soreness has been running high the last few days (avg {soreness.toFixed(1)}/5). Consider an easier session or extra stretching before pushing weight again.
          </p>
        </div>
      )}

      <div className="tt-card p-5 sm:p-6">
        <h3 className="font-display text-lg mb-3" style={{ fontWeight: 600 }}>Quick reads from your log</h3>
        {tips.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Log the same exercise twice and I'll start spotting trends here.
          </p>
        ) : (
          <div className="space-y-2">
            {tips.map((t, i) => (
              <div key={i} className={`rounded-xl px-3 py-2.5 text-sm ${t.type === "up" ? "tt-tag-up" : t.type === "down" ? "tt-tag-down" : "tt-tag-steady"}`}>
                {t.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tt-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h3 className="font-display text-lg flex items-center gap-2" style={{ fontWeight: 600 }}>
            <Sparkles size={17} style={{ color: "var(--gold)" }} /> Weekly coaching note
          </h3>
          <button onClick={onAsk} disabled={loading} className="tt-btn-primary rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {feedback ? "Refresh" : "Ask your trainer"}
          </button>
        </div>

        {error && <p className="text-sm mb-3" style={{ color: "var(--clay)" }}>{error}</p>}

        {feedback ? (
          <div className="space-y-3 text-sm">
            <p>{feedback.summary}</p>
            <ul className="space-y-1.5 list-disc pl-5">
              {(feedback.adjustments || []).map((a, i) => <li key={i}>{a}</li>)}
            </ul>
            <p className="tt-inset rounded-xl px-3 py-2.5"><span className="font-medium">Focus this week: </span>{feedback.focus}</p>
            <p className="italic" style={{ color: "var(--moss-dark)" }}>{feedback.encouragement}</p>
            <p className="font-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>
              generated {new Date(feedback.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : (
          !loading && (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Get a short, personal check-in based on your goals, your plan, and the last two weeks of logs. Needs an <span className="font-mono">ANTHROPIC_API_KEY</span> set in your Vercel project — see the README.
            </p>
          )
        )}
      </div>
    </div>
  );
}

/* --------------------------------- plan view --------------------------------- */

function PlanView({ plan, setPlan, onReset }) {
  const [editingDay, setEditingDay] = useState(DAY_KEYS[0]);
  const day = plan[editingDay];

  const updateDay = (updater) => {
    setPlan((prev) => ({ ...prev, [editingDay]: updater(prev[editingDay]) }));
  };

  const addExercise = () => {
    updateDay((d) => ({ ...d, exercises: [...d.exercises, { id: uid(), name: "New exercise", sets: 3, reps: "10", equipment: "" }] }));
  };
  const updateExercise = (id, field, value) => {
    updateDay((d) => ({ ...d, exercises: d.exercises.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)) }));
  };
  const removeExercise = (id) => {
    updateDay((d) => ({ ...d, exercises: d.exercises.filter((ex) => ex.id !== id) }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {DAY_KEYS.map((k) => (
            <button key={k} onClick={() => setEditingDay(k)}
              className={`tt-pill ${editingDay === k ? "tt-pill-active" : ""} rounded-full px-3.5 py-1.5 text-sm`}>
              {DAY_LABELS[k]}
            </button>
          ))}
        </div>
        <button onClick={onReset} className="tt-btn-ghost rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5">
          <RotateCcw size={13} /> Reset to default plan
        </button>
      </div>

      <div className="tt-card p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <Field label="Title">
            <input className="tt-input w-full px-3 py-2 text-sm" value={day.title}
              onChange={(e) => updateDay((d) => ({ ...d, title: e.target.value }))} />
          </Field>
          <Field label="Subtitle">
            <input className="tt-input w-full px-3 py-2 text-sm" value={day.subtitle}
              onChange={(e) => updateDay((d) => ({ ...d, subtitle: e.target.value }))} />
          </Field>
          <Field label="Type">
            <select className="tt-input w-full px-3 py-2 text-sm" value={day.type}
              onChange={(e) => updateDay((d) => ({ ...d, type: e.target.value }))}>
              <option value="strength">Strength</option>
              <option value="outdoor">Outdoor / cardio</option>
              <option value="rest">Rest</option>
            </select>
          </Field>
        </div>

        {day.type === "strength" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-display text-lg" style={{ fontWeight: 600 }}>Exercises</h4>
              <button onClick={addExercise} className="tt-btn-ghost rounded-full p-1.5"><Plus size={15} /></button>
            </div>
            <div className="space-y-3">
              {day.exercises.map((ex) => (
                <div key={ex.id} className="tt-card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className="tt-input flex-1 min-w-0 px-3 py-2 text-sm" value={ex.name} placeholder="Exercise name"
                      onChange={(e) => updateExercise(ex.id, "name", e.target.value)} />
                    <button onClick={() => removeExercise(ex.id)} className="tt-btn-ghost rounded-full p-1.5 flex-shrink-0" aria-label="Remove exercise">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" className="tt-input w-14 flex-shrink-0 px-2 py-2 text-sm" value={ex.sets} placeholder="sets" aria-label="Sets"
                      onChange={(e) => updateExercise(ex.id, "sets", Number(e.target.value))} />
                    <input className="tt-input w-20 flex-shrink-0 px-2 py-2 text-sm" value={ex.reps} placeholder="reps" aria-label="Reps"
                      onChange={(e) => updateExercise(ex.id, "reps", e.target.value)} />
                    <input className="tt-input flex-1 min-w-0 px-3 py-2 text-sm" value={ex.equipment} placeholder="Equipment"
                      onChange={(e) => updateExercise(ex.id, "equipment", e.target.value)} />
                  </div>
                </div>
              ))}
              {day.exercises.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No exercises yet — add one.</p>}
            </div>
          </>
        )}
        {day.type !== "strength" && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            {day.type === "outdoor" ? "This day logs route distance, elevation and duration instead of exercises." : "This day is for stretching, mobility and recovery."}
          </p>
        )}
      </div>
    </div>
  );
}
