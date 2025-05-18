
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
    
    if (!fileId || !userId) {
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
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get the file from storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('bank_statements')
      .download(uploadData.file_path);
      
    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Error downloading file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Process the file (this is a simplified example)
    // In a real app, you would parse CSV or PDF content properly
    const text = await fileData.text();
    const lines = text.split('\n');
    const transactions = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Assuming CSV format with date,description,amount
      const [date, description, amountStr] = line.split(',');
      if (!date || !description || !amountStr) continue;
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;
      
      const type = amount >= 0 ? 'income' : 'expense';
      const category = categorizeTransaction(description, amount);
      const monthKey = date.substring(0, 7); // Format: YYYY-MM
      
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
    }
    
    // Insert transactions in batches
    if (transactions.length > 0) {
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions);
        
      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Error inserting transactions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Mark the upload as processed
    await supabase
      .from('uploads')
      .update({ processed: true })
      .eq('id', fileId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${transactions.length} transactions` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
