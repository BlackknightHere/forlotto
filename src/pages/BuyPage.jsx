import { useRef, useState } from 'react'
import { OWNERS, TYPES, allocateItems, cleanMoney, entryTotal, fmt, parseReverse, permutations, toNum, uid } from '../lib.js'
import OverLimitModal from '../components/OverLimitModal.jsx'
import { useConfirm } from '../components/Confirm.jsx'
import ArchivedBar from '../components/ArchivedBar.jsx'
import { Check, Eraser, History, Plus, Receipt, Trash2, X } from 'lucide-react'

const DEFAULT_ROWS = 5
const blankRow = (owner = 'meaw') => ({ id: uid(), number: '', amount: '', pos: 'top', straight: '', tod: '', note: '', owner })
const blankRows = () => Array.from({ length: DEFAULT_ROWS }, () => blankRow())
const isBlank = (r) => !r.number && !r.amount && !r.straight && !r.tod && !r.note.trim()

export default function BuyPage({ data, update, event, toast, showReceipt }) {
  const [rows, setRows] = useState(blankRows)
  const [errors, setErrors] = useState({})
  const [overLimit, setOverLimit] = useState(null) // { info, resolve }
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false) // a ref, so a double click within the same tick is still blocked
  const formRef = useRef(null)

  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [blankRow()]))
  // New rows inherit the owner of the last row, since a run of numbers usually goes to the same person.
  const addRows = (n = 1) => setRows((rs) => [...rs, ...Array.from({ length: n }, () => blankRow(rs.at(-1)?.owner))])

  function validate() {
    const errs = {}
    const items = []
    for (const r of rows) {
      if (!r.number) {
        if (!isBlank(r)) errs[r.id] = 'ยังไม่ได้ใส่เลข'
        continue
      }
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
        const rev = reverseOf(r)
        if (rev) {
          // "กลับ": every ordering of the digits is bought ตรง at the same price.
          if (rev.error) errs[r.id] = rev.error
          else if (!straight) errs[r.id] = 'ใส่ราคาช่องตรง (เลขละกี่บาท)'
          else for (const n of rev.numbers) items.push({ type: 'three', number: n, straight, tod: 0, owner: r.owner, note: r.note.trim(), reverseOf: r.number })
          continue
        }
        const tod = toNum(r.tod)
        if (!straight && !tod) errs[r.id] = 'ใส่ยอดตรงหรือโต๊ด'
        else items.push({ type: 'three', number: r.number, straight, tod, owner: r.owner, note: r.note.trim() })
      }
    }
    return { errs, items }
  }

  const decide = (info) =>
    new Promise((resolve) =>
      setOverLimit({
        info,
        resolve: (v) => {
          setOverLimit(null)
          resolve(v)
        },
      }),
    )

  async function submit() {
    if (submitting.current || event.archived) return
    submitting.current = true
    setBusy(true)
    try {
      const { errs, items } = validate()
      setErrors(errs)
      if (Object.keys(errs).length) return toast('มีช่องที่กรอกไม่ถูกต้อง', 'err')
      if (!items.length) return toast('ยังไม่ได้กรอกเลข', 'err')

      const result = await allocateItems(items, { entries: data.entries, event, decide })
      if (result.cancelled) return toast('ยกเลิกการบันทึก — ยังไม่มีอะไรถูกบันทึก', 'err')

      const now = Date.now()
      const batchId = uid()
      const created = result.created.map((it) => makeEntry(it, event.id, batchId, now))
      if (!update((d) => void d.entries.push(...created))) return
      showReceipt({ batchId, savedAt: now, entries: created, rejected: result.rejected })
      setRows(blankRows())
      setErrors({})
      setTimeout(() => formRef.current?.querySelector('input')?.focus(), 0)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const filled = rows.filter((r) => r.number).length

  return (
    <div className="page buy-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{event.name}</div>
          <h1>ซื้อเลข</h1>
        </div>
      </div>

      {event.archived && <ArchivedBar event={event} update={update} text="ดูข้อมูลได้ แต่บันทึก แก้ไข หรือลบโพยไม่ได้" />}

      <div className="card ticket" ref={formRef}>
        <div className="card-head">
          <div className="card-title">
            <span className="card-title-icon">
              <Receipt size={18} />
            </span>
            โพยใบใหม่
            {filled > 0 && <span className="pill">{filled} เลข</span>}
          </div>
          <span className="muted small">พิมพ์ 2 หลัก = เลือกบน/ล่าง · พิมพ์ 3 หลัก = ใส่ตรง/โต๊ด · ช่องโต๊ดใส่ 3x / 6x = ซื้อกลับ</span>
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
                    <input placeholder="0 / 3x / 6x" value={r.tod} onChange={(e) => setRow(r.id, { tod: todInput(e) })} title="ใส่ 3x หรือ 6x = ซื้อกลับ" />
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
              {!errors[r.id] && <ReverseHint row={r} />}
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
          <button className="btn primary lg" onClick={submit} disabled={busy || event.archived}>
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
    if (!update((d) => void (d.entries = d.entries.filter((x) => x.id !== e.id)))) return
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
              <td>
                {TYPES[e.type]}
                {e.reverseOf && <span className="cut-tag">กลับ {e.reverseOf}</span>}
              </td>
              <td className="r mono">{fmt(entryTotal(e))}</td>
              <td>
                <span className={`owner-tag o-${e.owner}`}>{OWNERS[e.owner]}</span>
                {e.cutFrom && <span className="cut-tag">ตัดส่ง</span>}
              </td>
              <td className="muted">{e.note}</td>
              <td className="actions">
                {!event.archived && (
                  <button className="icon-btn danger" onClick={() => remove(e)} title="ลบรายการนี้">
                    <Trash2 size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const money = (e) => cleanMoney(e.target.value)

// The โต๊ด box takes money, or a กลับ marker while it is being typed ('3', '6', '3x', '6x'; ป = x on a Thai keyboard).
function todInput(e) {
  const v = e.target.value.replace(/\s/g, '')
  if (/^[36][xX×*ป]$/.test(v)) return v[0] + 'x'
  return cleanMoney(v)
}

/** For a 3-digit row with a 3x / 6x marker: the numbers to buy, or why the marker doesn't fit this number. */
function reverseOf(r) {
  const want = parseReverse(r.tod)
  if (!want || r.number.length !== 3) return null
  const numbers = permutations(r.number)
  if (numbers.length === 1) return { error: `เลข ${r.number} เป็นเลขตอง ซื้อกลับไม่ได้` }
  if (numbers.length !== want) return { error: `เลข ${r.number} กลับได้ ${numbers.length} แบบ ให้ใส่ ${numbers.length}x` }
  return { numbers }
}

function ReverseHint({ row }) {
  const rev = reverseOf(row)
  if (!rev) return null
  if (rev.error) return <span className="row-error">{rev.error}</span>
  const price = toNum(row.straight)
  return (
    <span className="row-hint">
      {rev.numbers.length} กลับ: <b>{rev.numbers.join('  ')}</b>
      {price > 0 && (
        <>
          {' '}
          · เลขละ {fmt(price)} × {rev.numbers.length} = <b>{fmt(price * rev.numbers.length)} บาท</b>
        </>
      )}
    </span>
  )
}

function makeEntry(it, eventId, batchId, now) {
  const base = { id: uid(), eventId, batchId, owner: it.owner, type: it.type, number: it.number, note: it.note, cutFrom: it.cutFrom, createdAt: now }
  if (it.reverseOf) base.reverseOf = it.reverseOf
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
