import { useState } from 'react'
import Modal from './Modal.jsx'
import { OWNERS, fmt } from '../lib.js'

/**
 * Asks what to do with an amount that pushes a number past its limit.
 * ลุงแมว: keep part, the rest is cut to ป้าจิก. ป้าจิก: keep part, the rest is refused.
 */
export default function OverLimitModal({ item, used, limit, incoming, typeLabel, onDecide, onCancel }) {
  const isThree = item.type === 'three'
  const isMeaw = item.owner === 'meaw'
  const remaining = Math.max(0, limit - used)

  const fitRemaining = () => {
    if (!isThree) return { amount: Math.min(item.amount, remaining) }
    const straight = Math.min(item.straight, remaining)
    return { straight, tod: Math.min(item.tod, remaining - straight) }
  }
  const full = isThree ? { straight: item.straight, tod: item.tod } : { amount: item.amount }
  const none = isThree ? { straight: 0, tod: 0 } : { amount: 0 }

  const [keep, setKeep] = useState(fitRemaining)
  const keepTotal = isThree ? (keep.straight || 0) + (keep.tod || 0) : keep.amount || 0
  const restTotal = incoming - keepTotal
  const valid = isThree
    ? keep.straight >= 0 && keep.tod >= 0 && keep.straight <= item.straight && keep.tod <= item.tod
    : keep.amount >= 0 && keep.amount <= item.amount

  const set = (k) => (e) => {
    const v = e.target.value.replace(/[^\d.]/g, '')
    setKeep((p) => ({ ...p, [k]: v === '' ? 0 : Number(v) }))
  }

  const presets = isMeaw
    ? [
        ['รับเต็มจำนวน', full],
        ['ตัดให้เจ้า (เก็บเท่าที่อั้น)', fitRemaining()],
        ['ส่งเจ้าทั้งหมด', none],
      ]
    : [
        ['รับเต็มจำนวน', full],
        ['รับเท่าที่อั้น', fitRemaining()],
        ['ไม่รับเลย', none],
      ]

  return (
    <Modal
      title={`เลข ${item.number} (${typeLabel}) ซื้อเกินยอดอั้นแล้ว`}
      onClose={onCancel}
      width={520}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            ยกเลิกทั้งใบ
          </button>
          <button className="btn primary" disabled={!valid} onClick={() => onDecide({ keep })}>
            ตกลง
          </button>
        </>
      }
    >
      <div onKeyDown={(e) => e.key === 'Enter' && valid && onDecide({ keep })}>
      <div className={`owner-banner o-${item.owner}`}>บัญชี {OWNERS[item.owner]}</div>
      <div className="limit-stats">
        <Stat label="ยอดอั้น" value={fmt(limit)} />
        <Stat label="ซื้อไปแล้ว" value={fmt(used)} />
        <Stat label="เหลือรับได้" value={fmt(remaining)} />
        <Stat label="กรอกเข้ามา" value={fmt(incoming)} />
        <Stat label="เกิน" value={fmt(used + incoming - limit)} danger />
      </div>

      <div className="preset-row">
        {presets.map(([label, v]) => (
          <button key={label} className="btn ghost sm" onClick={() => setKeep(v)}>
            {label}
          </button>
        ))}
      </div>

      <div className="split-grid">
        <div className="split-col">
          <h4>{isMeaw ? 'เก็บไว้เอง (ลุงแมว)' : 'รับไว้ (ป้าจิก)'}</h4>
          {isThree ? (
            <>
              <label className="field">
                <span>ตรง (สูงสุด {fmt(item.straight)})</span>
                <input value={keep.straight} onChange={set('straight')} autoFocus />
              </label>
              <label className="field">
                <span>โต๊ด (สูงสุด {fmt(item.tod)})</span>
                <input value={keep.tod} onChange={set('tod')} />
              </label>
            </>
          ) : (
            <label className="field">
              <span>จำนวนเงิน (สูงสุด {fmt(item.amount)})</span>
              <input value={keep.amount} onChange={set('amount')} autoFocus />
            </label>
          )}
        </div>
        <div className="split-col rest">
          <h4>{isMeaw ? 'ตัดส่งเจ้า (ป้าจิก)' : 'ไม่รับ'}</h4>
          {isThree ? (
            <div className="rest-values">
              <div>
                ตรง <b>{fmt(item.straight - (keep.straight || 0))}</b>
              </div>
              <div>
                โต๊ด <b>{fmt(item.tod - (keep.tod || 0))}</b>
              </div>
            </div>
          ) : (
            <div className="rest-values">
              <b>{fmt(restTotal)}</b> บาท
            </div>
          )}
        </div>
      </div>
      {!valid && <p className="error-text">จำนวนที่เก็บต้องไม่ติดลบ และไม่เกินยอดที่กรอกมา</p>}
      {valid && used + keepTotal > limit && <p className="warn-text">หมายเหตุ: ยอดที่เก็บไว้ยังเกินยอดอั้น {fmt(used + keepTotal - limit)} บาท</p>}
      </div>
    </Modal>
  )
}

function Stat({ label, value, danger }) {
  return (
    <div className={`stat ${danger ? 'danger' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}
