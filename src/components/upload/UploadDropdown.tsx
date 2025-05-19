
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface UploadDropdownProps {
  onSingleUpload: () => void;
  onBatchUpload: () => void;
}

export const UploadDropdown: React.FC<UploadDropdownProps> = ({
  onSingleUpload,
  onBatchUpload
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-income hover:bg-income-dark"
      >
        Upload Statements
      </Button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu">
            <button
              onClick={() => {
                setIsOpen(false);
                onSingleUpload();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Upload Single Statement
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onBatchUpload();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Batch Upload (Jan 2025 - Now)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
