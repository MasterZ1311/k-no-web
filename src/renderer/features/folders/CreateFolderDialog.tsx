import React, { useState } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import type { FolderDTO } from '../../../preload/types';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  parentFolder?: FolderDTO | null;
  onSubmit: (name: string, parentId?: string | null) => Promise<boolean>;
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  isOpen,
  onClose,
  parentId,
  parentFolder,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Folder name is required.');
      return;
    }
    if (trimmed.length > 120) {
      setError('Folder name must be 120 characters or fewer.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await onSubmit(trimmed, parentId);
      if (ok) {
        setName('');
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create folder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={parentFolder ? `New Subfolder in "${parentFolder.name}"` : 'New Folder'}
      description="Create a folder to group related notes together."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Create Folder
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Folder Name"
          placeholder="e.g., Engineering, Architecture, Personal"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          error={error || undefined}
          autoFocus
        />
      </form>
    </Dialog>
  );
};
