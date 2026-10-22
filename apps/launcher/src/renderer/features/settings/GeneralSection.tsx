import { BootTargetField } from './BootTargetField.tsx';
import { SettingsForm } from './form/SettingsForm.tsx';

/** Settings → General (IA §1): language, start with Windows and where the launcher starts. */
export function GeneralSection() {
  return (
    <SettingsForm
      sectionKey="general"
      extra={({ draft, update }) => <BootTargetField draft={draft} update={update} />}
    />
  );
}
