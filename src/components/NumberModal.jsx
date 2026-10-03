import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Modal from './Modal.jsx'
import { useConfirm } from './Confirm.jsx'
import { OWNERS, TYPES, cleanMoney, entryTotal, fmt, fmtTime, getLimit, sumThree, toNum } from '../lib.js'

export default function NumberModal({ number, type, owner, event, entries, update, toast, onClose, readOnly }) {
  const [editing, setEditing] = useState(null) // { id, amount, straight, tod, note }
  const confirm = useConfirm()
  const isThree = type === 'three'
  const list = [...entries].sort((a, b) => a.createdAt - b.createdAt)
  const total = list.reduce((s, e) => s + entryTotal(e), 0)
  const three = isThree ? sumThree(list) : null
  const limit = getLimit(event, owner, type, number)

  const startEdit = (e) =>
    setEditing({ id: e.id, amount: String(e.amount ?? ''), straight: String(e.straight ?? ''), tod: String(e.tod ?? ''), note: e.note || '' })

  function saveEdit() {
    const patch = isThree
      ? { straight: toNum(editing.straight), tod: toNum(editing.tod), note: editing.note.trim() }
      : { amount: toNum(editing.amount), note: editing.note.trim() }
    if ((isThree ? patch.straight + patch.tod : patch.amount) <= 0) return toast('ยอดต้องมากกว่า 0 (ถ้าจะเอาออกให้กดลบ)', 'err')
    if (!update((d) => Object.assign(d.entries.find((x) => x.id === editing.id), patch, { editedAt: Date.now() }))) return
    setEditing(null)
    toast('แก้ไขแล้ว')
  }

  async function remove(e) {
    const ok = await confirm({
      title: `ลบเลข ${number} ?`,
      message: `${TYPES[type]} · ยอด ${fmt(entryTotal(e))} บาท`,
      detail: e.note ? `หมายเหตุ: ${e.note}` : null,
      confirmText: 'ลบรายการนี้',
      danger: true,
    })
    if (!ok) return
    if (!update((d) => void (d.entries = d.entries.filter((x) => x.id !== e.id)))) return
    toast(`ลบเลข ${number} ยอด ${fmt(entryTotal(e))} แล้ว`, 'ok', { label: 'เลิกทำ', run: () => update((d) => void d.entries.push(e)) })
  }

  const money = (k) => (ev) => setEditing((p) => ({ ...p, [k]: cleanMoney(ev.target.value) }))

  return (
    <Modal
      title={`เลข ${number} · ${TYPES[type]} · ${OWNERS[owner]}`}
      onClose={onClose}
      onDismiss={editing ? () => setEditing(null) : onClose}
      width={720}
    >
      <div className="number-summary">
        <div>
          <div className="muted">ยอดรวม</div>
          <div className="big">{fmt(total)}</div>
          {isThree && <div className="muted small">ตรง {fmt(three.straight)} · โต๊ด {fmt(three.tod)}</div>}
        </div>
        <div>
          <div className="muted">ยอดอั้น</div>
          <div className="big">{limit === null ? 'ไม่อั้น' : fmt(limit)}</div>
        </div>
        <div>
          <div className="muted">เหลือรับได้</div>
          <div className={`big ${limit !== null && total > limit ? 'neg' : ''}`}>{limit === null ? '—' : fmt(limit - total)}</div>
        </div>
        <div>
          <div className="muted">จำนวนรายการ</div>
          <div className="big">{list.length}</div>
        </div>
      </div>

      {!list.length ? (
        <p className="muted center pad">ยังไม่มีคนซื้อเลขนี้</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>เวลาที่ซื้อ</th>
              <th className="r">ราคา</th>
              <th>หมายเหตุ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) =>
              editing?.id === e.id ? (
                <tr key={e.id} className="editing">
                  <td className="muted">{fmtTime(e.createdAt)}</td>
                  <td className="r">
                    {isThree ? (
                      <span className="inline end">
                        ตรง
                        <input className="w-80" value={editing.straight} onChange={money('straight')} autoFocus />
                        โต๊ด
                        <input className="w-80" value={editing.tod} onChange={money('tod')} />
                      </span>
                    ) : (
                      <input className="w-100" value={editing.amount} onChange={money('amount')} autoFocus />
                    )}
                  </td>
                  <td>
                    <input
                      value={editing.note}
                      onChange={(ev) => setEditing((p) => ({ ...p, note: ev.target.value }))}
                      onKeyDown={(ev) => ev.key === 'Enter' && saveEdit()}
                    />
                  </td>
                  <td className="actions">
                    <button className="btn sm primary" onClick={saveEdit}>
                      บันทึก
                    </button>
                    <button className="btn sm ghost" onClick={() => setEditing(null)}>
                      ยกเลิก
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td className="muted">
                    {fmtTime(e.createdAt)}
                    {e.editedAt && <span className="edited"> (แก้ไข)</span>}
                  </td>
                  <td className="r mono strong">
                    {fmt(entryTotal(e))}
                    {isThree && <div className="muted small">ตรง {fmt(e.straight)} · โต๊ด {fmt(e.tod)}</div>}
                  </td>
                  <td>
                    {e.cutFrom && <span className="cut-tag">ตัดจาก{OWNERS[e.cutFrom]}</span>}
                    {e.note || <span className="muted">—</span>}
                  </td>
                  <td className="actions">
                    {!readOnly && (
                      <>
                        <button className="btn sm ghost" onClick={() => startEdit(e)}>
                          <Pencil size={14} /> แก้ไข
                        </button>
                        <button className="btn sm danger" onClick={() => remove(e)}>
                          <Trash2 size={14} /> ลบ
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
