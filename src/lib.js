export const OWNERS = { meaw: 'ลุงแมว', jik: 'ป้าจิก' }
export const OWNER_KEYS = ['meaw', 'jik']
export const TYPES = { top: '2 ตัวบน', bottom: '2 ตัวล่าง', three: '3 ตัว' }
export const TYPE_KEYS = ['top', 'bottom', 'three']
export const DEFAULT_DISCOUNT = 20

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const pad = (n, len) => String(n).padStart(len, '0')
export const numbersFor = (type) =>
  type === 'three' ? Array.from({ length: 1000 }, (_, i) => pad(i, 3)) : Array.from({ length: 100 }, (_, i) => pad(i, 2))

export const sortDigits = (n) => n.split('').sort().join('')

/** Distinct orderings of a number's digits, sorted: '123' -> 6 numbers, '112' -> 3, '111' -> 1. */
export function permutations(number) {
  const out = new Set()
  const walk = (rest, acc) => {
    if (!rest) return out.add(acc)
    for (let i = 0; i < rest.length; i++) walk(rest.slice(0, i) + rest.slice(i + 1), acc + rest[i])
  }
  walk(number, '')
  return [...out].sort()
}

/** "กลับ" marker typed in the โต๊ด box: '3x' / '6x' (also X, ×, *, or ป = the x key on a Thai keyboard). */
export function parseReverse(value) {
  const m = String(value ?? '').trim().match(/^([36])\s*[xX×*ป]$/)
  return m ? Number(m[1]) : null
}
export const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export const fmt = (n) => (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })

export const fmtDate = (iso) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

export const fmtTime = (ts) =>
  new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`
}

/** Amount that counts toward a number's limit. For 3 ตัว this is ตรง + โต๊ด combined. */
export const entryTotal = (e) => (e.type === 'three' ? (e.straight || 0) + (e.tod || 0) : e.amount || 0)

export const emptyLimits = () =>
  Object.fromEntries(
    OWNER_KEYS.map((o) => [o, Object.fromEntries(TYPE_KEYS.map((t) => [t, { default: null, overrides: {} }]))]),
  )

// Multipliers are kept as the text the user typed ('' = not entered yet) and converted only when calculating.
export const emptyPayouts = () =>
  Object.fromEntries(
    OWNER_KEYS.map((o) => [
      o,
      {
        top: { mult: '' },
        bottom: { mult: '' },
        three: { straightMult: '', todMult: '' },
      },
    ]),
  )

// The government draw is the same for everyone, so winning numbers live on the event, not per owner.
export const emptyResults = () => ({ top: '', bottom: '', three: '' })

export function newEvent({ name, date, discount, limits }) {
  return {
    id: uid(),
    name,
    date,
    discount: { meaw: DEFAULT_DISCOUNT, jik: DEFAULT_DISCOUNT, ...discount },
    archived: false,
    createdAt: Date.now(),
    limits: limits ? structuredClone(limits) : emptyLimits(),
    payouts: emptyPayouts(),
    results: emptyResults(),
  }
}

/** Upgrades data saved by older versions. Mutates and returns `data`. */
export function migrateData(data) {
  data.events ||= []
  data.entries ||= []
  data.settings ||= {}
  for (const ev of data.events) {
    ev.payouts ||= emptyPayouts()
    if (!ev.results) {
      // v1 stored the winning number per owner; prefer ลุงแมว's, fall back to ป้าจิก's.
      ev.results = emptyResults()
      for (const t of TYPE_KEYS) ev.results[t] = ev.payouts.meaw?.[t]?.number || ev.payouts.jik?.[t]?.number || ''
    }
    for (const o of OWNER_KEYS) {
      ev.payouts[o] ||= emptyPayouts()[o]
      for (const t of TYPE_KEYS) {
        const p = (ev.payouts[o][t] ||= {})
        delete p.number
        for (const k of ['mult', 'straightMult', 'todMult']) if (p[k] === 0) p[k] = ''
      }
    }
  }
  return data
}

/** Keeps digits and a single decimal point, e.g. '1.2.3' -> '1.23'. */
export function cleanMoney(value) {
  const s = String(value ?? '').replace(/[^\d.]/g, '')
  const i = s.indexOf('.')
  return i === -1 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
}

/** '' or a valid non-negative number. */
export const isMoneyOrEmpty = (v) => v === '' || v === null || v === undefined || (Number.isFinite(Number(v)) && Number(v) >= 0)

/** null = ไม่อั้น */
export function getLimit(event, owner, type, number) {
  const l = event?.limits?.[owner]?.[type]
  if (!l) return null
  const o = l.overrides?.[number]
  if (o !== undefined && o !== null && o !== '') return Number(o)
  return l.default === null || l.default === undefined || l.default === '' ? null : Number(l.default)
}

/** The per-number limit set for this number (not the "all numbers" default), or null. */
export function ownLimit(event, owner, type, number) {
  const o = event?.limits?.[owner]?.[type]?.overrides?.[number]
  return o === undefined || o === null || o === '' ? null : Number(o)
}

/** The "all numbers" default limit, or null. */
export function defaultLimit(event, owner, type) {
  const d = event?.limits?.[owner]?.[type]?.default
  return d === undefined || d === null || d === '' ? null : Number(d)
}

export const entriesOf = (entries, eventId, owner, type) =>
  entries.filter((e) => e.eventId === eventId && e.owner === owner && e.type === type)

export function usedAmount(entries, eventId, owner, type, number) {
  let sum = 0
  for (const e of entries) {
    if (e.eventId === eventId && e.owner === owner && e.type === type && e.number === number) sum += entryTotal(e)
  }
  return sum
}

export const NEAR_RATIO = 0.8

/** State of one number in the grid: empty | closed (limit 0, nothing bought) | bought | near | full | over */
export function cellState(total, limit) {
  if (limit === 0 && !total) return 'closed'
  if (!total) return 'empty'
  if (limit === null || limit === undefined) return 'bought'
  if (Math.abs(total - limit) < 1e-9) return 'full'
  if (total > limit) return 'over'
  return total >= limit * NEAR_RATIO ? 'near' : 'bought'
}

/** Group a list of entries by number: { '25': [e, e], ... } */
export function groupByNumber(list) {
  const map = {}
  for (const e of list) (map[e.number] ||= []).push(e)
  return map
}

export function breakdown(list) {
  return list.map((e) => fmt(entryTotal(e))).join('+')
}

export function sumThree(list) {
  let straight = 0
  let tod = 0
  for (const e of list) {
    straight += e.straight || 0
    tod += e.tod || 0
  }
  return { straight, tod }
}

const subtractAmounts = (it, keep) =>
  it.type === 'three'
    ? { ...it, straight: (it.straight || 0) - (keep.straight || 0), tod: (it.tod || 0) - (keep.tod || 0) }
    : { ...it, amount: (it.amount || 0) - (keep.amount || 0) }

/**
 * Checks each incoming item against its owner's limit. When over, asks `decide({ item, used, limit, incoming })`,
 * which resolves to { keep } or null (cancel the whole ticket). Whatever ลุงแมว doesn't keep is cut to ป้าจิก
 * (and checked against ป้าจิก's limit too); whatever ป้าจิก doesn't keep is refused.
 */
export async function allocateItems(items, { entries, event, decide }) {
  const created = []
  let rejected = 0
  const queue = items.map((it) => ({ ...it, cutFrom: it.cutFrom ?? null }))

  while (queue.length) {
    const it = queue.shift()
    const sameNumber = (c) => c.owner === it.owner && c.type === it.type && c.number === it.number
    const used = usedAmount(entries, event.id, it.owner, it.type, it.number) + created.filter(sameNumber).reduce((s, c) => s + entryTotal(c), 0)
    const limit = getLimit(event, it.owner, it.type, it.number)
    const incoming = entryTotal(it)
    let keep = it

    if (limit !== null && used + incoming > limit) {
      const decision = await decide({ item: it, used, limit, incoming })
      if (!decision) return { cancelled: true, created: [], rejected: 0 }
      keep = { ...it, ...decision.keep }
      const rest = subtractAmounts(it, decision.keep)
      if (entryTotal(rest) > 0) {
        if (it.owner === 'meaw') queue.push({ ...rest, owner: 'jik', cutFrom: 'meaw' })
        else rejected += entryTotal(rest)
      }
    }
    if (entryTotal(keep) > 0) created.push(keep)
  }
  return { cancelled: false, created, rejected }
}

const num = (v) => Number(v) || 0

/** One row per winning part of an entry (a 3 ตัว entry can win both ตรง and โต๊ด). */
export function winningEntries(event, entries, owner, types = TYPE_KEYS) {
  const rows = []
  for (const type of types) {
    const win = event.results?.[type] || ''
    const p = event.payouts?.[owner]?.[type] || {}
    const list = entriesOf(entries, event.id, owner, type)
    if (type === 'three') {
      if (!/^\d{3}$/.test(win)) continue
      const key = sortDigits(win)
      for (const e of list) {
        if (e.number === win && (e.straight || 0) > 0) {
          rows.push({ entry: e, type, kind: 'straight', label: '3 ตัวตรง', bought: e.straight, mult: num(p.straightMult), pay: e.straight * num(p.straightMult) })
        }
        if ((e.tod || 0) > 0 && sortDigits(e.number) === key) {
          rows.push({ entry: e, type, kind: 'tod', label: '3 ตัวโต๊ด', bought: e.tod, mult: num(p.todMult), pay: e.tod * num(p.todMult) })
        }
      }
    } else {
      if (!/^\d{2}$/.test(win)) continue
      for (const e of list) {
        if (e.number === win) rows.push({ entry: e, type, kind: 'two', label: TYPES[type], bought: e.amount || 0, mult: num(p.mult), pay: (e.amount || 0) * num(p.mult) })
      }
    }
  }
  return rows
}

/** Sales + payout summary for one owner/type tab. */
export function tabSummary(event, entries, owner, type) {
  const list = entriesOf(entries, event.id, owner, type)
  const sales = list.reduce((s, e) => s + entryTotal(e), 0)
  const discountPct = num(event.discount?.[owner] ?? DEFAULT_DISCOUNT)
  const discount = (sales * discountPct) / 100
  const wins = winningEntries(event, entries, owner, [type])
  const payout = wins.reduce((s, w) => s + w.pay, 0)
  const win = event.results?.[type] || ''
  let detail = null

  if (type === 'three' && /^\d{3}$/.test(win)) {
    const part = (kind) => wins.filter((w) => w.kind === kind)
    const sum = (rows, k) => rows.reduce((s, w) => s + w[k], 0)
    detail = {
      straightBought: sum(part('straight'), 'bought'),
      todBought: sum(part('tod'), 'bought'),
      straightPay: sum(part('straight'), 'pay'),
      todPay: sum(part('tod'), 'pay'),
      todNumbers: [...new Set(part('tod').map((w) => w.entry.number))].sort(),
    }
  } else if (type !== 'three' && /^\d{2}$/.test(win)) {
    detail = { bought: wins.reduce((s, w) => s + w.bought, 0) }
  }

  return { sales, discountPct, discount, net: sales - discount, payout, profit: sales - discount - payout, detail }
}
export function eventTotals(event, entries) {
  const list = entries.filter((e) => e.eventId === event.id)
  const byOwner = {}
  for (const o of OWNER_KEYS) byOwner[o] = list.filter((e) => e.owner === o).reduce((s, e) => s + entryTotal(e), 0)
  return { count: list.length, byOwner }
}
