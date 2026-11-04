import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { send, request } from "./api";
import type { Goal, GoalInput, Notification, ProgressDay, Report, TokenResponse, User, Workout, WorkoutInput } from "./api";

type AuthValue = {
  user: User | null;
  setSession: (session: TokenResponse) => void;
  signOut: () => void;
};
const AuthContext = createContext<AuthValue | null>(null);

function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Authentication context is missing");
  return context;
}

function useLoad<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(localStorage.getItem("fittrack_token")));
  useEffect(() => {
    if (!localStorage.getItem("fittrack_token")) return;
    request<User>("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("fittrack_token"))
      .finally(() => setChecking(false));
  }, []);

  const auth = useMemo<AuthValue>(
    () => ({
      user,
      setSession: (session) => {
        localStorage.setItem("fittrack_token", session.access_token);
        setUser(session.user);
      },
      signOut: () => {
        localStorage.removeItem("fittrack_token");
        setUser(null);
      },
    }),
    [user],
  );

  if (checking) return <div className="loading-screen">Getting your space ready…</div>;
  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

function ProtectedLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { data: notifications, refresh: refreshNotifications } = useLoad(
    () => request<Notification[]>("/notifications"),
    [user?.id, location.pathname],
  );
  useEffect(() => {
    window.addEventListener("fittrack-notifications-updated", refreshNotifications);
    return () => window.removeEventListener("fittrack-notifications-updated", refreshNotifications);
  }, [refreshNotifications]);
  if (!user) return <Navigate to="/login" replace />;
  const unread = notifications?.filter((item) => !item.is_read).length ?? 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">f</span>
          <span>fittrack<span className="brand-period">.</span></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          <NavLink to="/" end><span className="nav-icon">◫</span> Overview</NavLink>
          <NavLink to="/workouts"><span className="nav-icon">↗</span> Workouts</NavLink>
          <NavLink to="/goals"><span className="nav-icon">◎</span> Goals</NavLink>
          <NavLink to="/reports"><span className="nav-icon">⌁</span> Reports</NavLink>
          <NavLink to="/notifications">
            <span className="nav-icon">🔔</span> Notifications
            {unread > 0 && <span className="nav-count">{unread}</span>}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div className="profile-copy"><strong>{user.username}</strong><span>Personal account</span></div>
          <button className="icon-button signout" title="Sign out" onClick={signOut}>↗</button>
        </div>
      </aside>
      <main className="main-area"><Outlet /></main>
    </div>
  );
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = isRegister
        ? await send<TokenResponse>(`/auth/${mode}`, "POST", Object.fromEntries(form.entries()))
        : await request<TokenResponse>("/auth/login", {
            method: "POST",
            body: new URLSearchParams({
              username: String(form.get("username") ?? ""),
              password: String(form.get("password") ?? ""),
            }),
          });
      setSession(session);
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-art">
        <Link to="/" className="brand auth-brand"><span className="brand-mark">f</span><span>fittrack<span className="brand-period">.</span></span></Link>
        <div className="art-copy">
          <div className="eyebrow"><span className="pulse-dot" /> YOUR ROUTINE, REIMAGINED</div>
          <h1>Small steps.<br />Stronger <em>you.</em></h1>
          <p>A calmer way to build consistency, celebrate progress, and feel good in your body.</p>
        </div>
        <div className="art-stat"><span className="stat-spark">↗</span><span><strong>One day at a time</strong><small>Progress over perfection</small></span><span className="stat-bars"><i /><i /><i /><i /><i /><i /><i /></span></div>
        <div className="art-orb orb-one" /><div className="art-orb orb-two" />
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-auth-brand"><span className="brand-mark">f</span> fittrack.</div>
          <p className="eyebrow muted">{isRegister ? "START YOUR JOURNEY" : "WELCOME BACK"}</p>
          <h2>{isRegister ? "Create your account" : "Good to see you."}</h2>
          <p className="form-subtitle">{isRegister ? "Your next chapter starts with a single step." : "Ready to pick up where you left off?"}</p>
          <form onSubmit={submit} className="form-stack">
            {isRegister && <label>Your name<input name="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.-]+" placeholder="e.g. alexmorgan" autoComplete="username" /></label>}
            {isRegister ? (
              <label>Email address<input name="email" type="email" required placeholder="you@example.com" autoComplete="email" /></label>
            ) : (
              <label>Username or email<input name="username" type="text" required placeholder="Your username" autoComplete="username" /></label>
            )}
            <label>Password<input name="password" type="password" required minLength={isRegister ? 8 : 1} maxLength={72} placeholder={isRegister ? "At least 8 characters" : "Your password"} autoComplete={isRegister ? "new-password" : "current-password"} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary submit-button" disabled={busy}>{busy ? "One moment…" : isRegister ? "Create account" : "Sign in"} <span>→</span></button>
          </form>
          <p className="auth-switch">{isRegister ? "Already have an account?" : "New to FitTrack?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
          <p className="auth-privacy">By continuing, you agree to keep showing up for yourself.</p>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow muted">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</header>;
}

function StatCard({ label, value, unit, detail, icon, tone }: { label: string; value: string | number; unit: string; detail: string; icon: string; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{unit}</small></div><div className="stat-detail">{detail}</div></article>;
}

function Dashboard() {
  const { user } = useAuth();
  const { data: workouts, loading: workoutsLoading, error: workoutError } = useLoad(() => request<Workout[]>("/workouts"), [user?.id]);
  const { data: progress, loading: progressLoading } = useLoad(() => request<ProgressDay[]>("/progress"), [user?.id]);
  const today = localDateString(new Date());
  const todayWorkouts = workouts?.filter((workout) => workout.workout_date === today) ?? [];
  const todayCalories = todayWorkouts.reduce((sum, workout) => sum + workout.calories_burned, 0);
  const week = progress?.slice(-7) ?? [];
  const weekCalories = week.reduce((sum, day) => sum + day.total_calories, 0);
  const weekWorkouts = week.reduce((sum, day) => sum + day.total_workouts, 0);
  const chartData = (week.length ? week : []).map((day) => ({
    ...day,
    label: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
  }));
  const latest = workouts?.slice(0, 4) ?? [];

  return <div className="page-content">
    <PageHeader eyebrow="YOUR FITNESS, IN FOCUS" title={`Good ${getGreeting()}, ${user?.username}.`} subtitle="A little progress adds up. Here's how you're doing." action={<div className="today-chip"><span /> {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>} />
    <section className="stats-grid">
      <StatCard label="Workouts this week" value={weekWorkouts} unit="sessions" detail="Keep your rhythm going" icon="↗" tone="lime" />
      <StatCard label="Calories this week" value={weekCalories.toLocaleString()} unit="kcal" detail="Energy put to good use" icon="✳" tone="peach" />
      <StatCard label="Today's activity" value={todayWorkouts.length} unit={todayWorkouts.length === 1 ? "workout" : "workouts"} detail={`${todayCalories.toLocaleString()} kcal burned today`} icon="◷" tone="blue" />
      <StatCard label="Active days" value={week.filter((day) => day.total_workouts > 0).length} unit="of 7 days" detail="Consistency is the goal" icon="✦" tone="lavender" />
    </section>
    <section className="content-grid dashboard-grid">
      <article className="panel chart-panel">
        <div className="panel-heading"><div><p className="eyebrow muted">THE LAST 7 DAYS</p><h2>Your activity</h2></div><span className="chart-legend"><i /> Calories</span></div>
        <div className="chart-wrap">
          {progressLoading ? <div className="empty-state">Loading your progress…</div> : chartData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7e548" stopOpacity={0.38} /><stop offset="100%" stopColor="#b7e548" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} dy={12} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e8ebdf", boxShadow: "0 8px 24px #17200c12" }} /><Area type="monotone" dataKey="total_calories" name="Calories" stroke="#88ae21" strokeWidth={2.5} fill="url(#calorieFill)" activeDot={{ r: 5, fill: "#88ae21" }} /></AreaChart></ResponsiveContainer> : <div className="empty-state">Your activity will show up here once you log a workout.</div>}
        </div>
      </article>
      <article className="panel today-panel">
        <div className="panel-heading"><div><p className="eyebrow muted">A GOOD PLACE TO START</p><h2>Today's focus</h2></div><span className="focus-icon">✳</span></div>
        <div className="focus-count">{todayWorkouts.length}<span> / 1</span></div>
        <p className="focus-caption">workout logged today</p>
        <div className="focus-progress"><i style={{ width: `${Math.min(todayWorkouts.length * 100, 100)}%` }} /></div>
        <p className="focus-note">{todayWorkouts.length ? "You're showing up for yourself. That's what matters." : "No pressure. Every movement counts, whenever you start."}</p>
        <Link to="/workouts" className="text-link">Log a workout <span>→</span></Link>
      </article>
    </section>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><p className="eyebrow muted">YOUR RECENT MOVEMENT</p><h2>Recent workouts</h2></div><Link to="/workouts" className="text-link">See all <span>→</span></Link></div>
      {workoutError && <p className="form-error">{workoutError}</p>}
      {workoutsLoading ? <div className="empty-state">Loading workouts…</div> : latest.length ? <WorkoutRows workouts={latest} /> : <div className="empty-state">Nothing logged just yet. Your first workout is a great place to begin. <Link to="/workouts">Add a workout →</Link></div>}
    </section>
  </div>;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function localDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function WorkoutRows({ workouts, onEdit, onDelete }: { workouts: Workout[]; onEdit?: (workout: Workout) => void; onDelete?: (workout: Workout) => void }) {
  return <div className="workout-list">{workouts.map((workout) => <div className="workout-row" key={workout.id}><div className={`workout-type-icon ${categoryTone(workout.category)}`}>{categoryIcon(workout.category)}</div><div className="workout-name"><strong>{workout.workout_name}</strong><span>{workout.category} · {formatDate(workout.workout_date)}</span></div><div className="workout-metric"><strong>{workout.duration}</strong><span>min</span></div><div className="workout-metric calories"><strong>{workout.calories_burned}</strong><span>kcal</span></div>{(onEdit || onDelete) && <div className="row-actions">{onEdit && <button className="icon-button" title="Edit workout" onClick={() => onEdit(workout)}>✎</button>}{onDelete && <button className="icon-button danger-hover" title="Delete workout" onClick={() => onDelete(workout)}>×</button>}</div>}</div>)}</div>;
}

function categoryIcon(category: Workout["category"]) {
  return category === "Cardio" ? "↗" : category === "Strength" ? "⌁" : "◉";
}
function categoryTone(category: Workout["category"]) {
  return category.toLowerCase();
}
function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function WorkoutsPage() {
  const { user } = useAuth();
  const { data: workouts, loading, error, refresh } = useLoad(() => request<Workout[]>("/workouts"), [user?.id]);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const input: WorkoutInput = {
      workout_name: String(values.workout_name),
      category: values.category as WorkoutInput["category"],
      duration: Number(values.duration),
      calories_burned: Number(values.calories_burned),
      workout_date: String(values.workout_date),
    };
    try {
      await send(editing ? `/workouts/${editing.id}` : "/workouts", editing ? "PATCH" : "POST", input);
      setEditing(null);
      setShowForm(false);
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not save workout");
    } finally {
      setBusy(false);
    }
  }

  async function removeWorkout(workout: Workout) {
    if (!window.confirm(`Delete "${workout.workout_name}"?`)) return;
    try {
      await send(`/workouts/${workout.id}`, "DELETE");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not delete workout");
    }
  }

  function startEdit(workout: Workout) {
    setEditing(workout);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className="page-content">
    <PageHeader eyebrow="MOVEMENT, MADE VISIBLE" title="Your workouts" subtitle="Every session counts. Keep a record of how you move." action={<button className="button button-primary" onClick={() => { setEditing(null); setShowForm((shown) => !shown); }}><span>＋</span> Log a workout</button>} />
    {(showForm || editing) && <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow muted">{editing ? "UPDATE YOUR SESSION" : "ADD TO YOUR JOURNEY"}</p><h2>{editing ? "Edit workout" : "New workout"}</h2></div><button className="icon-button" onClick={() => { setShowForm(false); setEditing(null); }}>×</button></div><form onSubmit={saveWorkout} className="form-grid">
      <label>Workout name<input name="workout_name" required minLength={2} maxLength={100} defaultValue={editing?.workout_name ?? ""} placeholder="e.g. Morning run" /></label>
      <label>Category<select name="category" defaultValue={editing?.category ?? "Cardio"}><option>Cardio</option><option>Strength</option><option>Yoga</option></select></label>
      <label>Duration (minutes)<input name="duration" type="number" min="1" max="1440" required defaultValue={editing?.duration ?? ""} placeholder="45" /></label>
      <label>Calories burned<input name="calories_burned" type="number" min="0" max="10000" required defaultValue={editing?.calories_burned ?? ""} placeholder="320" /></label>
      <label>Workout date<input name="workout_date" type="date" required defaultValue={editing?.workout_date ?? localDateString(new Date())} /></label>
      {actionError && <div className="form-error full-width">{actionError}</div>}
      <div className="form-actions full-width"><button type="button" className="button button-soft" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add workout"} <span>→</span></button></div>
    </form></section>}
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow muted">YOUR ACTIVITY LOG</p><h2>All workouts <span className="title-count">{workouts?.length ?? 0}</span></h2></div></div>{(error || actionError) && !showForm && <div className="form-error">{error || actionError}</div>}{loading ? <div className="empty-state">Loading workouts…</div> : workouts?.length ? <WorkoutRows workouts={workouts} onEdit={startEdit} onDelete={removeWorkout} /> : <div className="empty-state">Your log is ready when you are. Add your first workout to get started.</div>}</section>
  </div>;
}

function GoalsPage() {
  const { user } = useAuth();
  const { data: goals, loading, error, refresh } = useLoad(() => request<Goal[]>("/goals"), [user?.id]);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  async function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const input: GoalInput = {
      goal_type: values.goal_type as GoalInput["goal_type"],
      target_value: Number(values.target_value),
      current_value: Number(values.current_value),
      deadline: String(values.deadline),
    };
    try {
      await send("/goals", "POST", input);
      setShowForm(false);
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not create goal");
    } finally {
      setBusy(false);
    }
  }

  async function updateProgress(goal: Goal) {
    const value = window.prompt(`Update progress for ${goal.goal_type} (target: ${goal.target_value})`, String(goal.current_value));
    if (value === null) return;
    const current_value = Number(value);
    if (!Number.isFinite(current_value) || current_value < 0) {
      setActionError("Progress must be a non-negative number.");
      return;
    }
    try {
      await send(`/goals/${goal.id}`, "PATCH", { current_value });
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not update goal");
    }
  }

  async function removeGoal(goal: Goal) {
    if (!window.confirm(`Remove your ${goal.goal_type.toLowerCase()} goal?`)) return;
    try {
      await send(`/goals/${goal.id}`, "DELETE");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not delete goal");
    }
  }

  return <div className="page-content">
    <PageHeader eyebrow="AIM WITH INTENTION" title="Goals that move you" subtitle="Set a direction, track the small wins, and adjust as you grow." action={<button className="button button-primary" onClick={() => setShowForm((shown) => !shown)}><span>＋</span> Set a goal</button>} />
    {showForm && <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow muted">MAKE IT YOURS</p><h2>Set a new goal</h2></div><button className="icon-button" onClick={() => setShowForm(false)}>×</button></div><form onSubmit={addGoal} className="form-grid"><label>Goal type<select name="goal_type"><option>Weight Loss</option><option>Muscle Gain</option><option>Steps</option></select></label><label>Target value<input name="target_value" type="number" min="0.01" step="any" required placeholder="e.g. 10" /></label><label>Current progress<input name="current_value" type="number" min="0" step="any" defaultValue="0" required /></label><label>Target date<input name="deadline" type="date" min={localDateString(new Date())} required /></label>{actionError && <div className="form-error full-width">{actionError}</div>}<div className="form-actions full-width"><button type="button" className="button button-soft" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Create goal"} <span>→</span></button></div></form></section>}
    {(error || actionError) && !showForm && <div className="form-error">{error || actionError}</div>}
    {loading ? <div className="panel empty-state">Loading your goals…</div> : goals?.length ? <div className="goal-grid">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} onUpdate={() => void updateProgress(goal)} onDelete={() => void removeGoal(goal)} />)}</div> : <section className="panel empty-state">You don't have a goal set yet. Choose something meaningful and make it your own.</section>}
  </div>;
}

function GoalCard({ goal, onUpdate, onDelete }: { goal: Goal; onUpdate: () => void; onDelete: () => void }) {
  const percent = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  return <article className="panel goal-card"><div className="goal-card-top"><div className="goal-symbol">{goal.goal_type === "Steps" ? "↗" : goal.goal_type === "Muscle Gain" ? "⌁" : "◎"}</div><span className={`status-pill ${goal.status}`}>{goal.status}</span><button className="icon-button goal-delete" title="Delete goal" onClick={onDelete}>×</button></div><p className="eyebrow muted">YOUR GOAL</p><h2>{goal.goal_type}</h2><div className="goal-progress-copy"><strong>{goal.current_value.toLocaleString()}</strong><span> / {goal.target_value.toLocaleString()}</span></div><div className="goal-track"><i style={{ width: `${percent}%` }} /></div><div className="goal-card-foot"><span>{percent}% complete</span><span>Due {formatDate(goal.deadline)}</span></div><button className="button button-soft goal-update" onClick={onUpdate}>{goal.status === "completed" ? "Update progress" : "Update progress"} <span>→</span></button></article>;
}

function ReportsPage() {
  const { user } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [year, selectedMonth] = month.split("-").map(Number);
  const { data: report, loading, error } = useLoad(() => request<Report>(`/reports/monthly?year=${year}&month=${selectedMonth}`), [user?.id, year, selectedMonth]);
  const { data: weekly } = useLoad(() => request<Report>("/reports/weekly"), [user?.id]);
  const chartData = report?.days.map((day) => ({ ...day, label: new Date(`${day.date}T12:00:00`).getDate() })) ?? [];
  return <div className="page-content">
    <PageHeader eyebrow="ZOOM OUT, SEE THE CHANGE" title="Your progress, over time" subtitle="Patterns tell a story. Here's what yours is saying." action={<label className="month-picker"><span>MONTH</span><input aria-label="Select report month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>} />
    <section className="stats-grid report-stats"><StatCard label="This month" value={report?.total_workouts ?? 0} unit="workouts" detail="Sessions completed" icon="↗" tone="lime" /><StatCard label="Calories burned" value={(report?.total_calories ?? 0).toLocaleString()} unit="kcal" detail="Across your workouts" icon="✳" tone="peach" /><StatCard label="Time moving" value={formatHours(report?.total_duration ?? 0)} unit="" detail="Time invested in you" icon="◷" tone="blue" /><StatCard label="This week" value={weekly?.total_workouts ?? 0} unit="workouts" detail={`${(weekly?.total_calories ?? 0).toLocaleString()} kcal burned`} icon="✦" tone="lavender" /></section>
    {error && <div className="form-error">{error}</div>}
    <section className="panel report-chart-panel"><div className="panel-heading"><div><p className="eyebrow muted">DAILY BREAKDOWN</p><h2>Calories through the month</h2></div><span className="chart-legend"><i /> Calories</span></div><div className="report-chart">{loading ? <div className="empty-state">Loading your report…</div> : chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}><defs><linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7e548" stopOpacity={0.38} /><stop offset="100%" stopColor="#b7e548" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} /><Tooltip labelFormatter={(label) => `${month}-${String(label).padStart(2, "0")}`} contentStyle={{ borderRadius: 12, border: "1px solid #e8ebdf" }} /><Area type="monotone" dataKey="total_calories" name="Calories" stroke="#88ae21" strokeWidth={2.5} fill="url(#reportFill)" /></AreaChart></ResponsiveContainer> : <div className="empty-state">No activity for this month yet. Start where you are.</div>}</div></section>
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow muted">THE CURRENT WEEK</p><h2>Weekly snapshot</h2></div><span className="range-label">{weekly ? `${formatDate(weekly.start_date)} – ${formatDate(weekly.end_date)}` : ""}</span></div><div className="weekly-snapshot"><div><strong>{weekly?.total_workouts ?? 0}</strong><span>workouts completed</span></div><div><strong>{(weekly?.total_calories ?? 0).toLocaleString()}</strong><span>calories burned</span></div><div><strong>{formatHours(weekly?.total_duration ?? 0)}</strong><span>time in motion</span></div><div><strong>{weekly?.days.filter((day) => day.total_workouts).length ?? 0}<small> / 7</small></strong><span>active days</span></div></div></section>
  </div>;
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications, loading, error, refresh, setData } = useLoad(() => request<Notification[]>("/notifications"), [user?.id]);
  const unread = notifications?.filter((item) => !item.is_read).length ?? 0;

  async function markAllRead() {
    try {
      await send("/notifications/read-all", "PATCH");
      setData((notifications ?? []).map((item) => ({ ...item, is_read: true })));
      window.dispatchEvent(new Event("fittrack-notifications-updated"));
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Could not update notifications");
    }
  }
  async function markRead(item: Notification) {
    if (item.is_read) return;
    try {
      await send(`/notifications/${item.id}/read`, "PATCH");
      setData((notifications ?? []).map((notification) => notification.id === item.id ? { ...notification, is_read: true } : notification));
      window.dispatchEvent(new Event("fittrack-notifications-updated"));
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Could not update notification");
    }
  }

  return <div className="page-content"><PageHeader eyebrow="A GENTLE NUDGE, WHEN YOU NEED IT" title="Your notifications" subtitle="A little encouragement for the journey you're on." action={!!unread && <button className="button button-soft" onClick={() => void markAllRead()}>Mark all read</button>} />{error && <div className="form-error">{error}</div>}<section className="panel notification-panel"><div className="panel-heading"><div><p className="eyebrow muted">YOUR INBOX</p><h2>Recent updates <span className="title-count">{notifications?.length ?? 0}</span></h2></div><button className="icon-button" title="Refresh notifications" onClick={() => void refresh()}>↻</button></div>{loading ? <div className="empty-state">Checking for updates…</div> : notifications?.length ? <div className="notification-list">{notifications.map((item) => <button className={`notification-item ${item.is_read ? "read" : ""}`} key={item.id} onClick={() => void markRead(item)}><span className="notification-mark">{item.title.includes("Goal") || item.title.includes("goal") ? "◎" : "✳"}</span><span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString()}</small></span>{!item.is_read && <span className="unread-dot" />}</button>)}</div> : <div className="empty-state">All caught up. We'll leave a little encouragement here when you need it.</div>}</section></div>;
}

export default App;
