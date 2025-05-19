
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractTransactionsFromPDF } from "./utils/pdfExtractor.ts";
import { processCSVData } from "./utils/csvProcessor.ts";
import { categorizeWithAI } from "./utils/aiCategorizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Process-statement function called");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse the request body and log it for debugging
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Request body:", JSON.stringify(requestBody));
    } catch (parseError) {
      console.error("Error parsing request JSON:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { fileId, userId, statementMonth } = requestBody;
    console.log("Processing file", { fileId, userId, statementMonth });
    
    if (!fileId || !userId) {
      console.error("Missing required parameters");
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Use the provided statement month or get it from the upload record
    let monthKey = statementMonth;
    
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
    
    console.log("Found upload record", { filename: uploadData.filename, statement_month: uploadData.statement_month });
    
    // If statement_month exists in uploadData, use it
    if (!monthKey && uploadData.statement_month) {
      monthKey = uploadData.statement_month;
    }
    
    // If still not available, use current month as fallback
    if (!monthKey) {
      const now = new Date();
      monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    
    console.log("Using month key:", monthKey);
    
    // Fixed bucket name - make sure you're using 'statements' consistently
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('statements')
      .download(uploadData.file_path);
      
    if (fileError || !fileData) {
      console.error("Error downloading file", fileError);
      return new Response(
        JSON.stringify({ error: "Error downloading file: " + fileError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("File downloaded successfully");
    
    const transactions = [];
    const fileExt = uploadData.filename.toLowerCase().split('.').pop();
    const isCSV = fileExt === 'csv';
    const isTSV = fileExt === 'tsv';
    const isPDF = fileExt === 'pdf';
    const isTXT = fileExt === 'txt';
    
    console.log(`Processing file with extension: ${fileExt} - CSV:${isCSV}, TSV:${isTSV}, PDF:${isPDF}, TXT:${isTXT}`);
    
    let skippedRows = 0;
    let totalParsedRows = 0;
    
    if (isPDF) {
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const pdfTransactions = await extractTransactionsFromPDF(arrayBuffer);
        
        totalParsedRows = pdfTransactions.length;
        console.log("PDF transactions extracted:", pdfTransactions.length);
        
        // Process each transaction
        for (const tx of pdfTransactions) {
          const { date, description, amount } = tx;
          
          // Skip transactions missing essential data
          if (!date || !description || amount === undefined || isNaN(amount)) {
            skippedRows++;
            console.log(`Skipping incomplete PDF transaction: ${JSON.stringify(tx)}`);
            continue;
          }
          
          console.log("Processing PDF transaction:", { date, description, amount });
          
          // Determine transaction type based on amount
          const type = amount >= 0 ? 'income' : 'expense';
          
          // Use AI for categorization
          let category = await categorizeWithAI(description, amount);
          
          // Check for duplicates before inserting
          const { data: existingTx, error: queryError } = await supabase
            .from('transactions')
            .select('id')
            .eq('user_id', userId)
            .eq('date', date)
            .eq('description', description)
            .eq('amount', Math.abs(amount))
            .maybeSingle();
            
          if (existingTx) {
            console.log(`Skipping duplicate transaction: ${date} | ${description} | ${Math.abs(amount)}`);
            skippedRows++;
            continue;
          }
          
          transactions.push({
            user_id: userId,
            date,
            description,
            amount: Math.abs(amount),
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
      let text;
      try {
        text = await fileData.text();
        console.log(`File type: ${fileExt}, size: ${text.length} bytes`);
        console.log("File content sample:", text.substring(0, 500));
        
        const csvTransactions = await processCSVData(text, userId, fileId, monthKey);
        totalParsedRows = csvTransactions.length;
        
        // Check for duplicates before adding to final transaction list
        for (const tx of csvTransactions) {
          // Check for duplicates before inserting
          const { data: existingTx, error: queryError } = await supabase
            .from('transactions')
            .select('id')
            .eq('user_id', userId)
            .eq('date', tx.date)
            .eq('description', tx.description)
            .eq('amount', tx.amount)
            .maybeSingle();
            
          if (existingTx) {
            console.log(`Skipping duplicate transaction: ${tx.date} | ${tx.description} | ${tx.amount}`);
            skippedRows++;
            continue;
          }
          
          transactions.push(tx);
        }
        
      } catch (error) {
        console.error("Error reading file:", error);
        return new Response(
          JSON.stringify({ error: "Error reading file: " + error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    let insertedCount = 0;
    if (transactions.length > 0) {
      const BATCH_SIZE = 10;
      
      console.log(`Will insert ${transactions.length} transactions in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        console.log(`Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} transactions`);
        
        if (batch.length > 0) {
          console.log("Sample transaction in batch:", batch[0]);
          
          try {
            const { data: insertData, error: insertError } = await supabase
              .from('transactions')
              .insert(batch);
              
            if (insertError) {
              console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError);
            } else {
              insertedCount += batch.length;
              console.log(`Successfully inserted ${batch.length} transactions`);
            }
          } catch (batchError) {
            console.error(`Exception in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, batchError);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      console.log("No transactions to insert");
    }
    
    // Mark upload as processed even if there were no transactions
    await supabase
      .from('uploads')
      .update({ processed: true })
      .eq('id', fileId);
    
    console.log("Upload marked as processed");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: insertedCount > 0 
          ? `Processed and inserted ${insertedCount} transactions${skippedRows > 0 ? ` (${skippedRows} skipped)` : ''}` 
          : "No transactions were found in the uploaded files",
        details: {
          total_parsed: totalParsedRows,
          skipped_rows: skippedRows,
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
