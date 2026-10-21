import { TEMPLATE_TOKENS, templateIssues } from '@nextlevel/shared';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from '../../library/Modal.tsx';

/** The `{prefix` being typed just before the caret, if any. */
function openToken(text: string): { start: number; prefix: string } | null {
  const match = /\{([A-Za-z]*)$/.exec(text);
  if (!match || text.slice(0, match.index).endsWith('{')) return null;
  return { start: match.index, prefix: match[1] ?? '' };
}

/** The message of a template's first problem (FR-EMU-3), or null. */
export function useTemplateError(value: string, where: 'arg' | 'value'): string | null {
  const { t } = useTranslation();
  const issue = templateIssues(value, where)[0];
  if (!issue) return null;
  return issue.message === 'unknownToken'
    ? t('settings.emulators.editor.unknownToken', { token: `{${issue.token ?? ''}}` })
    : t(`errors.validation.${issue.message}`);
}

/**
 * A template field (S9 token-aware editor): typing `{` lists the tokens, and the first problem in
 * the text is shown under it, naming an unknown token (US-D1).
 */
export function TokenInput({
  value,
  label,
  where,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  where: 'arg' | 'value';
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const error = useTemplateError(value, where);
  const open = caret === null ? null : openToken(value.slice(0, caret));
  const tokens = open
    ? TEMPLATE_TOKENS.filter(
        (token) =>
          token.toLowerCase().startsWith(open.prefix.toLowerCase()) &&
          (where === 'arg' || token !== 'extraArgs'),
      )
    : [];
  const insert = (token: string) => {
    if (!open || caret === null) return;
    const next = `${value.slice(0, open.start)}{${token}}${value.slice(caret)}`;
    onChange(next);
    setCaret(null);
    input.current?.focus();
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={input}
        type="text"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
        }}
        onKeyDown={(event) => {
          const first = tokens[0];
          if (event.key === 'Escape' && tokens.length > 0) {
            event.stopPropagation();
            setCaret(null);
          } else if ((event.key === 'Enter' || event.key === 'Tab') && first) {
            event.preventDefault();
            insert(first);
          }
        }}
        onBlur={() => {
          // Let a click on a token land first.
          setTimeout(() => {
            setCaret(null);
          }, 150);
        }}
        className={`${INPUT} font-mono`}
      />
      {tokens.length > 0 && (
        <ul
          role="listbox"
          aria-label={t('settings.emulators.editor.tokens')}
          className="absolute z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a24] py-1 shadow-2xl"
        >
          {tokens.map((token) => (
            <li key={token}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  insert(token);
                }}
                className="w-full px-3 py-1 text-left font-mono text-xs text-slate-200 hover:bg-white/10"
              >
                {`{${token}}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
