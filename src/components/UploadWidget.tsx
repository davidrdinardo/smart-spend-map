
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthProvider';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

// Import refactored components
import { MonthSelector } from './upload/MonthSelector';
import { DropZone } from './upload/DropZone';
import { FileList } from './upload/FileList';
import { ProcessingStatus } from './upload/ProcessingStatus';
import { validateCSVFormat, processFiles } from './upload/utils';

interface UploadWidgetProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const UploadWidget = ({ onComplete, onCancel }: UploadWidgetProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>('');
  const [processingResult, setProcessingResult] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();
  const { user } = useAuth();
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, setUploadedFiles);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files, setUploadedFiles);
    }
  };
  
  const handleUpload = async () => {
    setProcessingError(null);
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload files.",
        variant: "destructive",
      });
      return;
    }
    
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select or drop files to upload.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedMonth) {
      toast({
        title: "Month not selected",
        description: "Please select the statement month and year.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    setProcessingResult(null);
    
    // Clear any existing timeout
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }
    
    // Set a timeout to show an error message if processing takes too long
    const timeout = setTimeout(() => {
      setProcessingError("Processing is taking longer than expected. Please check console logs for details.");
    }, 60000); // 60 seconds timeout
    
    setProcessingTimeout(timeout);
    
    try {
      // Create a storage bucket if it doesn't exist
      try {
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('bank_statements');
        
        if (bucketError && bucketError.message.includes('does not exist')) {
          const { error: createError } = await supabase.storage.createBucket('bank_statements', {
            public: false,
            fileSizeLimit: 10485760, // 10MB
          });
          
          if (createError) {
            throw new Error(`Error creating storage bucket: ${createError.message}`);
          }
          
          console.log("Created storage bucket 'bank_statements'");
          toast({
            title: "Storage bucket created",
            description: "Created storage for statement uploads.",
          });
        }
      } catch (bucketError: any) {
        console.error("Error checking bucket:", bucketError);
        toast({
          title: "Storage warning",
          description: `There was an issue with the storage bucket: ${bucketError.message}`,
          variant: "destructive",
        });
        // Continue even if there's an error checking/creating the bucket
      }
      
      const uploads = [];
      let progressIncrement = 90 / uploadedFiles.length;
      let totalTransactionsImported = 0;
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        setStatus(`Validating file ${i+1} of ${uploadedFiles.length}`);
        const file = uploadedFiles[i];
        
        // Log file details for debugging
        console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
        
        // Validate CSV files before uploading
        if (file.name.toLowerCase().endsWith('.csv')) {
          const isValid = await validateCSVFormat(file);
          if (!isValid) {
            setProcessingError(`File ${file.name} has invalid format. Upload canceled.`);
            setIsUploading(false);
            if (processingTimeout) clearTimeout(processingTimeout);
            return;
          }
        }
        
        setStatus(`Uploading file ${i+1} of ${uploadedFiles.length}`);
        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        // Upload to Supabase Storage
        setStatus(`Uploading ${file.name} to storage...`);
        const { error: uploadError } = await supabase.storage
          .from('bank_statements')
          .upload(filePath, file);
          
        if (uploadError) {
          throw new Error(`Error uploading ${file.name}: ${uploadError.message}`);
        }
        
        // Create record in uploads table
        setStatus(`Recording upload in database...`);
        const { data: uploadData, error: dbError } = await supabase
          .from('uploads')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: filePath,
            statement_month: selectedMonth // Store the selected month
          })
          .select()
          .single();
          
        if (dbError || !uploadData) {
          throw new Error(`Error recording upload: ${dbError?.message}`);
        }
        
        uploads.push(uploadData);
        
        // Update progress
        setUploadProgress((i + 1) * progressIncrement);
        
        // Process the file through our edge function
        setStatus(`Processing file ${file.name}...`);
        console.log(`Processing file ${uploadData.id} for user ${user.id} for month ${selectedMonth}`);
        
        try {
          const { data, error: processError } = await supabase.functions.invoke('process-statement', {
            body: {
              fileId: uploadData.id,
              userId: user.id,
              statementMonth: selectedMonth // Pass the selected month to the edge function
            }
          });
          
          if (processError) {
            console.error(`Error processing file: ${processError.message}`);
            toast({
              title: "Processing warning",
              description: `There was an issue processing ${file.name}. Some transactions may not be imported.`,
              variant: "destructive",
            });
            // Continue with other files even if processing fails for one
          } else {
            console.log("Processing response:", data);
            
            if (data?.details?.inserted_transactions) {
              totalTransactionsImported += data.details.inserted_transactions;
            }
            
            if (data?.details?.inserted_transactions === 0) {
              toast({
                title: "No transactions found",
                description: `No transactions were found in ${file.name}. Please check the file format.`,
                variant: "destructive",
              });
            } else {
              toast({
                title: "File processed",
                description: `${data?.message || "File processed successfully"}`,
              });
            }
          }
        } catch (funcError: any) {
          console.error(`Error calling function: ${funcError.message}`);
          toast({
            title: "Processing error",
            description: `Error processing ${file.name}: ${funcError.message}`,
            variant: "destructive",
          });
        }
      }
      
      setUploadProgress(100);
      setStatus(`Processing complete!`);
      
      const resultMessage = totalTransactionsImported > 0 
        ? `Successfully imported ${totalTransactionsImported} transactions from ${uploads.length} file${uploads.length !== 1 ? 's' : ''} for ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}.`
        : `Processed ${uploads.length} file${uploads.length !== 1 ? 's' : ''}, but no transactions were imported. Please check the file formats.`;
      
      setProcessingResult(resultMessage);
      
      // Clear the timeout as processing is complete
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        setProcessingTimeout(null);
      }
      
      // Wait a moment to show 100% progress
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Show final toast message
      if (totalTransactionsImported > 0) {
        toast({
          title: "Upload complete",
          description: resultMessage,
        });
        onComplete();
      } else {
        setIsUploading(false);
        toast({
          title: "No data imported",
          description: "No transactions were found in the uploaded files. Please check the file formats and try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      // Clear timeout if there's an error
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        setProcessingTimeout(null);
      }
      
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
      setProcessingResult(null);
      setProcessingError(`Error: ${error.message}`);
    }
  };
  
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // This function handles cancellation properly
  const handleCancel = () => {
    // Clear any running timeout
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      setProcessingTimeout(null);
    }
    
    // Reset state
    setIsUploading(false);
    setUploadedFiles([]);
    setProcessingResult(null);
    setProcessingError(null);
    setUploadProgress(0);
    setStatus('');
    
    // Call the parent's onCancel
    onCancel();
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Upload Statements</CardTitle>
          <CardDescription>
            Drag and drop your bank and credit card statements in PDF, CSV, TSV, or TXT format.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {!isUploading ? (
            <>
              <MonthSelector 
                selectedMonth={selectedMonth} 
                setSelectedMonth={setSelectedMonth} 
              />
              
              <DropZone
                isDragging={isDragging}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onFileInputChange={handleFileInputChange}
              />
            </>
          ) : (
            <ProcessingStatus
              status={status}
              uploadProgress={uploadProgress}
              processingResult={processingResult}
              processingError={processingError}
              uploadedFilesCount={uploadedFiles.length}
            />
          )}
          
          {/* File List */}
          {!isUploading && (
            <FileList 
              files={uploadedFiles} 
              onRemove={removeFile} 
            />
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleCancel} 
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button 
            className="bg-income hover:bg-income-dark"
            onClick={handleUpload} 
            disabled={uploadedFiles.length === 0 || isUploading}
          >
            {isUploading ? 'Processing...' : 'Upload & Process Files'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
