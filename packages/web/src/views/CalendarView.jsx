import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useTasks } from '../hooks/useTasks.js'
import { dayKey } from '../lib/dates.js'
import TaskRow from '../components/TaskRow.jsx'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons.jsx'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function CalendarView() {
  const { data: tasks = [] } = useTasks()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [mode, setMode] = useState('month') // 'month' | 'upcoming'

  const byDay = useMemo(() => {
    const map = new Map()
    for (const t of tasks) {
      if (!t.due_at) continue
      const key = dayKey(new Date(t.due_at))
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(t)
    }
    return map
  }, [tasks])

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  const selectedTasks = byDay.get(dayKey(selected)) ?? []
  const upcomingDays = [...Array(7)].map((_, i) => addDays(startOfDay(new Date()), i))

  return (
    <div>
      <header className="mb-5 mt-4 flex items-end justify-between md:mt-0">
        <h1 className="font-display text-[2rem] font-semibold leading-tight">
          Calendar
          <span className="ml-2.5 hidden align-middle text-base font-normal tracking-[0.2em] text-stone-300 wa:inline dark:text-stone-600"
            aria-hidden="true">
            暦
          </span>
        </h1>
        <div className="flex rounded-full bg-stone-100 p-1 text-xs font-medium dark:bg-night-edge">
          {['month', 'upcoming'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1.5 capitalize transition-all ${
                mode === m
                  ? 'bg-card text-stone-900 shadow-sm dark:bg-night-card dark:text-stone-100'
                  : 'text-stone-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {mode === 'month' ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg italic">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setMonth((m) => addMonths(m, -1))}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-night-edge"
              >
                <ChevronLeftIcon size={17} />
              </button>
              <button
                onClick={() => setMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-night-edge"
              >
                <ChevronRightIcon size={17} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-300 dark:text-stone-600">
                {d}
              </span>
            ))}
            {days.map((day) => {
              const inMonth = isSameMonth(day, month)
              const dayTasks = byDay.get(dayKey(day)) ?? []
              const openCount = dayTasks.filter((t) => t.status !== 'done').length
              const isSel = isSameDay(day, selected)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(day)}
                  className={`mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-2xl text-sm transition-colors ${
                    isSel
                      ? 'bg-stone-900 font-semibold text-stone-50 dark:bg-stone-100 dark:text-stone-900'
                      : isToday(day)
                        ? 'font-semibold text-accent'
                        : inMonth
                          ? 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-night-edge'
                          : 'text-stone-300 dark:text-stone-600'
                  }`}
                >
                  {format(day, 'd')}
                  <span className="mt-0.5 flex h-1 gap-0.5">
                    {dayTasks.slice(0, 3).map((t, i) => (
                      <span
                        key={i}
                        className={`h-1 w-1 rounded-full ${
                          isSel ? 'bg-accent-bright' : openCount ? 'bg-accent' : 'bg-stone-300 dark:bg-stone-600'
                        }`}
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>

          <section className="mt-7">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
              {format(selected, 'EEEE d MMMM')}
            </h3>
            {selectedTasks.length ? (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {selectedTasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <p className="py-6 text-center font-display text-sm italic text-stone-300 dark:text-stone-600">
                Nothing planned this day.
              </p>
            )}
          </section>
        </>
      ) : (
        <div className="space-y-7">
          {upcomingDays.map((day) => {
            const dayTasks = byDay.get(dayKey(day)) ?? []
            if (!dayTasks.length) return null
            return (
              <section key={day.toISOString()}>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
                  {isToday(day) ? 'Today' : format(day, 'EEEE d MMMM')}
                </h3>
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {dayTasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            )
          })}
          {!upcomingDays.some((d) => byDay.get(dayKey(d))?.length) && (
            <p className="mt-16 text-center font-display text-lg italic text-stone-400 dark:text-stone-500">
              A quiet week ahead.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
