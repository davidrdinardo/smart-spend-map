
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthProvider';
import { v4 as uuidv4 } from 'uuid';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  
  const processFiles = (files: FileList) => {
    // Filter only PDF and CSV files
    const validFiles = Array.from(files).filter(file => {
      const fileType = file.type.toLowerCase();
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      if (fileType === 'application/pdf' || fileType === 'text/csv' || fileType === 'text/tab-separated-values' || 
          fileExt === 'pdf' || fileExt === 'csv' || fileExt === 'tsv' || fileExt === 'txt') {
        return true;
      }
      
      toast({
        title: "Invalid file type",
        description: `${file.name} is not a supported file type. Please use PDF, CSV, TSV, or TXT files.`,
        variant: "destructive",
      });
      
      return false;
    });
    
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
      console.log(`Added ${validFiles.length} valid files for upload`);
      
      // Show a toast confirming files were added
      if (validFiles.length === 1) {
        toast({
          title: "File added",
          description: `${validFiles[0].name} is ready to upload.`,
        });
      } else {
        toast({
          title: "Files added",
          description: `${validFiles.length} files are ready to upload.`,
        });
      }
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };
  
  const validateCSVFormat = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV format",
          description: "File contains insufficient data. Please check your CSV file.",
          variant: "destructive",
        });
        return false;
      }
      
      console.log("CSV validation - first line:", lines[0]);
      
      // Check if the file contains essential data columns
      const firstLine = lines[0].toLowerCase();
      
      // Improved header detection for withdrawal/deposit format
      const hasWithdrawalDepositFormat = 
        (firstLine.includes('withdraw') && firstLine.includes('deposit')) || 
        (firstLine.includes('debit') && firstLine.includes('credit'));
      
      const hasStandardFormat = 
        firstLine.includes('date') && 
        (firstLine.includes('desc') || firstLine.includes('name') || firstLine.includes('transaction')) &&
        firstLine.includes('amount');
      
      if (!hasWithdrawalDepositFormat && !hasStandardFormat) {
        // Check if it has enough columns
        const fields = lines[0].split(/[,\t]/).filter(f => f.trim());
        if (fields.length < 3) {
          toast({
            title: "Invalid CSV format", 
            description: "File does not contain expected columns. Expected date, description, and either amount or withdrawal/deposit columns.",
            variant: "destructive",
          });
          return false;
        }
      }
      
      // Try to detect transaction pattern in at least one line
      let hasTransactionPattern = false;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        const commas = (line.match(/,/g) || []).length;
        const tabs = (line.match(/\t/g) || []).length;
        
        // Check if line has appropriate number of delimiters
        if (commas >= 2 || tabs >= 2) {
          hasTransactionPattern = true;
          break;
        }
      }
      
      if (!hasTransactionPattern) {
        toast({
          title: "CSV format warning",
          description: "File may not contain properly formatted transaction data. Processing will be attempted anyway.",
          variant: "warning",
        });
        // We return true anyway and let the backend try to process it
      }
      
      return true;
    } catch (error) {
      console.error("Error validating CSV:", error);
      toast({
        title: "Error validating file",
        description: "Could not read the file content. Please try another file.",
        variant: "destructive",
      });
      return false;
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
            file_path: filePath
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
        console.log(`Processing file ${uploadData.id} for user ${user.id}`);
        
        try {
          const { data, error: processError } = await supabase.functions.invoke('process-statement', {
            body: {
              fileId: uploadData.id,
              userId: user.id
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
        ? `Successfully imported ${totalTransactionsImported} transactions from ${uploads.length} file${uploads.length !== 1 ? 's' : ''}.`
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
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                isDragging 
                  ? 'border-income-dark bg-income-light/10' 
                  : 'border-gray-300 hover:border-income'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <svg 
                  className={`h-16 w-16 ${isDragging ? 'text-income-dark' : 'text-gray-400'}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                  />
                </svg>
                
                <div>
                  <p className="mb-2 text-lg font-semibold">
                    {isDragging ? 'Drop files here' : 'Drag & Drop Files Here'}
                  </p>
                  <p className="text-sm text-gray-500">or</p>
                  <Button 
                    variant="outline"
                    className="mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.csv,.tsv,.txt"
                    multiple
                    onChange={handleFileInputChange}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Supported formats: PDF, CSV, TSV, TXT
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    CSV format should have date, description, and either amount or withdrawal/deposit columns
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 space-y-6">
              <p className="text-center font-medium">{status || "Processing files..."}</p>
              <Progress value={uploadProgress} className="h-2 w-full" />
              
              {processingResult ? (
                <p className="text-center text-sm font-medium text-green-600">{processingResult}</p>
              ) : processingError ? (
                <p className="text-center text-sm font-medium text-red-600">{processingError}</p>
              ) : (
                <p className="text-center text-sm text-gray-500">
                  {uploadProgress < 100 
                    ? `Uploading and processing ${uploadedFiles.length} files...` 
                    : 'Finalizing transaction data...'}
                </p>
              )}
            </div>
          )}
          
          {/* File List */}
          {uploadedFiles.length > 0 && !isUploading && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Selected Files ({uploadedFiles.length})</h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <li 
                    key={index} 
                    className="flex items-center justify-between rounded bg-gray-50 p-2"
                  >
                    <span className="truncate text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 20 20" 
                        fill="currentColor" 
                        className="w-4 h-4"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
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
