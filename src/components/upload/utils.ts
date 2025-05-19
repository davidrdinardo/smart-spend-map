
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
    console.log("Checking and ensuring storage bucket exists...");
    
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
    
    // Use a try/catch for each Supabase operation to provide better error handling
    try {
      // Create the statements bucket if it doesn't exist
      const bucketName = 'statements';
      
      // First check if bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error("Error checking storage buckets:", listError);
        
        if (listError.message.includes("timeout")) {
          toast({
            title: "Network Error",
            description: "Connection to storage timed out. Please check your network connection.",
            variant: "destructive",
          });
          return false;
        }
        
        if (listError.message.includes("permission") || listError.message.includes("not authorized")) {
          toast({
            title: "Permission Error",
            description: "You don't have permission to access storage. Please check your account permissions.",
            variant: "destructive",
          });
          return false;
        }
        
        throw listError;
      }
      
      // Check if the bucket exists
      const statementsBucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!statementsBucketExists) {
        console.log("Statements bucket not found. Creating it...");
        
        // Try to create the bucket with public access
        const { error: createError } = await supabase.storage.createBucket(bucketName, { 
          public: true,
          fileSizeLimit: 52428800, // 50MB limit
        });
        
        if (createError) {
          console.error("Error creating statements bucket:", createError);
          
          // Show more user-friendly error messages
          if (createError.message.includes("already exists")) {
            console.log("Bucket already exists despite not being in the list, continuing...");
            // Continue as if bucket exists
          } else if (createError.message.includes("permission") || createError.message.includes("not authorized")) {
            toast({
              title: "Storage Permission Error",
              description: "You don't have permission to create storage buckets. Please contact your administrator.",
              variant: "destructive",
            });
            return false;
          } else {
            toast({
              title: "Storage Setup Error",
              description: createError.message || "Could not create storage bucket.",
              variant: "destructive",
            });
            return false;
          }
        } else {
          console.log("Successfully created statements bucket");
        }
      } else {
        console.log("Statements bucket already exists");
      }
      
      // Get buckets again to confirm our bucket exists
      const { data: confirmedBuckets, error: confirmError } = await supabase.storage.listBuckets();
      
      if (confirmError) {
        console.error("Error confirming bucket existence:", confirmError);
      } else {
        const bucketExists = confirmedBuckets?.some(bucket => bucket.name === bucketName);
        console.log(`Bucket ${bucketName} existence confirmed:`, bucketExists);
        
        if (!bucketExists) {
          toast({
            title: "Storage Configuration Error",
            description: "Unable to access or create storage bucket. Please try again later.",
            variant: "destructive",
          });
          return false;
        }
      }
      
      // Try a simple operation to verify we can use the bucket
      try {
        const testPath = `${userId}/test-permission.txt`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
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
        } else {
          // Clean up test file
          await supabase.storage.from(bucketName).remove([testPath]);
          console.log("Storage write permission confirmed");
        }
      } catch (testError) {
        console.error("Error during permission test:", testError);
      }
      
      return true;
    } catch (storageError: any) {
      console.error("Storage setup error:", storageError);
      toast({
        title: "Storage Setup Error",
        description: storageError.message || "An unexpected error occurred while setting up storage.",
        variant: "destructive", 
      });
      return false;
    }
  } catch (error: any) {
    console.error("Critical storage bucket check failed:", error);
    toast({
      title: "Storage Error",
      description: "Could not access or create storage. Please check that you're logged in and have proper permissions.",
      variant: "destructive", 
    });
    return false;
  }
};

export const processFiles = async (
  files: FileList, 
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>,
) => {
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
  
  // Ensure storage bucket exists before proceeding
  const bucketExists = await ensureStorageBucketExists();
  
  if (!bucketExists) {
    toast({
      title: "Storage Error",
      description: "Could not access or create storage. Please check that you're logged in and have proper permissions.",
      variant: "destructive",
    });
    return;
  }
  
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
