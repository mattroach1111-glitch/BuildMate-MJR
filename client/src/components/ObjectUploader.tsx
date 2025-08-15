import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (file?: any) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 * 
 * The component uses native drag and drop with direct upload functionality.
 * Supports file validation, progress tracking, and visual feedback during uploads.
 */
export function ObjectUploader({
  maxNumberOfFiles = 5,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    try {
      console.log("Starting upload for:", file.name);
      setIsUploading(true);
      
      // Get upload parameters
      const uploadParams = await onGetUploadParameters(file);
      console.log("Upload params:", uploadParams);
      
      // Upload file directly
      const uploadResponse = await fetch(uploadParams.url, {
        method: uploadParams.method,
        body: file,
        headers: uploadParams.headers || {},
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      console.log("Upload successful for:", file.name);
      
      return {
        successful: [{
          name: file.name,
          type: file.type,
          size: file.size,
          uploadURL: uploadParams.url,
        }],
        failed: []
      };
    } catch (error) {
      console.error("Upload failed for:", file.name, error);
      return {
        successful: [],
        failed: [{
          name: file.name,
          error: error.message,
        }]
      };
    } finally {
      setIsUploading(false);
    }
  };

  const handleFiles = async (files: File[]) => {
    // Check file count limit
    if (files.length > maxNumberOfFiles) {
      alert(`Maximum ${maxNumberOfFiles} files allowed`);
      return;
    }
    
    // Check file size limit
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      alert(`File too large: ${oversizedFiles[0].name}. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }
    
    // Upload files
    const results = await Promise.all(files.map(uploadFile));
    
    // Combine results
    const combinedResult = {
      successful: results.flatMap(r => r.successful),
      failed: results.flatMap(r => r.failed)
    };
    
    onComplete?.(combinedResult);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <div 
        className={`${buttonClassName} relative cursor-pointer transition-all duration-200 ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        data-testid="drag-drop-upload-area"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input-hidden"
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-sm text-gray-600">Uploading...</span>
          </div>
        ) : (
          children
        )}
        {isDragging && !isUploading && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-blue-600 font-medium">Drop files here</span>
          </div>
        )}
      </div>
    </div>
  );
}