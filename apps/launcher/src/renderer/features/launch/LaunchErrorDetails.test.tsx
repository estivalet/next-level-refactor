import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LaunchErrorDetails } from './LaunchErrorDetails.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const failed = (details: Record<string, unknown>) => ({
  code: 'LAUNCH_FAILED' as const,
  message: 'errors.launchFailed',
  details,
});

describe('launch error details (US-C2, FR-EMU-9)', () => {
  it('FR-EMU-9: a missing mount tool says where to put it', () => {
    installFakeBridge({});
    renderInShell(<LaunchErrorDetails error={failed({ reason: 'mountToolMissing' })} />);
    expect(screen.getByText(/mountsquashfs\.exe/)).toBeInTheDocument();
  });

  it('FR-EMU-9: a failed mount asks about WinFsp and shows the tool output', () => {
    installFakeBridge({});
    renderInShell(
      <LaunchErrorDetails
        error={failed({ reason: 'mountFailed', stderrTail: 'WinFsp not found' })}
      />,
    );
    expect(screen.getByText(/WinFsp is installed/)).toBeInTheDocument();
    expect(screen.getByText('WinFsp not found')).toBeInTheDocument();
  });

  it('FR-EMU-9: missing game files list what was looked for', () => {
    installFakeBridge({});
    renderInShell(
      <LaunchErrorDetails
        error={failed({ reason: 'entryMissing', looked: ['Q:\\a.singe', 'Q:\\a.zip'] })}
      />,
    );
    expect(screen.getByText(/game’s files were not found/)).toBeInTheDocument();
    expect(screen.getByText('Q:\\a.singe')).toBeInTheDocument();
    expect(screen.getByText('Q:\\a.zip')).toBeInTheDocument();
  });

  it('FR-EMU-9: a pointer file naming a missing game says so and shows the path', () => {
    installFakeBridge({});
    renderInShell(
      <LaunchErrorDetails
        error={failed({ reason: 'pointerMissing', path: 'E:\\x\\content\\g' })}
      />,
    );
    expect(screen.getByText(/file this game points to was not found/)).toBeInTheDocument();
    expect(screen.getByText('E:\\x\\content\\g')).toBeInTheDocument();
  });
});
