import { CircleHelp, Trash2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// In-app replacement for window.confirm(), which some embedded browsers block (it returns false instantly).
const ConfirmContext = createContext(async () => false)

export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null)

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setReq({ confirmText: 'ยืนยัน', danger: false, ...opts, resolve })),
    [],
  )
  const close = (result) => {
    req.resolve(result)
    setReq(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {req && <ConfirmDialog {...req} onClose={close} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ title, message, detail, confirmText, danger, onClose }) {
  const okRef = useRef(null)
  useEffect(() => {
    okRef.current?.focus()
    // Capture phase so Escape closes only this dialog, not the modal underneath it.
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true">
        <div className={`confirm-icon ${danger ? 'danger' : ''}`}>{danger ? <Trash2 size={26} /> : <CircleHelp size={26} />}</div>
        <h2>{title}</h2>
        {message && <p className="confirm-msg">{message}</p>}
        {detail && <div className="confirm-detail">{detail}</div>}
        <div className="confirm-actions">
          <button className="btn ghost lg" onClick={() => onClose(false)}>
            ยกเลิก
          </button>
          <button ref={okRef} className={`btn lg ${danger ? 'danger-solid' : 'primary'}`} onClick={() => onClose(true)}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
