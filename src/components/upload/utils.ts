import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// New function to validate file types
export const validateFileType = (file: File): boolean => {
  // Get MIME type and extension
  const fileType = file.type.toLowerCase();
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  // Valid MIME types and extensions
  const validMimeTypes = ['application/pdf', 'text/csv', 'text/tab-separated-values'];
  const validExtensions = ['pdf', 'csv', 'tsv', 'txt'];
  
  if (validMimeTypes.includes(fileType) || validExtensions.includes(fileExt || '')) {
    return true;
  }
  
  toast({
    title: "Unsupported file type",
    description: `${file.name} is not a supported file type. Please use PDF, CSV, TSV, or TXT files.`,
    variant: "destructive",
  });
  
  return false;
};

// Add CSV header validation function
export const validateCSVHeaders = async (file: File): Promise<boolean> => {
  try {
    // Check if the file is a CSV
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    if (!isCSV) {
      // Not a CSV, skip header validation (e.g., for PDF files)
      return true;
    }
    
    // Read only the first line of the file
    const chunk = await readFileChunk(file, 500); // Read just the first 500 bytes
    const firstLine = chunk.split('\n')[0];
    
    if (!firstLine || !firstLine.trim()) {
      toast({
        title: "Invalid CSV format",
        description: "The CSV file appears to be empty.",
        variant: "destructive",
      });
      return false;
    }
    
    // Convert headers to lowercase and remove spaces/underscores
    const headers = firstLine.toLowerCase().split(',').map(h => 
      h.trim().replace(/[_\s]/g, '')
    );
    
    console.log("CSV Headers found:", headers);
    
    // Define required column aliases
    const dateAliases = ['date', 'transactiondate', 'posteddate'];
    const descriptionAliases = ['description', 'memo', 'details'];
    const amountAliases = ['amount', 'value', 'transactionamount'];
    
    // Check if at least one alias for each required field is present
    const hasDateColumn = headers.some(header => dateAliases.includes(header));
    const hasDescriptionColumn = headers.some(header => descriptionAliases.includes(header));
    const hasAmountColumn = headers.some(header => amountAliases.includes(header));
    
    if (!hasDateColumn || !hasDescriptionColumn || !hasAmountColumn) {
      // Identify which required columns are missing
      const missingColumns = [];
      if (!hasDateColumn) missingColumns.push('date');
      if (!hasDescriptionColumn) missingColumns.push('description');
      if (!hasAmountColumn) missingColumns.push('amount');
      
      // Show warning toast with details
      toast({
        title: "⚠️ We couldn't find the required columns",
        description: `Your CSV must include:
        • date (date, transaction_date, posted_date)
        • description (description, memo, details)
        • amount (amount, value, transaction_amount)`,
        variant: "destructive",
      });
      
      // Show template download toast without using JSX
      toast({
        title: "Need a template?",
        description: "Click here to download a sample CSV template",
        action: {
          label: "Download Template",
          onClick: downloadCSVTemplate,
          className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs"
        },
        variant: "default",
      });
      
      return false;
    }

    // Optional: Check for delimiter issues (detect if semicolon or tab might be used)
    if (headers.length === 1 && firstLine.includes(';')) {
      toast({
        title: "Wrong delimiter detected",
        description: "Your CSV appears to use semicolons (;) instead of commas. Please convert to comma-separated format.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating CSV headers:", error);
    toast({
      title: "Error reading CSV",
      description: "Could not read the CSV file headers. Please check the file format.",
      variant: "destructive",
    });
    return false;
  }
};

// Helper to read just a chunk of a file
export const readFileChunk = (file: File, size: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    // Create a blob with just the beginning of the file
    const chunk = file.slice(0, size);
    
    reader.onload = (e) => {
      resolve(e.target?.result as string || '');
    };
    
    reader.onerror = (e) => {
      reject(new Error("Error reading file chunk"));
    };
    
    reader.readAsText(chunk);
  });
};

// Function to generate and download a CSV template
export const downloadCSVTemplate = () => {
  // Create sample CSV content
  const csvContent = `date,description,amount
2025-05-15,Grocery shopping,-82.47
2025-05-16,Salary deposit,1500.00
2025-05-17,Internet bill,-45.99`;

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'csv-template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast({
    title: "Template downloaded",
    description: "We've downloaded a sample CSV template for you to use.",
  });
};

export const validateCSVFormat = async (file: File): Promise<boolean> => {
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
        variant: "default",
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

export const ensureStorageBucketExists = async (): Promise<boolean> => {
  try {
    console.log("Checking storage bucket access...");
    
    // Check authentication first
    const { data: authData } = await supabase.auth.getSession();
    const isAuthenticated = !!authData.session?.user;
    
    if (!isAuthenticated) {
      console.error("User is not authenticated");
      toast({
        title: "Authentication Required",
        description: "Please log in to upload files.",
        variant: "destructive",
      });
      return false;
    }
    
    const userId = authData.session?.user?.id;
    console.log("User authenticated:", userId);
    
    // Check if we can access the bucket
    try {
      const { data: bucketData, error: bucketError } = await supabase
        .storage
        .getBucket('statements');
      
      if (bucketError) {
        console.error("Error accessing bucket:", bucketError);
        
        if (bucketError.message.includes("does not exist")) {
          toast({
            title: "Storage Setup Error",
            description: "The storage bucket doesn't exist. Please contact your administrator.",
            variant: "destructive",
          });
          return false;
        }
        
        if (bucketError.message.includes("permission") || bucketError.message.includes("not authorized")) {
          toast({
            title: "Permission Error",
            description: "You don't have permission to access the storage bucket. Please check your account permissions.",
            variant: "destructive",
          });
          return false;
        }
      }
      
      console.log("Storage bucket exists:", bucketData?.name);
      
      // Try a simple operation to verify we can use the bucket
      try {
        const testPath = `${userId}/test-permission.txt`;
        const { error: uploadError } = await supabase.storage
          .from('statements')
          .upload(testPath, new Blob(['test']), { upsert: true });
          
        if (uploadError) {
          console.error("Test upload failed:", uploadError);
          
          if (uploadError.message.includes("permission") || uploadError.message.includes("not authorized")) {
            toast({
              title: "Storage Permission Error",
              description: "You have insufficient permissions to upload files. Please contact your administrator.",
              variant: "destructive",
            });
            return false;
          }
          
          toast({
            title: "Upload Error",
            description: uploadError.message || "Could not verify upload permissions.",
            variant: "destructive",
          });
          return false;
        }
        
        // Clean up test file
        await supabase.storage.from('statements').remove([testPath]);
        console.log("Storage write permission confirmed");
        return true;
      } catch (testError) {
        console.error("Error during permission test:", testError);
        toast({
          title: "Permission Test Failed",
          description: "Could not verify storage permissions. Please try again later.",
          variant: "destructive",
        });
        return false;
      }
    } catch (storageError: any) {
      console.error("Storage access error:", storageError);
      toast({
        title: "Storage Access Error",
        description: storageError.message || "An unexpected error occurred while accessing storage.",
        variant: "destructive", 
      });
      return false;
    }
  } catch (error: any) {
    console.error("Critical storage check failed:", error);
    toast({
      title: "Storage Error",
      description: "Could not access storage. Please check that you're logged in and have proper permissions.",
      variant: "destructive", 
    });
    return false;
  }
};

export const processFiles = async (
  files: FileList, 
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>,
  setValidating?: React.Dispatch<React.SetStateAction<boolean>>
) => {
  // Set validating state if provided
  if (setValidating) setValidating(true);
  
  try {
    // Filter only supported file types
    const validFiles = Array.from(files).filter(file => validateFileType(file));
    
    if (validFiles.length === 0) {
      // No valid files were selected after filtering
      if (setValidating) setValidating(false);
      return;
    }
    
    // Validate CSV headers for all CSV files
    const validationPromises = validFiles.map(async file => {
      if (file.name.toLowerCase().endsWith('.csv')) {
        return await validateCSVHeaders(file);
      }
      return true; // Non-CSV files pass validation
    });
    
    const validationResults = await Promise.all(validationPromises);
    
    // Filter out files that failed validation
    const filesPassingValidation = validFiles.filter((_, index) => validationResults[index]);
    
    // Ensure storage bucket exists before proceeding
    const bucketExists = await ensureStorageBucketExists();
    
    if (!bucketExists) {
      toast({
        title: "Storage Error",
        description: "Could not access storage. Please make sure you're logged in and try again.",
        variant: "destructive",
      });
      if (setValidating) setValidating(false);
      return;
    }
    
    if (filesPassingValidation.length > 0) {
      setUploadedFiles(prev => [...prev, ...filesPassingValidation]);
      console.log(`Added ${filesPassingValidation.length} valid files for upload`);
      
      // Show a toast confirming files were added
      if (filesPassingValidation.length === 1) {
        toast({
          title: "File validated successfully",
          description: `${filesPassingValidation[0].name} is ready to upload.`,
        });
      } else {
        toast({
          title: "Files validated successfully",
          description: `${filesPassingValidation.length} files are ready to upload.`,
        });
      }
    }
  } catch (error) {
    console.error("Error processing files:", error);
    toast({
      title: "File processing error",
      description: "An unexpected error occurred while processing your files.",
      variant: "destructive",
    });
  } finally {
    if (setValidating) setValidating(false);
  }
};
