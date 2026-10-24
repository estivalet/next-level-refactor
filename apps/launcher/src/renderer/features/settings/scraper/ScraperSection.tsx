import { useTranslation } from 'react-i18next';
import { errorMessageKey } from '../settingsApi.ts';
import { SettingsSection } from '../form/SettingsSection.tsx';
import { CredentialsFields } from './CredentialsFields.tsx';
import { ScraperOptions } from './ScraperOptions.tsx';
import { useCredentialStatus } from './scraperApi.ts';

/**
 * Settings → Scraper (IA §1, FR-SCR-2, FR-SCR-3): the ScreenScraper credentials (OS store, saved
 * on their own) above the scraping options (settings file, Save bar).
 */
export function ScraperSection() {
  const { t } = useTranslation();
  const status = useCredentialStatus();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-6">
        {status.data && <CredentialsFields status={status.data} />}
        {status.isError && (
          <p role="alert" className="py-4 text-xs text-[#ff8a80]">
            {t(errorMessageKey(status.error))}
          </p>
        )}
      </div>
      <SettingsSection>
        {({ draft, update, errors }) => (
          <ScraperOptions draft={draft} update={update} errors={errors} />
        )}
      </SettingsSection>
    </div>
  );
}
