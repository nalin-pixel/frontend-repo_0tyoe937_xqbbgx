import { useEffect, useMemo, useState } from 'react'

const HABIT_OPTIONS = [
  { value: 'general', label: 'General Habit' },
  { value: 'phone', label: 'Phone Overuse' },
  { value: 'junk food', label: 'Junk Food' },
  { value: 'procrastination', label: 'Procrastination' },
  { value: 'smoking', label: 'Smoking' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'gambling', label: 'Gambling' },
]

function App() {
  const baseUrl = useMemo(() => import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000', [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [streak, setStreak] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [tips, setTips] = useState([])
  const [journalItems, setJournalItems] = useState([])
  const [goals, setGoals] = useState([])
  const [metrics, setMetrics] = useState({ checkins: [], journal_count: 0, avg_intensity: null })

  const [habit, setHabit] = useState(() => localStorage.getItem('hb_habit') || 'general')

  const [journalForm, setJournalForm] = useState({ note: '', intensity: 5, feeling: '' })
  const [goalForm, setGoalForm] = useState({ title: '', target_days: 30 })

  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem('hb_token') || '')
  const [me, setMe] = useState(null)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ email: '', password: '', display_name: '' })

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...authHeaders, ...(options.headers || {}) }, ...options })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
  }

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [tipsRes, journalRes, goalsRes, streakRes, metricRes] = await Promise.all([
        fetchJson(`${baseUrl}/api/tips?habit=${encodeURIComponent(habit)}`),
        fetchJson(`${baseUrl}/api/journal`),
        fetchJson(`${baseUrl}/api/goals`),
        fetchJson(`${baseUrl}/api/streak`),
        fetchJson(`${baseUrl}/api/metrics`),
      ])
      setTips(tipsRes.tips || [])
      setJournalItems(journalRes.items || [])
      setGoals(goalsRes.items || [])
      setStreak(streakRes.days_logged || 0)
      setCurrentStreak(streakRes.current_streak || 0)
      setMetrics(metricRes)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [token])
  useEffect(() => { // refresh tips when habit changes
    localStorage.setItem('hb_habit', habit)
    ;(async () => {
      try {
        const t = await fetchJson(`${baseUrl}/api/tips?habit=${encodeURIComponent(habit)}`)
        setTips(t.tips || [])
      } catch (e) {
        // ignore tip-only errors
      }
    })()
  }, [habit, token])

  // auth helpers
  const fetchMe = async () => {
    if (!token) { setMe(null); return }
    try {
      const m = await fetchJson(`${baseUrl}/api/auth/me`)
      setMe(m)
    } catch {
      setMe(null)
    }
  }
  useEffect(() => { fetchMe() }, [token])

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const resp = await fetchJson(`${baseUrl}/api/auth/register`, { method: 'POST', body: JSON.stringify({ email: authForm.email, password: authForm.password, display_name: authForm.display_name }) })
      setToken(resp.access_token)
      localStorage.setItem('hb_token', resp.access_token)
      setAuthForm({ email: '', password: '', display_name: '' })
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const resp = await fetchJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email: authForm.email, password: authForm.password }) })
      setToken(resp.access_token)
      localStorage.setItem('hb_token', resp.access_token)
      setAuthForm({ email: '', password: '', display_name: '' })
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const handleLogout = () => {
    setToken('')
    localStorage.removeItem('hb_token')
    setMe(null)
  }

  const handleCheckIn = async () => {
    setLoading(true)
    setError('')
    try {
      await fetchJson(`${baseUrl}/api/checkin`, { method: 'POST', body: JSON.stringify({}) })
      await Promise.all([loadStreakOnly(), loadJournalOnly(), loadMetricsOnly()])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const loadStreakOnly = async () => {
    try { const s = await fetchJson(`${baseUrl}/api/streak`); setStreak(s.days_logged || 0); setCurrentStreak(s.current_streak || 0) } catch {}
  }
  const loadJournalOnly = async () => {
    try { const j = await fetchJson(`${baseUrl}/api/journal`); setJournalItems(j.items || []) } catch {}
  }
  const loadGoalsOnly = async () => {
    try { const g = await fetchJson(`${baseUrl}/api/goals`); setGoals(g.items || []) } catch {}
  }
  const loadMetricsOnly = async () => {
    try { const m = await fetchJson(`${baseUrl}/api/metrics`); setMetrics(m) } catch {}
  }

  const submitJournal = async (e) => {
    e.preventDefault()
    if (!journalForm.note.trim()) return
    setLoading(true)
    setError('')
    try {
      await fetchJson(`${baseUrl}/api/journal`, { method: 'POST', body: JSON.stringify(journalForm) })
      setJournalForm({ note: '', intensity: 5, feeling: '' })
      await Promise.all([loadJournalOnly(), loadMetricsOnly()])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const submitGoal = async (e) => {
    e.preventDefault()
    if (!goalForm.title.trim()) return
    setLoading(true)
    setError('')
    try {
      await fetchJson(`${baseUrl}/api/goals`, { method: 'POST', body: JSON.stringify({ ...goalForm, target_days: Number(goalForm.target_days || 0) }) })
      setGoalForm({ title: '', target_days: 30 })
      await loadGoalsOnly()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const currentHabitLabel = HABIT_OPTIONS.find(h => h.value === habit)?.label || 'General Habit'

  // simple bar chart component
  const Chart = ({ data }) => {
    const max = Math.max(1, ...data.map(d => d.count))
    return (
      <div className="w-full h-32 flex items-end gap-1">
        {data.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center">
            <div className="w-full bg-emerald-200 rounded-t" style={{ height: `${(d.count / max) * 100}%` }}></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-emerald-50">
      <header className="px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Habit Breaker</h1>
            <p className="text-sm text-gray-600">Build better routines, one day at a time.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Focus:</label>
            <select value={habit} onChange={(e) => setHabit(e.target.value)} className="text-sm p-2 border border-gray-200 rounded-lg bg-white">
              {HABIT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-4 flex flex-wrap items-center justify-between gap-3">
          {me ? (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800">Signed in</span>
              <span className="font-medium">{me.display_name || me.email}</span>
              <button onClick={handleLogout} className="ml-2 text-red-600 hover:underline">Log out</button>
            </div>
          ) : (
            <div className="bg-white/70 border border-gray-200 rounded-lg p-3">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setAuthMode('login')} className={`text-sm px-2 py-1 rounded ${authMode==='login'?'bg-gray-800 text-white':'bg-gray-100'}`}>Login</button>
                <button onClick={() => setAuthMode('register')} className={`text-sm px-2 py-1 rounded ${authMode==='register'?'bg-gray-800 text-white':'bg-gray-100'}`}>Register</button>
              </div>
              <form onSubmit={authMode==='login'?handleLogin:handleRegister} className="flex flex-wrap items-center gap-2">
                <input type="email" placeholder="Email" value={authForm.email} onChange={(e)=>setAuthForm({...authForm, email:e.target.value})} className="p-2 border rounded" required />
                <input type="password" placeholder="Password" value={authForm.password} onChange={(e)=>setAuthForm({...authForm, password:e.target.value})} className="p-2 border rounded" required />
                {authMode==='register' && (
                  <input type="text" placeholder="Display name (optional)" value={authForm.display_name} onChange={(e)=>setAuthForm({...authForm, display_name:e.target.value})} className="p-2 border rounded" />
                )}
                <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded">{authMode==='login'?'Login':'Create account'}</button>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-16">
        {error && (
          <div className="mb-6 p-3 rounded bg-red-50 border border-red-200 text-red-700">{error}</div>
        )}

        <section className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Your Streak</h2>
              <button onClick={handleCheckIn} disabled={loading} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition">
                <span>Check in today</span>
              </button>
            </div>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-5xl font-extrabold text-emerald-700">{streak}<span className="text-2xl text-emerald-600 ml-2">days</span></p>
                <p className="mt-2 text-gray-600">Total days logged. Current streak: <span className="font-semibold text-emerald-700">{currentStreak}</span></p>
              </div>
              <div className="flex-1">
                <Chart data={metrics.checkins || []} />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  {(metrics.checkins||[]).map((d,i)=> (
                    <span key={i}>{new Date(d.day).toLocaleDateString(undefined,{ month:'numeric', day:'numeric'})}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Quick Tips</h2>
            <p className="text-xs text-gray-500 mb-3">Tailored for: <span className="font-medium text-gray-700">{currentHabitLabel}</span></p>
            <ul className="space-y-2">
              {tips.map((t, i) => (
                <li key={i} className="text-gray-700 text-sm flex gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400"></span>{t}</li>
              ))}
            </ul>
            <button onClick={() => loadAll()} className="mt-4 text-emerald-700 hover:text-emerald-800 text-sm">Refresh</button>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Log a Trigger or Craving</h3>
            <form onSubmit={submitJournal} className="space-y-3">
              <textarea
                value={journalForm.note}
                onChange={(e) => setJournalForm({ ...journalForm, note: e.target.value })}
                placeholder={`What happened? How did you respond? (${currentHabitLabel})`}
                className="w-full h-28 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Intensity (1-10)</label>
                  <input type="number" min={1} max={10} value={journalForm.intensity}
                    onChange={(e) => setJournalForm({ ...journalForm, intensity: Number(e.target.value) })}
                    className="w-full p-2 border border-gray-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Feeling</label>
                  <input type="text" value={journalForm.feeling}
                    onChange={(e) => setJournalForm({ ...journalForm, feeling: e.target.value })}
                    placeholder="e.g., bored, stressed"
                    className="w-full p-2 border border-gray-200 rounded-lg" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg">Save Entry</button>
              <div className="text-xs text-gray-500">Avg intensity (last 200): {metrics.avg_intensity == null ? '—' : metrics.avg_intensity.toFixed(1)}</div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Set a Goal</h3>
            <form onSubmit={submitGoal} className="space-y-3">
              <input
                type="text"
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                placeholder="Example: 30-day clean streak"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Target days</label>
                  <input type="number" min={1} max={3650}
                    value={goalForm.target_days}
                    onChange={(e) => setGoalForm({ ...goalForm, target_days: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-lg" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg">Create Goal</button>
            </form>
            <p className="mt-2 text-xs text-gray-500">Journal entries stored: <span className="font-semibold">{metrics.journal_count}</span></p>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Journal Entries</h3>
            <div className="space-y-3">
              {journalItems.length === 0 && <p className="text-gray-500 text-sm">No entries yet. Log your first one above.</p>}
              {journalItems.map((it) => (
                <div key={it._id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{new Date(it.created_at || Date.now()).toLocaleString()}</span>
                    {it.intensity && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Intensity {it.intensity}</span>
                    )}
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{it.note}</p>
                  {it.feeling && <p className="mt-1 text-sm text-gray-600">Feeling: {it.feeling}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Goals</h3>
            <ul className="space-y-3">
              {goals.length === 0 && <p className="text-gray-500 text-sm">No goals yet. Create one above.</p>}
              {goals.map((g) => (
                <li key={g._id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{g.title}</p>
                      <p className="text-sm text-gray-600">Target: {g.target_days} days</p>
                    </div>
                    <span className="text-xs text-gray-500">Start: {g.start_date ? new Date(g.start_date).toLocaleDateString() : '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between">
          <a href="/test" className="text-sm text-gray-500 hover:text-gray-700">System status</a>
          <button onClick={loadAll} disabled={loading} className="text-sm text-emerald-700 hover:text-emerald-800">Refresh All</button>
        </div>

        <div className="mt-4 text-xs text-gray-400">Backend: <span className="font-mono">{baseUrl}</span></div>
      </main>
    </div>
  )
}

export default App
