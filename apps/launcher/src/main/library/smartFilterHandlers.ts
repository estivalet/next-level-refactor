import type { EmitEvent } from '../ipc/events.ts';
import type { IpcHandlers } from '../ipc/router.ts';
import type { SmartFilterRepository } from './SmartFilterRepository.ts';

type SmartFilterChannel = Extract<keyof IpcHandlers, `smartFilters.${string}`>;

/**
 * Smart filter channels (FR-LIB-9). A menu can show a smart filter, so every successful write
 * announces `menus.changed`.
 */
export function createSmartFilterHandlers(deps: {
  smartFilters: () => SmartFilterRepository;
  emit: EmitEvent;
}): Pick<IpcHandlers, SmartFilterChannel> {
  const announce = () => {
    deps.emit('menus.changed', {});
  };
  const changed = <T>(value: T): T => {
    announce();
    return value;
  };
  return {
    'smartFilters.list': () => deps.smartFilters().list(),
    'smartFilters.create': ({ name, query }) => changed(deps.smartFilters().create(name, query)),
    'smartFilters.update': ({ id, name, query }) =>
      changed(
        deps.smartFilters().update(id, {
          ...(name === undefined ? {} : { name }),
          ...(query === undefined ? {} : { query }),
        }),
      ),
    'smartFilters.delete': ({ id }) => {
      deps.smartFilters().delete(id);
      announce();
    },
  };
}
