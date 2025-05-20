
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractTransactionsFromPDF } from "./utils/pdfExtractor.ts";
import { processCSVData } from "./utils/csvProcessor.ts";
import { categorizeWithAI, categorizeBatch } from "./utils/aiCategorizer.ts";

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
    
    const rawTransactions = [];
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
        
        // Filter out transactions missing essential data
        const validTransactions = pdfTransactions.filter(tx => {
          const { date, description, amount } = tx;
          const isValid = !!date && !!description && amount !== undefined && !isNaN(amount);
          
          if (!isValid) {
            skippedRows++;
            console.log(`Skipping incomplete PDF transaction: ${JSON.stringify(tx)}`);
          }
          
          return isValid;
        });
        
        console.log(`Found ${validTransactions.length} valid transactions from PDF (skipped ${skippedRows})`);
        
        // Prepare transactions for batch categorization
        for (const tx of validTransactions) {
          const isExpense = tx.amount < 0;
          rawTransactions.push({
            user_id: userId,
            date: tx.date,
            description: tx.description,
            amount: Math.abs(tx.amount),
            type: isExpense ? 'expense' : 'income',
            source_upload_id: fileId,
            month_key: monthKey,
            forAI: { description: tx.description, amount: tx.amount }
          });
        }
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
        
        // Add CSV transactions to the rawTransactions array with the forAI field
        for (const tx of csvTransactions) {
          rawTransactions.push({
            ...tx,
            forAI: { description: tx.description, amount: tx.amount * (tx.type === 'expense' ? -1 : 1) }
          });
        }
      } catch (error) {
        console.error("Error reading file:", error);
        return new Response(
          JSON.stringify({ error: "Error reading file: " + error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Check for duplicates and filter them out
    const finalTransactions = [];
    for (const tx of rawTransactions) {
      // Check for duplicates before adding
      const { data: existingTx, error: queryError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('date', tx.date)
        .eq('description', tx.description)
        .eq('amount', Math.abs(tx.amount))
        .maybeSingle();
        
      if (existingTx) {
        console.log(`Skipping duplicate transaction: ${tx.date} | ${tx.description} | ${Math.abs(tx.amount)}`);
        skippedRows++;
        continue;
      }
      
      finalTransactions.push(tx);
    }
    
    // Process transactions in batches for categorization
    let insertedCount = 0;
    if (finalTransactions.length > 0) {
      console.log(`Will process ${finalTransactions.length} transactions with batch categorization`);
      
      // Create batches of up to 100 transactions for categorization
      const BATCH_SIZE = 100;
      const INSERTION_BATCH_SIZE = 10;
      const batches = [];
      
      for (let i = 0; i < finalTransactions.length; i += BATCH_SIZE) {
        batches.push(finalTransactions.slice(i, i + BATCH_SIZE));
      }
      
      // Process each batch for categorization
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Categorizing batch ${batchIndex + 1} of ${batches.length} with ${batch.length} transactions`);
        
        try {
          // Extract just the fields needed for categorization
          const forAIBatch = batch.map(tx => tx.forAI);
          
          // Get categories for the entire batch at once
          const categories = await categorizeBatch(forAIBatch);
          
          // Assign categories to transactions
          for (let i = 0; i < batch.length; i++) {
            // Use the appropriate category based on transaction type
            if (batch[i].type === 'income') {
              batch[i].category = 'Income';
            } else if (categories[i]) {
              batch[i].category = categories[i];
            } else {
              // Fallback if category wasn't returned for expense
              batch[i].category = 'Uncategorized Expense';
            }
            
            // Remove the forAI field before insertion
            delete batch[i].forAI;
          }
          
          // Insert transactions in smaller sub-batches
          for (let i = 0; i < batch.length; i += INSERTION_BATCH_SIZE) {
            const insertBatch = batch.slice(i, i + INSERTION_BATCH_SIZE);
            console.log(`Inserting sub-batch ${Math.floor(i / INSERTION_BATCH_SIZE) + 1} with ${insertBatch.length} transactions`);
            
            if (insertBatch.length > 0) {
              console.log("Sample transaction in batch:", insertBatch[0]);
              
              try {
                const { data: insertData, error: insertError } = await supabase
                  .from('transactions')
                  .insert(insertBatch);
                  
                if (insertError) {
                  console.error(`Error inserting batch:`, insertError);
                } else {
                  insertedCount += insertBatch.length;
                  console.log(`Successfully inserted ${insertBatch.length} transactions`);
                }
              } catch (batchError) {
                console.error(`Exception in batch:`, batchError);
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (batchError) {
          console.error(`Error processing batch ${batchIndex + 1}:`, batchError);
          
          // If batch processing fails, fall back to individual processing
          console.log("Falling back to individual categorization");
          
          for (const tx of batch) {
            try {
              // Remove the forAI property before insertion
              const { forAI, ...transactionToInsert } = tx;
              
              // Ensure income transactions are categorized as "Income"
              if (transactionToInsert.type === 'income') {
                transactionToInsert.category = 'Income';
              } else {
                // Get category for expense transactions
                transactionToInsert.category = await categorizeWithAI(tx.description, -Math.abs(tx.amount));
                
                // If AI categorization failed or returned "Income" for an expense, use "Uncategorized Expense"
                if (!transactionToInsert.category || 
                    transactionToInsert.category.trim() === '' || 
                    transactionToInsert.category.toLowerCase() === 'income') {
                  transactionToInsert.category = 'Uncategorized Expense';
                }
              }
              
              const { data, error } = await supabase
                .from('transactions')
                .insert([transactionToInsert]);
                
              if (!error) {
                insertedCount++;
              } else {
                console.error("Error inserting transaction:", error);
              }
            } catch (singleError) {
              console.error("Error processing single transaction:", singleError);
            }
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
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
