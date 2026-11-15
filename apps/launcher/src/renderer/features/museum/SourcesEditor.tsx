import type { SystemInfoSource } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import type { FieldErrors } from './formErrors.ts';
import { TextField } from './FormFields.tsx';
import { ListEditor } from './ListEditor.tsx';

/** Where the entry's facts came from (FR-MUS-5). */
export function SourcesEditor({
  sources,
  errors,
  onChange,
}: {
  sources: readonly SystemInfoSource[];
  errors: FieldErrors;
  onChange: (sources: SystemInfoSource[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <ListEditor<SystemInfoSource>
      items={sources}
      onChange={onChange}
      makeNew={() => ({ name: '' })}
      addLabel={t('apps.museum.addSource')}
      listLabel={t('apps.museum.sections.sources')}
      renderRow={(source, index, update) => (
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label={t('apps.museum.field.name')}
            value={source.name}
            error={errors[`sources.${String(index)}.name`]}
            onChange={(name) => {
              update({ ...source, name: name ?? '' });
            }}
          />
          <TextField
            label={t('apps.museum.field.url')}
            value={source.url}
            error={errors[`sources.${String(index)}.url`]}
            onChange={(url) => {
              update({ ...source, url });
            }}
          />
        </div>
      )}
    />
  );
}
