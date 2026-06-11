import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../App.jsx'
import { useTasks, useTaskMutations } from '../hooks/useTasks.js'
import { toLocalInput, fromLocalInput } from '../lib/dates.js'
import { CloseIcon, FocusIcon, TrashIcon } from './icons.jsx'

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'Doing' },
  { value: 'done', label: 'Done' },
]
const PRIORITIES = [
  { value: 0, label: 'None' },
  { value: 1, label: '!' },
  { value: 2, label: '!!' },
  { value: 3, label: '!!!' },
]

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function Sheet({ task, onClose }) {
  const { patch, remove, restore } = useTaskMutations()
  const { showUndo } = useUI()
  const navigate = useNavigate()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)

  const save = (body) => patch.mutate({ id: task.id, ...body })

  const segmented = (options, current, onPick) => (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-night-edge"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPick(opt.value)}
          className={`rounded-lg py-1.5 text-sm transition-all ${
            current === opt.value
              ? 'bg-card font-medium text-stone-900 shadow-sm dark:bg-night-card dark:text-stone-100'
              : 'text-stone-500 dark:text-stone-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex max-h-[85dvh] flex-col">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="font-display text-lg italic text-stone-400 dark:text-stone-500">Details</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-night-edge"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
          className="w-full bg-transparent font-display text-2xl font-medium outline-none"
        />

        <Field label="Status">{segmented(STATUSES, task.status, (v) => save({ status: v }))}</Field>

        <Field label="When">
          <input
            type="datetime-local"
            value={toLocalInput(task.due_at)}
            onChange={(e) => save({ due_at: fromLocalInput(e.target.value) })}
            className="w-full rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm outline-none dark:bg-night-edge dark:[color-scheme:dark]"
          />
        </Field>

        <Field label="Priority">
          {segmented(PRIORITIES, task.priority, (v) => save({ priority: v }))}
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== task.notes && save({ notes })}
            rows={Math.max(3, notes.split('\n').length)}
            placeholder="Anything else…"
            className="w-full resize-none rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm leading-relaxed outline-none placeholder:text-stone-400 dark:bg-night-edge"
          />
        </Field>
      </div>

      <div className="flex gap-2.5 border-t border-stone-100 px-6 py-4 dark:border-night-edge"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <button
          onClick={() => {
            onClose()
            navigate('/focus', { state: { taskId: task.id } })
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-stone-50 transition-opacity hover:opacity-90 dark:bg-stone-100 dark:text-stone-900"
        >
          <FocusIcon size={16} /> Start focus
        </button>
        <button
          onClick={() => {
            remove.mutate(task.id)
            showUndo('Task deleted', () => restore.mutate(task.id))
            onClose()
          }}
          aria-label="Delete task"
          className="flex w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
        >
          <TrashIcon size={17} />
        </button>
      </div>
    </div>
  )
}

export default function TaskDetail({ taskId, onClose }) {
  const { data: tasks } = useTasks()
  const task = tasks?.find((t) => t.id === taskId)

  useEffect(() => {
    if (!task) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task, onClose])

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 flex items-end justify-center bg-stone-900/30 backdrop-blur-[2px] md:items-center dark:bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 48, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl bg-card shadow-2xl md:max-w-lg md:rounded-3xl dark:bg-night-card"
          >
            <Sheet key={task.id} task={task} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
