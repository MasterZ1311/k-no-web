import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrandBackdrop } from '../src/renderer/design-system/BrandBackdrop';

describe('BrandBackdrop Component', () => {
  it('renders with accessibility attributes to avoid interfering with screen readers', () => {
    const { container } = render(<BrandBackdrop size="huge" position="center" />);
    const backdrop = container.firstElementChild as HTMLElement;
    
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveAttribute('role', 'presentation');
  });

  it('enforces pointer-events-none and absolute positioning so it never intercepts user clicks', () => {
    const { container } = render(<BrandBackdrop size="huge" position="center" />);
    const backdrop = container.firstElementChild as HTMLElement;
    
    expect(backdrop.className).toContain('pointer-events-none');
    expect(backdrop.className).toContain('select-none');
    expect(backdrop.className).toContain('absolute');
  });

  it('supports huge, standard, and compact size presets on inner wrapper', () => {
    const { container: hugeContainer } = render(<BrandBackdrop size="huge" />);
    const hugeInner = hugeContainer.firstElementChild?.firstElementChild as HTMLElement;
    expect(hugeInner?.className).toContain('w-[75vmin]');
    expect(hugeInner?.className).toContain('max-w-[850px]');

    const { container: stdContainer } = render(<BrandBackdrop size="standard" />);
    const stdInner = stdContainer.firstElementChild?.firstElementChild as HTMLElement;
    expect(stdInner?.className).toContain('w-[60vmin]');
    expect(stdInner?.className).toContain('max-w-[650px]');

    const { container: compactContainer } = render(<BrandBackdrop size="compact" />);
    const compactInner = compactContainer.firstElementChild?.firstElementChild as HTMLElement;
    expect(compactInner?.className).toContain('w-[45vmin]');
    expect(compactInner?.className).toContain('max-w-[480px]');
  });

  it('renders the SVG element with currentColor and evenodd fill rule', () => {
    const { container } = render(<BrandBackdrop />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('fill')).toBe('currentColor');
    expect(svg?.getAttribute('fill-rule')).toBe('evenodd');

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('allows overriding opacity for subtle custom calibration', () => {
    const { container } = render(<BrandBackdrop opacity={0.015} />);
    const inner = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(inner.style.opacity).toBe('0.015');
  });
});
