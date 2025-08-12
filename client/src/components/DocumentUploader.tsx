import { useState } from "react";
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

interface DocumentUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (file: any) => Promise<{
    method: "PUT";
    url: string;
    fields?: Record<string, never>;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
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
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', 'image/*', 'application/pdf'],
      },
      autoProceed: false,
      allowMultipleUploads: true,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
      .on("complete", (result) => {
        onComplete?.(result);
      })
  );

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
        note="Upload bills, invoices, and expense documents (PDF, JPG, PNG). Drag and drop files or click to browse. Maximum 25MB per file."
        showProgressDetails={true}
        hideProgressAfterFinish={false}
      />
    </div>
  );
}