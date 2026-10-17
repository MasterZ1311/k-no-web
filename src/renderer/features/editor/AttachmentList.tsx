import React, { useRef, useState } from 'react';
import { Paperclip, Image, FileText, Trash2, Plus, ExternalLink } from 'lucide-react';
import { Button } from '../../design-system/Button';
import { IconButton } from '../../design-system/IconButton';
import { useToast } from '../../design-system/ToastProvider';
import type { AttachmentDTO } from '../../../preload/types';

interface AttachmentListProps {
  roomId: string;
  noteId: string;
  attachments: AttachmentDTO[];
  onUploadAttachment: (file: File) => Promise<boolean>;
  onDeleteAttachment: (attachmentId: string) => Promise<boolean>;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  roomId: _roomId,
  noteId: _noteId,
  attachments,
  onUploadAttachment,
  onDeleteAttachment,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 26214400) {
      showToast('File too large', {
        type: 'error',
        description: 'Attachment exceeds the 25MB limit.',
      });
      return;
    }

    setIsUploading(true);
    try {
      const ok = await onUploadAttachment(file);
      if (ok) {
        showToast('Attachment uploaded', {
          type: 'success',
          description: `${file.name} attached to note.`,
        });
      }
    } catch (err: unknown) {
      showToast('Upload failed', {
        type: 'error',
        description: err instanceof Error ? err.message : 'Unknown error during upload.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) {
      return <Image className="w-4 h-4 text-emerald-500" />;
    }
    return <FileText className="w-4 h-4 text-kano-accent" />;
  };

  return (
    <div className="border-t border-kano-border px-3 sm:px-6 py-3 sm:py-4 bg-kano-surface/50">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-kano-text-muted" />
          <h4 className="text-xs font-semibold text-kano-text-primary">
            Attachments ({attachments.length})
          </h4>
        </div>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Plus className="w-3.5 h-3.5" />}
          onClick={() => fileInputRef.current?.click()}
          isLoading={isUploading}
        >
          Add Attachment
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown"
          onChange={handleFileChange}
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-kano-text-muted italic">
          No attachments uploaded yet. Files up to 25MB (images, PDF, markdown) are supported.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-2.5 rounded-lg border border-kano-border bg-kano-surface hover:border-kano-accent transition-colors text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getFileIcon(att.mimeType)}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-kano-text-primary truncate" title={att.filename}>
                    {att.filename}
                  </p>
                  <p className="text-[10px] text-kano-text-muted">
                    {formatSize(att.sizeBytes)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {att.signedUrl && (
                  <IconButton
                    aria-label="Open attachment"
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-1 text-kano-text-muted hover:text-kano-text-primary"
                    onClick={() => {
                      if (window.kanoDesktop?.openExternal) {
                        window.kanoDesktop.openExternal(att.signedUrl!);
                      } else {
                        window.open(att.signedUrl, '_blank');
                      }
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </IconButton>
                )}
                <IconButton
                  aria-label="Delete attachment"
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-1 text-kano-text-muted hover:text-rose-600"
                  onClick={() => onDeleteAttachment(att.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
