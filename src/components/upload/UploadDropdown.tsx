
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UploadIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; 

interface UploadDropdownProps {
  onSingleUpload: () => void;
}

export const UploadDropdown: React.FC<UploadDropdownProps> = ({
  onSingleUpload,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
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

  const handleSingleUpload = () => {
    console.log("Triggering single upload");
    
    // Check if user is logged in
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to upload statements.",
        variant: "destructive",
      });
      return;
    }
    
    setIsOpen(false);
    onSingleUpload();
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-income hover:bg-income-dark"
      >
        <UploadIcon className="mr-2 h-4 w-4" />
        Upload Statements
      </Button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu">
            <button
              onClick={handleSingleUpload}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Upload Statement
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
