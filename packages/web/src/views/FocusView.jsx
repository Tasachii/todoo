import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client.js'
import { useTasks, useTaskMutations } from '../hooks/useTasks.js'
import { localDayRange } from '../lib/dates.js'

const PRESETS = [15, 25, 45]

// Two soft sine notes — no asset files needed.
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const note = (freq, at, dur) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + at
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.start(t)
      osc.stop(t + dur + 0.05)
    }
    note(880, 0, 0.5)
    note(1318.5, 0.18, 0.8)
  } catch {
    /* audio not available — fine */
  }
}

// Always derive time from timestamps: iOS suspends JS in background,
// so counting down with an interval would drift.
function useNow(running) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [running])
  return now
}

function Ring({ progress, label, sub, color = 'text-accent' }) {
  const size = 272
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-stone-200/80 dark:stroke-night-edge"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          className={`${color} transition-[stroke-dashoffset] duration-300 ease-linear`}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-6xl font-medium tabular-nums tracking-tight">{label}</span>
        {sub && <span className="mt-2 max-w-52 truncate text-sm text-stone-400 dark:text-stone-500">{sub}</span>}
      </div>
    </div>
  )
}

const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function FocusView() {
  const qc = useQueryClient()
  const location = useLocation()
  const { data: tasks = [] } = useTasks()
  const { patch } = useTaskMutations()

  const { data: session } = useQuery({
    queryKey: ['focus-active'],
    queryFn: api.focusActive,
    refetchInterval: 60_000,
  })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings })

  const dayRange = localDayRange()
  const { data: stats } = useQuery({
    queryKey: ['stats', dayRange.from],
    queryFn: () => api.stats(dayRange.from, dayRange.to),
  })

  const candidates = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    return [...open.filter((t) => t.status === 'in_progress'), ...open.filter((t) => t.status === 'todo')]
  }, [tasks])

  const [taskId, setTaskId] = useState(() => location.state?.taskId ?? null)
  const [minutes, setMinutes] = useState(null)
  const [finished, setFinished] = useState(null) // session that just completed
  const [breakUntil, setBreakUntil] = useState(null)

  const defaultMinutes = settings ? Math.round(Number(settings.focus_duration_sec) / 60) : 25
  const breakMinutes = settings ? Math.round(Number(settings.break_duration_sec) / 60) : 5
  const chosenMinutes = minutes ?? defaultMinutes
  const selectedTaskId = taskId ?? candidates[0]?.id ?? null

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['focus-active'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const start = useMutation({
    mutationFn: () =>
      api.focusStart({ task_id: selectedTaskId, duration_sec: chosenMinutes * 60 }),
    onSuccess: () => {
      setFinished(null)
      invalidate()
    },
    onError: invalidate, // 409 → refetch shows the already-active session
  })
  const stop = useMutation({
    mutationFn: ({ id, completed }) => api.focusStop(id, completed),
    onSuccess: invalidate,
  })

  const now = useNow(Boolean(session) || Boolean(breakUntil))
  const remaining = session
    ? session.planned_sec - (now - new Date(session.started_at).getTime()) / 1000
    : 0

  // auto-finish exactly once per session
  const finishedFor = useRef(null)
  useEffect(() => {
    if (session && remaining <= 0 && finishedFor.current !== session.id) {
      finishedFor.current = session.id
      chime()
      setFinished(session)
      stop.mutate({ id: session.id, completed: true })
    }
  }, [session, remaining, stop])

  const breakRemaining = breakUntil ? (breakUntil - now) / 1000 : 0
  useEffect(() => {
    if (breakUntil && breakRemaining <= 0) {
      chime()
      setBreakUntil(null)
    }
  }, [breakUntil, breakRemaining])

  const focusedMin = Math.round((stats?.focus_sec ?? 0) / 60)

  return (
    <div className="flex flex-col">
      <header className="mb-8 mt-4 md:mt-0">
        <h1 className="font-display text-[2rem] font-semibold leading-tight">Focus</h1>
        <p className="mt-0.5 text-sm text-stone-400 dark:text-stone-500">
          {focusedMin > 0
            ? `${focusedMin} min focused today · ${stats.focus_sessions} session${stats.focus_sessions === 1 ? '' : 's'}`
            : 'One task, one timer, nothing else.'}
        </p>
      </header>

      {breakUntil ? (
        <div className="text-center">
          <Ring
            progress={breakRemaining / (breakMinutes * 60)}
            label={mmss(breakRemaining)}
            sub="Break — breathe."
            color="text-emerald-500"
          />
          <button
            onClick={() => setBreakUntil(null)}
            className="mt-8 rounded-full border border-stone-300 px-6 py-2.5 text-sm text-stone-500 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-400"
          >
            Skip break
          </button>
        </div>
      ) : session ? (
        <div className="text-center">
          <Ring
            progress={remaining / session.planned_sec}
            label={mmss(remaining)}
            sub={session.task_title ?? 'Focusing'}
          />
          <button
            onClick={() => stop.mutate({ id: session.id, completed: false })}
            className="mt-8 rounded-full border border-stone-300 px-6 py-2.5 text-sm text-stone-500 transition-colors hover:border-rose-400 hover:text-rose-500 dark:border-stone-600 dark:text-stone-400"
          >
            Give up early
          </button>
        </div>
      ) : finished ? (
        <div className="mx-auto w-full max-w-sm rounded-3xl border border-stone-200/60 bg-card p-8 text-center dark:border-night-edge dark:bg-night-card">
          <p className="font-display text-2xl italic">Session complete.</p>
          {finished.task_id && (
            <p className="mt-1 truncate text-sm text-stone-400">{finished.task_title}</p>
          )}
          <div className="mt-6 flex flex-col gap-2.5">
            {finished.task_id && (
              <button
                onClick={() => {
                  patch.mutate({ id: finished.task_id, status: 'done' })
                  setFinished(null)
                }}
                className="rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-stone-50 dark:bg-stone-100 dark:text-stone-900"
              >
                Mark task done
              </button>
            )}
            <button
              onClick={() => {
                setFinished(null)
                setBreakUntil(Date.now() + breakMinutes * 60_000)
              }}
              className="rounded-xl bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              Take a {breakMinutes}-min break
            </button>
            <button
              onClick={() => setFinished(null)}
              className="py-1 text-sm text-stone-400 hover:text-stone-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-sm">
          <Ring progress={1} label={mmss(chosenMinutes * 60)} sub="Ready when you are." />

          <div className="mt-8 space-y-4">
            <div className="flex justify-center gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    chosenMinutes === m
                      ? 'bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900'
                      : 'bg-stone-100 text-stone-500 hover:text-stone-800 dark:bg-night-edge dark:text-stone-400'
                  }`}
                >
                  {m}m
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="240"
                placeholder="…"
                value={PRESETS.includes(chosenMinutes) ? '' : chosenMinutes}
                onChange={(e) => e.target.value && setMinutes(Number(e.target.value))}
                className="w-16 rounded-full bg-stone-100 px-4 py-2 text-center text-sm outline-none dark:bg-night-edge"
                aria-label="Custom minutes"
              />
            </div>

            <select
              value={selectedTaskId ?? ''}
              onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : null)}
              className="w-full appearance-none rounded-xl bg-stone-100 px-4 py-3 text-sm outline-none dark:bg-night-edge"
            >
              <option value="">No specific task</option>
              {candidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.status === 'in_progress' ? '● ' : ''}
                  {t.title}
                </option>
              ))}
            </select>

            <button
              onClick={() => start.mutate()}
              disabled={start.isPending}
              className="w-full rounded-xl bg-accent py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-amber-600/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              Start focusing
            </button>
            {start.isError && (
              <p className="text-center text-xs text-rose-500">{start.error.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
