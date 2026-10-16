import React, { useState } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { AlertCircle, FolderPlus } from 'lucide-react';
import { useRooms } from './RoomContext';
import { useToast } from '../../design-system/ToastProvider';

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomDialog: React.FC<CreateRoomDialogProps> = ({ isOpen, onClose }) => {
  const { createRoom } = useRooms();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a name for the room.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createRoom(name, description);
      if (!result.success) {
        setError(result.error || 'Failed to create room.');
      } else {
        showToast(`Created room "${name.trim()}"`, {
          type: 'success',
          description: 'You are enrolled as the room owner.',
        });
        setName('');
        setDescription('');
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating room');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Private Room" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="room-name" className="block text-xs font-medium text-kano-text-secondary">
            Room Name <span className="text-red-500">*</span>
          </label>
          <Input
            id="room-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Engineering Project, Product Roadmap"
            disabled={isSubmitting}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="room-desc" className="block text-xs font-medium text-kano-text-secondary">
            Description <span className="text-kano-text-muted">(Optional)</span>
          </label>
          <Input
            id="room-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of this private room"
            disabled={isSubmitting}
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-kano-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating...' : 'Create Room'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
