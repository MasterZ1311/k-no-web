import React, { useState } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { AlertCircle, Key, LogIn } from 'lucide-react';
import { useRooms } from './RoomContext';
import { useToast } from '../../design-system/ToastProvider';

interface JoinRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinRoomDialog: React.FC<JoinRoomDialogProps> = ({ isOpen, onClose }) => {
  const { redeemInvitation } = useRooms();
  const { showToast } = useToast();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = token.trim();
    if (!trimmed) {
      setError('Please enter a valid invitation token.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await redeemInvitation(trimmed);
      if (!result.success) {
        setError(result.error || 'Failed to redeem invitation token.');
      } else if (result.alreadyMember) {
        showToast('Already a member', {
          type: 'info',
          description: 'You are already a member of this room.',
        });
        setToken('');
        onClose();
      } else {
        showToast('Successfully joined room', {
          type: 'success',
          description: 'The room has been added to your workspaces.',
        });
        setToken('');
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error joining room');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Join Room with Invitation" maxWidth="md">
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
          <label htmlFor="invitation-token" className="block text-xs font-medium text-kano-text-secondary">
            Invitation Token <span className="text-red-500">*</span>
          </label>
          <Input
            id="invitation-token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your 48-character invitation token"
            iconLeft={<Key className="w-4 h-4" />}
            disabled={isSubmitting}
            autoFocus
            required
          />
          <span className="text-[10px] text-kano-text-muted block">
            Invitation tokens are provided by room owners to grant private access.
          </span>
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
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'Joining...' : 'Join Room'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
