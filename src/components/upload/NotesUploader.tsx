import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  Archive, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle,
  X 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
}

interface NotesUploaderProps {
  onFilesUploaded: (files: File[]) => void;
  disabled?: boolean;
}

export const NotesUploader = ({ onFilesUploaded, disabled }: NotesUploaderProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const getClientId = () => {
    let id = localStorage.getItem('demo_client_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('demo_client_id', id);
    }
    return id;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled) return;

    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      progress: 0,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Simulate upload progress visually while processing on the server
    newFiles.forEach((file) => {
      simulateUploadProgress(file.id);
    });

    (async () => {
      try {
        const filesPayload = await Promise.all(
          acceptedFiles
            .filter((f) => (f.type && f.type.startsWith('text')) || f.name.toLowerCase().endsWith('.md') || f.name.toLowerCase().endsWith('.txt'))
            .map(async (f) => ({
              name: f.name,
              type: f.type || 'text/plain',
              content: await f.text(),
            }))
        );

        const { data, error } = await supabase.functions.invoke('process-notes-upload', {
          body: { clientId: getClientId(), files: filesPayload },
        });
        if (error) throw error;

        setUploadedFiles(prev =>
          prev.map(f => newFiles.find(nf => nf.id === f.id)
            ? { ...f, status: 'completed', progress: 100 }
            : f
          )
        );

        onFilesUploaded(acceptedFiles);
      } catch (e) {
        console.error('process-notes-upload error', e);
        setUploadedFiles(prev =>
          prev.map(f => newFiles.find(nf => nf.id === f.id)
            ? { ...f, status: 'error' }
            : f
          )
        );
      }
    })();
  }, [disabled, onFilesUploaded]);

  const simulateUploadProgress = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'processing', progress: 100 }
              : f
          )
        );
        
        // Simulate processing
        setTimeout(() => {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === fileId 
                ? { ...f, status: 'completed' }
                : f
            )
          );
        }, 2000);
      } else {
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileId 
              ? { ...f, progress }
              : f
          )
        );
      }
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/rtf': ['.rtf'],
      'text/rtf': ['.rtf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
    },
    disabled
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'zip':
        return <Archive className="w-4 h-4" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'md':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
        return <ImageIcon className="w-4 h-4 text-green-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card
        {...getRootProps()}
        className={cn(
          "p-8 border-2 border-dashed transition-all cursor-pointer shadow-soft hover:shadow-medium",
          isDragActive && "border-primary bg-accent/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={cn(
            "w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center",
            isDragActive && "bg-gradient-primary"
          )}>
            <Upload className={cn(
              "w-8 h-8 text-muted-foreground",
              isDragActive && "text-white"
            )} />
          </div>
          
          <p className="text-sm text-muted-foreground">
            {isDragActive ? "Drop files to upload" : "Drop files or click to upload"}
          </p>

        </div>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card className="p-6 shadow-soft">
          
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {getFileIcon(file.name)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(file.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {file.status}
                    </Badge>
                  </div>
                  
                  {(file.status === 'uploading' || file.status === 'processing') && (
                    <Progress value={file.progress} className="mt-2 h-1" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};