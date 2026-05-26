import { BUTTON_STYLES, PANEL_STYLES } from '../../styles/designSystem'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1.5px]" onClick={onCancel} />
      <div className={PANEL_STYLES.modal}>
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className={BUTTON_STYLES.secondary}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={destructive ? BUTTON_STYLES.destructive : BUTTON_STYLES.primary}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
