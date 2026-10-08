import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, ReceiptText, Trash2, X } from 'lucide-react'
import { OWNERS, entryTotal, fmt } from '../lib.js'
import { useConfirm } from './Confirm.jsx'

const TYPE_SHORT = { top: 'บน', bottom: 'ล่าง', three: '3 ตัว' }

// A กลับ set is saved as one ตรง entry per ordering; show it as a single line when the parts match.
function groupRows(entries) {
  const rows = []
  for (const e of entries) {
    const last = rows.at(-1)
    if (e.reverseOf && last?.reverseOf === e.reverseOf && last.owner === e.owner && last.cutFrom === e.cutFrom && last.straight === e.straight) {
      last.numbers.push(e.number)
    } else rows.push({ ...e, numbers: [e.number] })
  }
  return rows
}

/**
 * Bottom-right summary of the ticket that was just saved. It stays until closed (so it can be checked
 * at reading pace); saving the next ticket replaces it, so there is never more than one.
 * It folds down to its header while the next ticket is being keyed, so it never covers the form.
 */
export default function ReceiptPanel({ receipt, update, toast, onClose }) {
  const confirm = useConfirm()
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    // Fold when typing starts on the next ticket (not on focus: the form refocuses itself after saving).
    const fold = (e) => e.target.closest?.('.ticket') && setCollapsed(true)
    document.addEventListener('input', fold)
    return () => document.removeEventListener('input', fold)
  }, [])
  const { entries, rejected, savedAt, batchId } = receipt
  const kept = entries.filter((e) => !e.cutFrom).reduce((s, e) => s + entryTotal(e), 0)
  const sent = entries.filter((e) => e.cutFrom).reduce((s, e) => s + entryTotal(e), 0)

  async function removeTicket() {
    const ok = await confirm({
      title: 'ลบโพยใบนี้ทั้งใบ?',
      message: `${entries.length} รายการ รวม ${fmt(kept + sent)} บาท`,
      detail: sent ? 'รวมส่วนที่ตัดส่งป้าจิกด้วย' : null,
      confirmText: 'ลบใบนี้',
      danger: true,
    })
    if (!ok) return
    if (!update((d) => void (d.entries = d.entries.filter((e) => e.batchId !== batchId)))) return
    onClose()
    toast(`ลบโพย ${entries.length} รายการแล้ว`, 'ok', { label: 'เลิกทำ', run: () => update((d) => void d.entries.push(...entries)) })
  }

  return (
    <section className={`receipt ${collapsed ? 'collapsed' : ''}`} aria-live="polite" aria-label="สรุปโพยที่เพิ่งบันทึก">
      <header className="receipt-head" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'กดเพื่อดูรายการ' : 'กดเพื่อย่อ'}>
        <span className="receipt-icon">
          <ReceiptText size={18} />
        </span>
        <div className="receipt-title">
          <b>บันทึกโพยแล้ว · {entries.length} รายการ</b>
          <small>
            {new Date(savedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. · รวม {fmt(kept + sent)} บาท
          </small>
        </div>
        <button className="icon-btn" aria-label={collapsed ? 'ขยายสรุปโพย' : 'ย่อสรุปโพย'} aria-expanded={!collapsed}>
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="ปิดสรุปโพย"
          title="ปิด"
        >
          <X size={18} />
        </button>
      </header>

      {!collapsed && (
        <>
          <ul className="receipt-list">
        {groupRows(entries).map((e) => (
          <li key={e.id} className={e.cutFrom ? 'cut' : ''}>
            <span className="receipt-num">{e.numbers.length > 1 ? e.reverseOf : e.number}</span>
            <span className={`receipt-type t-${e.type}`}>{e.numbers.length > 1 ? `${e.numbers.length} กลับ` : TYPE_SHORT[e.type]}</span>
            <span className="receipt-amount">
              {e.numbers.length > 1 ? (
                <>
                  ตรง {fmt(e.straight)} × {e.numbers.length} = {fmt(e.straight * e.numbers.length)}
                </>
              ) : e.type === 'three' ? (
                <>
                  {e.straight > 0 && <>ตรง {fmt(e.straight)}</>}
                  {e.straight > 0 && e.tod > 0 && ' · '}
                  {e.tod > 0 && <>โต๊ด {fmt(e.tod)}</>}
                </>
              ) : (
                fmt(e.amount)
              )}
            </span>
            <span className={`owner-tag o-${e.owner}`}>{e.cutFrom ? 'ตัดส่งป้าจิก' : OWNERS[e.owner]}</span>
            {e.numbers.length > 1 && <span className="receipt-note">{e.numbers.join(' ')}</span>}
            {e.note && <span className="receipt-note">{e.note}</span>}
          </li>
        ))}
      </ul>

      <footer className="receipt-foot">
        <div className="receipt-sum">
          <span>
            รวม <b>{fmt(kept + sent)}</b> บาท
          </span>
          {sent > 0 && <span>ตัดส่งป้าจิก {fmt(sent)}</span>}
          {rejected > 0 && <span className="neg">ไม่รับ {fmt(rejected)}</span>}
        </div>
        <button className="btn sm danger" onClick={removeTicket}>
          <Trash2 size={14} /> ลบใบนี้
        </button>
      </footer>
        </>
      )}
    </section>
  )
}
