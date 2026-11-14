import { normalizeLink, type FileRole } from '@nextlevel/shared';
import { Button, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddLink } from '../../api/catalog.ts';
import { catalogErrorKey, reasonOf } from './catalogText.ts';

/**
 * Add link (FR-CAT-9, D65): a file kept at Google Drive or archive.org. The link is checked here
 * first (the API refuses the same ones), then the API downloads it once to record its size and
 * SHA-256; the Files table shows Checking link… until it settles.
 */
export function LinkForm({
  itemId,
  role,
  nameProblem,
}: {
  itemId: string;
  role: FileRole;
  /** Why a file name can't be used for this role, or null (the Files tab's rule). */
  nameProblem: (name: string, role: FileRole) => string | null;
}) {
  const { t } = useTranslation();
  const add = useAddLink(itemId);
  const [filename, setFilename] = useState('');
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState<{ name?: string; link?: string } | null>(null);

  const linkProblem = (reason: string | null) =>
    reason === 'linkHost'
      ? t('admin.catalog.files.link.onlyHosts')
      : reason === 'linkFile'
        ? t('admin.catalog.files.link.notAFile')
        : null;

  const submit = () => {
    add.reset();
    const name = nameProblem(filename.trim(), role);
    const normalized = normalizeLink(link);
    const linkError = normalized.ok ? null : linkProblem(normalized.reason);
    if (name || linkError) {
      setProblem({ ...(name ? { name } : {}), ...(linkError ? { link: linkError } : {}) });
      return;
    }
    setProblem(null);
    add.mutate(
      { filename: filename.trim(), role, link: link.trim() },
      {
        onSuccess: () => {
          setFilename('');
          setLink('');
        },
      },
    );
  };

  const sent = add.error
    ? (linkProblem(reasonOf(add.error)) ?? t(catalogErrorKey(add.error)))
    : null;

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-white/10 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h3 className="text-sm font-semibold">{t('admin.catalog.files.link.title')}</h3>
      <p className="text-xs text-slate-500">{t('admin.catalog.files.link.help')}</p>
      <TextField
        label={t('admin.catalog.files.link.name')}
        value={filename}
        maxLength={200}
        error={problem?.name ?? null}
        onChange={(event) => {
          setFilename(event.target.value);
        }}
      />
      <TextField
        label={t('admin.catalog.files.link.link')}
        value={link}
        maxLength={2000}
        error={problem?.link ?? sent}
        onChange={(event) => {
          setLink(event.target.value);
        }}
      />
      <div>
        <Button type="submit" disabled={add.isPending || !filename.trim() || !link.trim()}>
          {t('admin.catalog.files.link.add')}
        </Button>
      </div>
    </form>
  );
}
