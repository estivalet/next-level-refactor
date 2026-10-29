import type { AdminCatalogItem, UpdateItem } from '@nextlevel/shared';
import { Button, Select, TextArea, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateItem } from '../../api/catalog.ts';
import { useScopes } from '../../api/plans.ts';
import { catalogErrorKey } from './catalogText.ts';
import { Confirm } from './Confirm.tsx';

interface Draft {
  title: string;
  description: string;
  year: string;
  developer: string;
  publisher: string;
  genre: string;
  players: string;
  scopeSlug: string;
}

const draftOf = (item: AdminCatalogItem): Draft => ({
  title: item.title,
  description: item.description,
  year: item.year === null ? '' : String(item.year),
  developer: item.developer,
  publisher: item.publisher,
  genre: item.genre,
  players: item.players === null ? '' : String(item.players),
  scopeSlug: item.scopeSlug,
});

/** "" → null; otherwise a whole number in range, or undefined when it isn't one. */
function whole(text: string, min: number, max: number): number | null | undefined {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/** Item metadata (FR-ADM-3): Save sends only what changed. */
export function MetadataTab({ item }: { item: AdminCatalogItem }) {
  const { t } = useTranslation();
  const scopes = useScopes();
  const update = useUpdateItem(item.id);
  // Only touched fields live here; the others follow the item as refetches bring it.
  const [edits, setEdits] = useState<Partial<Draft>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const saved = draftOf(item);
  const value = <K extends keyof Draft>(key: K): Draft[K] => edits[key] ?? saved[key];
  const set = (key: keyof Draft) => (next: string) => {
    setJustSaved(false);
    setEdits((current) => ({ ...current, [key]: next }));
  };

  const year = whole(value('year'), 1950, 2100);
  const players = whole(value('players'), 1, 16);
  const title = value('title').trim();
  const valid = title !== '' && year !== undefined && players !== undefined;
  const patch: UpdateItem = {
    ...(title !== item.title ? { title } : {}),
    ...(value('description').trim() !== item.description
      ? { description: value('description').trim() }
      : {}),
    ...(year !== undefined && year !== item.year ? { year } : {}),
    ...(value('developer').trim() !== item.developer
      ? { developer: value('developer').trim() }
      : {}),
    ...(value('publisher').trim() !== item.publisher
      ? { publisher: value('publisher').trim() }
      : {}),
    ...(value('genre').trim() !== item.genre ? { genre: value('genre').trim() } : {}),
    ...(players !== undefined && players !== item.players ? { players } : {}),
    ...(value('scopeSlug') !== item.scopeSlug ? { scopeSlug: value('scopeSlug') } : {}),
  };
  const changed = Object.keys(patch).length > 0;

  const text = (key: Exclude<keyof Draft, 'description' | 'scopeSlug'>, max: number) => (
    <TextField
      label={t(`admin.catalog.fields.${key}`)}
      value={value(key)}
      maxLength={max}
      inputMode={key === 'year' || key === 'players' ? 'numeric' : undefined}
      error={
        (key === 'year' && year === undefined) || (key === 'players' && players === undefined)
          ? t(`admin.catalog.fields.${key}Range`)
          : null
      }
      onChange={(event) => {
        set(key)(event.target.value);
      }}
    />
  );

  const save = () => {
    update.mutate(patch, {
      onSuccess: () => {
        setEdits({});
        setJustSaved(true);
      },
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        // A published item leaving players' plans follows its on_lapse (D43): ask first.
        if (item.status === 'published' && patch.scopeSlug !== undefined) setConfirming(true);
        else save();
      }}
    >
      {text('title', 200)}
      <TextArea
        label={t('admin.catalog.fields.description')}
        value={value('description')}
        maxLength={4000}
        rows={5}
        onChange={(event) => {
          set('description')(event.target.value);
        }}
      />
      <div className="grid grid-cols-2 gap-4">
        {text('year', 4)}
        {text('players', 2)}
        {text('developer', 200)}
        {text('publisher', 200)}
        {text('genre', 100)}
        <Select
          label={t('admin.catalog.fields.scope')}
          value={value('scopeSlug')}
          onChange={(event) => {
            set('scopeSlug')(event.target.value);
          }}
          options={(scopes.data ?? [{ slug: item.scopeSlug, name: item.scopeSlug }]).map(
            (scope) => ({ value: scope.slug, label: scope.name }),
          )}
        />
      </div>
      {update.error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(catalogErrorKey(update.error))}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={!changed || !valid || update.isPending}>
          {t('admin.catalog.save')}
        </Button>
        {justSaved && !changed && (
          <p role="status" className="text-sm text-emerald-300">
            {t('admin.catalog.saved')}
          </p>
        )}
      </div>
      {confirming && (
        <Confirm
          title={t('admin.catalog.scopeChange.title')}
          body={t(
            item.onLapse === 'remove'
              ? 'admin.catalog.scopeChange.bodyRemove'
              : 'admin.catalog.scopeChange.bodyKeep',
          )}
          action={t('admin.catalog.scopeChange.action')}
          onConfirm={save}
          onClose={() => {
            setConfirming(false);
          }}
        />
      )}
    </form>
  );
}
