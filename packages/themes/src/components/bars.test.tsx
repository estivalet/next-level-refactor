// Cases ported from NextLevelOS src/themes/components/TabBar.test.tsx @ 3d530b7.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HintBar } from './HintBar.tsx';
import { StatusBar } from './StatusBar.tsx';
import { TabBar } from './TabBar.tsx';

describe('TabBar (FR-THM-1, FR-THM-3)', () => {
  it('renders tabs with counts, marks the active one, and reports clicks', () => {
    const onChange = vi.fn();
    render(
      <TabBar
        tabs={[
          { id: 'all', label: 'All', count: 3 },
          { id: 'hidden', label: 'Hidden', count: 1 },
        ]}
        activeId="all"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Hidden/ })).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('tab', { name: /Hidden/ }));
    expect(onChange).toHaveBeenCalledWith('hidden');
  });
});

describe('HintBar (FR-THM-3)', () => {
  it('renders keys and labels', () => {
    render(<HintBar hints={[{ keys: ['Q', 'E'], label: 'Tabs' }]} />);
    expect(screen.getByText('Q')).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });
});

describe('StatusBar (FR-THM-1)', () => {
  it('shows a clock and the given slots', () => {
    render(<StatusBar left={<span>left</span>} right={<span>right</span>} />);
    expect(screen.getByText('left')).toBeInTheDocument();
    expect(screen.getByText('right')).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });
});
