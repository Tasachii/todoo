const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const Icon = ({ children, size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base} {...props}>
    {children}
  </svg>
)

export const TodayIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </Icon>
)
export const BoardIcon = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="4.5" height="16" rx="1.5" />
    <rect x="10" y="4" width="4.5" height="11" rx="1.5" />
    <rect x="16" y="4" width="4.5" height="7" rx="1.5" />
  </Icon>
)
export const CalendarIcon = (p) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M4 10h16M8.5 3.5v3M15.5 3.5v3" />
  </Icon>
)
export const FocusIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9.5V13l2.5 1.5M10 2.5h4" />
  </Icon>
)
export const SunIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
  </Icon>
)
export const MoonIcon = (p) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
  </Icon>
)
export const AutoThemeIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17M12 3.5a8.5 8.5 0 0 1 0 17" fill="currentColor" stroke="none" />
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" />
  </Icon>
)
export const PlusIcon = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)
export const TrashIcon = (p) => (
  <Icon {...p}>
    <path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M7 7l.8 12a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 7M10.5 11v5M13.5 11v5" />
  </Icon>
)
export const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)
export const ChevronLeftIcon = (p) => (
  <Icon {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Icon>
)
export const ChevronRightIcon = (p) => (
  <Icon {...p}>
    <path d="M9.5 5.5L16 12l-6.5 6.5" />
  </Icon>
)
export const CloseIcon = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
export const FlagIcon = (p) => (
  <Icon {...p}>
    <path d="M6 21V4.5M6 4.5c2.5-1.5 5-1.5 7.5 0s5 1.5 7-.0V14c-2 1.5-4.5 1.5-7 0s-5-1.5-7.5 0" />
  </Icon>
)
