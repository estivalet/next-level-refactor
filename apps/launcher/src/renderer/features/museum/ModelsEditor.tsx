import type { SystemInfoModel } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import type { FieldErrors } from './formErrors.ts';
import { TextField, YearField } from './FormFields.tsx';
import { ListEditor } from './ListEditor.tsx';
import { ModelImage } from './ModelImage.tsx';

/** How long typing must pause before the image link is previewed (no request per keystroke). */
const PREVIEW_SETTLE_MS = 600;

/** Hardware models and revisions (FR-MUS-1, FR-MUS-2). */
export function ModelsEditor({
  models,
  errors,
  onChange,
}: {
  models: readonly SystemInfoModel[];
  errors: FieldErrors;
  onChange: (models: SystemInfoModel[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <ListEditor<SystemInfoModel>
      items={models}
      onChange={onChange}
      makeNew={() => ({ name: '' })}
      addLabel={t('apps.museum.addModel')}
      listLabel={t('apps.museum.sections.models')}
      renderRow={(model, index, update) => {
        const error = (key: string) => errors[`models.${String(index)}.${key}`];
        return (
          <div className="flex gap-3">
            <ModelImage url={model.imageUrl} name={model.name} settleMs={PREVIEW_SETTLE_MS} />
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <TextField
                label={t('apps.museum.field.name')}
                value={model.name}
                error={error('name')}
                onChange={(name) => {
                  update({ ...model, name: name ?? '' });
                }}
              />
              <YearField
                label={t('apps.museum.field.releaseYear')}
                value={model.releaseYear}
                error={error('releaseYear')}
                onChange={(releaseYear) => {
                  update({ ...model, releaseYear });
                }}
              />
              <TextField
                label={t('apps.museum.field.launchPrice')}
                value={model.launchPrice}
                error={error('launchPrice')}
                onChange={(launchPrice) => {
                  update({ ...model, launchPrice });
                }}
              />
              <TextField
                label={t('apps.museum.field.imageUrl')}
                value={model.imageUrl}
                error={error('imageUrl')}
                onChange={(imageUrl) => {
                  update({ ...model, imageUrl });
                }}
              />
              <TextField
                label={t('apps.museum.field.cpu')}
                value={model.cpu}
                error={error('cpu')}
                onChange={(cpu) => {
                  update({ ...model, cpu });
                }}
              />
              <TextField
                label={t('apps.museum.field.ram')}
                value={model.ram}
                error={error('ram')}
                onChange={(ram) => {
                  update({ ...model, ram });
                }}
              />
              <div className="col-span-2">
                <TextField
                  multiline
                  label={t('apps.museum.field.notes')}
                  value={model.notes}
                  error={error('notes')}
                  onChange={(notes) => {
                    update({ ...model, notes });
                  }}
                />
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
