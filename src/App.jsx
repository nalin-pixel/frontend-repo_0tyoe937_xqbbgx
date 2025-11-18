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
  const [metricsDays, setMetricsDays] = useState(14)
  const [metrics, setMetrics] = useState({ checkins: [], journal_count: 0, avg_intensity: null, rolling_avg: [], window: 14 })

  const [habit, setHabit] = useState(() => localStorage.getItem('hb_habit') || 'general')

  const [journalForm, setJournalForm] = useState({ note: '', intensity: 5, feeling: '' })
  const [goalForm, setGoalForm] = useState({ title: '', target_days: 30 })

  // goal editing
  const [editingGoalId, setEditingGoalId] = useState('')
  const [goalEditForm, setGoalEditForm] = useState({ title: '', target_days: 0, completed_date: '' })

  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem('hb_token') || '')
  const [me, setMe] = useState(null)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ email: '', password: '', display_name: '' })
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [verifyHint, setVerifyHint] = useState('')

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...authHeaders, ...(options.headers || {}) }, ...options })
    if (!res.ok) {
      if (res.status === 401) {
        // handle expired/invalid token gracefully
        localStorage.removeItem('hb_token')
        setToken('')
        setMe(null)
        throw new Error('Session expired. Please log in again.')
      }
      const text = await res.text()
      throw new Error(`${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
    }
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
        fetchJson(`${baseUrl}/api/metrics?days=${metricsDays}`),
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
        // sync profile preference if logged in
        if (token) {
          await fetchJson(`${baseUrl}/api/profile`, { method: 'PUT', body: JSON.stringify({ selected_habit: habit }) })
        }
        const t = await fetchJson(`${baseUrl}/api/tips?habit=${encodeURIComponent(habit)}`)
        setTips(t.tips || [])
      } catch (e) {
        // ignore tip-only errors
      }
    })()
  }, [habit, token])

  useEffect(() => { // reload metrics when range changes
    ;(async () => {
      try { const m = await fetchJson(`${baseUrl}/api/metrics?days=${metricsDays}`); setMetrics(m) } catch {}
    })()
  }, [metricsDays, token])

  // auth helpers
  const fetchMe = async () => {
    if (!token) { setMe(null); return }
    try {
      const m = await fetchJson(`${baseUrl}/api/auth/me`)
      setMe(m)
      if (m?.selected_habit && m.selected_habit !== habit) {
        setHabit(m.selected_habit)
        localStorage.setItem('hb_habit', m.selected_habit)
      }
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

  // password reset
  const requestReset = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetchJson(`${baseUrl}/api/auth/request-reset`, { method: 'POST', body: JSON.stringify({ email: resetEmail }) })
      setVerifyHint('Reset token generated. Check response or email.')
      // In this demo, token comes in response for testing; in production it'd be emailed.
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  const confirmReset = async () => {
    setLoading(true)
    setError('')
    try {
      await fetchJson(`${baseUrl}/api/auth/confirm-reset`, { method: 'POST', body: JSON.stringify({ token: resetToken, new_password: resetNewPassword }) })
      setVerifyHint('Password updated. You can now log in.')
      setShowReset(false)
      setResetEmail(''); setResetToken(''); setResetNewPassword('')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  // email verify
  const requestVerify = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetchJson(`${baseUrl}/api/auth/request-verify`, { method: 'POST', body: JSON.stringify({ email: me?.email }) })
      setVerifyHint('Verification token generated. Paste it below to verify.')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  const confirmVerify = async () => {
    setLoading(true)
    setError('')
    try {
      await fetchJson(`${baseUrl}/api/auth/confirm-verify`, { method: 'POST', body: JSON.stringify({ token: verifyToken }) })
      setVerifyHint('Email verified!')
      setVerifyToken('')
      fetchMe()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
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
    try { const m = await fetchJson(`${baseUrl}/api/metrics?days=${metricsDays}`); setMetrics(m) } catch {}
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

  const startEditGoal = (g) => {
    setEditingGoalId(g._id)
    setGoalEditForm({ title: g.title, target_days: g.target_days, completed_date: g.completed_date || '' })
  }

  const saveGoalEdit = async () => {
    if (!editingGoalId) return
    setLoading(true)
    setError('')
    try {
      const body = { ...goalEditForm }
      if (!body.completed_date) delete body.completed_date
      await fetchJson(`${baseUrl}/api/goals/${editingGoalId}`, { method: 'PATCH', body: JSON.stringify(body) })
      setEditingGoalId('')
      await loadGoalsOnly()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const markGoalDoneToday = async (g) => {
    setLoading(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0,10)
      await fetchJson(`${baseUrl}/api/goals/${g._id}`, { method: 'PATCH', body: JSON.stringify({ completed_date: today }) })
      await loadGoalsOnly()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const cancelGoalEdit = () => { setEditingGoalId(''); setGoalEditForm({ title: '', target_days: 0, completed_date: '' }) }

  const currentHabitLabel = HABIT_OPTIONS.find(h => h.value === habit)?.label || 'General Habit'

  // simple bar chart + rolling average line using SVG
  const Chart = ({ data, rolling }) => {
    const values = data.map(d => d.count)
    const max = Math.max(1, ...values, ...(rolling||[]))
    const height = 120
    const barWidth = 100 / (data.length || 1)
    const points = (rolling || []).map((v, i) => {
      const x = (i + 0.5) * barWidth
      const y = 100 - (v / max) * 100
      return `${x},${y}`
    }).join(' ')

    return (
      <div className="w-full">
        <div className="w-full h-32 flex items-end gap-1">
          {data.map((d, i) => (
            <div key={d.day} className="flex-1 flex flex-col items-center">
              <div className="w-full bg-emerald-200 rounded-t" style={{ height: `${(d.count / max) * 100}%` }}></div>
            </div>
          ))}
        </div>
        {rolling && rolling.length > 1 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8 -mt-6">
            <polyline fill="none" stroke="#065f46" strokeWidth="1" points={points} />
          </svg>
        )}
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
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800">Signed in</span>
              <span className="font-medium">{me.display_name || me.email}</span>
              {!me.is_verified && (
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 ml-1">Email not verified</span>
              )}
              <button onClick={handleLogout} className="ml-2 text-red-600 hover:underline">Log out</button>
              {!me.is_verified && (
                <div className="w-full sm:w-auto flex items-center gap-2 mt-2">
                  <button onClick={requestVerify} disabled={loading} className="text-xs text-emerald-700 hover:underline">Get verify token</button>
                  <input value={verifyToken} onChange={(e)=>setVerifyToken(e.target.value)} placeholder="Paste verify token" className="p-1 border rounded text-xs" />
                  <button onClick={confirmVerify} disabled={loading || !verifyToken} className="text-xs px-2 py-1 rounded bg-gray-800 text-white">Verify</button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/70 border border-gray-200 rounded-lg p-3 w-full">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setAuthMode('login')} className={`text-sm px-2 py-1 rounded ${authMode==='login'?'bg-gray-800 text-white':'bg-gray-100'}`}>Login</button>
                <button onClick={() => setAuthMode('register')} className={`text-sm px-2 py-1 rounded ${authMode==='register'?'bg-gray-800 text-white':'bg-gray-100'}`}>Register</button>
                <button onClick={() => setShowReset(v=>!v)} className="text-sm px-2 py-1 rounded bg-gray-100 ml-auto">{showReset?'Hide reset':'Forgot password?'}</button>
              </div>
              {!showReset ? (
                <form onSubmit={authMode==='login'?handleLogin:handleRegister} className="flex flex-wrap items-center gap-2">
                  <input type="email" placeholder="Email" value={authForm.email} onChange={(e)=>setAuthForm({...authForm, email:e.target.value})} className="p-2 border rounded" required />
                  <input type="password" placeholder="Password" value={authForm.password} onChange={(e)=>setAuthForm({...authForm, password:e.target.value})} className="p-2 border rounded" required />
                  {authMode==='register' && (
                    <input type="text" placeholder="Display name (optional)" value={authForm.display_name} onChange={(e)=>setAuthForm({...authForm, display_name:e.target.value})} className="p-2 border rounded" />
                  )}
                  <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded">{authMode==='login'?'Login':'Create account'}</button>
                </form>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="email" placeholder="Your email" value={resetEmail} onChange={(e)=>setResetEmail(e.target.value)} className="p-2 border rounded" />
                    <button onClick={requestReset} disabled={loading || !resetEmail} className="bg-gray-800 text-white text-sm px-3 py-2 rounded">Get reset token</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input placeholder="Reset token" value={resetToken} onChange={(e)=>setResetToken(e.target.value)} className="p-2 border rounded" />
                    <input type="password" placeholder="New password" value={resetNewPassword} onChange={(e)=>setResetNewPassword(e.target.value)} className="p-2 border rounded" />
                    <button onClick={confirmReset} disabled={loading || !resetToken || !resetNewPassword} className="bg-emerald-600 text-white text-sm px-3 py-2 rounded">Reset password</button>
                  </div>
                </div>
              )}
              {verifyHint && <div className="text-xs text-gray-600 mt-2">{verifyHint}</div>}
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
              <div className="flex items-center gap-2">
                <select value={metricsDays} onChange={(e)=>setMetricsDays(Number(e.target.value))} className="text-xs border rounded p-1">
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
                <button onClick={handleCheckIn} disabled={loading} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition">
                  <span>Check in today</span>
                </button>
              </div>
            </div>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-5xl font-extrabold text-emerald-700">{streak}<span className="text-2xl text-emerald-600 ml-2">days</span></p>
                <p className="mt-2 text-gray-600">Total days logged. Current streak: <span className="font-semibold text-emerald-700">{currentStreak}</span></p>
                {metrics.rolling_avg && metrics.rolling_avg.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">7-day rolling average shown as line</p>
                )}
              </div>
              <div className="flex-1">
                <Chart data={metrics.checkins || []} rolling={metrics.rolling_avg || []} />
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
                  {editingGoalId === g._id ? (
                    <div className="space-y-2">
                      <input value={goalEditForm.title} onChange={(e)=>setGoalEditForm({...goalEditForm, title: e.target.value})} className="w-full p-2 border rounded" />
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={3650} value={goalEditForm.target_days} onChange={(e)=>setGoalEditForm({...goalEditForm, target_days: Number(e.target.value)})} className="w-32 p-2 border rounded" />
                        <input type="date" value={goalEditForm.completed_date || ''} onChange={(e)=>setGoalEditForm({...goalEditForm, completed_date: e.target.value})} className="p-2 border rounded" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={saveGoalEdit} className="text-xs px-3 py-1 rounded bg-emerald-600 text-white">Save</button>
                        <button onClick={cancelGoalEdit} className="text-xs px-3 py-1 rounded bg-gray-100">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{g.title}</p>
                        <p className="text-sm text-gray-600">Target: {g.target_days} days</p>
                        <p className="text-xs text-gray-500">Start: {g.start_date ? new Date(g.start_date).toLocaleDateString() : '—'}{g.completed_date ? ` • Completed: ${new Date(g.completed_date).toLocaleDateString()}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>startEditGoal(g)} className="text-xs px-3 py-1 rounded bg-gray-100">Edit</button>
                        <button onClick={()=>markGoalDoneToday(g)} className="text-xs px-3 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Mark done today</button>
                      </div>
                    </div>
                  )}
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
