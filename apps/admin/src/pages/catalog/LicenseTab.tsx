import {
  LICENSE_TYPES,
  type AdminCatalogItem,
  type AdminLicense,
  type LicenseInput,
  type LicenseType,
} from '@nextlevel/shared';
import { Button, Select, TextArea, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { itemPath, usePutLicense } from '../../api/catalog.ts';
import { catalogErrorKey } from './catalogText.ts';
import { Confirm } from './Confirm.tsx';
import { Evidence } from './Evidence.tsx';

interface Draft {
  type: LicenseType;
  rightsHolder: string;
  contact: string;
  terms: string;
  territories: string;
  startsAt: string;
  expiresAt: string;
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

const draftOf = (license: AdminLicense | null): Draft => ({
  type: license?.type ?? 'author-permission',
  rightsHolder: license?.rightsHolder ?? '',
  contact: license?.contact ?? '',
  terms: license?.terms ?? '',
  territories: license?.territories?.join(', ') ?? '',
  startsAt: day(license?.startsAt ?? null),
  expiresAt: day(license?.expiresAt ?? null),
});

/** The form as the API's license input: dates are whole UTC days, territories upper-cased. */
function inputOf(draft: Draft): LicenseInput {
  const territories = draft.territories
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  return {
    type: draft.type,
    rightsHolder: draft.rightsHolder.trim(),
    contact: draft.contact.trim(),
    terms: draft.terms.trim(),
    ...(territories.length > 0 ? { territories } : {}),
    ...(draft.startsAt ? { startsAt: `${draft.startsAt}T00:00:00.000Z` } : {}),
    ...(draft.expiresAt ? { expiresAt: `${draft.expiresAt}T00:00:00.000Z` } : {}),
  };
}

/**
 * The item's license (content policy §4, D44, C10). Saving always makes a new license record:
 * evidence and verification start over, and a published item is unpublished (asked first).
 */
export function LicenseTab({ item }: { item: AdminCatalogItem }) {
  const { t } = useTranslation();
  const put = usePutLicense(item.id);
  const [draft, setDraft] = useState<Draft>(() => draftOf(item.license));
  const [confirming, setConfirming] = useState(false);
  const published = item.status === 'published';
  const set = (key: keyof Draft) => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const input = inputOf(draft);
  const valid =
    input.rightsHolder !== '' &&
    input.contact !== '' &&
    input.terms !== '' &&
    (input.territories ?? []).every((code) => code.length <= 60) &&
    (!draft.startsAt || !draft.expiresAt || draft.startsAt < draft.expiresAt);
  const changed =
    item.license === null || JSON.stringify(draft) !== JSON.stringify(draftOf(item.license));

  const save = () => {
    put.mutate(input);
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (published) setConfirming(true);
          else save();
        }}
      >
        <Select
          label={t('admin.catalog.license.type')}
          value={draft.type}
          onChange={(event) => {
            set('type')(event.target.value);
          }}
          options={LICENSE_TYPES.map((value) => ({
            value,
            label: t(`admin.catalog.license.types.${value}`),
          }))}
        />
        <TextField
          label={t('admin.catalog.license.rightsHolder')}
          value={draft.rightsHolder}
          maxLength={200}
          onChange={(event) => {
            set('rightsHolder')(event.target.value);
          }}
        />
        <TextField
          label={t('admin.catalog.license.contact')}
          value={draft.contact}
          maxLength={200}
          onChange={(event) => {
            set('contact')(event.target.value);
          }}
        />
        <TextArea
          label={t('admin.catalog.license.terms')}
          value={draft.terms}
          maxLength={4000}
          rows={4}
          onChange={(event) => {
            set('terms')(event.target.value);
          }}
        />
        <TextField
          label={t('admin.catalog.license.territories')}
          help={t('admin.catalog.license.territoriesHelp')}
          value={draft.territories}
          onChange={(event) => {
            set('territories')(event.target.value);
          }}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t('admin.catalog.license.startsAt')}
            type="date"
            value={draft.startsAt}
            onChange={(event) => {
              set('startsAt')(event.target.value);
            }}
          />
          <TextField
            label={t('admin.catalog.license.expiresAt')}
            type="date"
            value={draft.expiresAt}
            onChange={(event) => {
              set('expiresAt')(event.target.value);
            }}
          />
        </div>
        <p className="text-xs text-slate-500">{t('admin.catalog.license.datesHelp')}</p>
        {item.license && (
          <p className={`text-sm ${published ? 'text-amber-200' : 'text-slate-400'}`}>
            {t(
              published
                ? 'admin.catalog.license.unpublishWarning'
                : 'admin.catalog.license.replaceNote',
            )}
          </p>
        )}
        {put.error && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {t(catalogErrorKey(put.error))}
          </p>
        )}
        <div>
          <Button type="submit" variant="primary" disabled={!changed || !valid || put.isPending}>
            {t('admin.catalog.license.save')}
          </Button>
        </div>
      </form>
      <Evidence item={item} evidenceUrl={`${itemPath(item.id)}/license/evidence`} />
      {confirming && (
        <Confirm
          title={t('admin.catalog.license.replaceTitle')}
          body={t('admin.catalog.license.unpublishWarning')}
          action={t('admin.catalog.license.replaceAction')}
          onConfirm={save}
          onClose={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
