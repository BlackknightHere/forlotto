import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ title, onClose, children, footer, width = 560, dismissable = true }) {
  useEffect(() => {
    if (!dismissable) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissable])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          {dismissable && (
            <button className="icon-btn" onClick={onClose} aria-label="ปิด">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
