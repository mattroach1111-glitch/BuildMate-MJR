import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, X, Eye, Trash2 } from "lucide-react";

interface DocumentUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (file: any) => Promise<{
    method: "PUT";
    url: string;
    fields?: Record<string, never>;
    headers?: Record<string, string>;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
}

interface FileWithPreview {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  uploadURL?: string;
  error?: string;
}

/**
 * A document upload component specifically for bills, invoices, and expense documents
 * that renders as a button and provides a modal interface for file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection (PDFs, images)
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 5)
 * @param props.maxFileSize - Maximum file size in bytes (default: 25MB)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL).
 *   Typically used to fetch a presigned URL from the backend server for direct-to-S3
 *   uploads.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to process the document and extract expense data.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function DocumentUploader({
  maxNumberOfFiles = 5,
  maxFileSize = 26214400, // 25MB default for documents
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: DocumentUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [previewFile, setPreviewFile] = useState<FileWithPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (fileList: File[]) => {
    const errors: string[] = [];
    
    if (fileList.length > maxNumberOfFiles) {
      errors.push(`Maximum ${maxNumberOfFiles} files allowed`);
    }
    
    const oversizedFiles = fileList.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      errors.push(`File too large: ${oversizedFiles[0].name}. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
    }
    
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
    const invalidFiles = fileList.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return !allowedTypes.includes(extension) && !file.type.startsWith('image/') && file.type !== 'application/pdf';
    });
    
    if (invalidFiles.length > 0) {
      errors.push(`Invalid file type: ${invalidFiles[0].name}. Allowed: PDF, JPG, PNG`);
    }
    
    return errors;
  };

  const addFiles = (fileList: File[]) => {
    const errors = validateFiles(fileList);
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }
    
    const newFiles: FileWithPreview[] = fileList.map(file => ({
      file,
      id: crypto.randomUUID(),
      status: 'pending',
      progress: 0,
    }));
    
    setFiles(newFiles);
    setShowModal(true);
  };

  const uploadFile = async (fileWithPreview: FileWithPreview) => {
    try {
      setFiles(prev => prev.map(f => 
        f.id === fileWithPreview.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      const uploadParams = await onGetUploadParameters(fileWithPreview.file);
      
      setFiles(prev => prev.map(f => 
        f.id === fileWithPreview.id 
          ? { ...f, progress: 50 }
          : f
      ));

      const response = await fetch(uploadParams.url, {
        method: uploadParams.method,
        headers: uploadParams.headers || {},
        body: fileWithPreview.file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setFiles(prev => prev.map(f => 
        f.id === fileWithPreview.id 
          ? { ...f, status: 'success', progress: 100, uploadURL: uploadParams.url }
          : f
      ));

      return {
        successful: [{
          ...fileWithPreview.file,
          name: fileWithPreview.file.name,
          size: fileWithPreview.file.size,
          type: fileWithPreview.file.type,
          uploadURL: uploadParams.url,
        }],
        failed: []
      };
    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileWithPreview.id 
          ? { ...f, status: 'error', error: error.message }
          : f
      ));
      
      return {
        successful: [],
        failed: [{
          ...fileWithPreview.file,
          error: error.message
        }]
      };
    }
  };

  const uploadAllFiles = async () => {
    const results = await Promise.all(files.map(uploadFile));
    
    const combinedResult = {
      successful: results.flatMap(r => r.successful),
      failed: results.flatMap(r => r.failed)
    };
    
    onComplete?.(combinedResult);
    
    // Close modal after successful uploads
    if (combinedResult.failed.length === 0) {
      setTimeout(() => {
        setShowModal(false);
        setFiles([]);
      }, 1000);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  const getFilePreviewURL = (file: File) => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  return (
    <div>
      <div 
        className={`relative cursor-pointer transition-all duration-200 ${
          isDragActive ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.tiff,image/*,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button className={`${buttonClassName} w-full min-h-[60px]`}>
          {children}
        </Button>

        {isDragActive && (
          <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-md flex items-center justify-center pointer-events-none z-10">
            <div className="text-blue-600 font-medium text-sm">
              Drop files here to upload
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Select and upload documents to add to your job. Supported formats: PDF, JPG, PNG (max 25MB each).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File List */}
            <div className="space-y-3">
              {files.map((fileWithPreview) => (
                <div key={fileWithPreview.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-6 w-6 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{fileWithPreview.file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(fileWithPreview.file.size / 1024 / 1024).toFixed(2)} MB • {fileWithPreview.file.type}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={
                        fileWithPreview.status === 'success' ? 'default' :
                        fileWithPreview.status === 'error' ? 'destructive' :
                        fileWithPreview.status === 'uploading' ? 'secondary' : 'outline'
                      }>
                        {fileWithPreview.status}
                      </Badge>
                      
                      {fileWithPreview.file.type.startsWith('image/') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewFile(fileWithPreview)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFile(fileWithPreview.id)}
                        disabled={fileWithPreview.status === 'uploading'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {fileWithPreview.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${fileWithPreview.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {fileWithPreview.error && (
                    <p className="text-sm text-red-600 mt-2">{fileWithPreview.error}</p>
                  )}
                </div>
              ))}
            </div>
            
            {files.length === 0 && (
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Drag files here or click to browse</p>
                <p className="text-sm text-gray-500 mt-1">PDF, JPG, PNG (max {Math.round(maxFileSize / 1024 / 1024)}MB each)</p>
              </div>
            )}
            
            {/* Action Buttons */}
            {files.length > 0 && (
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    setFiles([]);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={uploadAllFiles}
                  className="flex-1"
                  disabled={files.some(f => f.status === 'uploading')}
                >
                  Upload {files.length} file{files.length !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{previewFile.file.name}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={getFilePreviewURL(previewFile.file) || ''}
                alt={previewFile.file.name}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}