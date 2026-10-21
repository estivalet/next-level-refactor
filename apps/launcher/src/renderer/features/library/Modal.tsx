import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A dialog over the Library window. It is absolutely positioned inside the app (the shell window's
 * backdrop-filter would make `position: fixed` relative to it anyway). Esc closes; focus goes to
 * the first field and returns where it was on close.
 */
export function Modal({ title, onClose, children, footer }: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first =
      box.current?.querySelector<HTMLElement>('input, textarea, select') ??
      box.current?.querySelector<HTMLElement>('button');
    first?.focus();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
        className="flex max-h-full w-full max-w-lg flex-col rounded-xl border border-white/10 bg-[#1a1a24] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <h2 id={titleId} className="flex-1 truncate text-sm font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            aria-label={t('library.close')}
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-white/5 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

export const PRIMARY_BUTTON =
  'rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40';
export const SECONDARY_BUTTON =
  'rounded-lg bg-white/5 px-4 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white';
export const INPUT =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none aria-[invalid=true]:border-red-400/60';
