import { Archive, ArchiveRestore, CalendarPlus, Pencil, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { useConfirm } from '../components/Confirm.jsx'
import { cleanMoney, DEFAULT_DISCOUNT, OWNERS, eventTotals, fmt, fmtDate, newEvent, todayIso } from '../lib.js'

export default function EventsPage({ data, update, event, toast, setCurrentEvent, goBuy, startCreate, onCreateOpened }) {
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState(null) // null | { mode: 'create' | 'edit', ... }
  const confirm = useConfirm()

  const q = search.trim().toLowerCase()
  const events = data.events
    .filter((e) => e.archived === showArchived)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || fmtDate(e.date).includes(q) || e.date.includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const archivedCount = data.events.filter((e) => e.archived).length

  const openCreate = () => {
    const date = todayIso()
    setForm({ mode: 'create', name: `งวด ${fmtDate(date)}`, date, meaw: DEFAULT_DISCOUNT, jik: DEFAULT_DISCOUNT, copyFrom: '', nameTouched: false })
  }
  useEffect(() => {
    if (!startCreate) return
    openCreate()
    onCreateOpened()
  }, [startCreate]) // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (ev) =>
    setForm({ mode: 'edit', id: ev.id, name: ev.name, date: ev.date, meaw: ev.discount.meaw, jik: ev.discount.jik, nameTouched: true })

  function submit() {
    const name = form.name.trim() || `งวด ${fmtDate(form.date)}`
    const discount = { meaw: Number(form.meaw) || 0, jik: Number(form.jik) || 0 }
    if (form.mode === 'create') {
      const source = data.events.find((e) => e.id === form.copyFrom)
      const ev = newEvent({ name, date: form.date, discount, limits: source?.limits })
      update((d) => {
        d.events.push(ev)
        d.settings.currentEventId = ev.id
      })
      toast(`สร้าง "${name}" แล้ว`)
      setForm(null)
      goBuy()
    } else {
      update((d) => Object.assign(d.events.find((e) => e.id === form.id), { name, date: form.date, discount }))
      toast('บันทึกแล้ว')
      setForm(null)
    }
  }

  const toggleArchive = (ev) => {
    update((d) => {
      const target = d.events.find((e) => e.id === ev.id)
      target.archived = !target.archived
      if (target.archived && d.settings.currentEventId === ev.id) d.settings.currentEventId = null
    })
    toast(ev.archived ? `นำ "${ev.name}" กลับมาแล้ว` : `จัดเก็บ "${ev.name}" แล้ว`)
  }

  const remove = async (ev) => {
    const { count } = eventTotals(ev, data.entries)
    const ok = await confirm({
      title: `ลบ "${ev.name}" ?`,
      message: `โพยทั้งหมด ${count} รายการ ยอดอั้น และผลรางวัลของงวดนี้จะถูกลบถาวร`,
      detail: 'ถ้าแค่ไม่อยากเห็นในรายการ ให้กด "จัดเก็บ" แทน',
      confirmText: 'ลบงวดนี้',
      danger: true,
    })
    if (!ok) return
    update((d) => {
      d.events = d.events.filter((e) => e.id !== ev.id)
      d.entries = d.entries.filter((e) => e.eventId !== ev.id)
      if (d.settings.currentEventId === ev.id) d.settings.currentEventId = null
    })
    toast('ลบแล้ว')
  }

  return (
    <div className="page events-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">แต่ละงวดเก็บโพย ยอดอั้น และผลรางวัลแยกกัน</div>
          <h1>งวดทั้งหมด</h1>
        </div>
        <div className="head-actions">
          <button className="btn primary" onClick={openCreate}>
            <CalendarPlus size={17} /> สร้างงวดใหม่
          </button>
        </div>
      </div>

      <div className="board-toolbar">
        <div className="search-wrap">
          <Search size={16} />
          <input placeholder="ค้นหาชื่องวด / วันที่" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          <button className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>
            ใช้งานอยู่
          </button>
          <button className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>
            จัดเก็บแล้ว ({archivedCount})
          </button>
        </div>
      </div>

      <div className="event-list">
        {events.map((ev) => {
          const t = eventTotals(ev, data.entries)
          const isCurrent = ev.id === event?.id
          return (
            <div key={ev.id} className={`card event-card ${isCurrent ? 'current' : ''}`}>
              <div className="event-date">
                <span className="day">{new Date(ev.date + 'T00:00:00').getDate()}</span>
                <span className="mon">{new Date(ev.date + 'T00:00:00').toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })}</span>
              </div>
              <div className="event-info">
                <h3>
                  {ev.name} {isCurrent && <span className="current-tag">กำลังใช้</span>}
                </h3>
                <div className="muted small">
                  {fmtDate(ev.date)} · โพย {t.count} รายการ · ส่วนลด ลุงแมว {ev.discount.meaw}% / ป้าจิก {ev.discount.jik}%
                </div>
                <div className="event-totals">
                  {Object.entries(OWNERS).map(([k, v]) => (
                    <span key={k} className={`owner-tag o-${k}`}>
                      {v} {fmt(t.byOwner[k])} ฿
                    </span>
                  ))}
                </div>
              </div>
              <div className="event-actions">
                {!ev.archived && !isCurrent && (
                  <button className="btn sm primary" onClick={() => setCurrentEvent(ev.id)}>
                    เลือกใช้งาน
                  </button>
                )}
                {ev.archived && (
                  <button className="btn sm ghost" onClick={() => setCurrentEvent(ev.id)}>
                    เปิดดู
                  </button>
                )}
                <button className="btn sm ghost" onClick={() => openEdit(ev)}>
                  <Pencil size={14} /> แก้ไข
                </button>
                <button className="btn sm ghost" onClick={() => toggleArchive(ev)}>
                  {ev.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  {ev.archived ? 'นำกลับ' : 'จัดเก็บ'}
                </button>
                <button className="btn sm danger" onClick={() => remove(ev)}>
                  <Trash2 size={14} /> ลบ
                </button>
              </div>
            </div>
          )
        })}
        {!events.length && (
          <div className="empty-state small">
            <p className="muted">{q ? 'ไม่พบงวดที่ค้นหา' : showArchived ? 'ยังไม่มีงวดที่จัดเก็บ' : 'ยังไม่มีงวด กด "สร้างงวดใหม่" เพื่อเริ่ม'}</p>
          </div>
        )}
      </div>

      {form && (
        <Modal
          title={form.mode === 'create' ? 'สร้างงวดใหม่' : 'แก้ไขงวด'}
          onClose={() => setForm(null)}
          width={480}
          footer={
            <>
              <button className="btn ghost" onClick={() => setForm(null)}>
                ยกเลิก
              </button>
              <button className="btn primary" disabled={!form.date || badPct(form.meaw) || badPct(form.jik)} onClick={submit}>
                {form.mode === 'create' ? 'สร้าง' : 'บันทึก'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label className="field">
              <span>วันที่หวยออก</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => {
                  const date = e.target.value
                  setForm((f) => ({ ...f, date, name: f.nameTouched ? f.name : `งวด ${fmtDate(date)}` }))
                }}
              />
            </label>
            <label className="field">
              <span>ชื่องวด</span>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, nameTouched: true }))} />
            </label>
            <label className="field">
              <span>ส่วนลด ลุงแมว (%)</span>
              <input inputMode="decimal" value={form.meaw} onChange={(e) => setForm((f) => ({ ...f, meaw: cleanMoney(e.target.value) }))} className={badPct(form.meaw) ? 'invalid' : ''} />
            </label>
            <label className="field">
              <span>ส่วนลด ป้าจิก (%)</span>
              <input inputMode="decimal" value={form.jik} onChange={(e) => setForm((f) => ({ ...f, jik: cleanMoney(e.target.value) }))} className={badPct(form.jik) ? 'invalid' : ''} />
            </label>
            {(badPct(form.meaw) || badPct(form.jik)) && <p className="error-text span-2">ส่วนลดต้องเป็นตัวเลข 0–100 %</p>}
            {form.mode === 'create' && (
              <label className="field span-2">
                <span>คัดลอกยอดอั้นจากงวดก่อน</span>
                <select value={form.copyFrom} onChange={(e) => setForm((f) => ({ ...f, copyFrom: e.target.value }))}>
                  <option value="">— ไม่คัดลอก (เริ่มแบบไม่อั้น) —</option>
                  {[...data.events]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// Discount must be filled in and between 0 and 100 %
const badPct = (v) => v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100
