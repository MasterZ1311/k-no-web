import React, { useState, useEffect } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import type { FolderDTO } from '../../../preload/types';

interface RenameFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folder: FolderDTO | null;
  onSubmit: (folderId: string, name: string) => Promise<boolean>;
}

export const RenameFolderDialog: React.FC<RenameFolderDialogProps> = ({
  isOpen,
  onClose,
  folder,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setError(null);
    }
  }, [folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folder) return;
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
      const ok = await onSubmit(folder.id, trimmed);
      if (ok) {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Folder"
      description={`Enter a new name for "${folder?.name}".`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Save
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Folder Name"
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
