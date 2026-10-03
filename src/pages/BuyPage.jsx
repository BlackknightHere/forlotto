import { useRef, useState } from 'react'
import { OWNERS, TYPES, entryTotal, fmt, getLimit, toNum, uid, usedAmount } from '../lib.js'
import OverLimitModal from '../components/OverLimitModal.jsx'
import { useConfirm } from '../components/Confirm.jsx'
import { Check, Eraser, History, Plus, Receipt, Trash2, X } from 'lucide-react'

const DEFAULT_ROWS = 5
const blankRow = (owner = 'meaw') => ({ id: uid(), number: '', amount: '', pos: 'top', straight: '', tod: '', note: '', owner })
const blankRows = () => Array.from({ length: DEFAULT_ROWS }, () => blankRow())

export default function BuyPage({ data, update, event, toast }) {
  const [rows, setRows] = useState(blankRows)
  const [errors, setErrors] = useState({})
  const [overLimit, setOverLimit] = useState(null) // { info, resolve }
  const formRef = useRef(null)

  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [blankRow()]))
  // New rows inherit the owner of the last row, since a run of numbers usually goes to the same person.
  const addRows = (n = 1) => setRows((rs) => [...rs, ...Array.from({ length: n }, () => blankRow(rs.at(-1)?.owner))])

  // Enter jumps to the next input, so a whole ticket can be keyed without the mouse.
  // Ctrl+Enter saves the ticket.
  const ROW_FIELDS = '.ticket-row input:not([disabled]), .ticket-row select:not([disabled])'
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return
    e.preventDefault()
    if (e.ctrlKey) return submit()
    const fields = [...formRef.current.querySelectorAll(ROW_FIELDS)]
    const i = fields.indexOf(e.target)
    if (i === -1) return
    if (i === fields.length - 1) addRows(1)
    setTimeout(() => {
      const next = formRef.current.querySelectorAll(ROW_FIELDS)[i + 1]
      next?.focus()
      next?.select?.()
    }, 0)
  }

  function validate() {
    const errs = {}
    const items = []
    for (const r of rows) {
      if (!r.number) continue
      if (!/^\d{2,3}$/.test(r.number)) {
        errs[r.id] = 'ใส่เลข 2 หรือ 3 หลัก'
        continue
      }
      if (r.number.length === 2) {
        const amount = toNum(r.amount)
        if (!amount) errs[r.id] = 'ใส่จำนวนเงิน'
        else items.push({ type: r.pos, number: r.number, amount, owner: r.owner, note: r.note.trim() })
      } else {
        const straight = toNum(r.straight)
        const tod = toNum(r.tod)
        if (!straight && !tod) errs[r.id] = 'ใส่ยอดตรงหรือโต๊ด'
        else items.push({ type: 'three', number: r.number, straight, tod, owner: r.owner, note: r.note.trim() })
      }
    }
    return { errs, items }
  }

  const ask = (info) => new Promise((resolve) => setOverLimit({ info, resolve }))

  async function submit() {
    const { errs, items } = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return toast('มีช่องที่กรอกไม่ถูกต้อง', 'err')
    if (!items.length) return toast('ยังไม่ได้กรอกเลข', 'err')

    const now = Date.now()
    const batchId = uid()
    const created = []
    let rejected = 0
    // Items are processed one by one; amounts cut from ลุงแมว are queued again for ป้าจิก's limit check.
    const queue = items.map((it) => ({ ...it, cutFrom: null }))

    while (queue.length) {
      const it = queue.shift()
      const used =
        usedAmount(data.entries, event.id, it.owner, it.type, it.number) +
        created.filter((c) => c.owner === it.owner && c.type === it.type && c.number === it.number).reduce((s, c) => s + total3(c), 0)
      const limit = getLimit(event, it.owner, it.type, it.number)
      const incoming = total3(it)
      let keep = it

      if (limit !== null && used + incoming > limit) {
        const decision = await ask({ item: it, used, limit, incoming })
        setOverLimit(null)
        if (!decision) return toast('ยกเลิกการบันทึก — ยังไม่มีอะไรถูกบันทึก', 'err')
        keep = { ...it, ...decision.keep }
        const rest = subtract(it, decision.keep)
        if (total3(rest) > 0) {
          if (it.owner === 'meaw') queue.push({ ...rest, owner: 'jik', cutFrom: 'meaw' })
          else rejected += total3(rest)
        }
      }
      if (total3(keep) > 0) created.push(makeEntry(keep, event.id, batchId, now))
    }

    update((d) => void d.entries.push(...created))
    const sent = created.filter((c) => c.cutFrom).reduce((s, c) => s + total3(c), 0)
    let msg = `บันทึกแล้ว ${created.length} รายการ`
    if (sent) msg += ` · ตัดส่งป้าจิก ${fmt(sent)} บาท`
    if (rejected) msg += ` · ไม่รับ ${fmt(rejected)} บาท`
    toast(msg)
    setRows(blankRows())
    setErrors({})
    setTimeout(() => formRef.current?.querySelector('input')?.focus(), 0)
  }

  const filled = rows.filter((r) => r.number).length

  return (
    <div className="page buy-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{event.name}</div>
          <h1>ซื้อเลข</h1>
        </div>
        <div className="kbd-hints">
          <span>
            <kbd>Enter</kbd> ไปช่องถัดไป
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> ยืนยัน
          </span>
        </div>
      </div>

      <div className="card ticket" ref={formRef} onKeyDown={onKeyDown}>
        <div className="card-head">
          <div className="card-title">
            <span className="card-title-icon">
              <Receipt size={18} />
            </span>
            โพยใบใหม่
            {filled > 0 && <span className="pill">{filled} เลข</span>}
          </div>
          <span className="muted small">พิมพ์ 2 หลัก = เลือกบน/ล่าง · พิมพ์ 3 หลัก = ใส่ตรง/โต๊ด</span>
        </div>

        <div className="ticket-grid ticket-header">
          <span>#</span>
          <span>เลข</span>
          <span>จำนวนเงิน (บาท)</span>
          <span>ประเภท</span>
          <span>หมายเหตุ</span>
          <span>ลงบัญชีของ</span>
          <span></span>
        </div>

        {rows.map((r, i) => {
          const len = r.number.length
          return (
            <div key={r.id} className={`ticket-grid ticket-row ${errors[r.id] ? 'has-error' : ''} ${len ? 'filled' : ''}`}>
              <span className="row-no">{i + 1}</span>
              <input
                className="num-input"
                inputMode="numeric"
                maxLength={3}
                placeholder="00"
                value={r.number}
                onChange={(e) => setRow(r.id, { number: e.target.value.replace(/\D/g, '') })}
              />
              {len === 3 ? (
                <div className="three-amounts">
                  <label className="affix">
                    <span>ตรง</span>
                    <input inputMode="decimal" placeholder="0" value={r.straight} onChange={(e) => setRow(r.id, { straight: money(e) })} />
                  </label>
                  <label className="affix">
                    <span>โต๊ด</span>
                    <input inputMode="decimal" placeholder="0" value={r.tod} onChange={(e) => setRow(r.id, { tod: money(e) })} />
                  </label>
                </div>
              ) : (
                <input
                  inputMode="decimal"
                  placeholder={len === 2 ? '0' : 'ใส่เลขก่อน'}
                  disabled={len !== 2}
                  value={r.amount}
                  onChange={(e) => setRow(r.id, { amount: money(e) })}
                />
              )}
              {len === 3 ? (
                <span className="type-chip">3 ตัว</span>
              ) : (
                <Segmented
                  disabled={len !== 2}
                  value={r.pos}
                  options={[
                    ['top', 'บน'],
                    ['bottom', 'ล่าง'],
                  ]}
                  onChange={(pos) => setRow(r.id, { pos })}
                />
              )}
              <input placeholder="ชื่อคนซื้อ ฯลฯ" value={r.note} onChange={(e) => setRow(r.id, { note: e.target.value })} />
              <Segmented
                className="owner-seg"
                value={r.owner}
                options={Object.entries(OWNERS)}
                onChange={(owner) => setRow(r.id, { owner })}
              />
              <button className="icon-btn danger" tabIndex={-1} onClick={() => removeRow(r.id)} title="ลบแถว">
                <X size={16} />
              </button>
              {errors[r.id] && <span className="row-error">{errors[r.id]}</span>}
            </div>
          )
        })}

        <div className="ticket-add">
          <button className="btn ghost sm" onClick={() => addRows(1)}>
            <Plus size={15} /> เพิ่มแถว
          </button>
          <button className="btn ghost sm" onClick={() => addRows(5)}>
            <Plus size={15} /> เพิ่ม 5 แถว
          </button>
        </div>

        <div className="ticket-foot">
          <button
            className="btn ghost"
            onClick={() => {
              setRows(blankRows())
              setErrors({})
            }}
          >
            <Eraser size={16} /> ล้างโพย
          </button>
          <button className="btn primary lg" onClick={submit}>
            <Check size={19} /> ยืนยันบันทึก
          </button>
        </div>
      </div>

      <RecentEntries data={data} event={event} update={update} toast={toast} />

      {overLimit && (
        <OverLimitModal
          {...overLimit.info}
          typeLabel={TYPES[overLimit.info.item.type]}
          onDecide={overLimit.resolve}
          onCancel={() => overLimit.resolve(null)}
        />
      )}
    </div>
  )
}

function RecentEntries({ data, event, update, toast }) {
  const confirm = useConfirm()
  async function remove(e) {
    const ok = await confirm({
      title: `ลบเลข ${e.number} ?`,
      message: `${TYPES[e.type]} · ยอด ${fmt(entryTotal(e))} บาท · ${OWNERS[e.owner]}`,
      detail: e.note ? `หมายเหตุ: ${e.note}` : null,
      confirmText: 'ลบรายการนี้',
      danger: true,
    })
    if (!ok) return
    update((d) => void (d.entries = d.entries.filter((x) => x.id !== e.id)))
    toast(`ลบเลข ${e.number} แล้ว`, 'ok', { label: 'เลิกทำ', run: () => update((d) => void d.entries.push(e)) })
  }

  const recent = data.entries
    .filter((e) => e.eventId === event.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
  if (!recent.length) return null
  return (
    <div className="card recent">
      <div className="card-head">
        <div className="card-title">
          <span className="card-title-icon">
            <History size={18} />
          </span>
          รายการล่าสุด
        </div>
        <span className="muted small">12 รายการล่าสุดของงวดนี้</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>เวลา</th>
            <th>เลข</th>
            <th>ประเภท</th>
            <th className="r">ยอด</th>
            <th>ของ</th>
            <th>หมายเหตุ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {recent.map((e) => (
            <tr key={e.id}>
              <td className="muted">{new Date(e.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
              <td className="mono strong">{e.number}</td>
              <td>{TYPES[e.type]}</td>
              <td className="r mono">{fmt(entryTotal(e))}</td>
              <td>
                <span className={`owner-tag o-${e.owner}`}>{OWNERS[e.owner]}</span>
                {e.cutFrom && <span className="cut-tag">ตัดส่ง</span>}
              </td>
              <td className="muted">{e.note}</td>
              <td className="actions">
                <button className="icon-btn danger" onClick={() => remove(e)} title="ลบรายการนี้">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const money = (e) => e.target.value.replace(/[^\d.]/g, '')
const total3 = (it) => (it.type === 'three' ? (it.straight || 0) + (it.tod || 0) : it.amount || 0)

function subtract(it, keep) {
  return it.type === 'three'
    ? { ...it, straight: (it.straight || 0) - (keep.straight || 0), tod: (it.tod || 0) - (keep.tod || 0) }
    : { ...it, amount: (it.amount || 0) - (keep.amount || 0) }
}

function makeEntry(it, eventId, batchId, now) {
  const base = { id: uid(), eventId, batchId, owner: it.owner, type: it.type, number: it.number, note: it.note, cutFrom: it.cutFrom, createdAt: now }
  return it.type === 'three' ? { ...base, straight: it.straight || 0, tod: it.tod || 0 } : { ...base, amount: it.amount }
}

function Segmented({ value, options, onChange, disabled, className = '' }) {
  return (
    <div className={`segmented ${className} ${disabled ? 'disabled' : ''}`}>
      {options.map(([k, label]) => (
        <button key={k} type="button" tabIndex={-1} disabled={disabled} className={`${value === k ? 'active' : ''} v-${k}`} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}
