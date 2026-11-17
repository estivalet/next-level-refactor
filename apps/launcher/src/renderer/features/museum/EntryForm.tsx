import { SystemInfoSchema, type SystemInfo } from '@nextlevel/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldGroup, type FieldSpec } from './FieldGroup.tsx';
import { fieldErrors, type FieldErrors } from './formErrors.ts';
import { ModelsEditor } from './ModelsEditor.tsx';
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6" aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Every field of a museum entry, editable (FR-MUS-2). It renders no buttons: the page's action bar
 * submits it through `form={formId}` (FR-MUS-9). Submitting validates with the shared schema and
 * hands a valid entry to `onSubmit`.
 */
export function EntryForm({
  formId,
  name,
  entry,
  onSubmit,
  onDirtyChange,
}: {
  formId: string;
  name: string;
  entry: SystemInfo;
  onSubmit: (entry: SystemInfo) => void;
  /** Told whether the draft has unsaved changes; false again when the form closes. */
  onDirtyChange?: ((dirty: boolean) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SystemInfo>(entry);
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(entry);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  const title = (key: string) => t(`apps.museum.sections.${key}`);
  const patch = (changes: Partial<SystemInfo>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  const submit = () => {
    const parsed = SystemInfoSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form
      id={formId}
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
    </form>
  );
}
