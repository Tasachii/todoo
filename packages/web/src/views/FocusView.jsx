import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client.js'
import { useTasks, useTaskMutations } from '../hooks/useTasks.js'
import { localDayRange, dayKey } from '../lib/dates.js'

const TIMER_PRESETS = [15, 25, 45]
// work/break minutes — the classic pomodoro and a deep-work variant
const POMODORO_PRESETS = [
  { work: 25, brk: 5 },
  { work: 50, brk: 10 },
]
const ROUND_KEY = 'todoo-pomodoro-round'

// The current round survives a reload but resets each day.
function loadRound() {
  const raw = localStorage.getItem(ROUND_KEY)
  if (!raw) return 1
  try {
    const { round, day } = JSON.parse(raw)
    if (day === dayKey(new Date()) && Number.isInteger(round) && round >= 1) return round
  } catch {
    /* corrupt — start fresh */
  }
  return 1
}
function saveRound(round) {
  localStorage.setItem(ROUND_KEY, JSON.stringify({ round, day: dayKey(new Date()) }))
}

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

function RoundDots({ round, total }) {
  return (
    <span
      className="flex items-center justify-center gap-1.5"
      role="img"
      aria-label={`Round ${round} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            i + 1 < round
              ? 'bg-accent'
              : i + 1 === round
                ? 'bg-accent/40 ring-1 ring-accent'
                : 'bg-stone-200 dark:bg-night-edge'
          }`}
        />
      ))}
    </span>
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

  // undefined = no choice yet (default to top candidate); null = explicitly "no task"
  const [taskId, setTaskId] = useState(() => location.state?.taskId)
  const [minutes, setMinutes] = useState(null)
  const [finished, setFinished] = useState(null) // session that just completed
  const [breakUntil, setBreakUntil] = useState(null)
  const [breakTotal, setBreakTotal] = useState(300) // seconds, for the break ring
  const [breakKind, setBreakKind] = useState('short') // 'short' | 'long'
  // Captured when a break starts, so toggling the style mid-break
  // cannot change how (or whether) the round advances.
  const [breakMode, setBreakMode] = useState('timer')
  const [round, setRound] = useState(loadRound)
  // Local override so the toggle feels instant; the saved setting syncs devices.
  const [modeChoice, setModeChoice] = useState(null)
  const [pomoChoice, setPomoChoice] = useState(null)

  const saveSettings = useMutation({
    mutationFn: (body) => api.saveSettings(body),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const mode = modeChoice ?? settings?.focus_style ?? 'timer'
  const setMode = (m) => {
    setModeChoice(m)
    saveSettings.mutate({ focus_style: m })
  }

  const defaultMinutes = settings ? Math.round(Number(settings.focus_duration_sec) / 60) : 25
  const breakMinutes = settings ? Math.round(Number(settings.break_duration_sec) / 60) : 5
  const chosenMinutes = minutes ?? defaultMinutes

  const workMin = pomoChoice?.work ?? Math.round(Number(settings?.pomodoro_work_sec ?? 1500) / 60)
  const brkMin = pomoChoice?.brk ?? Math.round(Number(settings?.pomodoro_break_sec ?? 300) / 60)
  const longMin = Math.round(Number(settings?.pomodoro_long_break_sec ?? 900) / 60)
  const totalRounds = Math.max(1, Math.round(Number(settings?.pomodoro_rounds ?? 4)) || 4)
  const pickPomodoro = (p) => {
    setPomoChoice(p)
    saveSettings.mutate({ pomodoro_work_sec: p.work * 60, pomodoro_break_sec: p.brk * 60 })
  }

  const selectedTaskId = taskId === undefined ? (candidates[0]?.id ?? null) : taskId

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['focus-active'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const start = useMutation({
    mutationFn: () =>
      api.focusStart({
        task_id: selectedTaskId,
        duration_sec: mode === 'pomodoro' ? workMin * 60 : chosenMinutes * 60,
      }),
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
      if (mode === 'pomodoro') {
        // classic pomodoro: the break starts itself; the long one after the last round
        const isLong = round >= totalRounds
        const sec = (isLong ? longMin : brkMin) * 60
        setBreakKind(isLong ? 'long' : 'short')
        setBreakMode('pomodoro')
        setBreakTotal(sec)
        setBreakUntil(Date.now() + sec * 1000)
      }
    }
  }, [session, remaining, stop, mode, round, totalRounds, brkMin, longMin])

  const breakRemaining = breakUntil ? (breakUntil - now) / 1000 : 0
  // end exactly once per break (mirrors finishedFor); breakUntil doubles as the break's id
  const breakEndedFor = useRef(null)
  const endBreak = () => {
    if (breakUntil == null || breakEndedFor.current === breakUntil) return
    breakEndedFor.current = breakUntil
    setBreakUntil(null)
    if (breakMode === 'pomodoro') {
      const next = breakKind === 'long' ? 1 : round + 1
      setRound(next)
      saveRound(next)
      setFinished(null)
    }
  }
  useEffect(() => {
    if (breakUntil && breakRemaining <= 0 && breakEndedFor.current !== breakUntil) {
      chime()
      endBreak()
    }
  }, [breakUntil, breakRemaining, breakMode, breakKind, round]) // eslint-disable-line react-hooks/exhaustive-deps

  const focusedMin = Math.round((stats?.focus_sec ?? 0) / 60)

  return (
    <div className="flex flex-col">
      <header className="mb-8 mt-4 flex items-end justify-between md:mt-0">
        <div>
          <h1 className="font-display text-[2rem] font-semibold leading-tight">Focus</h1>
          <p className="mt-0.5 text-sm text-stone-400 dark:text-stone-500">
            {focusedMin > 0
              ? `${focusedMin} min focused today · ${stats.focus_sessions} session${stats.focus_sessions === 1 ? '' : 's'}`
              : 'One task, one timer, nothing else.'}
          </p>
        </div>
        <div className="flex rounded-full bg-stone-100 p-1 text-xs font-medium dark:bg-night-edge">
          {[
            { value: 'timer', label: 'Timer' },
            { value: 'pomodoro', label: 'Pomodoro' },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-full px-3.5 py-1.5 transition-all ${
                mode === m.value
                  ? 'bg-card text-stone-900 shadow-sm dark:bg-night-card dark:text-stone-100'
                  : 'text-stone-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {breakUntil ? (
        <div className="text-center">
          <Ring
            progress={breakRemaining / breakTotal}
            label={mmss(breakRemaining)}
            sub={breakKind === 'long' ? 'Long break — stretch.' : 'Break — breathe.'}
            color="text-emerald-500"
          />
          {breakMode === 'pomodoro' && (
            <div className="mt-5">
              <RoundDots round={round} total={totalRounds} />
            </div>
          )}
          <div className="mx-auto mt-7 flex w-full max-w-xs flex-col gap-2.5">
            {breakMode === 'pomodoro' && finished?.task_id && (
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
              onClick={endBreak}
              className="rounded-full border border-stone-300 px-6 py-2.5 text-sm text-stone-500 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-400"
            >
              Skip break
            </button>
          </div>
        </div>
      ) : session ? (
        <div className="text-center">
          <Ring
            progress={remaining / session.planned_sec}
            label={mmss(remaining)}
            sub={session.task_title ?? 'Focusing'}
          />
          {mode === 'pomodoro' && (
            <div className="mt-5">
              <RoundDots round={round} total={totalRounds} />
            </div>
          )}
          <button
            onClick={() => stop.mutate({ id: session.id, completed: false })}
            className="mt-7 rounded-full border border-stone-300 px-6 py-2.5 text-sm text-stone-500 transition-colors hover:border-rose-400 hover:text-rose-500 dark:border-stone-600 dark:text-stone-400"
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
                setBreakKind('short')
                setBreakMode('timer')
                setBreakTotal(breakMinutes * 60)
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
          <Ring
            progress={1}
            label={mmss((mode === 'pomodoro' ? workMin : chosenMinutes) * 60)}
            sub={mode === 'pomodoro' ? `Round ${round} of ${totalRounds}` : 'Ready when you are.'}
          />

          <div className="mt-8 space-y-4">
            {mode === 'pomodoro' ? (
              <>
                <div className="flex justify-center">
                  <RoundDots round={round} total={totalRounds} />
                </div>
                <div className="flex justify-center gap-2">
                  {POMODORO_PRESETS.map((p) => (
                    <button
                      key={p.work}
                      onClick={() => pickPomodoro(p)}
                      className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                        workMin === p.work && brkMin === p.brk
                          ? 'bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900'
                          : 'bg-stone-100 text-stone-500 hover:text-stone-800 dark:bg-night-edge dark:text-stone-400'
                      }`}
                    >
                      {p.work} / {p.brk}
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-stone-400 dark:text-stone-500">
                  {workMin} min focus · {brkMin} min break · {longMin} min long break after round{' '}
                  {totalRounds}
                </p>
              </>
            ) : (
              <div className="flex justify-center gap-2">
                {TIMER_PRESETS.map((m) => (
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
                  value={TIMER_PRESETS.includes(chosenMinutes) ? '' : chosenMinutes}
                  onChange={(e) => e.target.value && setMinutes(Number(e.target.value))}
                  className="w-16 rounded-full bg-stone-100 px-4 py-2 text-center text-sm outline-none dark:bg-night-edge"
                  aria-label="Custom minutes"
                />
              </div>
            )}

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
              {mode === 'pomodoro' && round > 1 ? `Start round ${round}` : 'Start focusing'}
            </button>
            {mode === 'pomodoro' && round > 1 && (
              <button
                onClick={() => {
                  setRound(1)
                  saveRound(1)
                }}
                className="w-full py-1 text-center text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                Reset cycle
              </button>
            )}
            {start.isError && (
              <p className="text-center text-xs text-rose-500">{start.error.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
