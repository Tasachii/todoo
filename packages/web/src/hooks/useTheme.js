import { useEffect, useState } from 'react'

const STORAGE_KEY = 'todoo-theme'
export const THEMES = ['auto', 'light', 'dark', 'wa']

export function useTheme() {
  const [pref, setPref] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(stored) ? stored : 'auto'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, pref)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.classList.toggle(
        'dark',
        pref === 'dark' || (pref === 'auto' && mq.matches)
      )
      // wa (和) is its own warm light theme — see index.css [data-theme="wa"]
      if (pref === 'wa') document.documentElement.dataset.theme = 'wa'
      else delete document.documentElement.dataset.theme
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])

  return [pref, setPref]
}
