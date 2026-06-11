import { createLocalApi } from './local.js'

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status})`)
    err.code = data?.error?.code
    throw err
  }
  return data
}

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '')
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

const httpApi = {
  tasks: (params) => request(`/api/tasks${qs(params)}`).then((d) => d.tasks),
  createTask: (body) => request('/api/tasks', { method: 'POST', body }).then((d) => d.task),
  patchTask: (id, body) => request(`/api/tasks/${id}`, { method: 'PATCH', body }).then((d) => d.task),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }).then((d) => d.task),
  restoreTask: (id) => request(`/api/tasks/${id}/restore`, { method: 'POST' }).then((d) => d.task),

  focusStart: (body) => request('/api/focus/start', { method: 'POST', body }).then((d) => d.session),
  focusStop: (id, completed) =>
    request(`/api/focus/${id}/stop`, { method: 'POST', body: { completed } }).then((d) => d.session),
  focusActive: () => request('/api/focus/active').then((d) => d.session),

  stats: (from, to) => request(`/api/stats${qs({ from, to })}`),
  settings: () => request('/api/settings').then((d) => d.settings),
  saveSettings: (body) => request('/api/settings', { method: 'PUT', body }).then((d) => d.settings),
}

// Inside the native app (Capacitor) there is no local server — the data
// engine runs in-process instead. VITE_STANDALONE=1 forces the same mode
// for plain web builds (useful for testing the standalone app in a browser).
export const isStandalone =
  (typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())) ||
  import.meta.env.VITE_STANDALONE === '1'

export const api = isStandalone ? createLocalApi() : httpApi
