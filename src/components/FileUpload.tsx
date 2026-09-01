import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { File as FileIcon, FileText, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/format';

export interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  resource_type: string;
  resource_id: string;
  uploaded_by: string;
  uploaded_by_name?: string | null;
  created_at: string;
}

/** Mirrors the server whitelist in worker/src/routes/uploads.ts. */
export const ACCEPTED_UPLOAD_TYPES =
  'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,' +
  'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface FileUploadProps {
  onFileUploaded: (file: Attachment) => void;
  resourceType: 'ticket' | 'asset' | 'expense' | 'kb_article' | 'user' | 'purchase_order';
  resourceId: string;
  accept?: string;
  /** Maximum size per file in MB; the API enforces the real limit. */
  maxSize?: number;
  multiple?: boolean;
}

export function FileUpload({
  onFileUploaded,
  resourceType,
  resourceId,
  accept = ACCEPTED_UPLOAD_TYPES,
  maxSize = 10,
  multiple = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const validFiles = files.filter((file) => {
      if (file.size > maxSize * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than ${maxSize}MB.`,
          variant: 'destructive',
        });
        return false;
      }
      return true;
    });
    setSelectedFiles(validFiles);
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);

    const uploaded: Attachment[] = [];
    const failures: string[] = [];

    // Sequential uploads keep memory predictable and error reporting precise.
    for (const file of selectedFiles) {
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('resourceType', resourceType);
      form.append('resourceId', resourceId);
      try {
        uploaded.push(await api.upload<Attachment>('/attachments', form));
      } catch (error) {
        failures.push(`${file.name}: ${errorMessage(error)}`);
      }
    }

    setUploading(false);
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    uploaded.forEach(onFileUploaded);

    if (uploaded.length) {
      toast({ title: 'Upload complete', description: `${uploaded.length} file(s) attached.` });
    }
    if (failures.length) {
      toast({ title: 'Some files were rejected', description: failures.join(' • '), variant: 'destructive' });
    }
  };

  const removeFile = (index: number) => setSelectedFiles((previous) => previous.filter((_, i) => i !== index));

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (file.type.includes('pdf') || file.type.includes('document')) return <FileText className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Attach files</Label>
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-2 w-full">
              <Upload className="mr-2 h-4 w-4" />
              Choose files
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Up to {maxSize}MB each. Images, PDFs, text, Word and Excel documents.
            </p>
          </div>

          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              <Label>Selected files</Label>
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded border p-2">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file)}
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button type="button" onClick={uploadFiles} disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {uploading ? 'Uploading…' : `Upload ${selectedFiles.length} file(s)`}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
