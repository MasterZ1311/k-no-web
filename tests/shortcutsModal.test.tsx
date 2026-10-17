import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsModal } from '../src/renderer/design-system/KeyboardShortcutsModal';

describe('KeyboardShortcutsModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<KeyboardShortcutsModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders shortcut categories and keybindings when isOpen is true', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Global & Navigation')).toBeInTheDocument();
    expect(screen.getByText('Notes & Notion-Style Editor')).toBeInTheDocument();
    expect(screen.getByText('Tasks & Productivity')).toBeInTheDocument();
  });

  it('calls onClose when close button or Got it button is clicked', () => {
    const handleClose = vi.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /close shortcuts modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
