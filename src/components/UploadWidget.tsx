
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

interface UploadWidgetProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const UploadWidget: React.FC<UploadWidgetProps> = ({ onComplete, onCancel }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const handleFileChange = (newFiles: File[]) => {
    setFiles(newFiles);
  };
  
  // Initial check to make sure bucket exists
  useEffect(() => {
    ensureStorageBucketExists()
      .then(exists => {
        if (!exists) {
          console.error("Storage bucket could not be created or accessed");
        }
      });
  }, []);
  
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
    
    try {
      // Ensure bucket exists
      const bucketExists = await ensureStorageBucketExists();
      
      if (!bucketExists) {
        throw new Error("Storage bucket could not be created or accessed");
      }
      
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatus(`Uploading ${i+1}/${files.length}: ${file.name}`);
        
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${format(new Date(), 'yyyy-MM')}/${uuidv4()}.${fileExt}`;
        
        console.log("Uploading file:", file.name, "to path:", filePath);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('statements')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error("File upload error:", file.name, uploadError);
          throw uploadError;
        }
        
        // Store upload metadata in the database
        const { error: dbError } = await supabase
          .from('uploads')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: filePath,
            processed: false,
            uploaded_at: new Date().toISOString(),
            statement_month: format(new Date(), 'yyyy-MM')
          });
          
        if (dbError) {
          console.error("Database insert error:", file.name, dbError);
          throw dbError;
        }
      }
      
      console.log("All files uploaded successfully");
      
      toast({
        title: "Upload successful!",
        description: "Your files have been uploaded and are being processed.",
      });
      
      // Clear the files
      setFiles([]);
      
      // Notify completion
      onComplete();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div
        className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white"
      >
        <Card>
          <CardHeader>
            <CardTitle>Upload Bank Statements</CardTitle>
            <CardDescription>
              Upload your bank statements to automatically extract transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            {uploadStatus && (
              <div className="mt-4 text-sm text-gray-600">
                {uploadStatus}
              </div>
            )}
            <FileList files={files} onRemove={(index) => {
              const newFiles = [...files];
              newFiles.splice(index, 1);
              setFiles(newFiles);
            }} />
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
