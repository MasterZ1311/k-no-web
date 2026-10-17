import React, { useState, useEffect, useCallback } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Button } from '../../design-system/Button';
import { IconButton } from '../../design-system/IconButton';
import { Input } from '../../design-system/Input';
import { useRooms } from './RoomContext';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../design-system/ToastProvider';
import type { RoomMemberDTO, InvitationTokenDTO } from '../../../preload/types';
import {
  Users,
  Key,
  Shield,
  Trash2,
  ArrowRightLeft,
  Copy,
  Check,
  AlertCircle,
  Plus,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface ManageMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageMembersDialog: React.FC<ManageMembersDialogProps> = ({ isOpen, onClose }) => {
  const { activeRoom, refreshRooms } = useRooms();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [members, setMembers] = useState<RoomMemberDTO[]>([]);
  const [invitations, setInvitations] = useState<InvitationTokenDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New invitation state
  const [maxUses, setMaxUses] = useState<number>(1);
  const [expiryOption, setExpiryOption] = useState<'never' | '1h' | '24h' | '7d' | '30d'>('24h');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Transfer ownership confirmation
  const [transferTarget, setTransferTarget] = useState<RoomMemberDTO | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Remove member confirmation
  const [removeTarget, setRemoveTarget] = useState<RoomMemberDTO | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const isOwner = activeRoom?.role === 'owner';

  const loadData = useCallback(async () => {
    if (!activeRoom || !window.kanoDesktop?.rooms) return;

    setIsLoading(true);
    setError(null);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        window.kanoDesktop.rooms.getRoomMembers(activeRoom.id),
        isOwner
          ? window.kanoDesktop.rooms.getInvitations(activeRoom.id)
          : Promise.resolve({ success: true, invitations: [] }),
      ]);

      if (membersRes.success) {
        setMembers(membersRes.members);
      } else {
        setError(membersRes.error || 'Failed to load members');
      }

      if (invitationsRes.success) {
        setInvitations(invitationsRes.invitations);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading room data');
    } finally {
      setIsLoading(false);
    }
  }, [activeRoom, isOwner]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setGeneratedToken(null);
      setTransferTarget(null);
      setRemoveTarget(null);
    }
  }, [isOpen, loadData]);

  const handleGenerateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !window.kanoDesktop?.rooms) return;

    setIsGenerating(true);
    setError(null);

    let expiresAt: string | undefined = undefined;
    const now = new Date();
    if (expiryOption === '1h') {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (expiryOption === '24h') {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (expiryOption === '7d') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expiryOption === '30d') {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    try {
      const result = await window.kanoDesktop.rooms.generateInvitation(
        activeRoom.id,
        maxUses,
        expiresAt
      );

      if (result.success && result.token) {
        setGeneratedToken(result.token);
        setHasCopied(false);
        showToast('Invitation token generated', {
          type: 'success',
          description: 'Copy and share this token securely with the recipient.',
        });
        loadData();
      } else {
        setError(result.error || 'Failed to generate invitation');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating token');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToken = async () => {
    if (!generatedToken) return;
    try {
      await navigator.clipboard.writeText(generatedToken);
      setHasCopied(true);
      showToast('Token copied to clipboard', { type: 'success' });
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      showToast('Failed to copy token', { type: 'error' });
    }
  };

  const handleRevokeInvitation = async (tokenId: string) => {
    if (!window.kanoDesktop?.rooms) return;
    try {
      const res = await window.kanoDesktop.rooms.revokeInvitation(tokenId);
      if (res.success) {
        showToast('Invitation revoked', { type: 'info' });
        loadData();
      } else {
        showToast('Failed to revoke invitation', { type: 'error', description: res.error });
      }
    } catch (err: unknown) {
      showToast('Error revoking invitation', {
        type: 'error',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleConfirmTransfer = async () => {
    if (!activeRoom || !transferTarget || !window.kanoDesktop?.rooms) return;

    setIsTransferring(true);
    try {
      const res = await window.kanoDesktop.rooms.transferOwnership(activeRoom.id, transferTarget.userId);
      if (res.success) {
        showToast(`Ownership transferred to ${transferTarget.displayName || transferTarget.email}`, {
          type: 'success',
        });
        setTransferTarget(null);
        await refreshRooms();
        loadData();
      } else {
        setError(res.error || 'Failed to transfer ownership');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error transferring ownership');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!activeRoom || !removeTarget || !window.kanoDesktop?.rooms) return;

    setIsRemoving(true);
    try {
      const res = await window.kanoDesktop.rooms.removeMember(activeRoom.id, removeTarget.userId);
      if (res.success) {
        showToast(`Removed ${removeTarget.displayName || removeTarget.email}`, { type: 'info' });
        setRemoveTarget(null);
        loadData();
      } else {
        setError(res.error || 'Failed to remove member');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error removing member');
    } finally {
      setIsRemoving(false);
    }
  };

  if (!activeRoom) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage: ${activeRoom.name}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-kano-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-kano-accent-subtle text-kano-accent'
                : 'text-kano-text-secondary hover:bg-kano-surface-hover'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({members.length})</span>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('invitations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'invitations'
                  ? 'bg-kano-accent-subtle text-kano-accent'
                  : 'text-kano-text-secondary hover:bg-kano-surface-hover'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Invitations ({invitations.filter((i) => !i.isRevoked).length})</span>
            </button>
          )}

          <div className="flex-1" />

          <IconButton
            aria-label="Refresh data"
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </IconButton>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto divide-y divide-kano-border border border-kano-border rounded-lg">
              {members.map((member) => {
                const isCurrentMember = member.userId === user?.id;
                const isTargetOwner = member.role === 'owner';

                return (
                  <div
                    key={member.userId}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-kano-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-kano-accent-subtle text-kano-accent border border-kano-accent/20 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-kano-text-primary truncate">
                            {member.displayName || member.email || 'Member'}
                          </span>
                          {isCurrentMember && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-kano-surface-hover text-kano-text-muted border border-kano-border">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-kano-text-muted block truncate">
                          {member.email || 'No email shared'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isTargetOwner ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <Shield className="w-3 h-3" />
                          Owner
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-kano-surface text-kano-text-muted border border-kano-border">
                          Member
                        </span>
                      )}

                      {/* Owner actions for standard members */}
                      {isOwner && !isTargetOwner && (
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <IconButton
                            aria-label="Transfer Room Ownership"
                            variant="ghost"
                            size="sm"
                            onClick={() => setTransferTarget(member)}
                            className="text-kano-text-muted hover:text-amber-600"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </IconButton>
                          <IconButton
                            aria-label="Remove Member"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveTarget(member)}
                            className="text-kano-text-muted hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Transfer Confirmation Modal */}
            {transferTarget && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Transfer Room Ownership</span>
                </div>
                <p className="text-xs text-kano-text-secondary leading-relaxed">
                  Are you sure you want to transfer ownership of &ldquo;{activeRoom.name}&rdquo; to{' '}
                  <span className="font-semibold">{transferTarget.displayName || transferTarget.email}</span>?
                  You will become a standard member.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setTransferTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmTransfer}
                    disabled={isTransferring}
                  >
                    {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
                  </Button>
                </div>
              </div>
            )}

            {/* Remove Member Confirmation Modal */}
            {removeTarget && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Remove Member</span>
                </div>
                <p className="text-xs text-kano-text-secondary leading-relaxed">
                  Remove <span className="font-semibold">{removeTarget.displayName || removeTarget.email}</span> from &ldquo;{activeRoom.name}&rdquo;? They will lose access immediately.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleConfirmRemove}
                    disabled={isRemoving}
                  >
                    {isRemoving ? 'Removing...' : 'Confirm Remove'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'invitations' && isOwner && (
          <div className="space-y-4">
            {/* Generate Token Form */}
            <form onSubmit={handleGenerateInvitation} className="p-3 bg-kano-bg border border-kano-border rounded-lg space-y-3">
              <span className="text-xs font-semibold text-kano-text-primary block">
                Generate New Invitation Token
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="max-uses" className="block text-[11px] font-medium text-kano-text-secondary">
                    Max Uses
                  </label>
                  <Input
                    id="max-uses"
                    type="number"
                    min={1}
                    max={100}
                    value={maxUses}
                    onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 1)}
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="expires-in" className="block text-[11px] font-medium text-kano-text-secondary">
                    Expiration
                  </label>
                  <select
                    id="expires-in"
                    value={expiryOption}
                    onChange={(e) => setExpiryOption(e.target.value as typeof expiryOption)}
                    disabled={isGenerating}
                    className="w-full h-8 px-2 text-xs rounded-md bg-kano-surface border border-kano-border text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent"
                  >
                    <option value="1h">1 Hour</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                    <option value="30d">30 Days</option>
                    <option value="never">Never (No expiry)</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{isGenerating ? 'Generating...' : 'Generate Invitation Token'}</span>
              </Button>
            </form>

            {/* Generated Plaintext Token Display */}
            {generatedToken && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Active Plaintext Token (Save & Share)
                  </span>
                  <span className="text-[10px] text-kano-text-muted">
                    Tokens are never shown again in plaintext!
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedToken}
                    className="flex-1 h-10 px-3 font-mono text-sm bg-kano-surface border border-kano-border rounded-lg text-kano-text-primary select-all"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleCopyToken}
                    className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {hasCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{hasCopied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Existing Invitations List */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-kano-text-secondary block">
                Existing Invitation Tokens
              </span>
              <div className="max-h-48 overflow-y-auto divide-y divide-kano-border border border-kano-border rounded-lg">
                {invitations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-kano-text-muted">
                    No active or past invitations for this room.
                  </div>
                ) : (
                  invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-kano-surface-hover"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-kano-text-primary">
                            Token #{inv.id.substring(0, 8)}...
                          </span>
                          {inv.isRevoked ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-600 border border-red-500/20">
                              Revoked
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-kano-text-muted">
                          <span>Uses: {inv.useCount} / {inv.maxUses}</span>
                          {inv.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {!inv.isRevoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-xs text-kano-text-muted hover:text-red-600"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
