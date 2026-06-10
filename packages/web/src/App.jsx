import { useState, useCallback, useRef, createContext, useContext } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import TaskDetail from './components/TaskDetail.jsx'
import UndoToast from './components/UndoToast.jsx'
import TodayView from './views/TodayView.jsx'
import BoardView from './views/BoardView.jsx'
import CalendarView from './views/CalendarView.jsx'
import FocusView from './views/FocusView.jsx'

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
        <Routes>
          <Route path="/" element={<TodayView />} />
          <Route path="/board" element={<BoardView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/focus" element={<FocusView />} />
        </Routes>
      </AppShell>
      <TaskDetail taskId={detailId} onClose={() => setDetailId(null)} />
      <UndoToast toast={toast} onDismiss={dismissToast} />
    </UIContext.Provider>
  )
}
