import type { MenuDraft } from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { IpcHandlers } from '../ipc/router.ts';
import type { MenuRepository } from './MenuRepository.ts';

type MenuChannel = Extract<keyof IpcHandlers, `menus.${string}`>;

/**
 * Menu Editor channels (FR-MENU-1..3). Every successful write announces `menus.changed`, so an
 * open front-end reloads its menu (US-D5); a refused write (CONFLICT, NOT_FOUND) announces nothing.
 */
export function createMenuHandlers(deps: {
  menus: () => MenuRepository;
  /** The generated menu of the enabled systems with games, as of now. */
  generatedDraft: () => MenuDraft;
  newId: () => string;
  emit: EmitEvent;
}): Pick<IpcHandlers, MenuChannel> {
  const announce = () => {
    deps.emit('menus.changed', {});
  };
  const changed = <T>(value: T): T => {
    announce();
    return value;
  };
  return {
    'menus.list': () => deps.menus().list(),
    'menus.get': ({ id }) => deps.menus().get(id),
    // FR-MENU-3: until the first save the generated menu is the one themes show.
    'menus.draft': () =>
      deps.menus().active() ?? {
        ...deps.generatedDraft(),
        id: deps.newId(),
        revision: 0,
        active: true,
        source: null,
      },
    'menus.generated': () => deps.generatedDraft(),
    'menus.save': ({ id, title, nodes, baseRevision }) =>
      changed(deps.menus().save(id, { title, nodes }, baseRevision)),
    'menus.create': ({ title, nodes }) => changed(deps.menus().create(title, nodes)),
    'menus.delete': ({ id }) => {
      deps.menus().delete(id);
      announce();
    },
    'menus.setActive': ({ id }) => {
      deps.menus().setActive(id);
      announce();
    },
  };
}
