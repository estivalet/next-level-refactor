import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HardwareImage } from './HardwareImage.tsx';

describe('HardwareImage', () => {
  it("FR-MUS-8: HardwareImage builds nextlevel://art/assets/art/hardware/Bandai%20Let's%20TV%20Play%20Classic.png", () => {
    const { container } = render(<HardwareImage name="Bandai Let's TV Play Classic" size="card" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute(
      'src',
      "nextlevel://art/assets/art/hardware/Bandai%20Let's%20TV%20Play%20Classic.png",
    );
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('FR-MUS-8: the hero image is not lazy', () => {
    const { container } = render(<HardwareImage name="Super Nintendo" size="hero" />);
    expect(container.querySelector('img')).not.toHaveAttribute('loading');
  });

  it('FR-MUS-8: shows the placeholder after an image error', () => {
    const { container } = render(<HardwareImage name="super Nintendo" size="thumb" />);
    const img = container.querySelector('img');
    if (!img) throw new Error('no image');
    const box = img.parentElement;
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    const placeholder = screen.getByTestId('hardware-placeholder');
    expect(placeholder).toHaveTextContent('S');
    expect(placeholder.parentElement).toBe(box);
  });

  it('FR-MUS-8: an empty name shows the placeholder without requesting an image', () => {
    const { container } = render(<HardwareImage name="" size="thumb" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('hardware-placeholder')).toBeInTheDocument();
  });
});
