import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { OWNERS } from '../lib.js'

const INITIALS = { meaw: 'ม', jik: 'จ' }

export const OwnerAvatar = ({ owner, size = 28 }) => (
  <span className={`avatar o-${owner}`} style={{ width: size, height: size, fontSize: size * 0.48 }}>
    {INITIALS[owner]}
  </span>
)

/** Dropdown for picking whose account (ลุงแมว / ป้าจิก) is shown. */
export default function OwnerSelect({ value, onChange, label = 'บัญชี' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="owner-dd" ref={ref}>
      <button className={`owner-dd-btn ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <OwnerAvatar owner={value} />
        <span className="owner-dd-text">
          <small>{label}</small>
          <b>{OWNERS[value]}</b>
        </span>
        <ChevronDown size={18} className="owner-dd-chev" />
      </button>
      {open && (
        <div className="owner-dd-menu">
          {Object.entries(OWNERS).map(([k, v]) => (
            <button
              key={k}
              className={`owner-dd-item ${k === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(k)
                setOpen(false)
              }}
            >
              <OwnerAvatar owner={k} size={30} />
              <span>
                <b>{v}</b>
                <small>{k === 'meaw' ? 'คนรับโพย' : 'เจ้ามือ (รับส่วนที่ตัดส่ง)'}</small>
              </span>
              {k === value && <Check size={18} className="owner-dd-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
