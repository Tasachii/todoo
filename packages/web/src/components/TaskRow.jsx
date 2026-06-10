import { motion } from 'framer-motion'
import { useUI } from '../App.jsx'
import { useTaskMutations } from '../hooks/useTasks.js'
import { isOverdue, formatDue } from '../lib/dates.js'
import { CheckIcon, TrashIcon } from './icons.jsx'

const SWIPE_THRESHOLD = 80

export default function TaskRow({ task, swipeable = true }) {
  const { patch, remove, restore } = useTaskMutations()
  const { openDetail, showUndo } = useUI()
  const done = task.status === 'done'
  const overdue = isOverdue(task)

  const toggleDone = () => {
    const prevStatus = task.status
    patch.mutate({ id: task.id, status: done ? 'todo' : 'done' })
    if (!done) showUndo('Task completed', () => patch.mutate({ id: task.id, status: prevStatus }))
  }

  const deleteTask = () => {
    remove.mutate(task.id)
    showUndo('Task deleted', () => restore.mutate(task.id))
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="relative list-none overflow-hidden rounded-2xl"
    >
      {/* swipe reveal underlay */}
      {swipeable && (
        <div className="absolute inset-0 flex">
          <div className="flex w-1/2 items-center justify-start rounded-l-2xl bg-emerald-500 pl-5 text-white">
            <CheckIcon size={22} />
          </div>
          <div className="flex w-1/2 items-center justify-end rounded-r-2xl bg-rose-500 pr-5 text-white">
            <TrashIcon size={20} />
          </div>
        </div>
      )}

      <motion.div
        drag={swipeable ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) toggleDone()
          else if (info.offset.x < -SWIPE_THRESHOLD) deleteTask()
        }}
        onTap={() => openDetail(task.id)}
        className="relative flex cursor-pointer touch-pan-y items-center gap-3.5 rounded-2xl border border-stone-200/60 bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-night-edge dark:bg-night-card"
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleDone()
          }}
          onPointerDownCapture={(e) => e.stopPropagation()}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all ${
            done
              ? 'border-accent bg-accent text-white'
              : 'border-stone-300 text-transparent hover:border-accent dark:border-stone-600'
          }`}
        >
          <CheckIcon size={13} strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[15px] leading-snug ${
              done ? 'text-stone-400 line-through dark:text-stone-500' : ''
            }`}
          >
            {task.title}
          </p>
          {(task.due_at || task.notes) && (
            <p className="mt-0.5 flex items-center gap-2 text-xs">
              {task.due_at && (
                <span className={overdue ? 'font-medium text-rose-500' : 'text-stone-400 dark:text-stone-500'}>
                  {formatDue(task.due_at)}
                </span>
              )}
              {task.notes && <span className="truncate text-stone-300 dark:text-stone-600">{task.notes}</span>}
            </p>
          )}
        </div>

        {task.priority > 0 && (
          <span className="shrink-0 text-xs font-semibold tracking-wider text-accent">
            {'!'.repeat(task.priority)}
          </span>
        )}
      </motion.div>
    </motion.li>
  )
}
