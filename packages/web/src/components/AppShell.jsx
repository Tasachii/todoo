import { NavLink } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme.js'
import {
  TodayIcon,
  BoardIcon,
  CalendarIcon,
  FocusIcon,
  SunIcon,
  MoonIcon,
  AutoThemeIcon,
} from './icons.jsx'

const TABS = [
  { to: '/', label: 'Today', icon: TodayIcon },
  { to: '/board', label: 'Board', icon: BoardIcon },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/focus', label: 'Focus', icon: FocusIcon },
]

function ThemeButton() {
  const [pref, setPref] = useTheme()
  const next = { auto: 'light', light: 'dark', dark: 'auto' }
  const Icon = pref === 'light' ? SunIcon : pref === 'dark' ? MoonIcon : AutoThemeIcon
  return (
    <button
      onClick={() => setPref(next[pref])}
      title={`Theme: ${pref}`}
      className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-night-edge dark:hover:text-stone-100"
    >
      <Icon size={18} />
    </button>
  )
}

const Wordmark = ({ className = '' }) => (
  <span className={`font-display italic font-semibold tracking-tight ${className}`}>
    Todoo<span className="text-accent not-italic">.</span>
  </span>
)

export default function AppShell({ children }) {
  return (
    <div className="min-h-dvh">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-stone-200/70 px-4 py-6 md:flex dark:border-night-edge">
        <Wordmark className="px-3 text-2xl" />
        <nav className="mt-8 flex flex-col gap-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition-colors ${
                  isActive
                    ? 'bg-stone-900 font-medium text-stone-50 dark:bg-stone-100 dark:text-stone-900'
                    : 'text-stone-500 hover:bg-stone-200/50 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-night-edge dark:hover:text-stone-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2">
          <ThemeButton />
        </div>
      </aside>

      {/* mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-paper/80 px-5 pb-2 backdrop-blur-md md:hidden dark:bg-night/80"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
      >
        <Wordmark className="text-xl" />
        <ThemeButton />
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-32 pt-2 md:pl-64 md:pr-8 md:pt-10 lg:mx-auto lg:max-w-3xl">
        {children}
      </main>

      {/* mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/70 bg-paper/90 backdrop-blur-md md:hidden dark:border-night-edge dark:bg-night/90"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  isActive ? 'text-accent' : 'text-stone-400 dark:text-stone-500'
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
