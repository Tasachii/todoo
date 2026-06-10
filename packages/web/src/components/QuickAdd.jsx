import { useState } from 'react'
import { useTaskMutations } from '../hooks/useTasks.js'
import { fromLocalInput } from '../lib/dates.js'
import { PlusIcon, ClockIcon } from './icons.jsx'

export default function QuickAdd() {
  const { create } = useTaskMutations()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [showDue, setShowDue] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    create.mutate({ title: trimmed, due_at: fromLocalInput(due) })
    setTitle('')
    setDue('')
    setShowDue(false)
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-stone-200/60 bg-card shadow-[0_1px_3px_rgba(28,25,23,0.05)] dark:border-night-edge dark:bg-night-card"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-accent">
          <PlusIcon size={18} />
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task, press Enter…"
          enterKeyHint="done"
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
        />
        <button
          type="button"
          onClick={() => setShowDue((s) => !s)}
          aria-label="Set due time"
          className={`transition-colors ${showDue || due ? 'text-accent' : 'text-stone-300 hover:text-stone-500 dark:text-stone-600'}`}
        >
          <ClockIcon size={18} />
        </button>
      </div>
      {showDue && (
        <div className="border-t border-stone-100 px-4 py-2.5 dark:border-night-edge">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full bg-transparent text-sm text-stone-600 outline-none dark:text-stone-300 dark:[color-scheme:dark]"
          />
        </div>
      )}
    </form>
  )
}
