
import { Button } from '@/components/ui/button';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
}

export const FileList = ({ files, onRemove }: FileListProps) => {
  if (files.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium mb-2">Selected Files ({files.length})</h3>
      <ul className="space-y-2 max-h-40 overflow-y-auto">
        {files.map((file, index) => (
          <li 
            key={index} 
            className="flex items-center justify-between rounded bg-gray-50 p-2"
          >
            <span className="truncate text-sm">{file.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
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
  );
};
