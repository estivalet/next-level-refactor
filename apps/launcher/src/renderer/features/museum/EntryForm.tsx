import { SystemInfoSchema, type SystemInfo } from '@nextlevel/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../menus/ConfirmDialog.tsx';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { FieldGroup, type FieldSpec } from './FieldGroup.tsx';
import { fieldErrors, type FieldErrors } from './formErrors.ts';
import { ModelsEditor } from './ModelsEditor.tsx';
import { useResetSystemInfo, useSaveSystemInfo } from './museumApi.ts';
import { PeripheralsEditor } from './PeripheralsEditor.tsx';
import { SourcesEditor } from './SourcesEditor.tsx';
import { TopGamesEditor } from './TopGamesEditor.tsx';

const OVERVIEW: readonly FieldSpec[] = [
  { key: 'fullName', kind: 'text' },
  { key: 'manufacturer', kind: 'text' },
  { key: 'country', kind: 'text' },
  { key: 'generation', kind: 'text' },
  { key: 'releaseYear', kind: 'year' },
  { key: 'discontinuedYear', kind: 'year' },
  { key: 'unitsSold', kind: 'text' },
  { key: 'description', kind: 'area' },
];
const STORY: readonly FieldSpec[] = [
  { key: 'history', kind: 'area' },
  { key: 'legacy', kind: 'area' },
];
const HARDWARE: readonly FieldSpec[] = [
  { key: 'cpu', kind: 'text' },
  { key: 'ram', kind: 'text' },
  { key: 'graphics', kind: 'text' },
  { key: 'sound', kind: 'text' },
  { key: 'media', kind: 'text' },
  { key: 'display', kind: 'text' },
];
const RELATED: readonly FieldSpec[] = [
  { key: 'predecessor', kind: 'text' },
  { key: 'successor', kind: 'text' },
];

type Confirming = 'discard' | 'reset' | null;

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6" aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

/** Every field of a museum entry, editable; Save validates with the shared schema (FR-MUS-2). */
export function EntryForm({
  name,
  entry,
  edited,
  onDone,
}: {
  name: string;
  entry: SystemInfo;
  edited: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SystemInfo>(entry);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState<Confirming>(null);
  const save = useSaveSystemInfo();
  const reset = useResetSystemInfo();
  const dirty = JSON.stringify(draft) !== JSON.stringify(entry);
  const title = (key: string) => t(`apps.museum.sections.${key}`);
  const patch = (changes: Partial<SystemInfo>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };
  const failure = save.error ?? reset.error;

  const submit = () => {
    const parsed = SystemInfoSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    save.mutate({ systemId: entry.systemId, entry: parsed.data }, { onSuccess: onDone });
  };

  return (
    <>
      <form
        aria-label={t('apps.museum.editing', { name })}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormSection title={title('overview')}>
          <FieldGroup fields={OVERVIEW} draft={draft} errors={errors} onChange={patch} />
        </FormSection>
        <FormSection title={title('story')}>
          <FieldGroup fields={STORY} draft={draft} errors={errors} onChange={patch} />
        </FormSection>
        <FormSection title={title('hardware')}>
          <FieldGroup fields={HARDWARE} draft={draft} errors={errors} onChange={patch} />
        </FormSection>
        <FormSection title={title('models')}>
          <ModelsEditor
            models={draft.models}
            errors={errors}
            onChange={(models) => {
              patch({ models });
            }}
          />
        </FormSection>
        <FormSection title={title('related')}>
          <FieldGroup fields={RELATED} draft={draft} errors={errors} onChange={patch} />
          <h4 className="mt-3 mb-1 text-xs text-slate-400">{t('apps.museum.field.peripherals')}</h4>
          <PeripheralsEditor
            peripherals={draft.peripherals}
            errors={errors}
            onChange={(peripherals) => {
              patch({ peripherals });
            }}
          />
        </FormSection>
        <FormSection title={title('topGames')}>
          <TopGamesEditor
            systemId={entry.systemId}
            games={draft.topGames}
            errors={errors}
            onChange={(topGames) => {
              patch({ topGames });
            }}
          />
        </FormSection>
        <FormSection title={title('sources')}>
          <SourcesEditor
            sources={draft.sources}
            errors={errors}
            onChange={(sources) => {
              patch({ sources });
            }}
          />
        </FormSection>

        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mb-2 text-xs text-[#ff8a80]">
            {t('apps.museum.fixErrors')}
          </p>
        )}
        {failure && (
          <p role="alert" className="mb-2 text-xs text-[#ff8a80]">
            {t(errorMessageKey(failure))}
          </p>
        )}
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-[#14141c] py-3">
          <button type="submit" className={PRIMARY_BUTTON} disabled={save.isPending}>
            {t('apps.museum.save')}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              if (dirty) setConfirming('discard');
              else onDone();
            }}
          >
            {t('apps.museum.discard')}
          </button>
          {edited && (
            <button
              type="button"
              className={`${SECONDARY_BUTTON} ml-auto`}
              onClick={() => {
                setConfirming('reset');
              }}
            >
              {t('apps.museum.reset')}
            </button>
          )}
        </div>
      </form>
      {confirming === 'discard' && (
        <ConfirmDialog
          title={t('apps.museum.discardTitle')}
          message={t('apps.museum.discardMessage')}
          confirmLabel={t('apps.museum.discardConfirm')}
          onCancel={() => {
            setConfirming(null);
          }}
          onConfirm={onDone}
        />
      )}
      {confirming === 'reset' && (
        <ConfirmDialog
          title={t('apps.museum.resetTitle')}
          message={t('apps.museum.resetMessage')}
          confirmLabel={t('apps.museum.reset')}
          onCancel={() => {
            setConfirming(null);
          }}
          onConfirm={() => {
            setConfirming(null);
            reset.mutate({ systemId: entry.systemId }, { onSuccess: onDone });
          }}
        />
      )}
    </>
  );
}
