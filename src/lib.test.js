import { describe, expect, it } from 'vitest'
import { allocateItems, cleanMoney, getLimit, migrateData, newEvent, tabSummary, winningEntries } from './lib.js'

const makeEvent = (patch = {}) => Object.assign(newEvent({ name: 'test', date: '2026-10-16' }), patch)
const entry = (p) => ({ id: Math.random().toString(36), eventId: 'E', owner: 'meaw', note: '', createdAt: 0, ...p })

describe('getLimit', () => {
  const ev = makeEvent()
  ev.limits.meaw.top = { default: 500, overrides: { 25: 150, 99: 0, 10: '' } }

  it('uses the default for numbers without an override', () => expect(getLimit(ev, 'meaw', 'top', '00')).toBe(500))
  it('prefers the per-number override', () => expect(getLimit(ev, 'meaw', 'top', '25')).toBe(150))
  it('treats 0 as "accept nothing", not as "no limit"', () => expect(getLimit(ev, 'meaw', 'top', '99')).toBe(0))
  it('ignores an empty override', () => expect(getLimit(ev, 'meaw', 'top', '10')).toBe(500))
  it('returns null (no limit) when nothing is set', () => expect(getLimit(ev, 'jik', 'top', '25')).toBeNull())
})

describe('cleanMoney', () => {
  it('keeps one decimal point', () => expect(cleanMoney('1.2.3')).toBe('1.23'))
  it('drops non-digits', () => expect(cleanMoney('1,000 ฿')).toBe('1000'))
  it('handles empty values', () => expect(cleanMoney(undefined)).toBe(''))
})

describe('tabSummary / winningEntries', () => {
  const ev = makeEvent({ id: 'E', discount: { meaw: 20, jik: 10 } })
  ev.results = { top: '25', bottom: '07', three: '123' }
  ev.payouts.meaw.top.mult = '90'
  ev.payouts.meaw.three = { straightMult: '500', todMult: '100' }
  const entries = [
    entry({ type: 'top', number: '25', amount: 100, note: 'ป้าศรี' }),
    entry({ type: 'top', number: '25', amount: 20 }),
    entry({ type: 'top', number: '30', amount: 80 }),
    entry({ type: 'three', number: '123', straight: 10, tod: 5 }),
    entry({ type: 'three', number: '321', straight: 20, tod: 7 }),
    entry({ type: 'three', number: '124', straight: 0, tod: 9 }),
    entry({ type: 'top', number: '25', amount: 999, owner: 'jik' }),
  ]

  it('2 ตัว: sales, discount and payout', () => {
    const s = tabSummary(ev, entries, 'meaw', 'top')
    expect(s.sales).toBe(200)
    expect(s.discount).toBe(40)
    expect(s.payout).toBe(120 * 90)
    expect(s.profit).toBe(200 - 40 - 10800)
  })

  it('3 ตัว: ตรง only for the exact number, โต๊ด for any permutation', () => {
    const s = tabSummary(ev, entries, 'meaw', 'three')
    expect(s.detail.straightBought).toBe(10)
    expect(s.detail.todBought).toBe(12)
    expect(s.detail.todNumbers).toEqual(['123', '321'])
    expect(s.payout).toBe(10 * 500 + 12 * 100)
  })

  it('an empty multiplier pays 0', () => {
    expect(tabSummary(ev, entries, 'meaw', 'bottom').payout).toBe(0)
    expect(tabSummary(ev, entries, 'jik', 'top').payout).toBe(0)
  })

  it('lists each winning part per entry', () => {
    const rows = winningEntries(ev, entries, 'meaw')
    expect(rows.map((r) => [r.entry.number, r.kind, r.pay])).toEqual([
      ['25', 'two', 9000],
      ['25', 'two', 1800],
      ['123', 'straight', 5000],
      ['123', 'tod', 500],
      ['321', 'tod', 700],
    ])
    expect(rows[0].entry.note).toBe('ป้าศรี')
  })
})

describe('allocateItems', () => {
  const ev = makeEvent({ id: 'E' })
  ev.limits.meaw.top = { default: 150, overrides: {} }
  ev.limits.jik.top = { default: 50, overrides: {} }
  const existing = [entry({ type: 'top', number: '25', amount: 120 })]
  const item = { type: 'top', number: '25', amount: 100, owner: 'meaw', note: 'x' }

  it('saves directly when under the limit', async () => {
    const r = await allocateItems([{ ...item, amount: 30 }], { entries: existing, event: ev, decide: () => null })
    expect(r.created).toHaveLength(1)
    expect(r.created[0].amount).toBe(30)
  })

  it('cuts the rest from ลุงแมว to ป้าจิก, then asks again for ป้าจิก', async () => {
    const asked = []
    const decide = async (info) => {
      asked.push([info.item.owner, info.used, info.limit, info.incoming])
      return info.item.owner === 'meaw' ? { keep: { amount: 30 } } : { keep: { amount: 50 } }
    }
    const r = await allocateItems([item], { entries: existing, event: ev, decide })
    expect(asked).toEqual([
      ['meaw', 120, 150, 100],
      ['jik', 0, 50, 70],
    ])
    expect(r.created.map((c) => [c.owner, c.amount, c.cutFrom])).toEqual([
      ['meaw', 30, null],
      ['jik', 50, 'meaw'],
    ])
    expect(r.rejected).toBe(20)
  })

  it('counts earlier rows of the same ticket toward the limit', async () => {
    let asked = 0
    const r = await allocateItems([{ ...item, amount: 20 }, { ...item, amount: 20 }], {
      entries: existing,
      event: ev,
      decide: async () => (asked++, { keep: { amount: 20 } }),
    })
    expect(asked).toBe(1)
    expect(r.created).toHaveLength(2)
  })

  it('cancelling saves nothing', async () => {
    const r = await allocateItems([item], { entries: existing, event: ev, decide: async () => null })
    expect(r).toEqual({ cancelled: true, created: [], rejected: 0 })
  })

  it('3 ตัว limit counts ตรง + โต๊ด together', async () => {
    const ev3 = makeEvent({ id: 'E' })
    ev3.limits.meaw.three = { default: 100, overrides: {} }
    let info
    await allocateItems([{ type: 'three', number: '123', straight: 60, tod: 50, owner: 'meaw', note: '' }], {
      entries: [],
      event: ev3,
      decide: async (i) => ((info = i), { keep: { straight: 60, tod: 40 } }),
    })
    expect(info.incoming).toBe(110)
  })
})

describe('migrateData', () => {
  it('moves per-owner winning numbers to event.results and blanks 0 multipliers', () => {
    const data = {
      events: [
        {
          id: 'E',
          payouts: {
            meaw: { top: { number: '', mult: 0 }, bottom: { number: '07', mult: 90 }, three: { number: '', straightMult: 0, todMult: 0 } },
            jik: { top: { number: '25', mult: 0 }, bottom: { number: '', mult: 0 }, three: { number: '123', straightMult: 0, todMult: 0 } },
          },
        },
      ],
      entries: [],
    }
    migrateData(data)
    const ev = data.events[0]
    expect(ev.results).toEqual({ top: '25', bottom: '07', three: '123' })
    expect(ev.payouts.meaw.bottom).toEqual({ mult: 90 })
    expect(ev.payouts.meaw.top).toEqual({ mult: '' })
    expect(data.settings).toEqual({})
  })

  it('leaves already-migrated events alone', () => {
    const ev = makeEvent()
    ev.results.top = '11'
    const data = migrateData({ events: [ev], entries: [], settings: {} })
    expect(data.events[0].results.top).toBe('11')
  })
})
