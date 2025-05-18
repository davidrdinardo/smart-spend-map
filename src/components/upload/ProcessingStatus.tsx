
import { Progress } from '@/components/ui/progress';

interface ProcessingStatusProps {
  status: string;
  uploadProgress: number;
  processingResult: string | null;
  processingError: string | null;
  uploadedFilesCount: number;
}

export const ProcessingStatus = ({ 
  status, 
  uploadProgress, 
  processingResult, 
  processingError,
  uploadedFilesCount
}: ProcessingStatusProps) => {
  return (
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
            ? `Uploading and processing ${uploadedFilesCount} files...` 
            : 'Finalizing transaction data...'}
        </p>
      )}
    </div>
  );
};
