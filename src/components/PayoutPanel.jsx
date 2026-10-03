import { Target, Wallet } from 'lucide-react'
import { OWNERS, TYPES, TYPE_KEYS, fmt, tabSummary } from '../lib.js'

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

  const set = (patch) =>
    update((d) => {
      const ev = d.events.find((e) => e.id === event.id)
      Object.assign(ev.payouts[owner][type], patch)
    })
  const digitsOnly = (e, len) => e.target.value.replace(/\D/g, '').slice(0, len)
  const mult = (e) => {
    const v = e.target.value.replace(/[^\d.]/g, '')
    return v === '' ? 0 : v
  }

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
              value={p.number || ''}
              onChange={(e) => set({ number: digitsOnly(e, isThree ? 3 : 2) })}
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
        <input className="w-80" inputMode="decimal" value={multValue ?? 0} onChange={onMult} onFocus={(e) => e.target.select()} />
        <span className="op">=</span>
        <span className="mono strong pay">{pay === undefined ? '—' : fmt(pay)}</span>
      </div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  )
}

const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n))
