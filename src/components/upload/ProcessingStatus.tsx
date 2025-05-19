
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, RotateCw } from 'lucide-react';

interface ProcessingStatusProps {
  status: string;
  uploadProgress: number;
  processingResult: string | null;
  processingError: string | null;
  uploadedFilesCount: number;
  processingDetails?: {
    total_parsed?: number;
    skipped_rows?: number;
    inserted_transactions?: number;
  } | null;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  uploadProgress,
  processingResult,
  processingError,
  uploadedFilesCount,
  processingDetails
}) => {
  return (
    <div className="mt-4">
      <div className="flex flex-col space-y-4">
        <div className="text-center">
          {processingResult ? (
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
          ) : processingError ? (
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
          ) : (
            <RotateCw className="h-10 w-10 text-blue-500 mx-auto mb-2 animate-spin" />
          )}
          
          <div className="font-semibold text-lg mb-2">
            {processingResult ? 'Processing Complete' : 
             processingError ? 'Error' :  
             'Processing Files'}
          </div>
          
          <div className="text-gray-600 mb-4">
            {processingError ? processingError :
             processingResult ? processingResult : 
             status}
          </div>
          
          {!processingResult && !processingError && (
            <Progress value={uploadProgress} className="h-2 mb-2" />
          )}
          
          <div className="text-sm text-gray-500">
            {!processingResult && !processingError && (
              <>
                {uploadProgress < 100 ? (
                  `Uploading ${uploadedFilesCount} ${uploadedFilesCount === 1 ? 'file' : 'files'}...`
                ) : (
                  'Processing transactions...'
                )}
              </>
            )}
          </div>
          
          {processingDetails && (
            <div className="mt-4 bg-gray-50 p-3 rounded-md text-sm">
              <h4 className="font-semibold mb-1">Processing Results</h4>
              <ul className="space-y-1 text-left">
                {processingDetails.total_parsed !== undefined && (
                  <li>Transactions found: {processingDetails.total_parsed}</li>
                )}
                {processingDetails.inserted_transactions !== undefined && (
                  <li>Successfully imported: {processingDetails.inserted_transactions}</li>
                )}
                {processingDetails.skipped_rows ? (
                  <li>Skipped: {processingDetails.skipped_rows} (duplicates or invalid data)</li>
                ) : null}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
