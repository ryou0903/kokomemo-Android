import { useEffect, useRef } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'やめる',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-w-sm rounded-2xl bg-surface p-6 shadow-xl backdrop:bg-black/50"
      onClose={onCancel}
    >
      <h2 className="mb-4 text-xl font-bold text-text">{title}</h2>
      <p className="mb-6 text-lg text-text-secondary leading-relaxed">{message}</p>
      <div className="flex flex-col gap-3">
        <Button variant={variant} size="large" onClick={onConfirm} className="w-full">
          {confirmLabel}
        </Button>
        <Button variant="secondary" size="large" onClick={onCancel} className="w-full">
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
