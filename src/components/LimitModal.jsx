import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import Modal from './Modal.jsx'
import { OWNERS, TYPES, cleanMoney, fmt, isMoneyOrEmpty, uid } from '../lib.js'

export default function LimitModal({ event, owner, type, update, toast, onClose }) {
  const digits = type === 'three' ? 3 : 2
  const range = type === 'three' ? '000-999' : '00-99'
  const current = event.limits?.[owner]?.[type] || { default: null, overrides: {} }

  const [all, setAll] = useState(current.default ?? '')
  const [rows, setRows] = useState(() => {
    const r = Object.entries(current.overrides || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([number, limit]) => ({ id: uid(), number, limit: String(limit) }))
    return r.length ? r : [{ id: uid(), number: '', limit: '' }]
  })

  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { id: uid(), number: '', limit: '' }])
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id))

  const filled = rows.filter((r) => r.number || r.limit)
  const badNumber = filled.filter((r) => !new RegExp(`^\\d{${digits}}$`).test(r.number))
  const badLimit = filled.filter((r) => r.limit === '' || !Number.isFinite(Number(r.limit)))
  const counts = {}
  filled.forEach((r) => (counts[r.number] = (counts[r.number] || 0) + 1))
  const dupes = Object.keys(counts).filter((n) => counts[n] > 1 && n)
  const badAll = !isMoneyOrEmpty(all)
  const valid = !badNumber.length && !badLimit.length && !dupes.length && !badAll

  function save() {
    if (!valid) return
    const ok = update((d) => {
      const ev = d.events.find((e) => e.id === event.id)
      ev.limits[owner][type] = {
        default: all === '' ? null : Number(all),
        overrides: Object.fromEntries(filled.map((r) => [r.number, Number(r.limit)])),
      }
    })
    if (!ok) return
    toast(`บันทึกยอดอั้น ${TYPES[type]} ของ${OWNERS[owner]}แล้ว`)
    onClose()
  }

  return (
    <Modal
      title={`ตั้งยอดอั้น · ${TYPES[type]} · ${OWNERS[owner]}`}
      onClose={onClose}
      width={620}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn primary" disabled={!valid} onClick={save}>
            บันทึก
          </button>
        </>
      }
    >
      <section className="limit-section">
        <h3>1. ตั้งทุกเลข ({range}) เท่ากัน</h3>
        <p className="muted">
          {type === 'three' ? 'ยอดอั้น 3 ตัวคิดรวม ตรง + โต๊ด ของเลขนั้น · ' : ''}เว้นว่าง = ไม่อั้น (รับไม่จำกัด)
        </p>
        <div className="inline">
          <input
            className={`w-160 ${badAll ? 'invalid' : ''}`}
            inputMode="numeric"
            placeholder="ไม่อั้น"
            value={all}
            onChange={(e) => setAll(cleanMoney(e.target.value))}
          />
          <span>บาท / เลข</span>
          {all !== '' && (
            <button className="btn ghost sm" onClick={() => setAll('')}>
              ล้าง (ไม่อั้น)
            </button>
          )}
        </div>
        {badAll && <p className="error-text">ยอดอั้นต้องเป็นตัวเลข</p>}
      </section>

      <section className="limit-section">
        <h3>2. อั้นรายเลข (ใช้แทนค่าข้อ 1 สำหรับเลขนั้น)</h3>
        <p className="muted">เช่น 00 → 200, 20 → 800 · ใส่ 0 = ไม่รับเลขนั้นเลย</p>
        <div className="limit-rows">
          {rows.map((r) => {
            const bad = badNumber.includes(r) || dupes.includes(r.number)
            return (
              <div key={r.id} className="limit-row">
                <input
                  className={`num-input ${bad ? 'invalid' : ''}`}
                  inputMode="numeric"
                  maxLength={digits}
                  placeholder={type === 'three' ? '000' : '00'}
                  value={r.number}
                  onChange={(e) => setRow(r.id, { number: e.target.value.replace(/\D/g, '') })}
                />
                <span>→</span>
                <input
                  className={badLimit.includes(r) ? 'invalid' : ''}
                  inputMode="numeric"
                  placeholder="บาท"
                  value={r.limit}
                  onChange={(e) => setRow(r.id, { limit: cleanMoney(e.target.value) })}
                  onKeyDown={(e) => e.key === 'Enter' && addRow()}
                />
                <button className="icon-btn danger" onClick={() => removeRow(r.id)} title="ลบ">
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
        <button className="btn ghost sm" onClick={addRow}>
          <Plus size={14} /> เพิ่มเลข
        </button>
        {dupes.length > 0 && <p className="error-text">มีเลขซ้ำ: {dupes.join(', ')}</p>}
        {badNumber.length > 0 && <p className="error-text">เลขต้องมี {digits} หลัก</p>}
        {badLimit.length > 0 && <p className="error-text">ใส่ยอดอั้นให้ครบทุกแถว</p>}
        {filled.length > 0 && valid && <p className="muted">อั้นรายเลขทั้งหมด {filled.length} เลข · รวม {fmt(filled.reduce((s, r) => s + Number(r.limit), 0))} บาท</p>}
      </section>
    </Modal>
  )
}
