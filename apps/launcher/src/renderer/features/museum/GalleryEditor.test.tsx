import { MUSEUM_GALLERY_MAX, museumImageUrl, ok, type SystemGalleryImage } from '@nextlevel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { GalleryEditor } from './GalleryEditor.tsx';
import { GallerySection } from './GallerySection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

/** A stored-image file name, as main names them: `<uuid>.<ext>`. */
const file = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}.png`;
const images = (count: number, from = 1): SystemGalleryImage[] =>
  Array.from({ length: count }, (_, i) => ({ file: file(from + i) }));

function Harness({
  initial,
  onChange,
}: {
  initial: SystemGalleryImage[];
  onChange: (gallery: SystemGalleryImage[]) => void;
}) {
  const [gallery, setGallery] = useState(initial);
  return (
    <GalleryEditor
      systemId="snes"
      gallery={gallery}
      onChange={(next) => {
        setGallery(next);
        onChange(next);
      }}
    />
  );
}

function renderEditor(initial: SystemGalleryImage[]) {
  const changes: SystemGalleryImage[][] = [];
  renderInShell(
    <Harness
      initial={initial}
      onChange={(next) => {
        changes.push(next);
      }}
    />,
  );
  return { latest: () => changes.at(-1), user: userEvent.setup() };
}

const rows = () => within(screen.getByRole('list', { name: 'Gallery' })).getAllByRole('listitem');

describe('GalleryEditor', () => {
  it('FR-MUS-8: Add images appends returned files and shows rejected ones by name and reason', async () => {
    const bridge = installFakeBridge({
      'systems.personal.addImages': () =>
        ok({
          added: [{ file: file(2) }, { file: file(3) }],
          rejected: [
            { name: 'notes.txt', reason: 'type' },
            { name: 'huge.png', reason: 'size' },
            { name: 'broken.jpg', reason: 'unreadable' },
            { name: 'locked.png', reason: 'copy' },
          ],
        }),
    });
    const { latest, user } = renderEditor(images(1));
    await user.click(screen.getByRole('button', { name: 'Add images' }));

    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
    expect(latest()).toEqual([{ file: file(1) }, { file: file(2) }, { file: file(3) }]);
    expect(bridge.calls.find((c) => c.channel === 'systems.personal.addImages')?.input).toEqual({
      systemId: 'snes',
    });
    expect(within(rows()[1] as HTMLElement).getByRole('img')).toHaveAttribute(
      'src',
      museumImageUrl('snes', file(2)),
    );
    const rejected = screen.getByRole('list', { name: 'Images not added' });
    expect(within(rejected).getByText('notes.txt is not a supported image type.')).toBeVisible();
    expect(within(rejected).getByText('huge.png is larger than 20 MB.')).toBeVisible();
    expect(within(rejected).getByText('broken.jpg could not be read.')).toBeVisible();
    expect(
      within(rejected).getByText('locked.png could not be copied into the museum folder.'),
    ).toBeVisible();
  });

  it('FR-MUS-8: adding past 50 keeps the first ones up to 50 and says the gallery is full', async () => {
    installFakeBridge({
      'systems.personal.addImages': () => ok({ added: images(3, 100), rejected: [] }),
    });
    const { latest, user } = renderEditor(images(MUSEUM_GALLERY_MAX - 2));
    await user.click(screen.getByRole('button', { name: 'Add images' }));

    expect(await screen.findByText(/The gallery holds up to 50 images/)).toBeInTheDocument();
    expect(latest()).toHaveLength(MUSEUM_GALLERY_MAX);
    expect(latest()?.slice(-2)).toEqual([{ file: file(100) }, { file: file(101) }]);
    expect(screen.getByRole('button', { name: 'Add images' })).toBeDisabled();
  });

  it('FR-MUS-8: captions edit and rows reorder/remove via RowControls', async () => {
    installFakeBridge();
    const { latest, user } = renderEditor([{ file: file(1), caption: 'Front' }, { file: file(2) }]);

    const second = rows()[1] as HTMLElement;
    await user.type(within(second).getByLabelText('Caption'), 'Back');
    expect(latest()).toEqual([
      { file: file(1), caption: 'Front' },
      { file: file(2), caption: 'Back' },
    ]);

    await user.clear(within(rows()[0] as HTMLElement).getByLabelText('Caption'));
    await user.type(within(rows()[0] as HTMLElement).getByLabelText('Caption'), '   ');
    expect(latest()?.[0]).toEqual({ file: file(1), caption: undefined });

    await user.click(within(rows()[1] as HTMLElement).getByRole('button', { name: 'Move up' }));
    expect(latest()?.map((image) => image.file)).toEqual([file(2), file(1)]);
    expect(within(rows()[0] as HTMLElement).getByLabelText('Caption')).toHaveValue('Back');
    expect(within(rows()[1] as HTMLElement).getByLabelText('Caption')).toHaveValue('   ');

    await user.click(within(rows()[0] as HTMLElement).getByRole('button', { name: 'Remove' }));
    expect(latest()).toEqual([{ file: file(1), caption: undefined }]);
  });

  it('FR-MUS-8: Add is disabled at 50 images', () => {
    installFakeBridge();
    renderEditor(images(MUSEUM_GALLERY_MAX));
    expect(screen.getByRole('button', { name: 'Add images' })).toBeDisabled();
    expect(screen.getByText(/The gallery holds up to 50 images/)).toBeInTheDocument();
  });
});

describe('GallerySection', () => {
  it('FR-MUS-8: an empty gallery says so', () => {
    installFakeBridge();
    renderInShell(<GallerySection title="Gallery" systemId="snes" gallery={[]} />);
    expect(screen.getByText('No images yet.')).toBeInTheDocument();
  });

  it('FR-MUS-8: the viewer opens on click, arrows move, Esc closes', async () => {
    installFakeBridge();
    const user = userEvent.setup();
    renderInShell(
      <GallerySection
        title="Gallery"
        systemId="snes"
        gallery={[{ file: file(1), caption: 'Front' }, { file: file(2) }, { file: file(3) }]}
      />,
    );
    const thumbs = within(screen.getByRole('region', { name: 'Gallery' })).getAllByRole('button');
    expect(thumbs).toHaveLength(3);
    const second = thumbs[1] as HTMLElement;
    await user.click(second);

    const dialog = await screen.findByRole('dialog');
    const shown = () => within(dialog).getByRole('img');
    expect(shown()).toHaveAttribute('src', museumImageUrl('snes', file(2)));
    expect(within(dialog).getByText('2 / 3')).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(shown()).toHaveAttribute('src', museumImageUrl('snes', file(3)));
    expect(within(dialog).getByRole('button', { name: 'Next image' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(shown()).toHaveAttribute('src', museumImageUrl('snes', file(1)));
    expect(within(dialog).getByText('Front')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Next image' }));
    expect(shown()).toHaveAttribute('src', museumImageUrl('snes', file(2)));

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(second).toHaveFocus();
  });
});
