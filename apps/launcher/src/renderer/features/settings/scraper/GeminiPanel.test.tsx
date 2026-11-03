import { defaultSettings, err, ok, type Settings } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { GeminiOptions } from './GeminiOptions.tsx';
import { GeminiPanel } from './GeminiPanel.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

describe('Settings → Scraper → Gemini key (FR-SCR-7)', () => {
  it('FR-SCR-7: saves a typed key to the secret store and shows only "Saved"', async () => {
    const user = userEvent.setup();
    let set = false;
    const bridge = installFakeBridge({
      'gemini.key.status': () => ok({ available: true, set }),
      'gemini.key.set': ({ apiKey }) => {
        set = apiKey !== null;
        return ok({ available: true, set });
      },
      'gemini.test': () => ok({ ok: true as const }),
    });
    renderInShell(<GeminiPanel />);
    expect(await screen.findByText('Not set')).toBeInTheDocument();
    await user.type(screen.getByLabelText('API key'), '  AIza-test-key-123 ');
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect(bridge.calls.find((call) => call.channel === 'gemini.key.set')?.input).toEqual({
      apiKey: 'AIza-test-key-123',
    });
    expect(await screen.findByPlaceholderText('Saved')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Test Gemini' }));
    expect(await screen.findByText('Gemini answered. The key works.')).toBeInTheDocument();
  });

  it('FR-SCR-7: links AI Studio and warns not to add billing', async () => {
    installFakeBridge({ 'gemini.key.status': () => ok({ available: true, set: false }) });
    renderInShell(<GeminiPanel />);
    const link = await screen.findByRole('link', { name: 'Google AI Studio' });
    expect(link).toHaveAttribute('href', 'https://aistudio.google.com/apikey');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/don't add billing/i)).toBeInTheDocument();
  });

  it('FR-SCR-7: Test shows the daily limit and key errors', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      'gemini.key.status': () => ok({ available: true, set: true }),
      'gemini.test': () => err('GEMINI_QUOTA', 'errors.geminiQuota'),
    });
    renderInShell(<GeminiPanel />);
    await user.click(await screen.findByRole('button', { name: 'Test Gemini' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/free daily limit is used up/);
  });

  it('FR-SCR-7: Remove clears the key', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'gemini.key.status': () => ok({ available: true, set: true }),
      'gemini.key.set': () => ok({ available: true, set: false }),
    });
    renderInShell(<GeminiPanel />);
    await user.click(await screen.findByRole('button', { name: 'Remove key' }));
    expect(bridge.calls.find((call) => call.channel === 'gemini.key.set')?.input).toEqual({
      apiKey: null,
    });
  });
});

describe('Settings → Scraper → Gemini options (FR-SCR-7)', () => {
  function setup() {
    let latest: Settings = defaultSettings();
    function Harness() {
      const [draft, setDraft] = useState(latest);
      return (
        <GeminiOptions
          draft={draft}
          update={(change) => {
            setDraft((current) => {
              latest = change(current);
              return latest;
            });
          }}
          errors={{}}
        />
      );
    }
    renderInShell(<Harness />);
    return { current: () => latest };
  }

  it('FR-SCR-7: edits the model, Search checking and the website tool paths', async () => {
    const user = userEvent.setup();
    const { current } = setup();
    const model = screen.getByLabelText('Model');
    expect(model).toHaveValue('gemini-3.6-flash');
    await user.clear(model);
    await user.type(model, 'x');
    expect(current().scraper.gemini.model).toBe('x');
    await user.click(screen.getByLabelText('Check answers with Google Search'));
    expect(current().scraper.gemini.grounding).toBe(false);
    await user.type(screen.getByLabelText('Python program'), 'C');
    expect(current().scraper.gemini.webTool.python).toBe('C');
    await user.type(screen.getByLabelText('Firefox profile folder'), 'P');
    expect(current().scraper.gemini.webTool.firefoxProfile).toBe('P');
    await user.type(screen.getByLabelText('geckodriver (optional)'), 'G');
    expect(current().scraper.gemini.webTool.driver).toBe('G');
  });
});
