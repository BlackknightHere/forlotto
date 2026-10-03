import { useCallback, useEffect, useRef, useState } from 'react'
import { migrateData } from './lib.js'

const SAVE_DELAY = 250
const RETRY_DELAYS = [1000, 2000, 5000, 10000]
const CHANNEL = 'lotto-lung-meaw'

/**
 * Loads the whole database from the local server and saves it back (debounced)
 * after every change. `update(fn)` receives a mutable copy of the data.
 *
 * Only one browser tab may edit at a time: a newly opened tab tells the others (BroadcastChannel),
 * they save what they have and switch to status 'locked'. If a save is still rejected as stale (409),
 * the unsaved data is kept in memory and status becomes 'conflict' so the UI can block further typing.
 */
export function useDb() {
  const [data, setData] = useState(null)
  const [status, setStatusRaw] = useState('loading') // loading | saved | saving | error | conflict | locked
  const statusRef = useRef('loading')
  // While locked: did this tab manage to save its last changes? saving | saved | failed
  const [lockedSave, setLockedSave] = useState('saved')
  const version = useRef(0)
  const pending = useRef(null)
  const timer = useRef(null)
  const inFlight = useRef(false)
  const failures = useRef(0)
  const channel = useRef(null)

  // 'conflict' and 'locked' are sticky: background saves must not hide them.
  const setStatus = useCallback((s) => {
    const cur = statusRef.current
    if (cur === 'conflict') return
    if (cur === 'locked' && s !== 'conflict') return
    statusRef.current = s
    setStatusRaw(s)
  }, [])

  const load = useCallback(async () => {
    const s = await fetch('/api/db').then((r) => r.json())
    version.current = s.version
    setData(migrateData({ ...s.data }))
    setStatus('saved')
  }, [setStatus])

  const flush = useCallback(async () => {
    if (inFlight.current || !pending.current || statusRef.current === 'conflict') return
    const body = pending.current
    pending.current = null
    inFlight.current = true
    setStatus('saving')
    let retryIn = SAVE_DELAY
    try {
      const r = await fetch('/api/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: version.current, data: body }),
      })
      if (r.status === 409) {
        pending.current ??= body
        setStatus('conflict')
        return
      }
      if (!r.ok) throw new Error(await r.text())
      version.current = (await r.json()).version
      failures.current = 0
      channel.current?.postMessage({ type: 'saved', version: version.current })
      if (statusRef.current === 'locked' && !pending.current) setLockedSave('saved')
      setStatus(pending.current ? 'saving' : 'saved')
    } catch (err) {
      console.error(err)
      pending.current ??= body
      retryIn = RETRY_DELAYS[Math.min(failures.current, RETRY_DELAYS.length - 1)]
      failures.current++
      if (statusRef.current === 'locked') setLockedSave('failed')
      setStatus('error')
    } finally {
      inFlight.current = false
      if (pending.current && statusRef.current !== 'conflict') {
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, retryIn)
      }
    }
  }, [setStatus])

  useEffect(() => {
    load().catch(() => setStatus('error'))

    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(CHANNEL)
    channel.current = ch
    ch.onmessage = ({ data: msg }) => {
      if (msg?.type === 'hello') {
        // A newer tab took over: save what we have right away, then lock this one.
        clearTimeout(timer.current)
        flush()
        setStatus('locked')
        setLockedSave(pending.current || inFlight.current ? 'saving' : 'saved')
      } else if (msg?.type === 'saved' && msg.version > version.current) {
        // The other tab saved after we loaded (e.g. its last edits): pick them up if we have nothing unsaved.
        if (!pending.current && !inFlight.current && statusRef.current !== 'locked') load().catch(() => {})
      }
    }
    ch.postMessage({ type: 'hello' })
    return () => ch.close()
  }, [load, flush, setStatus])

  // Returns false (and changes nothing) while this tab is locked or in conflict, so callers must not report success.
  const update = useCallback(
    (fn) => {
      if (statusRef.current === 'locked' || statusRef.current === 'conflict') return false
      setData((prev) => {
        const next = structuredClone(prev)
        fn(next)
        pending.current = next
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, SAVE_DELAY)
        return next
      })
      return true
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

  // Reload from the server, deliberately dropping anything unsaved in this tab.
  const reload = useCallback(() => {
    pending.current = null
    location.reload()
  }, [])

  return { data, status, lockedSave, update, reload }
}
