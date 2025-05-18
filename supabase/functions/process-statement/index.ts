import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define common expense categories for classification
const categories = {
  housing: ["rent", "mortgage", "property", "home", "hoa", "apartment", "childcare"],
  utilities: ["electric", "water", "gas", "internet", "wifi", "phone", "utility", "utilities"],
  groceries: ["grocery", "supermarket", "food", "market", "safeway", "kroger", "trader", "whole foods", "aldi", "walmart"],
  diningOut: ["restaurant", "cafe", "coffee", "starbucks", "mcdonalds", "dining", "pizza", "burger", "takeout", "ubereats", "doordash", "grubhub"],
  transportation: ["gas", "fuel", "uber", "lyft", "taxi", "transit", "train", "subway", "bus", "car", "auto", "vehicle", "insurance"],
  healthcare: ["doctor", "hospital", "medical", "dental", "pharmacy", "health", "insurance"],
  entertainment: ["movie", "netflix", "spotify", "hbo", "amazon prime", "disney", "hulu", "theater", "concert"],
  shopping: ["amazon", "target", "clothing", "department", "store", "retail", "online"],
  subscriptions: ["subscription", "membership", "monthly", "gym"],
  personal: ["haircut", "salon", "spa", "gym", "fitness"],
  education: ["tuition", "school", "course", "book", "university", "college"],
  travel: ["hotel", "flight", "airline", "airbnb", "vacation", "travel"],
  income: ["paycheck", "deposit", "salary", "income", "payment received", "venmo received", "zelle received", "transfer received", "freelance", "interest"],
  savings: ["savings", "investment", "transfer"]
};

// Function to categorize a transaction based on its description
function categorizeTransaction(description: string, amount: number): string {
  description = description.toLowerCase();
  
  // Check for income first (deposits are typically positive amounts)
  if (amount > 0) {
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
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        result.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Push the last value
    result.push(currentValue.trim());
    console.log("Parsed CSV line:", result);
    return result;
  } catch (error) {
    console.error("Error parsing CSV line:", error, "Line:", line);
    return [];
  }
}

// Function to detect header columns in the first line
function detectHeaderColumns(headerLine: string): {dateIndex: number, descriptionIndex: number, amountIndex: number} {
  const headers = parseCSVLine(headerLine.toLowerCase());
  console.log("Detected headers:", headers);
  
  const dateIndex = headers.findIndex(h => h.includes('date'));
  const descriptionIndex = headers.findIndex(h => 
    h.includes('description') || h.includes('desc') || h.includes('name') || h.includes('transaction')
  );
  const amountIndex = headers.findIndex(h => 
    h.includes('amount') || h.includes('sum') || h.includes('price') || h.includes('value')
  );
  
  // Special case for withdrawal/deposit format
  const withdrawalIndex = headers.findIndex(h => 
    h.includes('withdrawal') || h.includes('debit') || h.includes('withdraw')
  );
  const depositIndex = headers.findIndex(h => 
    h.includes('deposit') || h.includes('credit')
  );
  
  console.log("Column indices - date:", dateIndex, "description:", descriptionIndex, 
              "amount:", amountIndex, "withdrawals:", withdrawalIndex, "deposits:", depositIndex);
  
  // If we have withdrawal and deposit columns, set a special flag
  if (withdrawalIndex >= 0 && depositIndex >= 0) {
    return {
      dateIndex: dateIndex >= 0 ? dateIndex : 0,
      descriptionIndex: descriptionIndex >= 0 ? descriptionIndex : 1,
      amountIndex: -1 // Special marker to indicate we need to use withdrawalIndex and depositIndex
    };
  }
  
  return {
    dateIndex: dateIndex >= 0 ? dateIndex : 0,
    descriptionIndex: descriptionIndex >= 0 ? descriptionIndex : 1,
    amountIndex: amountIndex >= 0 ? amountIndex : 2
  };
}

// Improved function to parse dates from various formats
function parseDate(dateStr: string): string {
  try {
    // Clean up the date string - remove any non-alphanumeric characters except /-
    const cleanedDate = dateStr.replace(/[^\w\/-]/g, '').trim();
    console.log(`Parsing date: "${dateStr}" (cleaned: "${cleanedDate}")`);
    
    // Try to detect different date formats
    let match;
    let year, month, day;
    
    // Format: MM/DD/YYYY or MM-DD-YYYY
    if ((match = cleanedDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/))) {
      month = match[1].padStart(2, '0');
      day = match[2].padStart(2, '0');
      year = match[3].length === 2 ? `20${match[3]}` : match[3];
      console.log(`Parsed date as MM/DD/YYYY: ${year}-${month}-${day}`);
      return `${year}-${month}-${day}`;
    }
    
    // Format: YYYY/MM/DD or YYYY-MM-DD
    if ((match = cleanedDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/))) {
      year = match[1];
      month = match[2].padStart(2, '0');
      day = match[3].padStart(2, '0');
      console.log(`Parsed date as YYYY/MM/DD: ${year}-${month}-${day}`);
      return `${year}-${month}-${day}`;
    }
    
    // If string already looks like YYYY-MM-DD, return as is
    if ((match = cleanedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
      console.log(`Date already in YYYY-MM-DD format: ${cleanedDate}`);
      return cleanedDate;
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
    let cleaned = amountStr.toString().replace(/[$,\s]/g, '');
    
    console.log(`Parsing amount: "${amountStr}" (cleaned: "${cleaned}")`);
    
    // Check for parentheses (indicating negative number in accounting)
    let multiplier = 1;
    if (cleaned.match(/^\(.*\)$/)) {
      cleaned = cleaned.replace(/[()]/g, '');
      multiplier = -1;
      console.log(`Amount in parentheses, applying negative multiplier. Cleaned: "${cleaned}"`);
    }
    
    // Check if string contains any non-allowed characters
    if (!/^-?\d*\.?\d*$/.test(cleaned)) {
      console.log(`Invalid amount format: "${cleaned}"`);
      return null;
    }
    
    // Parse to float and apply multiplier
    const amount = parseFloat(cleaned) * multiplier;
    
    if (isNaN(amount)) {
      console.log(`Amount is NaN: "${cleaned}"`);
      return null;
    }
    
    console.log(`Parsed amount: ${amount}`);
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
    const hasDatePattern = /\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(line);
    const hasCurrencyPattern = /\$?\d+\.?\d{0,2}/.test(line);
    console.log(`Line transaction check - Has date: ${hasDatePattern}, Has currency: ${hasCurrencyPattern}`);
    return hasDatePattern || hasCurrencyPattern;
  }
  // For simple TSV-like format with just spaces or tabs
  if (line.split(/\s+/).length >= 3) {
    return /\d{4}-\d{2}-\d{2}/.test(line) || /\$?\d+\.?\d{0,2}/.test(line);
  }
  return false;
}

// New function to extract PDF text (without using pdf-parse which has compatibility issues)
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    // This is a very simplified PDF text extraction
    // Converting the buffer to a string to find text patterns
    const uint8Array = new Uint8Array(pdfBuffer);
    const textDecoder = new TextDecoder('utf-8');
    let text = '';
    
    // Look for text objects in PDF
    // This is a simplified approach that won't work for all PDFs
    // but should extract some text from simple PDF files
    const str = textDecoder.decode(uint8Array);
    
    // Find text objects between "BT" (Begin Text) and "ET" (End Text)
    const textMarkers = str.match(/BT.*?ET/gs);
    if (textMarkers && textMarkers.length > 0) {
      // Extract text content from these markers
      for (const marker of textMarkers) {
        // Look for text within parentheses or angle brackets
        const textMatches = marker.match(/\((.*?)\)|\<(.*?)\>/g);
        if (textMatches) {
          for (const match of textMatches) {
            // Clean up the extracted text
            const cleaned = match.replace(/^\(|\)$|^\<|\>$/g, '');
            text += cleaned + ' ';
          }
        }
      }
    }
    
    // If we couldn't extract text using the marker approach, try a fallback
    if (text.trim().length === 0) {
      // Look for common patterns that might indicate transaction data
      const datePattern = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/g;
      const amountPattern = /\$\s*[\d,]+\.\d{2}|-\$\s*[\d,]+\.\d{2}|\([\d,]+\.\d{2}\)|\d+\.\d{2}\s*DR|\d+\.\d{2}\s*CR/g;
      
      const dates = str.match(datePattern) || [];
      const amounts = str.match(amountPattern) || [];
      
      // If we found dates and amounts, construct some text with them
      if (dates.length > 0 && amounts.length > 0) {
        // Try to locate text near dates and amounts to use as descriptions
        for (let i = 0; i < Math.min(dates.length, amounts.length); i++) {
          const datePos = str.indexOf(dates[i]);
          const amountPos = str.indexOf(amounts[i]);
          
          // Try to extract some context around these positions
          if (datePos >= 0 && amountPos >= 0) {
            const startPos = Math.max(0, datePos - 20);
            const endPos = Math.min(str.length, amountPos + amounts[i].length + 20);
            
            if (startPos < endPos) {
              text += str.substring(startPos, endPos) + '\n';
            }
          }
        }
      }
    }
    
    console.log("Extracted text sample:", text.substring(0, 500));
    return text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return "";
  }
}

// Updated function to extract data from PDF files
async function extractTransactionsFromPDF(buffer: ArrayBuffer): Promise<{ date: string, description: string, amount: number }[]> {
  try {
    // Extract text from PDF using our simplified method
    const text = await extractTextFromPDF(buffer);
    console.log("PDF extracted text sample:", text.substring(0, 500));
    
    // Split the PDF text into lines
    const lines = text.split('\n').filter(line => line.trim());
    
    // Look for patterns that might indicate transaction data
    // Common patterns: date (MM/DD/YYYY), description, amount ($XX.XX)
    const transactions: { date: string, description: string, amount: number }[] = [];
    
    // Try to detect what type of bank statement this is based on common formats
    const containsDatePattern = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(text);
    const containsAmountPattern = /\$\s*\d+\.\d{2}|-\$\s*\d+\.\d{2}|\(\$\s*\d+\.\d{2}\)|\d+\.\d{2}\s*(DR|CR)/.test(text);
    
    console.log(`PDF format detection - Has date patterns: ${containsDatePattern}, Has amount patterns: ${containsAmountPattern}`);
    
    if (!containsDatePattern || !containsAmountPattern) {
      console.log("PDF does not appear to contain standard transaction formats");
      return transactions;
    }

    const dateRegexes = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,           // MM/DD/YYYY
      /(\d{4}-\d{2}-\d{2})/                    // YYYY-MM-DD
    ];
    
    const amountRegexes = [
      /\$\s*([\d,]+\.\d{2})/,                  // $XX.XX
      /-\$\s*([\d,]+\.\d{2})/,                 // -$XX.XX
      /\(\$\s*([\d,]+\.\d{2})\)/,              // ($XX.XX)
      /([\d,]+\.\d{2})\s*DR/,                  // XX.XX DR
      /([\d,]+\.\d{2})\s*CR/                   // XX.XX CR
    ];
    
    // Process each line looking for transaction data
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip short lines that likely don't contain transaction data
      if (line.length < 10) continue;
      
      // Try to extract date
      let dateMatch = null;
      for (const regex of dateRegexes) {
        const match = line.match(regex);
        if (match) {
          dateMatch = match[1];
          break;
        }
      }
      
      if (!dateMatch) continue;
      
      // If date found, try to extract amount from same line
      let amountMatch = null;
      let amountValue = 0;
      let isNegative = false;
      
      for (const regex of amountRegexes) {
        const match = line.match(regex);
        if (match) {
          amountMatch = match[1].replace(/,/g, '');
          isNegative = regex.toString().includes('-') || 
                       regex.toString().includes('\\(') || 
                       regex.toString().includes('DR');
          break;
        }
      }
      
      if (!amountMatch) {
        // Try looking at the next line for the amount
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          for (const regex of amountRegexes) {
            const match = nextLine.match(regex);
            if (match) {
              amountMatch = match[1].replace(/,/g, '');
              isNegative = regex.toString().includes('-') || 
                           regex.toString().includes('\\(') || 
                           regex.toString().includes('DR');
              i++; // Skip the next line as we've used it
              break;
            }
          }
        }
      }
      
      if (!amountMatch) continue;
      
      amountValue = parseFloat(amountMatch);
      if (isNegative) amountValue = -amountValue;
      
      // Extract description - everything between date and amount
      // or everything after date if we found amount on next line
      let description = line;
      
      // Remove the date part
      description = description.replace(dateMatch, '').trim();
      
      // Remove the amount part if on same line
      if (line.includes(amountMatch)) {
        description = description.replace(new RegExp('\\$?\\s*' + amountMatch.replace('.', '\\.') + '\\s*(DR|CR)?'), '').trim();
      }
      
      // Clean up description - remove common prefixes/suffixes and extra spaces
      description = description
        .replace(/^\s*-\s*/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      // If description is too short, try to combine with previous or next line
      if (description.length < 3 && i > 0) {
        description = lines[i - 1].trim();
      }
      
      // If we have valid data, add to transactions
      if (dateMatch && description && !isNaN(amountValue)) {
        const formattedDate = parseDate(dateMatch);
        
        console.log(`Extracted PDF transaction: ${formattedDate} | ${description} | ${amountValue}`);
        
        transactions.push({
          date: formattedDate,
          description: description || "Unknown transaction",
          amount: amountValue
        });
      }
    }
    
    console.log(`Extracted ${transactions.length} transactions from PDF`);
    return transactions;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    return [];
  }
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
    const isTXT = fileExt === 'txt';
    
    console.log(`Processing file with extension: ${fileExt} - CSV:${isCSV}, TSV:${isTSV}, PDF:${isPDF}, TXT:${isTXT}`);
    
    // Process PDF differently than text-based files
    if (isPDF) {
      try {
        // For PDF files, use our custom extraction method
        const arrayBuffer = await fileData.arrayBuffer();
        const pdfTransactions = await extractTransactionsFromPDF(arrayBuffer);
        
        console.log("PDF transactions extracted:", pdfTransactions.length);
        
        for (const tx of pdfTransactions) {
          const { date, description, amount } = tx;
          
          console.log("Processing PDF transaction:", { date, description, amount });
          
          // Determine transaction type based on amount sign
          // Negative = expense, Positive = income
          const type = amount >= 0 ? 'income' : 'expense';
          
          // Categorize based on description and amount
          const category = type === 'income' ? 'Income' : categorizeTransaction(description, amount);
          
          // Extract YYYY-MM for month_key
          const monthKey = date.substring(0, 7); // Format: YYYY-MM
          
          transactions.push({
            user_id: userId,
            date,
            description,
            amount: Math.abs(amount), // Store absolute value in database
            type,
            category,
            month_key: monthKey,
            source_upload_id: fileId
          });
          
          console.log("Added transaction:", {
            date,
            description,
            amount: Math.abs(amount),
            type,
            category
          });
        }
        
        console.log(`Processed ${transactions.length} transactions from PDF document`);
      } catch (error) {
        console.error("Error processing PDF:", error);
        return new Response(
          JSON.stringify({ 
            error: "Error processing PDF document", 
            details: error.message 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Process CSV, TSV, or TXT files as before
      // Get file content as text
      let text;
      try {
        text = await fileData.text();
        console.log(`File type: ${fileExt}, size: ${text.length} bytes`);
        console.log("File content sample:", text.substring(0, 500));
      } catch (error) {
        console.error("Error reading file:", error);
        return new Response(
          JSON.stringify({ error: "Error reading file: " + error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Detect delimiter (comma, tab, or space)
      let delimiter = ',';
      if (isTSV) {
        delimiter = '\t';
      } else if (text.includes('\t')) {
        delimiter = '\t';
      } else if (!text.includes(',') && text.trim().split('\n')[0].includes(' ')) {
        // If no commas but has spaces, might be space-delimited
        delimiter = ' ';
      }
      
      console.log("Detected delimiter:", delimiter === ',' ? "comma" : delimiter === '\t' ? "tab" : "space");
      
      // Sample data for manual review in logs
      const sampleLines = text.split('\n').slice(0, 10).join('\n');
      console.log(`Sample data (first 10 lines):\n${sampleLines}`);
      
      // Split the file into lines
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      console.log(`Processing ${lines.length} lines from ${isCSV ? "CSV" : isPDF ? "PDF" : "text"} file`);
      
      if (lines.length === 0) {
        console.error("No data found in file");
        return new Response(
          JSON.stringify({ error: "No data found in file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let validTransactionsCount = 0;
      let skippedLinesCount = 0;
      
      // Check if first line looks like a header and detect column indices
      let headerLine = lines[0];
      let startIndex = 0;
      let columnIndices = { dateIndex: 0, descriptionIndex: 1, amountIndex: 2 }; // Default
      
      // Detect if first line is a header
      const isFirstLineHeader = headerLine.toLowerCase().includes('date') || 
          headerLine.toLowerCase().includes('description') || 
          headerLine.toLowerCase().includes('amount') ||
          headerLine.toLowerCase().includes('withdraw') ||
          headerLine.toLowerCase().includes('deposit');
          
      if (isFirstLineHeader) {
        columnIndices = detectHeaderColumns(headerLine);
        startIndex = 1; // Skip header row when processing
        console.log("Using header line to determine columns:", headerLine);
      } else {
        console.log("No header detected, using default column order");
      }
      
      // Process each line
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let fields;
        
        // Handle different delimiters
        if (delimiter === ',') {
          if (line.includes('"')) {
            fields = parseCSVLine(line);
          } else {
            fields = line.split(',').map(field => field.trim());
          }
        } else if (delimiter === '\t') {
          fields = line.split('\t').map(field => field.trim());
        } else { // Space delimiter
          // Split by multiple spaces to handle variable spacing
          fields = line.split(/\s+/).filter(field => field.trim());
        }
        
        console.log(`Line ${i+1}: Fields detected:`, fields);
        
        // Skip if we don't have enough fields
        if (!fields || fields.length < 3) {
          console.log(`Skipping line ${i+1}: Not enough fields. Found: ${fields?.length || 0} fields`);
          skippedLinesCount++;
          continue;
        }
        
        const dateField = fields[columnIndices.dateIndex];
        const descriptionField = fields[columnIndices.descriptionIndex];
        
        // Special handling for withdrawals and deposits columns
        let amountField;
        let isExpense = false;
        
        if (columnIndices.amountIndex === -1) {
          // Special case with separate withdrawals and deposits columns
          const headers = headerLine.toLowerCase().split(delimiter).map(h => h.trim());
          const withdrawalsIndex = headers.findIndex(h => h.includes('withdraw') || h.includes('debit'));
          const depositsIndex = headers.findIndex(h => h.includes('deposit') || h.includes('credit'));
          
          console.log("Using separate columns:", { withdrawalsIndex, depositsIndex });
          
          const withdrawalAmount = fields[withdrawalsIndex]?.trim();
          const depositAmount = fields[depositsIndex]?.trim();
          
          console.log("Checking amounts:", { withdrawalAmount, depositAmount });
          
          if (withdrawalAmount && withdrawalAmount !== '0' && withdrawalAmount !== '0.0' && withdrawalAmount !== '0.00') {
            amountField = withdrawalAmount;
            isExpense = true;
            console.log(`Line ${i+1}: Found withdrawal amount: ${amountField}`);
          } else if (depositAmount && depositAmount !== '0' && depositAmount !== '0.0' && depositAmount !== '0.00') {
            amountField = depositAmount;
            isExpense = false;
            console.log(`Line ${i+1}: Found deposit amount: ${amountField}`);
          } else {
            console.log(`Skipping line ${i+1}: No valid amount found in withdrawals/deposits`);
            skippedLinesCount++;
            continue;
          }
        } else {
          amountField = fields[columnIndices.amountIndex];
          // Standard way of determining expense/income - needs detection from context
          // Let's determine later after parsing the amount
        }
        
        // Skip if any essential field is missing
        if (!dateField || !descriptionField || !amountField) {
          console.log(`Skipping line ${i+1}: Missing essential fields. Found: date=${dateField}, desc=${descriptionField}, amount=${amountField}`);
          skippedLinesCount++;
          continue;
        }
        
        const date = parseDate(dateField);
        const description = descriptionField.trim();
        const parsedAmount = parseAmount(amountField);
        
        console.log(`Line ${i+1}: Parsed values:`, { date, description, parsedAmount });
        
        if (parsedAmount === null) {
          console.log(`Skipping line ${i+1} due to invalid amount: ${amountField}`);
          skippedLinesCount++;
          continue;
        }
        
        // For standard columns, expense is indicated by negative amount or withdrawal position
        if (columnIndices.amountIndex !== -1) {
          isExpense = parsedAmount < 0;
        }
        
        // Determine if income or expense
        const type = isExpense ? 'expense' : 'income';
        
        console.log(`Line ${i+1}: Transaction type: ${type} (isExpense: ${isExpense})`);
        
        // Always use positive values in the database, the type field indicates whether it's an expense
        const amount = Math.abs(parsedAmount);
        
        // Determine category - for income, always use Income category
        // For expenses, use category detection
        const category = type === 'income' ? 'Income' : categorizeTransaction(description, -1);
        
        // Extract YYYY-MM for month_key
        const monthKey = date.substring(0, 7); // Format: YYYY-MM
        
        console.log(`Line ${i+1}: Adding transaction: ${date} | ${description} | ${amount} | ${type} | ${category}`);
        
        transactions.push({
          user_id: userId,
          date,
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
    }
    
    // Insert transactions in batches
    let insertedCount = 0;
    if (transactions.length > 0) {
      // Insert in smaller batches to avoid payload size issues
      const BATCH_SIZE = 10; // Smaller batch size for more reliability
      
      console.log(`Will insert ${transactions.length} transactions in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        console.log(`Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} transactions`);
        
        if (batch.length > 0) {
          console.log("Sample transaction in batch:", batch[0]);
          
          try {
            const { data: insertData, error: insertError } = await supabase
              .from('transactions')
              .insert(batch)
              .select();
              
            if (insertError) {
              console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError);
              // Continue with other batches even if one fails
            } else {
              insertedCount += insertData?.length || 0;
              console.log(`Successfully inserted ${insertData?.length || 0} transactions`);
            }
          } catch (batchError) {
            console.error(`Exception in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, batchError);
          }
        }
        
        // Small delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      console.log("No transactions to insert");
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
        message: insertedCount > 0 
          ? `Processed and inserted ${insertedCount} transactions out of ${transactions.length} parsed` 
          : "No transactions were found in the uploaded files",
        details: {
          total_transactions: transactions.length,
          inserted_transactions: insertedCount
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
