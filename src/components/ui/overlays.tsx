import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useGame } from '@/state/game-store';
import { cx } from './primitives';

/**
 * SOBREPOSIÇÕES
 *
 * Modal e toasts. Ambos existem para interromper o mínimo possível: o modal só
 * aparece quando o jogo precisa de uma decisão ou entrega um resultado, e o
 * toast some sozinho.
 */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  /** Bloqueia fechar por clique fora e Esc, para decisões que não dá para adiar. */
  locked = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  locked?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);

    // Trava a rolagem do fundo enquanto o modal está aberto.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, locked]);

  const width = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }[size];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex select-none items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-[2px] sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={locked ? undefined : onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cx('card-raised w-full shadow-2xl', width)}
            initial={{ opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.995 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-700 px-4 py-3">
              <div className="min-w-0">
                <h2 className="section-title text-lg leading-tight">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[13px] text-neutral-500">{subtitle}</p>}
              </div>
              {!locked && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="rounded-card p-1 text-neutral-500 transition-colors hover:bg-ink-700 hover:text-neutral-200"
                >
                  <X size={16} />
                </button>
              )}
            </header>

            <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>

            {footer && (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-700 px-4 py-3">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const TOAST_STYLE = {
  info: { icon: Info, cls: 'border-l-info-500', color: 'text-info-400' },
  sucesso: { icon: CheckCircle2, cls: 'border-l-gov-500', color: 'text-gov-400' },
  alerta: { icon: AlertTriangle, cls: 'border-l-warn-500', color: 'text-warn-400' },
  erro: { icon: XCircle, cls: 'border-l-danger-500', color: 'text-danger-400' },
} as const;

export function Toaster() {
  const toasts = useGame((store) => store.toasts);
  const dismiss = useGame((store) => store.dismissToast);

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] select-none flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = TOAST_STYLE[toast.kind];
          const Icon = style.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className={cx('pointer-events-auto card-raised border-l-2 p-3 shadow-xl', style.cls)}
            >
              <div className="flex items-start gap-2.5">
                <Icon size={15} className={cx('mt-0.5 shrink-0', style.color)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-neutral-100">{toast.title}</p>
                  {toast.detail && (
                    <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">{toast.detail}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dispensar"
                  className="shrink-0 rounded-card p-0.5 text-neutral-600 transition-colors hover:text-neutral-300"
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/** Confirmação curta para ações destrutivas (apagar partida, revogar medida). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
  destructive = true,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={destructive ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-neutral-400">{body}</p>
    </Modal>
  );
}
