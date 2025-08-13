import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import DragDrop from "@uppy/drag-drop";
import "@uppy/drag-drop/dist/style.min.css";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface DocumentUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  getUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
    fields?: Record<string, never>;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children?: ReactNode;
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
  getUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: DocumentUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', 'image/*', 'application/pdf'],
      },
      autoProceed: false,
      allowMultipleUploads: true,
      debug: true,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: getUploadParameters,
      })
      .on("upload", () => {
        console.log("🔵 Uppy: Upload started");
      })
      .on("upload-progress", (file, progress) => {
        console.log("🔵 Uppy: Upload progress:", file?.name, progress);
      })
      .on("upload-success", (file, response) => {
        console.log("🟢 Uppy: Upload success:", file?.name, response);
      })
      .on("upload-error", (file, error) => {
        console.error("🔴 Uppy: Upload error:", file?.name, error);
      })
      .on("complete", (result) => {
        console.log("🟢 Uppy: Upload complete:", result);
        onComplete?.(result);
      })

  );

  // Add global drag event listeners for better drag feedback
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragActive(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only set to false if we're leaving the window
      if (!e.relatedTarget) {
        setIsDragActive(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <div 
      className="relative"
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        // Only hide if leaving the component area
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragActive(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragActive(false);
        
        // Handle file drop
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          // Clear existing files first to avoid duplicates
          uppy.getFiles().forEach(file => uppy.removeFile(file.id));
          
          // Add files to Uppy and open modal
          files.forEach(file => {
            uppy.addFile({
              source: 'drag-drop',
              name: file.name,
              type: file.type,
              data: file,
            });
          });
          setShowModal(true);
        }
      }}
    >
      <Button 
        onClick={() => setShowModal(true)} 
        className={`
          ${buttonClassName} 
          ${isDragActive ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50 border-blue-300' : ''}
          transition-all duration-200 w-full min-h-[60px]
        `}
      >
        {children || (
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Choose Files or Drag & Drop
          </div>
        )}
      </Button>

      {isDragActive && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-md flex items-center justify-center pointer-events-none z-10">
          <div className="text-blue-600 font-medium text-sm">
            Drop files here to upload
          </div>
        </div>
      )}

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
        note="Upload bills, invoices, and expense documents (PDF, JPG, PNG). AI will convert PDFs automatically. Drag and drop files or click to browse. Maximum 25MB per file."
        showProgressDetails={true}
        hideProgressAfterFinish={false}
      />
    </div>
  );
}