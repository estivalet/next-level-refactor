import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BootGate } from './features/boot/BootGate.tsx';
import { BootShell } from './features/boot/BootShell.tsx';
import { GameLaunchScreen } from './features/launch/GameLaunchScreen.tsx';
import { Desktop } from './features/shell/Desktop.tsx';
import { blockFileDrops } from './fileDrop.ts';
import { Taskbar } from './features/shell/Taskbar.tsx';
import './i18n.ts';
import './index.css';
import { createQueryClient } from './queryClient.ts';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

blockFileDrops(document);
const queryClient = createQueryClient();
// The desktop measures its real work area on mount; this is only the first guess.
const initialBounds = { width: window.innerWidth, height: window.innerHeight };

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BootGate>
        <BootShell initialBounds={initialBounds}>
          <Desktop taskbar={<Taskbar />} />
          <GameLaunchScreen />
        </BootShell>
      </BootGate>
    </QueryClientProvider>
  </StrictMode>,
);
