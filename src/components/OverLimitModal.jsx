import { useState } from 'react'
import { Check } from 'lucide-react'
import Modal from './Modal.jsx'
import { useConfirm } from './Confirm.jsx'
import { cleanMoney, fmt } from '../lib.js'

/**
 * Asks how to split an amount that pushes a number past its limit: two boxes, one per side.
 * ลุงแมว: keep part, the rest is cut to ป้าจิก. ป้าจิก: keep part, the rest is refused.
 * Typing in either box fills in the other, so the two always add up to what was keyed.
 */
export default function OverLimitModal({ item, used, limit, incoming, typeLabel, onDecide, onCancel }) {
  const isThree = item.type === 'three'
  const isMeaw = item.owner === 'meaw'
  const remaining = Math.max(0, limit - used)
  const over = used + incoming - limit
  const leftLabel = isMeaw ? 'ลุงแมวเก็บ' : 'ป้าจิกรับ'
  const rightLabel = isMeaw ? 'ส่งป้าจิก' : 'ไม่รับ'

  // Parts of the ticket line: one amount for 2 ตัว, ตรง + โต๊ด for 3 ตัว.
  const parts = isThree
    ? [
        { key: 'straight', label: 'ตรง', max: item.straight },
        { key: 'tod', label: 'โต๊ด', max: item.tod },
      ]
    : [{ key: 'amount', label: null, max: item.amount }]

  // Start by keeping what still fits under the limit (ตรง first); the rest goes to the other side.
  const [keep, setKeep] = useState(() => {
    let room = remaining
    const k = {}
    for (const p of parts) {
      const v = Math.min(p.max, room)
      k[p.key] = String(v)
      room -= v
    }
    return k
  })
  const kept = (p) => Number(keep[p.key]) || 0
  const setLeft = (p, v) => setKeep((k) => ({ ...k, [p.key]: cleanMoney(v) }))
  const setRight = (p, v) => {
    const clean = cleanMoney(v)
    setKeep((k) => ({ ...k, [p.key]: String(p.max - (Number(clean) || 0)) }))
  }

  const keepTotal = parts.reduce((s, p) => s + kept(p), 0)
  const valid = parts.every((p) => kept(p) >= 0 && kept(p) <= p.max)
  const stillOver = valid ? used + keepTotal - limit : 0

  const confirm = useConfirm()
  const askCancel = async () => {
    const ok = await confirm({
      title: 'ยกเลิกโพยทั้งใบ?',
      message: 'ทุกแถวในโพยใบนี้จะยังไม่ถูกบันทึก (ข้อมูลที่คีย์ไว้ยังอยู่ในฟอร์ม)',
      confirmText: 'ยกเลิกทั้งใบ',
      danger: true,
    })
    if (ok) onCancel()
  }
  const submit = () => valid && onDecide({ keep: Object.fromEntries(parts.map((p) => [p.key, kept(p)])) })

  return (
    <Modal
      title={`เลข ${item.number} ซื้อเกินยอดอั้น`}
      onClose={askCancel}
      width={480}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            ยกเลิกทั้งใบ
          </button>
          <button className="btn primary lg" disabled={!valid} onClick={submit}>
            <Check size={18} /> ยืนยัน
          </button>
        </>
      }
    >
      <div className="ol" onKeyDown={(e) => e.key === 'Enter' && submit()}>
        <div className="ol-head">
          <span className="ol-num">{item.number}</span>
          <div className="ol-head-text">
            <div className="ol-over">
              เกินอั้น <b>{fmt(over)}</b> บาท
            </div>
            <p>
              {typeLabel} · อั้น {fmt(limit)} · ซื้อไปแล้ว {fmt(used)} · ใหม่ {fmt(incoming)}
            </p>
          </div>
        </div>

        <div className="ol-split">
          {parts.map((p, i) => (
            <div key={p.key} className="ol-split-row">
              {p.label && <div className="ol-part">{p.label}</div>}
              <label className="ol-box keep">
                <span>{leftLabel}</span>
                <input
                  inputMode="decimal"
                  value={keep[p.key]}
                  onChange={(e) => setLeft(p, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  autoFocus={i === 0}
                />
              </label>
              <label className={`ol-box ${isMeaw ? 'send' : 'refuse'}`}>
                <span>{rightLabel}</span>
                <input inputMode="decimal" value={String(p.max - kept(p))} onChange={(e) => setRight(p, e.target.value)} onFocus={(e) => e.target.select()} />
              </label>
            </div>
          ))}
        </div>

        {!valid ? (
          <p className="error-text">กรอกได้ตั้งแต่ 0 ถึงยอดที่คีย์มา ({parts.map((p) => fmt(p.max)).join(' / ')} บาท)</p>
        ) : stillOver > 0 ? (
          <p className="warn-text">
            {leftLabel} {fmt(keepTotal)} จะเกินอั้น {fmt(stillOver)} บาท
          </p>
        ) : (
          <p className="ol-hint">รับได้อีกโดยไม่เกินอั้น {fmt(remaining)} บาท</p>
        )}
      </div>
    </Modal>
  )
}
