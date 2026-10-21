import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ShellProvider } from './features/shell/ShellContext.tsx';
import './i18n.ts';
import { createQueryClient } from './queryClient.ts';

/** Renders UI inside the same providers as main.tsx, with a fresh query client per test. */
export function renderInShell(ui: ReactNode) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ShellProvider initialBounds={{ width: 1200, height: 800 }}>{ui}</ShellProvider>
    </QueryClientProvider>,
  );
}
