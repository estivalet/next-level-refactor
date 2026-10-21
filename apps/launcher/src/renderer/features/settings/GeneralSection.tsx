import { SettingsForm } from './form/SettingsForm.tsx';

/** Settings → General (IA §1): language and start with Windows. Boot target arrives in M4. */
export function GeneralSection() {
  return <SettingsForm sectionKey="general" />;
}
