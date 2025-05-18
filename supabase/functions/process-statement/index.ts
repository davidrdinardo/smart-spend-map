import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define common expense categories for classification
const categories = {
  housing: ["rent", "mortgage", "property", "home", "hoa", "apartment"],
  utilities: ["electric", "water", "gas", "internet", "wifi", "phone", "utility", "utilities"],
  groceries: ["grocery", "supermarket", "food", "market", "safeway", "kroger", "trader", "whole foods", "aldi", "walmart"],
  diningOut: ["restaurant", "cafe", "coffee", "starbucks", "mcdonalds", "dining", "pizza", "burger", "takeout", "ubereats", "doordash", "grubhub"],
  transportation: ["gas", "fuel", "uber", "lyft", "taxi", "transit", "train", "subway", "bus", "car", "auto", "vehicle", "insurance"],
  healthcare: ["doctor", "hospital", "medical", "dental", "pharmacy", "health", "insurance"],
  entertainment: ["movie", "netflix", "spotify", "hbo", "amazon prime", "disney", "hulu", "theater", "concert"],
  shopping: ["amazon", "target", "clothing", "department", "store", "retail", "online"],
  subscriptions: ["subscription", "membership", "monthly"],
  personal: ["haircut", "salon", "spa", "gym", "fitness"],
  education: ["tuition", "school", "course", "book", "university", "college"],
  travel: ["hotel", "flight", "airline", "airbnb", "vacation"],
  income: ["payroll", "deposit", "salary", "income", "payment received", "venmo received", "zelle received", "transfer received"]
};

// Function to categorize a transaction based on its description
function categorizeTransaction(description: string, amount: number): string {
  description = description.toLowerCase();
  
  // Check for income first
  if (amount >= 0 || categories.income.some(keyword => description.includes(keyword))) {
    return "Income";
  }
  
  // Check expense categories
  for (const [category, keywords] of Object.entries(categories)) {
    if (category === 'income') continue;
    if (keywords.some(keyword => description.includes(keyword))) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  
  // Default category
  return "Other";
}

// Improved function to properly parse CSV lines
function parseCSVLine(line: string): string[] {
  const result = [];
  let currentValue = '';
  let inQuotes = false;
  
  try {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Push the last value
    result.push(currentValue);
    return result;
  } catch (error) {
    console.error("Error parsing CSV line:", error, "Line:", line);
    return [];
  }
}

// Improved function to parse dates from various formats
function parseDate(dateStr: string): string {
  try {
    // Clean up the date string - remove any non-alphanumeric characters except /-
    const cleanedDate = dateStr.replace(/[^\w\/-]/g, '').trim();
    
    // Try to detect different date formats
    let match;
    let year, month, day;
    
    // Format: MM/DD/YYYY or MM-DD-YYYY
    if ((match = cleanedDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/))) {
      month = match[1].padStart(2, '0');
      day = match[2].padStart(2, '0');
      year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${month}-${day}`;
    }
    
    // Format: YYYY/MM/DD or YYYY-MM-DD
    if ((match = cleanedDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/))) {
      year = match[1];
      month = match[2].padStart(2, '0');
      day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // If no format is recognized, default to current date
    const now = new Date();
    year = now.getFullYear().toString();
    month = (now.getMonth() + 1).toString().padStart(2, '0');
    day = now.getDate().toString().padStart(2, '0');
    
    console.log(`Could not parse date "${dateStr}", using current date: ${year}-${month}-${day}`);
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error(`Error parsing date "${dateStr}":`, e);
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }
}

// Function to safely parse amount strings
function parseAmount(amountStr: string): number | null {
  try {
    // Remove currency symbols, commas, parentheses (for negative numbers), and leading/trailing whitespace
    let cleaned = amountStr.replace(/[$,\s]/g, '');
    
    // Check for parentheses (indicating negative number in accounting)
    let multiplier = 1;
    if (cleaned.match(/^\(.*\)$/)) {
      cleaned = cleaned.replace(/[()]/g, '');
      multiplier = -1;
    }
    
    // Check if string contains any non-allowed characters
    if (!/^-?\d*\.?\d*$/.test(cleaned)) {
      return null;
    }
    
    // Parse to float and apply multiplier
    const amount = parseFloat(cleaned) * multiplier;
    
    if (isNaN(amount)) {
      return null;
    }
    
    return amount;
  } catch (error) {
    console.error("Error parsing amount:", error, "Amount string:", amountStr);
    return null;
  }
}

// Simple check to see if a line might contain transaction data
function looksLikeTransactionLine(line: string): boolean {
  // Check if the line has at least two commas or tabs (meaning at least 3 fields)
  if ((line.match(/,/g) || []).length >= 2 || (line.match(/\t/g) || []).length >= 2) {
    // And contains either a date-like pattern or a currency-like pattern
    return /\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(line) || /\$?\d+\.\d{2}/.test(line);
  }
  return false;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Create a Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse the request
    const { fileId, userId } = await req.json();
    console.log("Processing file", { fileId, userId });
    
    if (!fileId || !userId) {
      console.error("Missing required parameters");
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get the file data from the uploads table
    const { data: uploadData, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();
      
    if (uploadError || !uploadData) {
      console.error("File not found", uploadError);
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Found upload record", { filename: uploadData.filename });
    
    // Get the file from storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('bank_statements')
      .download(uploadData.file_path);
      
    if (fileError || !fileData) {
      console.error("Error downloading file", fileError);
      return new Response(
        JSON.stringify({ error: "Error downloading file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("File downloaded successfully");
    
    // Process the file based on type
    const transactions = [];
    const fileExt = uploadData.filename.toLowerCase().split('.').pop();
    const isCSV = fileExt === 'csv';
    const isTSV = fileExt === 'tsv';
    const isPDF = fileExt === 'pdf';
    
    // Get file content as text
    let text;
    try {
      text = await fileData.text();
      console.log(`File type: ${fileExt}, size: ${text.length} bytes`);
    } catch (error) {
      console.error("Error reading file:", error);
      return new Response(
        JSON.stringify({ error: "Error reading file: " + error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Simple detection of delimiter
    const delimiter = isTSV ? '\t' : ',';
    
    // Sample data for manual review in logs
    const sampleLines = text.split('\n').slice(0, 10).join('\n');
    console.log(`Sample data (first 10 lines):\n${sampleLines}`);
    
    // Split the file into lines
    const lines = text.split('\n');
    console.log(`Processing ${lines.length} lines from ${isCSV ? "CSV" : isPDF ? "PDF" : "text"} file`);
    
    let validTransactionsCount = 0;
    let skippedLinesCount = 0;
    
    // We'll use a more flexible approach - try to detect transaction data in each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Skip lines that don't look like they might contain transaction data
      if (!looksLikeTransactionLine(line)) {
        skippedLinesCount++;
        continue;
      }
      
      let date, description, amountStr;
      let fields = [];
      
      if (isCSV || isTSV) {
        // Handle delimiter-separated values
        if (line.includes('"')) {
          // Use special parsing for lines with quoted fields
          fields = parseCSVLine(line);
        } else {
          // Simple split for unquoted fields
          fields = line.split(delimiter);
        }
      } else {
        // For PDFs and other formats, try common patterns
        // First check if there are comma or tab separated values
        if (line.includes(',')) {
          fields = line.split(',');
        } else if (line.includes('\t')) {
          fields = line.split('\t');
        } else {
          // Otherwise try to extract values using regex patterns
          // This is a simplified approach - real implementation would need more patterns
          const datePattern = /\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/;
          const amountPattern = /[-+]?\$?\s*\d+(?:[,\.]\d+)?(?:\.\d+)?/;
          
          const dateMatch = line.match(datePattern);
          date = dateMatch ? dateMatch[0] : null;
          
          const amountMatch = line.match(amountPattern);
          amountStr = amountMatch ? amountMatch[0] : null;
          
          // Description is everything that's not date or amount
          if (date && amountStr) {
            description = line
              .replace(datePattern, '')
              .replace(amountPattern, '')
              .trim();
          }
        }
      }
      
      // Try to extract data from fields if available
      if (fields.length >= 3) {
        // Attempt to identify which fields are date, description, and amount
        // This is a simplified approach - would need more sophisticated logic for real app
        
        // Look for date-like pattern in fields
        for (let j = 0; j < Math.min(fields.length, 3); j++) {
          if (/\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(fields[j])) {
            date = fields[j].trim();
            // Assume next field is description
            description = fields[j + 1]?.trim() || '';
            // Assume amount is one of the next fields
            for (let k = j + 1; k < fields.length; k++) {
              const potentialAmount = parseAmount(fields[k]);
              if (potentialAmount !== null) {
                amountStr = fields[k].trim();
                // If description wasn't set yet, use everything between date and amount
                if (!description && k > j + 1) {
                  description = fields.slice(j + 1, k).join(' ').trim();
                }
                break;
              }
            }
            break;
          }
        }
        
        // If date not found yet, check if first field might be date
        if (!date && fields.length > 0) {
          const firstField = fields[0].trim();
          if (/\d/.test(firstField)) {  // Contains at least some digits
            date = firstField;
            description = fields[1]?.trim() || '';
            amountStr = fields[2]?.trim() || '';
          }
        }
      }
      
      // Skip if we couldn't extract the essential fields
      if (!date || !description || !amountStr) {
        console.log(`Skipping line ${i}: Missing essential fields. Found: date=${date}, desc=${description}, amount=${amountStr}`);
        skippedLinesCount++;
        continue;
      }
      
      // Parse amount safely
      const amount = parseAmount(amountStr);
      
      if (amount === null) {
        console.log(`Skipping line ${i} due to invalid amount: ${amountStr}`);
        skippedLinesCount++;
        continue;
      }
      
      // Format and validate date
      const formattedDate = parseDate(date);
      
      // Determine if income or expense
      const type = amount >= 0 ? 'income' : 'expense';
      const category = categorizeTransaction(description, amount);
      
      // Extract YYYY-MM for month_key
      const monthKey = formattedDate.substring(0, 7); // Format: YYYY-MM
      
      transactions.push({
        user_id: userId,
        date: formattedDate,
        description,
        amount,
        type,
        category,
        month_key: monthKey,
        source_upload_id: fileId
      });
      
      validTransactionsCount++;
    }
    
    console.log(`Parsed ${transactions.length} transactions (valid: ${validTransactionsCount}, skipped: ${skippedLinesCount})`);
    
    // Insert transactions in batches
    let insertedCount = 0;
    if (transactions.length > 0) {
      // Insert in smaller batches to avoid payload size issues
      const BATCH_SIZE = 20;
      
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        console.log(`Inserting batch ${i / BATCH_SIZE + 1} with ${batch.length} transactions`);
        
        const { data: insertData, error: insertError } = await supabase
          .from('transactions')
          .insert(batch)
          .select();
          
        if (insertError) {
          console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError);
          // Continue with other batches even if one fails
        } else {
          insertedCount += insertData?.length || 0;
          console.log(`Successfully inserted ${insertData?.length || 0} transactions`);
        }
      }
    }
    
    // Mark the upload as processed
    await supabase
      .from('uploads')
      .update({ processed: true })
      .eq('id', fileId);
    
    console.log("Upload marked as processed");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed and inserted ${insertedCount} transactions out of ${transactions.length} parsed (${skippedLinesCount} lines skipped)`,
        details: {
          total_lines: lines.length,
          valid_transactions: validTransactionsCount,
          inserted_transactions: insertedCount,
          skipped_lines: skippedLinesCount
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Process statement error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
