'use client';

import { useEffect } from 'react';
import { LucideIcon } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  icon: LucideIcon;
  tone?: 'danger' | 'default';
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  icon: Icon,
  tone = 'default',
  confirmLabel,
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-primary/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest max-w-sm w-full rounded-2xl p-space-lg shadow-[0_16px_36px_rgba(43,24,16,0.18)] flex flex-col gap-space-md"
      >
        <div className={`flex items-center gap-space-xs ${tone === 'danger' ? 'text-error' : 'text-secondary'}`}>
          <Icon className="w-6 h-6" />
          <h3 id="confirm-title" className="font-display text-headline-sm font-bold text-on-surface">
            {title}
          </h3>
        </div>
        <p id="confirm-message" className="text-body-md text-on-surface-variant">
          {message}
        </p>
        <div className="flex items-center justify-end gap-space-sm pt-2">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="px-space-md py-2 rounded-full bg-surface-container text-on-surface font-display text-label-md hover:bg-surface-container-high transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-space-md py-2 rounded-full font-display text-label-md font-bold transition-colors ${
              tone === 'danger' ? 'bg-error text-on-error hover:opacity-90' : 'bg-primary-container text-on-primary hover:bg-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
