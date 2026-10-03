import { Award, Target, Wallet } from 'lucide-react'
import { OWNERS, TYPES, TYPE_KEYS, cleanMoney, fmt, tabSummary, winningEntries } from '../lib.js'

/** Winning number + multiplier for the current tab, and the profit/loss summary of all tabs. */
export default function PayoutPanel({ data, update, event, owner, type }) {
  const p = event.payouts?.[owner]?.[type] || {}
  const isThree = type === 'three'
  const current = tabSummary(event, data.entries, owner, type)
  const all = TYPE_KEYS.map((t) => [t, tabSummary(event, data.entries, owner, t)])
  const sum = all.reduce(
    (acc, [, s]) => ({ sales: acc.sales + s.sales, discount: acc.discount + s.discount, payout: acc.payout + s.payout }),
    { sales: 0, discount: 0, payout: 0 },
  )
  const sumProfit = sum.sales - sum.discount - sum.payout

  const winners = winningEntries(event, data.entries, owner)
  const winTotal = winners.reduce((s, w) => s + w.pay, 0)

  const set = (patch) =>
    update((d) => {
      const ev = d.events.find((e) => e.id === event.id)
      Object.assign(ev.payouts[owner][type], patch)
    })
  // The draw result is shared by both owners.
  const setResult = (value) =>
    update((d) => {
      const ev = d.events.find((e) => e.id === event.id)
      ev.results[type] = value
    })
  const digitsOnly = (e, len) => e.target.value.replace(/\D/g, '').slice(0, len)
  const mult = (e) => cleanMoney(e.target.value)

  const d = current.detail
  return (
    <div className="payout">
      <div className="card payout-card">
        <h3 className="card-title">
          <span className="card-title-icon">
            <Target size={18} />
          </span>
          เลขที่ออก · {TYPES[type]}
        </h3>
        <div className="payout-inputs">
          <label className="field">
            <span>เลขที่ออก</span>
            <input
              className="num-input big-input"
              inputMode="numeric"
              placeholder={isThree ? '000' : '00'}
              maxLength={isThree ? 3 : 2}
              value={event.results?.[type] || ''}
              onChange={(e) => setResult(digitsOnly(e, isThree ? 3 : 2))}
            />
          </label>

          {isThree ? (
            <>
              <PayLine
                label="ตรง"
                bought={d?.straightBought}
                multValue={p.straightMult}
                onMult={(e) => set({ straightMult: mult(e) })}
                pay={d?.straightPay}
              />
              <PayLine
                label="โต๊ด"
                bought={d?.todBought}
                multValue={p.todMult}
                onMult={(e) => set({ todMult: mult(e) })}
                pay={d?.todPay}
                hint={d?.todNumbers?.length ? `จากเลข ${d.todNumbers.join(', ')}` : ''}
              />
            </>
          ) : (
            <PayLine label="ยอดซื้อ" bought={d?.bought} multValue={p.mult} onMult={(e) => set({ mult: mult(e) })} pay={current.payout} />
          )}
        </div>
        {!d && <p className="muted small">กรอกเลขที่ออกให้ครบ {isThree ? 3 : 2} หลัก ระบบจะดึงยอดซื้อมาให้</p>}
      </div>

      <div className="card summary-card">
        <h3 className="card-title">
          <span className="card-title-icon">
            <Wallet size={18} />
          </span>
          สรุปกำไร / ขาดทุน · {OWNERS[owner]}
        </h3>
        <table className="table summary-table">
          <thead>
            <tr>
              <th></th>
              <th className="r">ยอดขาย</th>
              <th className="r">ส่วนลด {current.discountPct}%</th>
              <th className="r">รับจริง</th>
              <th className="r">จ่ายเลขถูก</th>
              <th className="r">กำไร / ขาดทุน</th>
            </tr>
          </thead>
          <tbody>
            {all.map(([t, s]) => (
              <tr key={t} className={t === type ? 'current' : ''}>
                <td>{TYPES[t]}</td>
                <td className="r mono">{fmt(s.sales)}</td>
                <td className="r mono neg">−{fmt(s.discount)}</td>
                <td className="r mono">{fmt(s.net)}</td>
                <td className="r mono neg">−{fmt(s.payout)}</td>
                <td className={`r mono strong ${s.profit < 0 ? 'neg' : 'pos'}`}>{signed(s.profit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>รวมทั้งหมด</td>
              <td className="r mono">{fmt(sum.sales)}</td>
              <td className="r mono neg">−{fmt(sum.discount)}</td>
              <td className="r mono">{fmt(sum.sales - sum.discount)}</td>
              <td className="r mono neg">−{fmt(sum.payout)}</td>
              <td className={`r mono strong ${sumProfit < 0 ? 'neg' : 'pos'}`}>{signed(sumProfit)}</td>
            </tr>
          </tfoot>
        </table>
        <div className={`profit-banner ${sumProfit < 0 ? 'loss' : 'gain'}`}>
          {sumProfit < 0 ? 'ขาดทุน' : 'กำไร'} <b>{fmt(Math.abs(sumProfit))}</b> บาท
        </div>
      </div>

      <div className="card winners-card">
        <div className="card-head">
          <h3 className="card-title">
            <span className="card-title-icon">
              <Award size={18} />
            </span>
            รายการที่ถูกรางวัล · {OWNERS[owner]}
            {winners.length > 0 && <span className="pill">{winners.length} รายการ</span>}
          </h3>
          <span className="muted small">ทุกประเภท · ตามเลขที่ออกที่กรอกไว้</span>
        </div>
        {!winners.length ? (
          <p className="muted center pad">{TYPE_KEYS.some((t) => event.results?.[t]) ? 'ไม่มีรายการที่ถูกรางวัล' : 'ยังไม่ได้กรอกเลขที่ออก'}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อคนซื้อ / หมายเหตุ</th>
                <th>เลข</th>
                <th>ประเภท</th>
                <th className="r">ยอดซื้อ</th>
                <th className="r">ตัวคูณ</th>
                <th className="r">ยอดจ่าย</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((w) => (
                <tr key={w.entry.id + w.kind}>
                  <td className="strong">{w.entry.note || <span className="muted">— ไม่มีหมายเหตุ —</span>}</td>
                  <td className="mono strong">{w.entry.number}</td>
                  <td>{w.label}</td>
                  <td className="r mono">{fmt(w.bought)}</td>
                  <td className="r mono">{w.mult ? `×${fmt(w.mult)}` : <span className="warn-inline">ยังไม่ใส่</span>}</td>
                  <td className="r mono strong neg">{fmt(w.pay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>รวมยอดจ่าย</td>
                <td className="r mono strong neg">{fmt(winTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function PayLine({ label, bought, multValue, onMult, pay, hint }) {
  return (
    <div className="payline">
      <div className="payline-label">{label}</div>
      <div className="payline-calc">
        <span className="mono strong">{bought === undefined ? '—' : fmt(bought)}</span>
        <span className="op">×</span>
        <input className="w-80" inputMode="decimal" placeholder="0" value={multValue ?? ''} onChange={onMult} onFocus={(e) => e.target.select()} />
        <span className="op">=</span>
        <span className="mono strong pay">{pay === undefined ? '—' : fmt(pay)}</span>
      </div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  )
}

const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n))
