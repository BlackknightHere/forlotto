import { useCallback, useEffect, useRef, useState } from 'react'
import { AppWindow, CalendarDays, CalendarPlus, Cat, CircleCheck, CloudOff, LayoutGrid, Loader, PenLine, RefreshCw, TriangleAlert } from 'lucide-react'
import { useDb } from './store.js'
import { fmtDate } from './lib.js'
import BuyPage from './pages/BuyPage.jsx'
import BoardPage from './pages/BoardPage.jsx'
import EventsPage from './pages/EventsPage.jsx'

const NAV = [
  { key: 'buy', label: 'ซื้อเลข', icon: PenLine },
  { key: 'board', label: 'ดูยอดรวม', icon: LayoutGrid },
  { key: 'events', label: 'งวดทั้งหมด', icon: CalendarDays },
]

const STATUS = {
  loading: { text: 'กำลังโหลด…', icon: Loader },
  saving: { text: 'กำลังบันทึก…', icon: Loader },
  saved: { text: 'บันทึกอัตโนมัติแล้ว', icon: CircleCheck },
  error: { text: 'บันทึกไม่สำเร็จ', icon: CloudOff },
  conflict: { text: 'บันทึกไม่ได้', icon: RefreshCw },
  locked: { text: 'เปิดอยู่ในหน้าต่างอื่น', icon: AppWindow },
}

export default function App() {
  const { data, status, lockedSave, update, reload } = useDb()
  const shellRef = useRef(null)
  const blocked = status === 'locked' || status === 'conflict'

  // Under the blocking notice nothing may be typed or clicked: drop focus and make the app inert.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    if (blocked) {
      document.activeElement?.blur()
      shell.setAttribute('inert', '')
    } else shell.removeAttribute('inert')
  }, [blocked, data])
  const [page, setPage] = useState('buy')
  const [boardOwner, setBoardOwner] = useState('meaw')
  const [startCreate, setStartCreate] = useState(false)
  const [toasts, setToasts] = useState([])

  // action: optional { label, run } button shown in the toast, e.g. "เลิกทำ" after a delete
  const toast = useCallback((text, kind = 'ok', action = null) => {
    const id = Math.random()
    setToasts((t) => [...t, { id, text, kind, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 7000 : 3500)
  }, [])
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id))

  // Every page goes through this, so a refused save is never reported as success.
  const guardedUpdate = (fn) => {
    const ok = update(fn)
    if (!ok) toast(status === 'conflict' ? 'บันทึกไม่ได้ — ต้องโหลดข้อมูลล่าสุดก่อน' : 'บันทึกไม่ได้ — แอปถูกเปิดอยู่ในหน้าต่างอื่น', 'err')
    return ok
  }

  if (!data) {
    return (
      <div className="center-screen">
        {status === 'error' ? 'เชื่อมต่อโปรแกรมไม่ได้ — กรุณาเปิดผ่านไฟล์ 2-open-app.bat' : 'กำลังโหลด…'}
      </div>
    )
  }

  const activeEvents = data.events.filter((e) => !e.archived).sort((a, b) => b.date.localeCompare(a.date))
  const event = data.events.find((e) => e.id === data.settings.currentEventId) || activeEvents[0] || null
  const setCurrentEvent = (id) => guardedUpdate((d) => void (d.settings.currentEventId = id))
  const createEvent = () => {
    setStartCreate(true)
    setPage('events')
  }

  const ctx = { data, update: guardedUpdate, event, toast }
  const St = STATUS[status]

  return (
    <>
      <div className="shell" ref={shellRef}>
      <aside className="sidebar">
        <div className="brand" onClick={() => setPage('buy')}>
          <span className="brand-logo">
            <Cat size={22} strokeWidth={2.2} />
          </span>
          <div>
            <div className="brand-name">หวยลุงแมว</div>
            <div className="brand-sub">ระบบจดโพยหวยรัฐบาล</div>
          </div>
        </div>

        <div className="side-event">
          <div className="side-label">งวดปัจจุบัน</div>
          {event ? (
            <div className="select-wrap">
              <CalendarDays size={16} className="select-icon" />
              <select value={event.id} onChange={(e) => setCurrentEvent(e.target.value)}>
                {event.archived && <option value={event.id}>{event.name} (จัดเก็บแล้ว)</option>}
                {activeEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button className="btn primary block" onClick={createEvent}>
              <CalendarPlus size={16} /> สร้างงวดแรก
            </button>
          )}
          {event && <div className="side-event-date">หวยออก {fmtDate(event.date)}</div>}
        </div>

        <nav className="side-nav">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`side-link ${page === key ? 'active' : ''}`} onClick={() => setPage(key)}>
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className={`side-status s-${status}`}>
          <St.icon size={14} className={status === 'saving' ? 'spin' : ''} />
          <span>{St.text}</span>
        </div>
      </aside>

      <main className="main">
        {status === 'error' && (
          <div className="alert-bar">
            <TriangleAlert size={20} />
            <div>
              <b>บันทึกข้อมูลไม่สำเร็จ — ระบบกำลังลองใหม่อัตโนมัติ</b>
              <span>อย่าเพิ่งปิดโปรแกรม และตรวจว่าหน้าต่างสีดำ (2-open-app) ยังเปิดอยู่</span>
            </div>
          </div>
        )}
        {page === 'events' ? (
          <EventsPage
            {...ctx}
            setCurrentEvent={setCurrentEvent}
            goBuy={() => setPage('buy')}
            startCreate={startCreate}
            onCreateOpened={() => setStartCreate(false)}
          />
        ) : !event ? (
          <div className="empty-state">
            <div className="empty-icon">
              <CalendarDays size={34} />
            </div>
            <h2>ยังไม่มีงวด</h2>
            <p>สร้างงวด (วันที่หวยออก) ก่อน แล้วค่อยเริ่มคีย์เลข</p>
            <button className="btn primary lg" onClick={createEvent}>
              <CalendarPlus size={18} /> สร้างงวดใหม่
            </button>
          </div>
        ) : page === 'buy' ? (
          <BuyPage {...ctx} />
        ) : (
          <BoardPage key={boardOwner} {...ctx} owner={boardOwner} setOwner={setBoardOwner} goBuy={() => setPage('buy')} />
        )}
      </main>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast t-${t.kind}`}>
            <span className="toast-dot" />
            <span>{t.text}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action.run()
                  dismissToast(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      </div>

      {status === 'locked' && (
        <BlockingNotice
          icon={AppWindow}
          title="แอปถูกเปิดอยู่ในหน้าต่างอื่น"
          message={LOCKED_MESSAGE[lockedSave]}
          action="ใช้งานหน้านี้แทน"
          busy={lockedSave !== 'saved'}
          onAction={reload}
        />
      )}
      {status === 'conflict' && (
        <BlockingNotice
          danger
          icon={TriangleAlert}
          title="บันทึกรายการล่าสุดไม่ได้"
          message="ข้อมูลถูกแก้ไขจากหน้าต่างอื่น รายการที่เพิ่งคีย์ในหน้านี้ (หลังจากบันทึกครั้งล่าสุด) ยังไม่ถูกบันทึก กดปุ่มด้านล่างเพื่อโหลดข้อมูลล่าสุด แล้วตรวจดูในรายการล่าสุดว่าต้องคีย์อะไรใหม่บ้าง"
          action="โหลดข้อมูลล่าสุด"
          onAction={reload}
        />
      )}
    </>
  )
}

const LOCKED_MESSAGE = {
  saving: 'เพื่อไม่ให้ข้อมูลหายหรือซ้ำ ใช้งานได้ทีละหน้าต่างเท่านั้น กำลังบันทึกข้อมูลล่าสุดของหน้านี้… กรุณารอสักครู่',
  saved: 'เพื่อไม่ให้ข้อมูลหายหรือซ้ำ ใช้งานได้ทีละหน้าต่างเท่านั้น ข้อมูลในหน้านี้บันทึกไว้เรียบร้อยแล้ว กรุณาใช้หน้าต่างที่เปิดล่าสุด',
  failed: 'บันทึกข้อมูลล่าสุดของหน้านี้ไม่สำเร็จ ระบบกำลังลองใหม่อัตโนมัติ — อย่าเพิ่งปิดหน้านี้ และตรวจว่าหน้าต่างสีดำ (2-open-app) ยังเปิดอยู่',
}

function BlockingNotice({ icon: Icon, title, message, action, onAction, danger, busy }) {
  return (
    <div className="modal-backdrop confirm-backdrop blocking">
      <div className="confirm" role="alertdialog" aria-modal="true">
        <div className={`confirm-icon ${danger ? 'danger' : ''}`}>
          <Icon size={28} />
        </div>
        <h2>{title}</h2>
        <p className="confirm-msg">{message}</p>
        <button
          autoFocus
          className={`btn lg block ${danger ? 'danger-solid' : 'primary'}`}
          style={{ marginTop: 22 }}
          disabled={busy}
          onClick={onAction}
        >
          {busy ? <Loader size={18} className="spin" /> : null}
          {action}
        </button>
      </div>
    </div>
  )
}
