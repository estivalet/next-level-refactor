import type { IpcHandlers } from './ipc/router.ts';

type SystemInfoChannel = Extract<keyof IpcHandlers, `systems.info.${string}`>;

const unimplemented = (channel: SystemInfoChannel) => () => {
  throw new Error(`IPC channel ${channel} is not implemented`);
};

/** Museum channels (FR-MUS-1..5). Stubs until the museum service lands; the router reports INTERNAL. */
export function createSystemInfoHandlers(): Pick<IpcHandlers, SystemInfoChannel> {
  return {
    'systems.info.list': unimplemented('systems.info.list'),
    'systems.info.get': unimplemented('systems.info.get'),
    'systems.info.save': unimplemented('systems.info.save'),
    'systems.info.reset': unimplemented('systems.info.reset'),
    'systems.info.forTheme': unimplemented('systems.info.forTheme'),
  };
}
