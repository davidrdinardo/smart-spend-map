
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

interface UploadWidgetProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const UploadWidget = ({ onComplete, onCancel }: UploadWidgetProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
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
      
      if (fileType === 'application/pdf' || fileType === 'text/csv' || fileExt === 'pdf' || fileExt === 'csv') {
        return true;
      }
      
      toast({
        title: "Invalid file type",
        description: `${file.name} is not a PDF or CSV file.`,
        variant: "destructive",
      });
      
      return false;
    });
    
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
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
  
  const handleUpload = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select or drop files to upload.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 5) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setUploadProgress(progress);
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Upload complete",
      description: `${uploadedFiles.length} files have been processed successfully.`,
    });
    
    setIsUploading(false);
    onComplete();
  };
  
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Upload Statements</CardTitle>
          <CardDescription>
            Drag and drop your bank and credit card statements in PDF or CSV format.
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
                    accept=".pdf,.csv"
                    multiple
                    onChange={handleFileInputChange}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Only PDF and CSV files are accepted
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 space-y-6">
              <p className="text-center font-medium">Processing files...</p>
              <Progress value={uploadProgress} className="h-2 w-full" />
              <p className="text-center text-sm text-gray-500">
                {uploadProgress < 100 
                  ? `Uploading and processing ${uploadedFiles.length} files...` 
                  : 'Finalizing transaction data...'}
              </p>
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
            onClick={onCancel} 
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
