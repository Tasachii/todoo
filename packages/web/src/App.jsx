import { useState, useCallback, useRef, createContext, useContext, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import TaskDetail from './components/TaskDetail.jsx'
import UndoToast from './components/UndoToast.jsx'
import TodayView from './views/TodayView.jsx'

// Code-split the secondary views so the initial bundle stays lean
// (BoardView alone pulls in all of dnd-kit).
const BoardView = lazy(() => import('./views/BoardView.jsx'))
const CalendarView = lazy(() => import('./views/CalendarView.jsx'))
const FocusView = lazy(() => import('./views/FocusView.jsx'))

const UIContext = createContext(null)
export const useUI = () => useContext(UIContext)

export default function App() {
  const [detailId, setDetailId] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()

  const showUndo = useCallback((label, onUndo) => {
    clearTimeout(toastTimer.current)
    setToast({ label, onUndo })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  return (
    <UIContext.Provider value={{ openDetail: setDetailId, showUndo }}>
      <AppShell>
        <Suspense
          fallback={
            <p className="mt-24 text-center font-display text-sm italic text-stone-300 dark:text-stone-600">
              Loading…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<TodayView />} />
            <Route path="/board" element={<BoardView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/focus" element={<FocusView />} />
          </Routes>
        </Suspense>
      </AppShell>
      <TaskDetail taskId={detailId} onClose={() => setDetailId(null)} />
      <UndoToast toast={toast} onDismiss={dismissToast} />
    </UIContext.Provider>
  )
}
