import { ArchiveRestore } from 'lucide-react'

/** Shown on an archived event: tickets and limits are read-only, draw results/multipliers can still be filled in. */
export default function ArchivedBar({ event, update, text }) {
  return (
    <div className="archived-bar">
      <ArchiveRestore size={20} />
      <div>
        <b>งวดนี้จัดเก็บแล้ว</b> — {text}
      </div>
      <button className="btn sm" onClick={() => update((d) => void (d.events.find((e) => e.id === event.id).archived = false))}>
        นำกลับมาใช้งาน
      </button>
    </div>
  )
}
