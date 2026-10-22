import {
  ARCHIVE_MODES,
  type Emulator,
  type EmulatorProfile,
  type GameRow,
} from '@nextlevel/shared';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from '../../library/Modal.tsx';
import { ArgsEditor } from './ArgsEditor.tsx';
import { CommandPreview } from './CommandPreview.tsx';
import { EnvEditor } from './EnvEditor.tsx';
import { GamePicker } from './GamePicker.tsx';
import { SystemPicker } from './SystemPicker.tsx';
import { TestLaunchPanel } from './TestLaunchPanel.tsx';
import { TokenInput } from './TokenInput.tsx';

const LABEL = 'mb-1 block text-[11px] text-slate-400';

/**
 * The emulator profile editor (S9): name, systems, argument templates with token autocomplete,
 * working folder, core, archives and environment, with a live preview and Test launch.
 */
export function ProfileEditor({
  profile,
  emulator,
  errors,
  valid,
  onChange,
  onClose,
}: {
  profile: EmulatorProfile;
  emulator: Emulator;
  /** Message keys by path inside this profile (`name`, `args.0`, `env.HOME`, …). */
  errors: Readonly<Record<string, string>>;
  /** The whole profile and its emulator pass validation. */
  valid: boolean;
  onChange: (change: (profile: EmulatorProfile) => EmulatorProfile) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [game, setGame] = useState<GameRow | null>(null);
  const envErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([path]) => path.startsWith('env.'))
      .map(([path, key]) => [path.slice('env.'.length), key]),
  );
  const set = <K extends keyof EmulatorProfile>(key: K, value: EmulatorProfile[K]) => {
    onChange((current) => ({ ...current, [key]: value }));
  };
  const optional = (key: 'cwd' | 'core', value: string) => {
    // An empty field removes the key, so the default ({emulatorDir}, no core) applies.
    onChange((current) =>
      value === ''
        ? (Object.fromEntries(
            Object.entries(current).filter(([name]) => name !== key),
          ) as EmulatorProfile)
        : { ...current, [key]: value },
    );
  };

  return (
    <section
      aria-label={t('settings.emulators.editor.title')}
      className="flex flex-col gap-4 rounded-lg border border-white/20 bg-white/5 p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {t('settings.emulators.editor.title')} · {emulator.name}
        </h4>
        <button
          type="button"
          aria-label={t('settings.emulators.editor.close')}
          onClick={onClose}
          className="rounded-lg p-1 text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <label className="text-xs">
        <span className={LABEL}>{t('settings.emulators.editor.name')}</span>
        <input
          type="text"
          value={profile.name}
          aria-invalid={errors['name'] ? true : undefined}
          onChange={(event) => {
            set('name', event.target.value);
          }}
          className={INPUT}
        />
        {errors['name'] && <p className="mt-1 text-[11px] text-red-300">{t(errors['name'])}</p>}
      </label>
      <SystemPicker
        selected={profile.systems}
        onChange={(systems) => {
          set('systems', systems);
        }}
      />
      <ArgsEditor
        args={profile.args}
        onChange={(args) => {
          set('args', args);
        }}
      />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className={LABEL}>{t('settings.emulators.editor.cwd')}</span>
          <TokenInput
            value={profile.cwd ?? ''}
            where="value"
            label={t('settings.emulators.editor.cwd')}
            placeholder="{emulatorDir}"
            onChange={(value) => {
              optional('cwd', value);
            }}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            {t('settings.emulators.editor.cwdHelp')}
          </p>
        </div>
        <label>
          <span className={LABEL}>{t('settings.emulators.editor.core')}</span>
          <input
            type="text"
            value={profile.core ?? ''}
            onChange={(event) => {
              optional('core', event.target.value);
            }}
            className={`${INPUT} font-mono`}
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            {t('settings.emulators.editor.coreHelp')}
          </span>
        </label>
      </div>
      <label className="text-xs">
        <span className={LABEL}>{t('settings.emulators.editor.archives')}</span>
        <select
          value={profile.archives}
          onChange={(event) => {
            set('archives', event.target.value as EmulatorProfile['archives']);
          }}
          className={INPUT}
        >
          {ARCHIVE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(
                mode === 'pass'
                  ? 'settings.emulators.editor.archivesPass'
                  : 'settings.emulators.editor.archivesExtract',
              )}
            </option>
          ))}
        </select>
      </label>
      <EnvEditor
        env={profile.env}
        errors={envErrors}
        onChange={(env) => {
          set('env', env);
        }}
      />
      <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
        <span className={LABEL}>{t('settings.emulators.editor.game')}</span>
        <GamePicker game={game} onChange={setGame} />
        <CommandPreview
          emulator={emulator}
          profile={profile}
          gameId={game?.id ?? null}
          valid={valid}
        />
        <TestLaunchPanel
          emulator={emulator}
          profile={profile}
          gameId={game?.id ?? null}
          valid={valid}
        />
      </div>
    </section>
  );
}
