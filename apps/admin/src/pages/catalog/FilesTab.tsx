import {
  FILE_ROLES,
  MAX_UPLOAD_BYTES,
  safeFilename,
  type AdminCatalogItem,
  type FileRole,
} from '@nextlevel/shared';
import { getSystem } from '@nextlevel/system-catalog';
import { Button, Select, Table } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRemoveFile, useUploadFile } from '../../api/catalog.ts';
import { catalogErrorKey, formatBytes, reasonOf, systemName } from './catalogText.ts';
import { Confirm } from './Confirm.tsx';
import { Progress, type Sending } from './Progress.tsx';

interface Choice {
  file: File;
  filename: string;
  role: FileRole;
}

/**
 * Game files (D41, FR-ADM-3): upload with progress, then the size and SHA-256 the API computed.
 * A file is never edited: Replace uploads under the same name. On a published item replacing or
 * removing asks first, because players get an update.
 */
export function FilesTab({ item }: { item: AdminCatalogItem }) {
  const { t, i18n } = useTranslation();
  const upload = useUploadFile(item.id);
  const remove = useRemoveFile(item.id);
  const [role, setRole] = useState<FileRole>('rom');
  const [sending, setSending] = useState<Sending | null>(null);
  const [done, setDone] = useState<{ name: string; size: number; sha256: string } | null>(null);
  const [badName, setBadName] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<Choice | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const files = item.files.filter((file) => file.status === 'ready');
  const published = item.status === 'published';
  const busy = sending !== null || upload.isPending;

  /** Why a name can't be used, or null. Extras only need a safe name. */
  const nameProblem = (name: string, fileRole: FileRole): string | null => {
    if (!safeFilename(name)) return t('admin.catalog.files.badName', { name });
    if (fileRole === 'extra') return null;
    const extensions = getSystem(item.systemId)?.extensions ?? [];
    if (safeFilename(name, extensions)) return null;
    const list = new Intl.ListFormat(i18n.language, { type: 'disjunction' }).format(
      extensions.map((extension) => `.${extension}`),
    );
    return t('admin.catalog.files.badExtension', {
      name,
      system: systemName(item.systemId),
      extensions: list,
    });
  };

  const send = (choice: Choice) => {
    setDone(null);
    upload.reset();
    setSending({ name: choice.filename, loaded: 0, total: choice.file.size });
    upload.mutate(
      {
        ...choice,
        onProgress: (loaded, total) => {
          setSending({ name: choice.filename, loaded, total });
        },
      },
      {
        onSuccess: ({ uploaded }) => {
          setDone({ name: choice.filename, ...uploaded });
        },
        onSettled: () => {
          setSending(null);
        },
      },
    );
  };

  const choose = (picked: Choice) => {
    setBadName(null);
    // A same-name upload replaces that file, so it keeps the file's role (an extra must never
    // stand in for a game file, C10).
    const same = files.find(
      (file) => file.filename.toLowerCase() === picked.filename.toLowerCase(),
    );
    const choice = same ? { ...picked, role: same.role } : picked;
    // Refused here, not by the API: a browser may reset the connection on an early refusal.
    const problem =
      choice.file.size > MAX_UPLOAD_BYTES
        ? t('admin.catalog.files.tooLarge', { name: choice.filename })
        : nameProblem(choice.filename, choice.role);
    if (problem) {
      setBadName(problem);
      return;
    }
    if (published && same) setReplacing(choice);
    else send(choice);
  };

  const uploadError =
    upload.error && reasonOf(upload.error) === 'filename'
      ? t('admin.catalog.files.badName', { name: upload.variables.filename })
      : upload.error
        ? t(catalogErrorKey(upload.error))
        : null;
  const error = badName ?? uploadError ?? (remove.error ? t(catalogErrorKey(remove.error)) : null);

  return (
    <div className="flex flex-col gap-5">
      <Table
        label={t('admin.catalog.files.title')}
        columns={[
          t('admin.catalog.files.name'),
          t('admin.catalog.files.role'),
          t('admin.catalog.files.size'),
          t('admin.catalog.files.sha256'),
          '',
        ]}
        empty={t('admin.catalog.files.empty')}
        rows={files.map((file) => ({
          key: file.id,
          cells: [
            file.filename,
            t(`admin.catalog.roles.${file.role}`),
            formatBytes(file.size, i18n.language),
            <code key="sha" className="text-xs break-all text-slate-400">
              {file.sha256}
            </code>,
            <div key="actions" className="flex gap-2 whitespace-nowrap">
              <label className="cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
                {t('admin.catalog.files.replace')}
                <input
                  type="file"
                  className="sr-only"
                  disabled={busy}
                  aria-label={t('admin.catalog.files.replaceLabel', { name: file.filename })}
                  onChange={(event) => {
                    const picked = event.target.files?.[0];
                    event.target.value = '';
                    if (picked) choose({ file: picked, filename: file.filename, role: file.role });
                  }}
                />
              </label>
              <Button
                aria-label={t('admin.catalog.files.removeLabel', { name: file.filename })}
                disabled={remove.isPending}
                onClick={() => {
                  remove.reset();
                  setRemoving({ id: file.id, name: file.filename });
                }}
              >
                {t('admin.catalog.files.remove')}
              </Button>
            </div>,
          ],
        }))}
      />
      <div className="flex items-end gap-3">
        <Select
          label={t('admin.catalog.files.role')}
          value={role}
          onChange={(event) => {
            setRole(event.target.value as FileRole);
          }}
          options={FILE_ROLES.map((value) => ({
            value,
            label: t(`admin.catalog.roles.${value}`),
          }))}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
          {t('admin.catalog.files.upload')}
          <input
            type="file"
            disabled={busy}
            className="text-sm text-slate-300"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              event.target.value = '';
              if (picked) choose({ file: picked, filename: picked.name, role });
            }}
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">{t('admin.catalog.files.uploadHelp')}</p>
      {sending && <Progress sending={sending} />}
      {done && (
        <p role="status" className="text-sm break-all text-emerald-300">
          {t('admin.catalog.files.done', {
            name: done.name,
            size: formatBytes(done.size, i18n.language),
            sha256: done.sha256,
          })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {error}
        </p>
      )}
      {replacing && (
        <Confirm
          title={t('admin.catalog.files.replaceTitle', { name: replacing.filename })}
          body={t('admin.catalog.files.replaceBody')}
          action={t('admin.catalog.files.replaceAction')}
          onConfirm={() => {
            send(replacing);
          }}
          onClose={() => {
            setReplacing(null);
          }}
        />
      )}
      {removing && (
        <Confirm
          title={t('admin.catalog.files.removeTitle', { name: removing.name })}
          body={t(
            published
              ? 'admin.catalog.files.removeBodyPublished'
              : 'admin.catalog.files.removeBody',
          )}
          action={t('admin.catalog.files.remove')}
          onConfirm={() => {
            remove.mutate(removing.id);
          }}
          onClose={() => {
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}
