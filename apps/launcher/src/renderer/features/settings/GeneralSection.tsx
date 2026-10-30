import { BootTargetField } from './BootTargetField.tsx';
import { SettingsForm } from './form/SettingsForm.tsx';
import { RunSetupAgainField } from './RunSetupAgainField.tsx';
import { ThemeSoundField } from './ThemeSoundField.tsx';

/**
 * Settings → General (IA §1): language, start with Windows, where the launcher starts and the
 * theme sounds, and Run setup again (D48).
 */
export function GeneralSection() {
  return (
    <SettingsForm
      sectionKey="general"
      extra={({ draft, update }) => (
        <>
          <BootTargetField draft={draft} update={update} />
          <ThemeSoundField draft={draft} update={update} />
          <RunSetupAgainField draft={draft} update={update} />
        </>
      )}
    />
  );
}
