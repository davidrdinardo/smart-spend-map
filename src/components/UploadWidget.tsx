import React, { useState } from 'react';
import { DropZone } from '@/components/upload/DropZone';
import { FileList } from '@/components/upload/FileList';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth'; // Updated import path
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

interface UploadWidgetProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const UploadWidget: React.FC<UploadWidgetProps> = ({ onComplete, onCancel }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const handleFileChange = (newFiles: File[]) => {
    setFiles(newFiles);
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
    
    try {
      // Upload each file
      await Promise.all(
        files.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const filePath = `${user.id}/${format(new Date(), 'yyyy-MM')}/${uuidv4()}.${fileExt}`;
          
          console.log("Uploading file:", file.name, "to path:", filePath);
          
          const { error: uploadError } = await supabase.storage
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
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              upload_date: new Date().toISOString(),
              month_key: format(new Date(), 'yyyy-MM')
            });
            
          if (dbError) {
            console.error("Database insert error:", file.name, dbError);
            throw dbError;
          }
        })
      );
      
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
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
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
            <DropZone onFileChange={handleFileChange} />
            <FileList files={files} onFileChange={handleFileChange} />
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
