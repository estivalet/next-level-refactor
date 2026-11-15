import { useTranslation } from 'react-i18next';
import type { FieldErrors } from './formErrors.ts';
import { TextField } from './FormFields.tsx';
import { ListEditor } from './ListEditor.tsx';

/** Notable accessories, one name per row (FR-MUS-1, FR-MUS-2). */
export function PeripheralsEditor({
  peripherals,
  errors,
  onChange,
}: {
  peripherals: readonly string[];
  errors: FieldErrors;
  onChange: (peripherals: string[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <ListEditor
      items={peripherals}
      onChange={onChange}
      makeNew={() => ''}
      addLabel={t('apps.museum.addPeripheral')}
      listLabel={t('apps.museum.field.peripherals')}
      renderRow={(name, index, update) => (
        <TextField
          label={t('apps.museum.field.name')}
          value={name}
          error={errors[`peripherals.${String(index)}`]}
          onChange={(next) => {
            update(next ?? '');
          }}
        />
      )}
    />
  );
}
