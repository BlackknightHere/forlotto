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

export const emptyPayouts = () =>
  Object.fromEntries(
    OWNER_KEYS.map((o) => [
      o,
      {
        top: { number: '', mult: 0 },
        bottom: { number: '', mult: 0 },
        three: { number: '', straightMult: 0, todMult: 0 },
      },
    ]),
  )

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
  }
}

/** null = ไม่อั้น */
export function getLimit(event, owner, type, number) {
  const l = event?.limits?.[owner]?.[type]
  if (!l) return null
  const o = l.overrides?.[number]
  if (o !== undefined && o !== null && o !== '') return Number(o)
  return l.default === null || l.default === undefined || l.default === '' ? null : Number(l.default)
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

/** Sales + payout summary for one owner/type tab. */
export function tabSummary(event, entries, owner, type) {
  const list = entriesOf(entries, event.id, owner, type)
  const sales = list.reduce((s, e) => s + entryTotal(e), 0)
  const discountPct = Number(event.discount?.[owner] ?? DEFAULT_DISCOUNT) || 0
  const discount = (sales * discountPct) / 100
  const p = event.payouts?.[owner]?.[type] || {}
  let payout = 0
  let detail = null

  if (type === 'three') {
    const win = p.number || ''
    if (/^\d{3}$/.test(win)) {
      const straightBought = list.filter((e) => e.number === win).reduce((s, e) => s + (e.straight || 0), 0)
      const key = sortDigits(win)
      const todList = list.filter((e) => (e.tod || 0) > 0 && sortDigits(e.number) === key)
      const todBought = todList.reduce((s, e) => s + (e.tod || 0), 0)
      const straightPay = straightBought * (Number(p.straightMult) || 0)
      const todPay = todBought * (Number(p.todMult) || 0)
      payout = straightPay + todPay
      const todNumbers = [...new Set(todList.map((e) => e.number))].sort()
      detail = { straightBought, todBought, straightPay, todPay, todNumbers }
    }
  } else {
    const win = p.number || ''
    if (/^\d{2}$/.test(win)) {
      const bought = list.filter((e) => e.number === win).reduce((s, e) => s + (e.amount || 0), 0)
      payout = bought * (Number(p.mult) || 0)
      detail = { bought }
    }
  }

  return { sales, discountPct, discount, net: sales - discount, payout, profit: sales - discount - payout, detail }
}

export function eventTotals(event, entries) {
  const list = entries.filter((e) => e.eventId === event.id)
  const byOwner = {}
  for (const o of OWNER_KEYS) byOwner[o] = list.filter((e) => e.owner === o).reduce((s, e) => s + entryTotal(e), 0)
  return { count: list.length, byOwner }
}
