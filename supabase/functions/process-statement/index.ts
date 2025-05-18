
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

// Helper function to properly parse CSV lines
function parseCSVLine(line: string): string[] {
  const result = [];
  let currentValue = '';
  let inQuotes = false;
  
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
    let isCSV = uploadData.filename.toLowerCase().endsWith('.csv');
    
    // Get file content as text
    const text = await fileData.text();
    const lines = text.split('\n');
    
    console.log(`Processing ${lines.length} lines from ${isCSV ? "CSV" : "text"} file`);
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      let date, description, amountStr;
      
      if (isCSV) {
        // Parse CSV line properly
        const fields = parseCSVLine(line);
        if (fields.length < 3) continue;
        
        // Assume date, description, amount format
        // Adjust these indices based on your CSV structure
        date = fields[0]?.trim();
        description = fields[1]?.trim();
        amountStr = fields[2]?.trim();
      } else {
        // Simple fallback for non-CSV format
        const parts = line.split(',');
        if (parts.length < 3) continue;
        
        date = parts[0]?.trim();
        description = parts[1]?.trim();
        amountStr = parts[2]?.trim();
      }
      
      // Validate fields
      if (!date || !description || !amountStr) {
        console.log(`Skipping invalid line ${i}: ${line}`);
        continue;
      }
      
      // Clean up amount string (remove currency symbols and commas)
      amountStr = amountStr.replace(/[$,]/g, '');
      const amount = parseFloat(amountStr);
      
      if (isNaN(amount)) {
        console.log(`Skipping line ${i} due to invalid amount: ${amountStr}`);
        continue;
      }
      
      // Format date if needed (assuming YYYY-MM-DD format)
      let formattedDate = date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Try to parse and format the date
        try {
          const dateParts = date.split(/[\/\-\.]/);
          // Assuming MM/DD/YYYY format from most bank statements
          if (dateParts.length === 3) {
            const month = dateParts[0].padStart(2, '0');
            const day = dateParts[1].padStart(2, '0');
            const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
            formattedDate = `${year}-${month}-${day}`;
          }
        } catch (e) {
          console.log(`Could not parse date ${date}, using as-is`);
        }
      }
      
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
    }
    
    console.log(`Parsed ${transactions.length} transactions`);
    
    // Insert transactions in batches
    if (transactions.length > 0) {
      // Insert in smaller batches to avoid payload size issues
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        console.log(`Inserting batch ${i / BATCH_SIZE + 1} with ${batch.length} transactions`);
        
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(batch);
          
        if (insertError) {
          console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError);
          // Continue with other batches even if one fails
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
        message: `Processed ${transactions.length} transactions` 
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
