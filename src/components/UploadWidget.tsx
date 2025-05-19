
import React, { useState, useEffect } from 'react';
import { DropZone } from '@/components/upload/DropZone';
import { FileList } from '@/components/upload/FileList';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth'; 
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { processFiles, ensureStorageBucketExists } from './upload/utils';
import { ProcessingStatus } from './upload/ProcessingStatus';
import { MonthSelector } from './upload/MonthSelector';
import { useNavigate } from 'react-router-dom';

interface UploadWidgetProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const UploadWidget: React.FC<UploadWidgetProps> = ({ onComplete, onCancel }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingResult, setProcessingResult] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingDetails, setProcessingDetails] = useState<{
    total_parsed?: number;
    skipped_rows?: number;
    inserted_transactions?: number;
  } | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Added selected month state with default to current month
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  
  const handleFileChange = (newFiles: File[]) => {
    setFiles(newFiles);
  };
  
  // Initial check to make sure bucket exists
  useEffect(() => {
    async function checkBucket() {
      const exists = await ensureStorageBucketExists();
      if (!exists) {
        console.error("Storage bucket could not be accessed");
        toast({
          title: "Storage Setup",
          description: "Storage access issues detected. Please make sure you're signed in.",
          variant: "default",
        });
      } else {
        console.log("Storage bucket access confirmed");
      }
    }
    
    if (user) {
      checkBucket();
    }
  }, [user, toast]);
  
  const triggerProcessing = async (uploadId: string) => {
    if (!user) return;
    
    try {
      setUploadStatus('Processing your file...');
      
      // Fix: Construct proper URL for the Supabase Edge Function
      const url = 'https://nefaagbbbvfgssxgacly.supabase.co/functions/v1/process-statement';
      
      // Get the access token
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token || '';
      
      console.log("Calling process-statement function with URL:", url);
      
      // Call the Supabase Edge Function to process the statements
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          fileId: uploadId,
          userId: user.id,
          statementMonth: selectedMonth // Pass selected month
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Processing error: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("Processing result:", result);
      
      if (result.success) {
        setProcessingResult(result.message);
        setProcessingDetails(result.details || null);
        
        // Wait a moment before showing success message
        setTimeout(() => {
          // Show appropriate toast based on result
          if (result.details?.inserted_transactions === 0) {
            toast({
              title: "No transactions found",
              description: "We couldn't find any transactions in that file.",
              variant: "default",
            });
          } else {
            const skippedMessage = result.details?.skipped_rows > 0 
              ? ` (${result.details.skipped_rows} rows skipped due to missing data or duplicates)`
              : '';
              
            toast({
              title: "Statement processed successfully",
              description: `${result.details?.inserted_transactions || 0} transactions imported${skippedMessage}`,
              variant: "default",
            });
          }

          // Complete and redirect to dashboard
          onComplete();
          navigate('/dashboard');
        }, 1500);
      } else {
        throw new Error(result.error || "Unknown processing error");
      }
    } catch (error: any) {
      console.error("Error processing file:", error);
      setProcessingError(error.message || "Failed to process file");
      
      toast({
        title: "Processing failed",
        description: error.message || "An error occurred while processing your file",
        variant: "destructive",
      });
    }
  };
  
  const handleUpload = async () => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to upload files.",
        variant: "destructive",
      });
      return;
    }
    
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload.",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    setProcessingResult(null);
    setProcessingError(null);
    setProcessingDetails(null);
    
    try {
      // Ensure bucket exists
      const bucketExists = await ensureStorageBucketExists();
      
      if (!bucketExists) {
        throw new Error("Storage bucket could not be accessed. Please check your permissions and try again.");
      }
      
      // Upload each file
      let uploadedFileIds = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatus(`Uploading ${i+1}/${files.length}: ${file.name}`);
        
        // Update progress for this file
        const progressPerFile = 100 / files.length;
        setUploadProgress(Math.min(100, progressPerFile * i));
        
        const fileExt = file.name.split('.').pop();
        // Use selected month for file path organization
        const filePath = `${user.id}/${selectedMonth}/${uuidv4()}.${fileExt}`;
        
        console.log("Uploading file:", file.name, "to path:", filePath, "for month:", selectedMonth);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('statements')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error("File upload error:", file.name, uploadError);
          
          if (uploadError.message.includes("permission") || uploadError.message.includes("unauthorized")) {
            throw new Error(`Permission denied: You don't have rights to upload to this storage bucket.`);
          }
          
          throw uploadError;
        }
        
        // Store upload metadata in the database
        const { data, error: dbError } = await supabase
          .from('uploads')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: filePath,
            processed: false,
            uploaded_at: new Date().toISOString(),
            statement_month: selectedMonth // Use selected month
          })
          .select('id');
          
        if (dbError) {
          console.error("Database insert error:", file.name, dbError);
          
          // Try to delete the uploaded file if database insert fails
          await supabase.storage.from('statements').remove([filePath]);
          
          throw dbError;
        }
        
        // Store the upload ID for processing
        if (data && data.length > 0) {
          uploadedFileIds.push(data[0].id);
        }
      }
      
      console.log("All files uploaded successfully");
      setUploadProgress(100);
      
      toast({
        title: "Upload successful!",
        description: "Your files have been uploaded and are being processed.",
      });
      
      // Process files one by one
      for (const uploadId of uploadedFileIds) {
        await triggerProcessing(uploadId);
      }
      
      // Clear the files
      setFiles([]);
      
    } catch (error: any) {
      console.error("Upload error:", error);
      setProcessingError(error.message || "An unexpected error occurred during upload");
      toast({
        title: "Upload failed",
        description: error.message || "An unexpected error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div
        className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white"
      >
        <Card>
          <CardHeader>
            <CardTitle>Upload Bank Statement</CardTitle>
            <CardDescription>
              Upload your bank statement to automatically extract transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!uploading ? (
              <>
                {/* Added MonthSelector with full 2025 year option */}
                <MonthSelector 
                  selectedMonth={selectedMonth} 
                  setSelectedMonth={setSelectedMonth}
                  year={2025}
                  showFullYear={true}
                />
                <DropZone
                  isDragging={false}
                  onDragEnter={(e) => e.preventDefault()}
                  onDragLeave={(e) => e.preventDefault()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length > 0) {
                      processFiles(e.dataTransfer.files, setFiles);
                    }
                  }}
                  onFileInputChange={(e) => {
                    if (e.target.files?.length) {
                      processFiles(e.target.files, setFiles);
                    }
                  }}
                />
                <FileList files={files} onRemove={(index) => {
                  const newFiles = [...files];
                  newFiles.splice(index, 1);
                  setFiles(newFiles);
                }} />
              </>
            ) : (
              <ProcessingStatus 
                status={uploadStatus}
                uploadProgress={uploadProgress}
                processingResult={processingResult}
                processingError={processingError}
                uploadedFilesCount={files.length}
                processingDetails={processingDetails}
              />
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              onClick={onCancel}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-income text-white rounded hover:bg-income-dark"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
