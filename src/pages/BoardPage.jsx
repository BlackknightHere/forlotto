import { useMemo, useState } from 'react'
import { Coins, Hash, PenLine, Search, Settings2, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { TYPES, TYPE_KEYS, breakdown, entriesOf, entryTotal, fmt, cellState, defaultLimit, getLimit, groupByNumber, numbersFor, ownLimit, tabSummary } from '../lib.js'
import LimitModal from '../components/LimitModal.jsx'
import NumberModal from '../components/NumberModal.jsx'
import PayoutPanel from '../components/PayoutPanel.jsx'
import OwnerSelect from '../components/OwnerSelect.jsx'
import ArchivedBar from '../components/ArchivedBar.jsx'

const THREE_PAGE_SIZE = 500
const GRID_COLUMNS = 10

export default function BoardPage({ data, update, event, toast, owner, setOwner, goBuy }) {
  const [type, setType] = useState('top')
  const [search, setSearch] = useState('')
  const [onlyBought, setOnlyBought] = useState(false)
  const [threePage, setThreePage] = useState(0)
  const [limitOpen, setLimitOpen] = useState(false)
  const [openNumber, setOpenNumber] = useState(null)

  const list = useMemo(() => entriesOf(data.entries, event.id, owner, type), [data.entries, event.id, owner, type])
  const groups = useMemo(() => groupByNumber(list), [list])
  const tabTotal = list.reduce((s, e) => s + entryTotal(e), 0)
  const profit = TYPE_KEYS.reduce((s, t) => s + tabSummary(event, data.entries, owner, t).profit, 0)

  const numbers = useMemo(() => {
    let all = numbersFor(type)
    const q = search.trim()
    if (q) all = all.filter((n) => n.startsWith(q))
    else if (type === 'three') all = all.slice(threePage * THREE_PAGE_SIZE, (threePage + 1) * THREE_PAGE_SIZE)
    if (onlyBought) all = all.filter((n) => groups[n])
    return all
  }, [type, search, threePage, onlyBought, groups])

  const overCount = Object.keys(groups).filter((n) => {
    const lim = getLimit(event, owner, type, n)
    return lim !== null && groups[n].reduce((s, e) => s + entryTotal(e), 0) > lim
  }).length

  const tabIndex = TYPE_KEYS.indexOf(type)

  return (
    <div className="page board-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{event.name}</div>
          <h1>ยอดรวม</h1>
        </div>
        <div className="head-actions">
          <OwnerSelect value={owner} onChange={setOwner} />
          <button className="btn" onClick={() => setLimitOpen(true)} disabled={event.archived} title={event.archived ? 'งวดที่จัดเก็บแล้วแก้ยอดอั้นไม่ได้' : ''}>
            <Settings2 size={17} /> ตั้งยอดอั้น
          </button>
          <button className="btn primary" onClick={goBuy}>
            <PenLine size={17} /> ซื้อเลข
          </button>
        </div>
      </div>

      {event.archived && <ArchivedBar event={event} update={update} text="แก้ไขโพยและยอดอั้นไม่ได้ แต่ยังกรอกเลขที่ออกและตัวคูณได้" />}

      <div className="stat-row">
        <StatCard icon={Coins} tone="brand" label={`ยอดซื้อ ${TYPES[type]}`} value={`${fmt(tabTotal)} ฿`} />
        <StatCard icon={Hash} tone="blue" label="เลขที่มีคนซื้อ" value={`${Object.keys(groups).length} เลข`} />
        <StatCard icon={TriangleAlert} tone={overCount ? 'red' : 'gray'} label="เลขที่เกินอั้น" value={`${overCount} เลข`} />
        <StatCard
          icon={profit < 0 ? TrendingDown : TrendingUp}
          tone={profit < 0 ? 'red' : 'green'}
          label="กำไร / ขาดทุน (ทุกประเภท)"
          value={`${profit < 0 ? '−' : profit > 0 ? '+' : ''}${fmt(Math.abs(profit))} ฿`}
        />
      </div>

      <div className="card board-card">
        <div className="board-toolbar">
          <div className="tabs" style={{ '--tab-index': tabIndex }}>
            <span className="tab-slider" />
            {TYPE_KEYS.map((t) => (
              <button
                key={t}
                className={t === type ? 'tab active' : 'tab'}
                onClick={() => {
                  setType(t)
                  setSearch('')
                }}
              >
                {TYPES[t]}
              </button>
            ))}
          </div>
          <div className="search-wrap">
            <Search size={16} />
            <input
              inputMode="numeric"
              maxLength={type === 'three' ? 3 : 2}
              placeholder={`ค้นหาเลข ${type === 'three' ? '000-999' : '00-99'}`}
              value={search}
              onChange={(e) => setSearch(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && numbers.length === 1 && setOpenNumber(numbers[0])}
            />
          </div>
          {type === 'three' && !search && (
            <div className="seg">
              {[0, 1].map((p) => (
                <button key={p} className={p === threePage ? 'active' : ''} onClick={() => setThreePage(p)}>
                  {p === 0 ? '000 – 499' : '500 – 999'}
                </button>
              ))}
            </div>
          )}
          <label className="switch">
            <input type="checkbox" checked={onlyBought} onChange={(e) => setOnlyBought(e.target.checked)} />
            <span className="switch-track" />
            เฉพาะเลขที่มีคนซื้อ
          </label>
          <div className="legend">
            {defaultLimit(event, owner, type) !== null && (
              <span className="legend-default">
                อั้นทุกเลข <b>{fmt(defaultLimit(event, owner, type))}</b>
              </span>
            )}
            <span>
              <i className="l-near" />
              ใกล้เต็ม 80%
            </span>
            <span>
              <i className="l-full" />
              เต็มพอดี
            </span>
            <span>
              <i className="l-over" />
              เกินอั้น
            </span>
          </div>
        </div>

      {/* Numbers run top-to-bottom, then on to the next column (00–09 in the first column). */}
      <div
        className={`grid ${type === 'three' ? 'grid-three' : 'grid-two'}`}
        style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(numbers.length / GRID_COLUMNS))}, auto)` }}
      >
        {numbers.map((n) => (
          <Cell
            key={n}
            number={n}
            entries={groups[n]}
            limit={getLimit(event, owner, type, n)}
            own={ownLimit(event, owner, type, n)}
            short={type === 'three'}
            found={search.length === (type === 'three' ? 3 : 2) && n === search}
            onClick={() => setOpenNumber(n)}
          />
        ))}
        {!numbers.length && <div className="muted empty-grid">ไม่พบเลข</div>}
      </div>
      </div>

      <PayoutPanel data={data} update={update} event={event} owner={owner} type={type} />

      {limitOpen && <LimitModal event={event} owner={owner} type={type} update={update} toast={toast} onClose={() => setLimitOpen(false)} />}
      {openNumber && (
        <NumberModal
          number={openNumber}
          type={type}
          owner={owner}
          event={event}
          readOnly={event.archived}
          entries={groups[openNumber] || []}
          update={update}
          toast={toast}
          onClose={() => setOpenNumber(null)}
        />
      )}
    </div>
  )
}

// One number in the grid. Every cell reads the same way:
//   [number] ............ [total]        or, with a per-number limit:  [number] [อั้น 500]
//   [20+20+50 = 90]                                                    [400+20 = 420]
// (the corner total gives way to the limit pill: the bottom line already ends in "= total")
// The state (near / full / over) is shown by the bar on the left; "over" also tints the cell.
function Cell({ number, entries, limit, own, short, found, onClick }) {
  const list = entries || []
  const total = list.reduce((s, e) => s + entryTotal(e), 0)
  const state = cellState(total, limit)
  const tip = [sumTip(list, total), limit !== null ? `อั้น ${fmt(limit)}` : ''].filter(Boolean).join(' · ')

  let pill = null
  if (state === 'closed') pill = 'ปิดรับ'
  else if (own !== null) pill = short ? fmt(own) : `อั้น ${fmt(own)}`

  return (
    <button className={`cell s-${state} ${found ? 'found' : ''}`} onClick={onClick} title={tip}>
      <div className="cell-top">
        <span className="cell-num">{number}</span>
        {pill && <span className="cell-limit">{pill}</span>}
        {total > 0 && !pill && <span className="cell-total">{fmt(total)}</span>}
      </div>
      {list.length > 0 && (
        <div className="cell-break">
          <span className="cell-sum">{breakdown(list)}</span>
          <b className="cell-eq">= {fmt(total)}</b>
        </div>
      )}
    </button>
  )
}

const sumTip = (list, total) => (list.length ? `${breakdown(list)} = ${fmt(total)}` : '')

function StatCard({ icon: Icon, tone, label, value }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon t-${tone}`}>
        <Icon size={20} />
      </span>
      <div>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
      </div>
    </div>
  )
}
