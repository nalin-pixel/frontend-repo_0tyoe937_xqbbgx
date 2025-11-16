import { useEffect, useMemo, useState } from 'react'

function App() {
  const baseUrl = useMemo(() => import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000', [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [streak, setStreak] = useState(0)
  const [tips, setTips] = useState([])
  const [journalItems, setJournalItems] = useState([])
  const [goals, setGoals] = useState([])

  const [journalForm, setJournalForm] = useState({ note: '', intensity: 5, feeling: '' })
  const [goalForm, setGoalForm] = useState({ title: '', target_days: 30 })

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
  }

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [tipsRes, journalRes, goalsRes, streakRes] = await Promise.all([
        fetchJson(`${baseUrl}/api/tips`),
        fetchJson(`${baseUrl}/api/journal`),
        fetchJson(`${baseUrl}/api/goals`),
        fetchJson(`${baseUrl}/api/streak`)
      ])
      setTips(tipsRes.tips || [])
      setJournalItems(journalRes.items || [])
      setGoals(goalsRes.items || [])
      setStreak(streakRes.days_logged || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const handleCheckIn = async () => {
    setLoading(true)
    setError('')
    try {
      await fetchJson(`${baseUrl}/api/checkin`, { method: 'POST', body: JSON.stringify({}) })
      await Promise.all([loadStreakOnly(), loadJournalOnly()])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const loadStreakOnly = async () => {
    try { const s = await fetchJson(`${baseUrl}/api/streak`); setStreak(s.days_logged || 0) } catch {}
  }
  const loadJournalOnly = async () => {
    try { const j = await fetchJson(`${baseUrl}/api/journal`); setJournalItems(j.items || []) } catch {}
  }
  const loadGoalsOnly = async () => {
    try { const g = await fetchJson(`${baseUrl}/api/goals`); setGoals(g.items || []) } catch {}
  }

  const submitJournal = async (e) => {
    e.preventDefault()
    if (!journalForm.note.trim()) return
    setLoading(true)
    setError('')
    try {
      await fetchJson(`${baseUrl}/api/journal`, { method: 'POST', body: JSON.stringify(journalForm) })
      setJournalForm({ note: '', intensity: 5, feeling: '' })
      await loadJournalOnly()
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-emerald-50">
      <header className="px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Recovery Companion</h1>
          <div className="text-sm text-gray-500">Backend: <span className="font-mono">{baseUrl}</span></div>
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
            <p className="text-5xl font-extrabold text-emerald-700">{streak}<span className="text-2xl text-emerald-600 ml-2">days</span></p>
            <p className="mt-2 text-gray-600">Show up daily. Small, consistent wins compound.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Quick Tips</h2>
            <ul className="space-y-2">
              {tips.map((t, i) => (
                <li key={i} className="text-gray-700 text-sm flex gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400"></span>{t}</li>
              ))}
            </ul>
            <button onClick={loadAll} className="mt-4 text-emerald-700 hover:text-emerald-800 text-sm">Refresh tips</button>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Log an Urge or Trigger</h3>
            <form onSubmit={submitJournal} className="space-y-3">
              <textarea
                value={journalForm.note}
                onChange={(e) => setJournalForm({ ...journalForm, note: e.target.value })}
                placeholder="What happened? What did you do instead?"
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
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Set a Goal</h3>
            <form onSubmit={submitGoal} className="space-y-3">
              <input
                type="text"
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                placeholder="Example: 30-day no-porn challenge"
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
      </main>
    </div>
  )
}

export default App
