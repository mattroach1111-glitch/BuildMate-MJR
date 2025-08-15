import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

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
  showExpenseFields?: boolean;
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
  showExpenseFields = false,
}: ObjectUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [selectedJobAddress, setSelectedJobAddress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch jobs for address dropdown
  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: showExpenseFields,
  });

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
    
    // If expense fields are enabled, show dialog first
    if (showExpenseFields) {
      setPendingFiles(files);
      setShowExpenseDialog(true);
      return;
    }
    
    // Upload files directly
    await uploadFiles(files);
  };

  const uploadFiles = async (files: File[]) => {
    const results = await Promise.all(files.map(uploadFile));
    
    // Combine results and add expense data
    const combinedResult = {
      successful: results.flatMap(r => r.successful.map(f => ({
        ...f,
        expenseAmount: expenseAmount ? parseFloat(expenseAmount) : undefined,
        expenseAddress: selectedJobAddress || undefined,
      }))),
      failed: results.flatMap(r => r.failed)
    };
    
    onComplete?.(combinedResult);
  };

  const handleExpenseSubmit = () => {
    setShowExpenseDialog(false);
    uploadFiles(pendingFiles);
    setPendingFiles([]);
    setExpenseAmount("");
    setSelectedJobAddress("");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the actual drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
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
        className={`${buttonClassName} relative cursor-pointer transition-all duration-200 border-2 border-dashed ${
          isDragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
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

      {/* Simple Expense Dialog */}
      {showExpenseDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Expense Document Details</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="expense-amount">Amount ($)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="job-address">Job Address</Label>
                <Select value={selectedJobAddress} onValueChange={setSelectedJobAddress}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job address" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs?.map((job: any) => (
                      <SelectItem key={job.id} value={job.jobAddress}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          {job.jobAddress}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowExpenseDialog(false);
                  setPendingFiles([]);
                  setExpenseAmount("");
                  setSelectedJobAddress("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleExpenseSubmit} className="flex-1">
                Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}