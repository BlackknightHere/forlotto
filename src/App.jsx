import { useCallback, useState } from 'react'
import { CalendarDays, CalendarPlus, Cat, CircleCheck, CloudOff, LayoutGrid, Loader, PenLine, RefreshCw } from 'lucide-react'
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
  conflict: { text: 'ข้อมูลถูกแก้จากหน้าต่างอื่น', icon: RefreshCw },
}

export default function App() {
  const { data, status, update } = useDb()
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

  if (!data) {
    return (
      <div className="center-screen">
        {status === 'error' ? 'เชื่อมต่อโปรแกรมไม่ได้ — กรุณาเปิดผ่านไฟล์ 2-open-app.bat' : 'กำลังโหลด…'}
      </div>
    )
  }

  const activeEvents = data.events.filter((e) => !e.archived).sort((a, b) => b.date.localeCompare(a.date))
  const event = data.events.find((e) => e.id === data.settings.currentEventId) || activeEvents[0] || null
  const setCurrentEvent = (id) => update((d) => void (d.settings.currentEventId = id))
  const createEvent = () => {
    setStartCreate(true)
    setPage('events')
  }

  const ctx = { data, update, event, toast }
  const St = STATUS[status]

  return (
    <div className="shell">
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
          {status === 'conflict' && (
            <button className="link-btn" onClick={() => location.reload()}>
              โหลดใหม่
            </button>
          )}
        </div>
      </aside>

      <main className="main">
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
  )
}
