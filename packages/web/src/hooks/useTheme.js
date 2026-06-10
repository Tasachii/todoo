import { useEffect, useState } from 'react'

const STORAGE_KEY = 'todoo-theme'
export const THEMES = ['auto', 'light', 'dark']

export function useTheme() {
  const [pref, setPref] = useState(() => localStorage.getItem(STORAGE_KEY) || 'auto')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, pref)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        pref === 'dark' || (pref === 'auto' && mq.matches)
      )
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])

  return [pref, setPref]
}
