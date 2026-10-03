import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import Modal from './Modal.jsx'
import { useConfirm } from './Confirm.jsx'
import { OWNERS, cleanMoney, fmt } from '../lib.js'

/**
 * Asks what to do with an amount that pushes a number past its limit.
 * ลุงแมว: keep part, the rest is cut to ป้าจิก. ป้าจิก: keep part, the rest is refused.
 * Each choice is a card that spells out the result, so nothing has to be worked out by hand.
 */
export default function OverLimitModal({ item, used, limit, incoming, typeLabel, onDecide, onCancel }) {
  const isThree = item.type === 'three'
  const isMeaw = item.owner === 'meaw'
  const remaining = Math.max(0, limit - used)
  const over = used + incoming - limit
  const keeper = isMeaw ? 'ลุงแมวเก็บ' : 'ป้าจิกรับ'
  const restLabel = isMeaw ? 'ส่งป้าจิก' : 'ไม่รับ'

  const fit = (() => {
    if (!isThree) return { amount: Math.min(item.amount, remaining) }
    const straight = Math.min(item.straight, remaining)
    return { straight, tod: Math.min(item.tod, remaining - straight) }
  })()
  const full = isThree ? { straight: item.straight, tod: item.tod } : { amount: item.amount }
  const none = isThree ? { straight: 0, tod: 0 } : { amount: 0 }
  const total = (k) => (isThree ? (k.straight || 0) + (k.tod || 0) : k.amount || 0)

  const options = [
    { id: 'fit', title: isMeaw ? 'ตัดส่งเจ้า' : 'รับเท่าที่อั้น', keep: fit, recommended: true },
    { id: 'full', title: 'รับเต็มจำนวน', keep: full },
    // With nothing left under the limit, "fit" already means keeping nothing.
    ...(remaining > 0 ? [{ id: 'none', title: isMeaw ? 'ส่งเจ้าทั้งหมด' : 'ไม่รับเลย', keep: none }] : []),
    { id: 'custom', title: 'กำหนดเอง' },
  ]

  const [mode, setMode] = useState('fit')
  const [custom, setCustom] = useState(() => (isThree ? { straight: String(fit.straight), tod: String(fit.tod) } : { amount: String(fit.amount) }))
  const customKeep = isThree ? { straight: Number(custom.straight) || 0, tod: Number(custom.tod) || 0 } : { amount: Number(custom.amount) || 0 }
  const keep = mode === 'custom' ? customKeep : options.find((o) => o.id === mode).keep
  const keepTotal = total(keep)
  const restTotal = incoming - keepTotal
  const valid = isThree
    ? keep.straight >= 0 && keep.tod >= 0 && keep.straight <= item.straight && keep.tod <= item.tod
    : keep.amount >= 0 && keep.amount <= item.amount
  const stillOver = valid && used + keepTotal > limit ? used + keepTotal - limit : 0

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
  const submit = () => valid && onDecide({ keep })

  const describe = (k) => {
    const kept = total(k)
    const rest = incoming - kept
    const parts = []
    if (kept > 0) parts.push(`${keeper} ${fmt(kept)}`)
    if (rest > 0) parts.push(`${restLabel} ${fmt(rest)}`)
    if (used + kept > limit) parts.push(`เกินอั้น ${fmt(used + kept - limit)}`)
    return parts.join(' · ')
  }

  // Meter: everything drawn against the larger of the limit and the new total.
  const scale = Math.max(limit, used + incoming) || 1
  const pct = (v) => `${(Math.max(0, v) / scale) * 100}%`

  return (
    <Modal
      title={`เลข ${item.number} ซื้อเกินยอดอั้น`}
      onClose={askCancel}
      width={560}
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
            <div className="ol-tags">
              <span className="type-tag">{typeLabel}</span>
              <span className={`owner-tag o-${item.owner}`}>บัญชี {OWNERS[item.owner]}</span>
            </div>
            <p>
              อั้นไว้ <b>{fmt(limit)}</b> · ซื้อไปแล้ว <b>{fmt(used)}</b> · รับได้อีก <b>{fmt(remaining)}</b>
            </p>
          </div>
        </div>

        <div className="ol-meter" aria-hidden="true">
          <div className="ol-bar">
            <span className="seg used" style={{ width: pct(used) }} />
            <span className="seg fits" style={{ width: pct(Math.min(incoming, remaining)) }} />
            <span className="seg over" style={{ width: pct(over) }} />
            <span className="ol-limit" style={{ left: pct(limit) }} />
          </div>
          <div className="ol-legend">
            <span>
              <i className="used" /> ซื้อไปแล้ว {fmt(used)}
            </span>
            <span>
              <i className="fits" /> ใหม่ {fmt(incoming)}
            </span>
            <span className="ol-over-text">
              <i className="over" /> เกินอั้น {fmt(over)}
            </span>
          </div>
        </div>

        <div className="ol-question">ยอดใหม่ {fmt(incoming)} บาท จะทำอย่างไร?</div>
        <div className="ol-options" role="radiogroup" aria-label="เลือกวิธีจัดการยอดที่เกิน">
          {options.map((o) => {
            const selected = mode === o.id
            return (
              <label key={o.id} className={`ol-option ${selected ? 'selected' : ''} ${o.id === 'custom' && selected ? 'wide' : ''}`}>
                <input type="radio" name="ol-mode" value={o.id} checked={selected} onChange={() => setMode(o.id)} autoFocus={o.recommended} />
                <span className="ol-radio">{selected && <Check size={14} strokeWidth={3} />}</span>
                <span className="ol-option-body">
                  <span className="ol-option-title">
                    {o.title}
                    {o.recommended && <span className="ol-rec">แนะนำ</span>}
                  </span>
                  <span className="ol-option-desc">{o.id === 'custom' ? `ใส่เองว่า${keeper}เท่าไหร่` : describe(o.keep)}</span>
                  {o.id === 'custom' && selected && (
                    <span className="ol-custom" onClick={(e) => e.preventDefault()}>
                      {isThree ? (
                        <>
                          <CustomField label={`ตรง (สูงสุด ${fmt(item.straight)})`} value={custom.straight} onChange={(v) => setCustom((c) => ({ ...c, straight: v }))} />
                          <CustomField label={`โต๊ด (สูงสุด ${fmt(item.tod)})`} value={custom.tod} onChange={(v) => setCustom((c) => ({ ...c, tod: v }))} />
                        </>
                      ) : (
                        <CustomField label={`${keeper} (สูงสุด ${fmt(item.amount)})`} value={custom.amount} onChange={(v) => setCustom({ amount: v })} />
                      )}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>

        <div className={`ol-result ${valid ? '' : 'invalid'}`}>
          {valid ? (
            <>
              <div className="ol-result-box keep">
                <small>{keeper}</small>
                <b>{fmt(keepTotal)}</b>
                {isThree && <small>ตรง {fmt(keep.straight)} · โต๊ด {fmt(keep.tod)}</small>}
              </div>
              <ArrowRight size={20} className="ol-arrow" />
              <div className={`ol-result-box rest ${isMeaw ? '' : 'refuse'}`}>
                <small>{restLabel}</small>
                <b>{fmt(restTotal)}</b>
                {isThree && (
                  <small>
                    ตรง {fmt(item.straight - keep.straight)} · โต๊ด {fmt(item.tod - keep.tod)}
                  </small>
                )}
              </div>
            </>
          ) : (
            <span>จำนวนต้องไม่ติดลบ และไม่เกินยอดที่กรอกมา</span>
          )}
        </div>
        {stillOver > 0 && <p className="warn-text">ยอดที่{isMeaw ? 'เก็บไว้' : 'รับไว้'}จะเกินอั้น {fmt(stillOver)} บาท</p>}
      </div>
    </Modal>
  )
}

function CustomField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(cleanMoney(e.target.value))} onFocus={(e) => e.target.select()} autoFocus />
    </label>
  )
}
