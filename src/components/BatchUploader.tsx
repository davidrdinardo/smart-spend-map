
import React, { useState, useEffect } from 'react';
import { DropZone } from '@/components/upload/DropZone';
import { FileList } from '@/components/upload/FileList';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isBefore, isAfter } from 'date-fns';
import { ProcessingStatus } from './upload/ProcessingStatus';
import { validateCSVFormat } from './upload/utils';

interface BatchUploaderProps {
  onComplete: () => void;
  onCancel: () => void;
  startDate?: Date;
  endDate?: Date;
}

export const BatchUploader: React.FC<BatchUploaderProps> = ({ 
  onComplete, 
  onCancel, 
  startDate = new Date(2025, 0, 1), // January 1st, 2025
  endDate = new Date() 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<{id: string, month: string}[]>([]);
  const [processingResult, setProcessingResult] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  const handleFileChange = (newFiles: File[]) => {
    setFiles(prevFiles => {
      // Filter out duplicates
      const existingNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newFiles.filter(file => !existingNames.has(file.name));
      
      return [...prevFiles, ...uniqueNewFiles];
    });
  };
  
  const detectMonthFromFile = (fileName: string): string => {
    // Extract date patterns like 2025-01, Jan 2025, January 2025, etc.
    const monthYearPattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\-_ ]?(?:20\d{2})|(?:20\d{2})[.\-_ ]?(?:0?[1-9]|1[0-2])/i;
    
    const match = fileName.match(monthYearPattern);
    
    if (match) {
      // Try to parse the detected date
      try {
        // If it's in the format "Month Year" or "Month-Year"
        const parts = match[0].split(/[.\-_ ]/);
        
        if (parts.length === 2) {
          let year, month;
          
          // Check which part is the year (4 digits)
          if (/^20\d{2}$/.test(parts[0])) {
            year = parts[0];
            month = parts[1];
          } else {
            year = parts[1];
            month = parts[0];
          }
          
          // Convert month name to month number if needed
          if (isNaN(Number(month))) {
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const monthIndex = monthNames.findIndex(m => month.toLowerCase().startsWith(m));
            if (monthIndex !== -1) {
              month = (monthIndex + 1).toString().padStart(2, '0');
            }
          } else {
            month = month.padStart(2, '0');
          }
          
          if (year && month) {
            return `${year}-${month}`;
          }
        }
      } catch (e) {
        console.error("Error parsing date from filename:", e);
      }
    }
    
    // Default to current month if can't detect
    return format(new Date(), 'yyyy-MM');
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
    setCurrentFileIndex(0);
    setUploadedFiles([]);
    setProcessingResult(null);
    setProcessingError(null);
    
    try {
      // Sort files by date (if possible)
      const sortedFiles = [...files].sort((a, b) => {
        const aMonth = detectMonthFromFile(a.name);
        const bMonth = detectMonthFromFile(b.name);
        return aMonth.localeCompare(bMonth);
      });
      
      // Upload each file
      for (let i = 0; i < sortedFiles.length; i++) {
        setCurrentFileIndex(i);
        setStatus(`Uploading file ${i+1} of ${sortedFiles.length}: ${sortedFiles[i].name}`);
        
        const file = sortedFiles[i];
        const detectedMonth = detectMonthFromFile(file.name);
        
        // Check if the detected month falls within the specified date range
        const fileDate = parseISO(`${detectedMonth}-01`); // Use the 1st of the month
        const isInRange = 
          (!startDate || !isAfter(startDate, fileDate)) && 
          (!endDate || !isBefore(endDate, fileDate));
        
        if (!isInRange) {
          console.log(`Skipping ${file.name} as it's outside the specified date range (${detectedMonth})`);
          continue;
        }
        
        // Validate CSV files before uploading
        if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.tsv')) {
          const isValid = await validateCSVFormat(file);
          if (!isValid) {
            console.log(`Skipping invalid CSV file: ${file.name}`);
            continue;
          }
        }
        
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${detectedMonth}/${uuidv4()}.${fileExt}`;
        
        console.log(`Uploading ${file.name} for month ${detectedMonth} to path ${filePath}`);
        
        // Upload the file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('statements')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError);
          toast({
            title: `Error uploading ${file.name}`,
            description: uploadError.message,
            variant: "destructive",
          });
          continue;
        }
        
        // Store metadata in the database
        const { data: insertData, error: insertError } = await supabase
          .from('uploads')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: filePath,
            processed: false,
            statement_month: detectedMonth
          })
          .select();
          
        if (insertError) {
          console.error(`Error recording metadata for ${file.name}:`, insertError);
          toast({
            title: `Error recording metadata for ${file.name}`,
            description: insertError.message,
            variant: "destructive",
          });
          continue;
        }
        
        if (insertData && insertData.length > 0) {
          setUploadedFiles(prev => [...prev, { id: insertData[0].id, month: detectedMonth }]);
        }
        
        // Update progress
        setUploadProgress(((i + 1) / sortedFiles.length) * 100);
      }
      
      if (uploadedFiles.length === 0) {
        toast({
          title: "No files uploaded",
          description: "No files were uploaded. Please check that your files meet the requirements.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      
      toast({
        title: "Upload complete!",
        description: `Successfully uploaded ${uploadedFiles.length} files.`,
      });
      
      // Start processing the uploaded files
      await processUploadedFiles();
      
    } catch (error: any) {
      console.error("Upload batch error:", error);
      setProcessingError(error.message || "An unexpected error occurred during upload");
      toast({
        title: "Upload failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      if (!processing) {
        setUploading(false);
      }
    }
  };
  
  const processUploadedFiles = async () => {
    if (uploadedFiles.length === 0) {
      setProcessingResult("No files were uploaded");
      return;
    }
    
    setProcessing(true);
    setStatus(`Processing ${uploadedFiles.length} uploaded files...`);
    
    try {
      // Process each file in sequence
      for (let i = 0; i < uploadedFiles.length; i++) {
        const fileInfo = uploadedFiles[i];
        setStatus(`Processing file ${i+1} of ${uploadedFiles.length} (${fileInfo.month})`);
        
        // Call the process-statement function
        const response = await fetch(
          `https://nefaagbbbvfgssxgacly.supabase.co/functions/v1/process-statement`, 
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              fileId: fileInfo.id,
              userId: user?.id,
              statementMonth: fileInfo.month
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error processing file ${fileInfo.id}:`, errorText);
          setProcessingError(`Error processing file ${i+1}: ${errorText}`);
          
          // Continue with next file despite error
          continue;
        }
        
        // Update progress
        setUploadProgress(((i + 1) / uploadedFiles.length) * 100);
      }
      
      setProcessingResult(`Successfully processed ${uploadedFiles.length} files`);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error: any) {
      console.error("Processing error:", error);
      setProcessingError(error.message || "An unexpected error occurred during processing");
      toast({
        title: "Processing failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setUploading(false);
    }
  };

  // Show a summary of months being uploaded
  const getMonthsSummary = () => {
    if (files.length === 0) return null;
    
    const months = files.map(file => detectMonthFromFile(file.name));
    const uniqueMonths = Array.from(new Set(months)).sort();
    
    return (
      <div className="mt-2 text-sm">
        <p className="text-gray-600">Statements will be uploaded for these months:</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {uniqueMonths.map(month => (
            <span 
              key={month} 
              className="px-2 py-1 bg-gray-100 rounded text-gray-700"
            >
              {month}
            </span>
          ))}
        </div>
      </div>
    );
  };
  
  if (uploading || processing) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
          <ProcessingStatus 
            status={status}
            uploadProgress={uploadProgress}
            processingResult={processingResult}
            processingError={processingError}
            uploadedFilesCount={files.length}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <Card>
          <CardHeader>
            <CardTitle>Batch Upload Bank Statements</CardTitle>
            <CardDescription>
              Upload multiple statements for January 2025 to present
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
                  handleFileChange(Array.from(e.dataTransfer.files));
                }
              }}
              onFileInputChange={(e) => {
                if (e.target.files?.length) {
                  handleFileChange(Array.from(e.target.files));
                }
              }}
            />
            <FileList files={files} onRemove={(index) => {
              const newFiles = [...files];
              newFiles.splice(index, 1);
              setFiles(newFiles);
            }} />
            {getMonthsSummary()}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              className="bg-income text-white hover:bg-income-dark"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
            >
              Upload {files.length} Files
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
