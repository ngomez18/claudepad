import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#161b27] border border-white/10 rounded-xl shadow-2xl w-80 p-6">
        <h3 className="text-[15px] font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-[13px] text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[13px] text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-md text-[13px] bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
