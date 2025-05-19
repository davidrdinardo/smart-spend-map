
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader } from 'lucide-react';

export interface DropZoneProps {
  isDragging: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isValidating?: boolean;
}

export const DropZone = ({
  isDragging,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileInputChange,
  isValidating = false
}: DropZoneProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div 
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragging 
          ? 'border-income-dark bg-income-light/10' 
          : isValidating
            ? 'border-blue-300 bg-blue-50/20'
            : 'border-gray-300 hover:border-income'
      }`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={isValidating ? e => e.preventDefault() : onDrop}
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        {isValidating ? (
          <Loader className="h-16 w-16 text-blue-500 animate-spin" />
        ) : (
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
        )}
        
        <div>
          {isValidating ? (
            <p className="mb-2 text-lg font-semibold text-blue-600">
              Checking file headers...
            </p>
          ) : (
            <>
              <p className="mb-2 text-lg font-semibold">
                {isDragging ? 'Drop files here' : 'Drag & Drop Files Here'}
              </p>
              <p className="text-sm text-gray-500">or</p>
              <Button 
                variant="outline"
                className="mt-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isValidating}
              >
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.csv,.tsv,.txt"
                multiple
                onChange={onFileInputChange}
                disabled={isValidating}
              />
              <p className="mt-2 text-xs text-gray-500">
                Supported formats: PDF, CSV, TSV, TXT
              </p>
              <p className="mt-1 text-xs text-gray-500">
                CSV format should have date, description, and either amount or withdrawal/deposit columns
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
