import { useCallback, useEffect, useRef, useState } from 'react'

const SAVE_DELAY = 250

/**
 * Loads the whole database from the local server and saves it back (debounced)
 * after every change. `update(fn)` receives a mutable copy of the data.
 */
export function useDb() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading') // loading | saved | saving | error | conflict
  const version = useRef(0)
  const pending = useRef(null)
  const timer = useRef(null)
  const inFlight = useRef(false)

  useEffect(() => {
    fetch('/api/db')
      .then((r) => r.json())
      .then((s) => {
        version.current = s.version
        setData({ events: [], entries: [], settings: {}, ...s.data })
        setStatus('saved')
      })
      .catch(() => setStatus('error'))
  }, [])

  const flush = useCallback(async () => {
    if (inFlight.current || !pending.current) return
    const body = pending.current
    pending.current = null
    inFlight.current = true
    setStatus('saving')
    try {
      const r = await fetch('/api/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: version.current, data: body }),
      })
      if (r.status === 409) {
        setStatus('conflict')
        return
      }
      if (!r.ok) throw new Error(await r.text())
      version.current = (await r.json()).version
      setStatus(pending.current ? 'saving' : 'saved')
    } catch (err) {
      console.error(err)
      pending.current ??= body
      setStatus('error')
    } finally {
      inFlight.current = false
      if (pending.current) timer.current = setTimeout(flush, SAVE_DELAY)
    }
  }, [])

  const update = useCallback(
    (fn) => {
      setData((prev) => {
        const next = structuredClone(prev)
        fn(next)
        pending.current = next
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, SAVE_DELAY)
        return next
      })
    },
    [flush],
  )

  useEffect(() => {
    const warn = (e) => {
      if (pending.current || inFlight.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  return { data, status, update }
}
