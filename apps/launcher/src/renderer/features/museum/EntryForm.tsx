import {
  SystemInfoSchema,
  SystemPersonalSchema,
  type SystemInfo,
  type SystemPersonal,
} from '@nextlevel/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmulatorsSection } from './EmulatorsSection.tsx';
import { FieldGroup, type FieldSpec } from './FieldGroup.tsx';
import { fieldErrors, type FieldErrors } from './formErrors.ts';
import { GalleryEditor } from './GalleryEditor.tsx';
import { ModelsEditor } from './ModelsEditor.tsx';
import { NotesEditor, PersonalUnavailable } from './NotesSection.tsx';
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

/** Which half of the draft differs from what was loaded. */
export type DraftDirty = { entry: boolean; personal: boolean };

/** The validated halves of a save; a half is present only when it changed. */
export type DraftChanges = { entry?: SystemInfo; personal?: SystemPersonal };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Personal-record errors share the error map, keyed under `personal.`. */
function prefixed(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [`personal.${key}`, value]),
  );
}

/**
 * A system's page in edit mode: the owner's notes (FR-MUS-6), the read-only emulators (FR-MUS-7),
 * every field of the museum entry (FR-MUS-2) and the owner's gallery (FR-MUS-8). It renders no
 * buttons: the page's action bar submits it through `form={formId}` (FR-MUS-9). Submitting
 * validates both the entry and the personal record and hands the changed, valid halves to
 * `onSubmit`. Without a personal record (it failed to load) only the entry can be edited. A new
 * `resetEntryTo` replaces the entry half of the draft and leaves the personal half as it is.
 */
export function EntryForm({
  formId,
  name,
  entry,
  personal,
  onSubmit,
  onDirtyChange,
  onImagesAdded,
  resetEntryTo,
}: {
  formId: string;
  name: string;
  entry: SystemInfo;
  personal: SystemPersonal | undefined;
  onSubmit: (changes: DraftChanges) => void;
  /** Told which halves of the draft have unsaved changes. */
  onDirtyChange?: ((dirty: DraftDirty) => void) | undefined;
  /** Told when main copied gallery images in during this edit. */
  onImagesAdded?: (() => void) | undefined;
  /** The entry after a Reset; each new value replaces the entry half of the draft. */
  resetEntryTo?: SystemInfo | undefined;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SystemInfo>(entry);
  const [personalDraft, setPersonalDraft] = useState<SystemPersonal | undefined>(personal);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [appliedReset, setAppliedReset] = useState(resetEntryTo);
  if (resetEntryTo !== appliedReset) {
    setAppliedReset(resetEntryTo);
    if (resetEntryTo) {
      setDraft(resetEntryTo);
      setErrors({});
    }
  }
  const entryDirty = !same(draft, entry);
  const personalDirty = personalDraft !== undefined && !same(personalDraft, personal);
  useEffect(() => {
    onDirtyChange?.({ entry: entryDirty, personal: personalDirty });
  }, [entryDirty, personalDirty, onDirtyChange]);
  const title = (key: string) => t(`apps.museum.sections.${key}`);
  const patch = (changes: Partial<SystemInfo>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };
  const patchPersonal = (changes: Partial<SystemPersonal>) => {
    setPersonalDraft((current) => current && { ...current, ...changes });
  };

  const submit = () => {
    const parsed = SystemInfoSchema.safeParse(draft);
    // No personal draft means it failed to load: there is nothing of it to check or save.
    const parsedPersonal = personalDraft && SystemPersonalSchema.safeParse(personalDraft);
    if (!parsed.success || parsedPersonal?.success === false) {
      setErrors({
        ...(parsed.success ? {} : fieldErrors(parsed.error.issues)),
        ...(parsedPersonal?.error ? prefixed(fieldErrors(parsedPersonal.error.issues)) : {}),
      });
      return;
    }
    setErrors({});
    const changes: DraftChanges = {};
    if (entryDirty) changes.entry = parsed.data;
    if (personalDirty && parsedPersonal?.data) changes.personal = parsedPersonal.data;
    onSubmit(changes);
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
      {personalDraft ? (
        <NotesEditor
          title={title('notes')}
          notes={personalDraft.notes}
          error={errors['personal.notes']}
          onChange={(notes) => {
            patchPersonal({ notes });
          }}
        />
      ) : (
        <PersonalUnavailable title={title('notes')} />
      )}
      <EmulatorsSection title={title('emulators')} systemId={entry.systemId} />
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
      {personalDraft ? (
        <FormSection title={title('gallery')}>
          <GalleryEditor
            systemId={entry.systemId}
            gallery={personalDraft.gallery}
            onChange={(gallery) => {
              patchPersonal({ gallery });
            }}
            onImagesAdded={onImagesAdded}
          />
        </FormSection>
      ) : (
        <PersonalUnavailable title={title('gallery')} />
      )}
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
