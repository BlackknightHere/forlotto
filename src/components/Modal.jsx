import { X } from 'lucide-react'
import { useEffect } from 'react'

// onDismiss (Esc / click outside) defaults to onClose; pass it to intercept, e.g. to cancel an edit or ask first.
export default function Modal({ title, onClose, onDismiss = onClose, children, footer, width = 560, dismissable = true }) {
  useEffect(() => {
    if (!dismissable) return
    const onKey = (e) => e.key === 'Escape' && onDismiss?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss, dismissable])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => dismissable && e.target === e.currentTarget && onDismiss?.()}>
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
