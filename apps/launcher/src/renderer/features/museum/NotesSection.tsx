import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from '../library/Modal.tsx';

const SECTION = 'mb-6';
const HEADING = 'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400';

/** The owner's notes, read-only, line breaks kept (FR-MUS-6). */
export function NotesSection({ title, notes }: { title: string; notes: string | undefined }) {
  const { t } = useTranslation();
  return (
    <section className={SECTION} aria-label={title}>
      <h3 className={HEADING}>{title}</h3>
      {notes === undefined ? (
        <p className="text-xs text-slate-500">{t('apps.museum.empty')}</p>
      ) : (
        <p className="whitespace-pre-line text-sm text-slate-200">{notes}</p>
      )}
    </section>
  );
}

/**
 * The notes textarea (FR-MUS-6). Blank or whitespace-only text reads as no notes (`undefined`),
 * since the schema rejects an empty string; the textarea still shows exactly what was typed.
 */
export function NotesEditor({
  title,
  notes,
  error,
  onChange,
}: {
  title: string;
  notes: string | undefined;
  /** An i18n key. */
  error?: string | undefined;
  onChange: (notes: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(notes ?? '');
  return (
    <section className={SECTION} aria-label={title}>
      <h3 className={HEADING}>{title}</h3>
      <textarea
        id={id}
        className={INPUT}
        rows={10}
        value={text}
        aria-label={t('apps.museum.field.notes')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          onChange(value.trim() === '' ? undefined : value);
        }}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] text-[#ff8a80]">
          {t(error)}
        </p>
      )}
    </section>
  );
}
