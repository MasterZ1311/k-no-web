import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/renderer/App';
import { Dialog } from '../src/renderer/design-system/Dialog';
import { DropdownMenu } from '../src/renderer/design-system/DropdownMenu';
import { ErrorBoundary } from '../src/renderer/design-system/ErrorBoundary';

describe('káno̱ Workspace Shell & Navigation', () => {
  it('renders the workspace shell with the default Notes route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Notes & Documents/i })).toBeInTheDocument();
    expect(screen.getByText('Personal Workspace')).toBeInTheDocument();
  });

  it('navigates to each route correctly when sidebar items are clicked', async () => {
    render(<App />);

    // 1. Tasks
    fireEvent.click(screen.getByRole('button', { name: /Tasks/i }));
    expect(screen.getByRole('heading', { name: /Tasks & Checklists/i })).toBeInTheDocument();

    // 2. Board
    fireEvent.click(screen.getByRole('button', { name: /Board/i }));
    expect(screen.getByRole('heading', { name: /Main Kanban Board/i })).toBeInTheDocument();

    // 3. Calendar
    fireEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    expect(screen.getByRole('heading', { name: /Calendar & Deadlines/i })).toBeInTheDocument();

    // 4. Activity
    fireEvent.click(screen.getByRole('button', { name: /Activity/i }));
    expect(screen.getByRole('heading', { name: /Room Activity Stream/i })).toBeInTheDocument();

    // 5. Favorites
    fireEvent.click(screen.getByRole('button', { name: /Favorites/i }));
    expect(screen.getByRole('heading', { name: /Favorites/i })).toBeInTheDocument();

    // 6. Trash
    fireEvent.click(screen.getByRole('button', { name: /Trash/i }));
    expect(screen.getByRole('heading', { name: /Trash & Soft Deletion/i })).toBeInTheDocument();

    // 7. Settings
    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(screen.getByRole('heading', { name: /Workspace & Client Settings/i })).toBeInTheDocument();

    // Back to Notes
    fireEvent.click(screen.getByRole('button', { name: /Notes/i }));
    expect(screen.getByRole('heading', { name: /Notes & Documents/i })).toBeInTheDocument();
  }, 15000);

  it('collapses and expands the sidebar', () => {
    render(<App />);
    const sidebar = screen.getByRole('complementary', { name: /Workspace Sidebar/i });
    expect(sidebar).toHaveClass('w-64');

    const collapseButton = screen.getByRole('button', { name: /Collapse sidebar/i });
    fireEvent.click(collapseButton);

    expect(sidebar).toHaveClass('w-14');

    // Click expand button
    const expandButtons = screen.getAllByRole('button', { name: /Expand sidebar/i });
    fireEvent.click(expandButtons[0]);
    expect(sidebar).toHaveClass('w-64');
  });

  it('opens, searches, and closes the Search Palette using keyboard shortcuts', async () => {
    render(<App />);

    // Open via Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: /Search and Command Palette/i })).toBeInTheDocument();

    // Search for "Board"
    const input = screen.getByPlaceholderText(/Type a command or jump to section/i);
    fireEvent.change(input, { target: { value: 'Board' } });

    // Option should be present
    expect(screen.getByText('Kanban Board')).toBeInTheDocument();

    // Dismiss with Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Search and Command Palette/i })).not.toBeInTheDocument();
    });
  });

  it('navigates via Search Palette selection', async () => {
    render(<App />);

    // Open via Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const option = screen.getByText('Kanban Board');
    fireEvent.click(option);

    expect(screen.getByRole('heading', { name: /Main Kanban Board/i })).toBeInTheDocument();
  });

  it('dismisses Dialog on Escape key press', () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={handleClose} title="Test Modal">
        Modal Content
      </Dialog>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to triggering element when Dialog closes', () => {
    const Component = () => {
      const [isOpen, setIsOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="open-btn" onClick={() => setIsOpen(true)}>
            Open Dialog
          </button>
          <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title="Focus Modal">
            <button data-testid="inside-btn">Inside</button>
          </Dialog>
        </div>
      );
    };

    render(<Component />);
    const openBtn = screen.getByTestId('open-btn');
    openBtn.focus();
    expect(document.activeElement).toBe(openBtn);

    fireEvent.click(openBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openBtn);
  });

  it('dismisses DropdownMenu on Escape key press and outside click', () => {
    const handleAction = vi.fn();
    render(
      <div>
        <DropdownMenu
          trigger={<button>Menu Trigger</button>}
          items={[{ id: '1', label: 'Action 1', onClick: handleAction }]}
        />
        <div data-testid="outside">Outside area</div>
      </div>
    );

    // Click to open
    fireEvent.click(screen.getByText('Menu Trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Press Escape to dismiss
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Open again and click outside
    fireEvent.click(screen.getByText('Menu Trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders ErrorBoundary fallback when an unhandled error occurs', () => {
    const ProblemComponent = () => {
      throw new Error('Test boundary crash');
    };

    // Suppress console.error in test output for intentional throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemComponent />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong in the workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Test boundary crash/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
