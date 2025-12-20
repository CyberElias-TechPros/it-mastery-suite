import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, File, Image, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadProps {
  onFileUploaded: (fileData: any) => void;
  resourceType: string;
  resourceId: string;
  accept?: string;
  maxSize?: number; // in MB
  multiple?: boolean;
}

export function FileUpload({
  onFileUploaded,
  resourceType,
  resourceId,
  accept = "*",
  maxSize = 10,
  multiple = false
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > maxSize * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than ${maxSize}MB`,
          variant: "destructive",
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
    try {
      const user = await supabase.auth.getUser();
      
      const uploadPromises = selectedFiles.map(async (file) => {
        // Create a unique file name
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(fileName);

        // Save file metadata to database
        const { data: fileData, error: dbError } = await supabase
          .from('attachments' as any)
          .insert({
            file_name: file.name,
            file_path: publicUrl,
            file_size: file.size,
            mime_type: file.type,
            resource_type: resourceType,
            resource_id: resourceId,
            uploaded_by: user.data.user?.id,
          } as any)
          .select()
          .single();

        if (dbError) throw dbError;

        return fileData;
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      toast({
        title: "Success",
        description: `${uploadedFiles.length} file(s) uploaded successfully`,
      });

      // Clear selected files
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Notify parent component
      uploadedFiles.forEach(file => onFileUploaded(file));

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (file.type.includes('pdf') || file.type.includes('document')) {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Attach Files</Label>
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-2"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Files
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Max file size: {maxSize}MB. Supported formats: {accept}
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files</Label>
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file)}
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                onClick={uploadFiles}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? "Uploading..." : `Upload ${selectedFiles.length} File(s)`}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}