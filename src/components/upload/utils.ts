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
    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error checking storage buckets:", bucketsError);
      throw bucketsError;
    }
    
    const statementsBucketExists = buckets?.some(bucket => bucket.name === 'statements');
    
    // If bucket doesn't exist, create it
    if (!statementsBucketExists) {
      console.log("Statements bucket not found. Attempting to create it...");
      
      // Try to create the bucket with public access
      const { data: newBucket, error: createError } = await supabase.storage
        .createBucket('statements', { 
          public: true,  // Make bucket public
          fileSizeLimit: 52428800 // 50MB limit
        });
      
      if (createError) {
        console.error("Error creating statements bucket:", createError);
        
        // Show more detailed error message
        if (createError.message.includes("row-level security")) {
          toast({
            title: "Storage Permission Error",
            description: "You don't have permission to create storage buckets. Please check your Supabase RLS policies.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Storage Error",
            description: createError.message || "Could not create storage bucket. Please contact support.",
            variant: "destructive",
          });
        }
        return false;
      }
      
      console.log("Created statements bucket successfully:", newBucket);
      
      // Set up RLS policies for the bucket (this may require admin access)
      try {
        // Make our bucket publicly readable but only authenticated users can write
        await (supabase.rpc as any)('set_bucket_public_policy', {
          bucket_name: 'statements'
        }).then(({ error: policyError }: { error: any }) => {
          if (policyError) {
            console.error("Error setting bucket policy:", policyError);
          }
        });
      } catch (policyErr) {
        console.error("Failed to set bucket policy:", policyErr);
        // Continue anyway, user may need to set policies manually
      }
    } else {
      console.log("Statements bucket already exists");
    }
    
    return true;
  } catch (error: any) {
    console.error("Storage bucket check failed:", error);
    toast({
      title: "Storage Setup Error",
      description: "Please ensure you're logged in and have proper permissions. Error: " + (error.message || "Unknown error"),
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
