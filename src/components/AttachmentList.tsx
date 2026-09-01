import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, File as FileIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL, api, errorMessage, getAccessToken, refreshAccessToken } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import type { Attachment } from '@/components/FileUpload';

interface AttachmentListProps {
  resourceType: string;
  resourceId: string;
}

/**
 * Attachments live in a private R2 bucket, so downloads are streamed through
 * the API with an Authorization header rather than a public URL.
 */
async function downloadAttachment(attachment: Attachment) {
  let token = getAccessToken();
  const fetchFile = () =>
    fetch(`${API_BASE_URL}/attachments/${attachment.id}/download`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    });

  let response = await fetchFile();
  if (response.status === 401) {
    token = await refreshAccessToken();
    response = await fetchFile();
  }
  if (!response.ok) throw new Error('The file could not be downloaded.');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.file_name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AttachmentList({ resourceType, resourceId }: AttachmentListProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments', resourceType, resourceId],
    queryFn: () => api.get<Attachment[]>('/attachments', { resourceType, resourceId }),
    enabled: Boolean(resourceId),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.del(`/attachments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', resourceType, resourceId] });
      toast({ title: 'Attachment removed' });
    },
    onError: (error) => toast({ title: 'Could not remove file', description: errorMessage(error), variant: 'destructive' }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading attachments…</p>;
  if (attachments.length === 0) return <p className="text-sm text-muted-foreground">No attachments yet.</p>;

  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => {
        const canDelete = profile?.role === 'admin' || profile?.id === attachment.uploaded_by;
        return (
          <li key={attachment.id} className="flex items-center justify-between gap-3 rounded border p-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileIcon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(attachment.file_size)} • {attachment.uploaded_by_name ?? 'Unknown'} •{' '}
                  {formatDateTime(attachment.created_at)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Download ${attachment.file_name}`}
                disabled={busyId === attachment.id}
                onClick={async () => {
                  setBusyId(attachment.id);
                  try {
                    await downloadAttachment(attachment);
                  } catch (error) {
                    toast({ title: 'Download failed', description: errorMessage(error), variant: 'destructive' });
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                {busyId === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${attachment.file_name}`}
                  onClick={() => removeMutation.mutate(attachment.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
