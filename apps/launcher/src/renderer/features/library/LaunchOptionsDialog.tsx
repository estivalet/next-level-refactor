import {
  defaultProfileFor,
  EMPTY_LAUNCH_OVERRIDE,
  LAUNCH_OVERRIDE_LIMITS,
  profilesFor,
  usesToken,
  type GameDetails,
  type LaunchOverride,
  type Settings,
} from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessageKey, useSettings } from '../settings/settingsApi.ts';
import { useGameDetails, useLaunchOverride, useSetLaunchOverride } from './libraryApi.ts';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';

/** One argument per line; blank lines are dropped. */
const argsOf = (text: string) => text.split(/\r?\n/).filter((line) => line.trim() !== '');

/** Why the options can't be saved (the limits main checks), or null. */
function limitProblem(core: string, extraArgs: readonly string[]): string | null {
  if (core.trim().length > LAUNCH_OVERRIDE_LIMITS.core) return 'library.launchOptions.coreTooLong';
  if (extraArgs.length > LAUNCH_OVERRIDE_LIMITS.extraArgs) {
    return 'library.launchOptions.tooManyArgs';
  }
  if (extraArgs.some((arg) => arg.length > LAUNCH_OVERRIDE_LIMITS.extraArg)) {
    return 'library.launchOptions.argTooLong';
  }
  return null;
}

/**
 * Launch options for one game (FR-EMU-4): a profile other than the system default, a RetroArch
 * core and extra arguments. Opens once the game, its override and the settings are loaded.
 */
export function LaunchOptionsDialog({ gameId, onClose }: { gameId: number; onClose: () => void }) {
  const game = useGameDetails(gameId).data;
  const override = useLaunchOverride(gameId).data;
  const load = useSettings().data;
  const settings = load?.kind === 'ok' ? load.snapshot.settings : undefined;
  if (!game || !override || !settings) return null;
  return <OptionsForm game={game} initial={override} settings={settings} onClose={onClose} />;
}

interface OptionsFormProps {
  game: GameDetails;
  initial: LaunchOverride;
  settings: Settings;
  onClose: () => void;
}

function OptionsForm({ game, initial, settings, onClose }: OptionsFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const save = useSetLaunchOverride();
  const profiles = profilesFor(settings, game.systemId);
  const systemDefault = defaultProfileFor(settings, game.systemId);
  const [profileId, setProfileId] = useState(
    profiles.some((p) => p.id === initial.profileId) ? (initial.profileId ?? '') : '',
  );
  const [core, setCore] = useState(initial.core ?? '');
  const [extraText, setExtraText] = useState(initial.extraArgs.join('\n'));
  const effective = profiles.find((p) => p.id === profileId) ?? systemDefault;
  const extraArgs = argsOf(extraText);
  const extraIgnored =
    extraArgs.length > 0 &&
    effective !== undefined &&
    !effective.args.some((arg) => usesToken(arg, 'extraArgs'));
  const problem = limitProblem(core, extraArgs);

  const store = (override: LaunchOverride) => {
    save.mutate({ gameId: game.id, override }, { onSuccess: onClose });
  };
  return (
    <Modal
      title={t('library.launchOptions.title', { title: game.title })}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${SECONDARY_BUTTON} mr-auto`}
            disabled={save.isPending}
            onClick={() => {
              store(EMPTY_LAUNCH_OVERRIDE);
            }}
          >
            {t('library.launchOptions.reset')}
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.edit.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={save.isPending || problem !== null}
            onClick={() => {
              store({ profileId: profileId || null, core: core.trim() || null, extraArgs });
            }}
          >
            {t('library.edit.save')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-xs">
        <label htmlFor={`${id}-profile`} className="flex flex-col gap-1 text-slate-400">
          {t('library.launchOptions.profile')}
          <select
            id={`${id}-profile`}
            value={profileId}
            onChange={(event) => {
              setProfileId(event.target.value);
            }}
            className={INPUT}
          >
            <option value="">
              {t('library.launchOptions.systemDefault', {
                name: systemDefault?.name ?? t('library.launchOptions.none'),
              })}
            </option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-core`} className="flex flex-col gap-1 text-slate-400">
          {t('library.launchOptions.core')}
          <input
            id={`${id}-core`}
            type="text"
            value={core}
            placeholder={effective?.core ?? ''}
            onChange={(event) => {
              setCore(event.target.value);
            }}
            className={INPUT}
          />
        </label>
        <label htmlFor={`${id}-extra`} className="flex flex-col gap-1 text-slate-400">
          {t('library.launchOptions.extraArgs')}
          <textarea
            id={`${id}-extra`}
            rows={4}
            value={extraText}
            aria-describedby={`${id}-extra-help`}
            onChange={(event) => {
              setExtraText(event.target.value);
            }}
            className={`${INPUT} font-mono`}
          />
        </label>
        <p
          id={`${id}-extra-help`}
          className={`text-[11px] ${extraIgnored ? 'text-amber-300' : 'text-slate-500'}`}
        >
          {extraIgnored
            ? t('library.launchOptions.extraIgnored', { name: effective.name })
            : t('library.launchOptions.extraHelp')}
        </p>
        {problem && (
          <p role="alert" className="text-[11px] text-red-300">
            {t(problem, LAUNCH_OVERRIDE_LIMITS)}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-[11px] text-red-300">
            {t(errorMessageKey(save.error))}
          </p>
        )}
      </div>
    </Modal>
  );
}
