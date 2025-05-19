
import { parseCSVLine, detectHeaderColumns, parseDate, parseAmount } from "./parsers.ts";
import { categorizeWithAI } from "./aiCategorizer.ts";

export async function processCSVData(
  text: string, 
  userId: string, 
  fileId: string, 
  monthKey: string
): Promise<Array<{
  user_id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  month_key: string;
  source_upload_id: string;
}>> {
  console.log("Starting CSV processing, fileId:", fileId);
  const transactions: Array<{
    user_id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    category: string;
    month_key: string;
    source_upload_id: string;
  }> = [];
  
  try {
    // Detect delimiter (improved detection)
    let delimiter = ',';
    if (text.includes('\t') && text.split('\t').length > 3) {
      delimiter = '\t';
      console.log("Detected TAB delimiter");
    } else if (text.includes(',')) {
      console.log("Detected COMMA delimiter");
    } else if (text.trim().split('\n')[0].includes(' ')) {
      delimiter = ' ';
      console.log("Detected SPACE delimiter");
    }
    
    console.log("Using delimiter:", delimiter === ',' ? "comma" : delimiter === '\t' ? "tab" : "space");
    
    // Split by lines and filter out empty ones
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
      
    console.log(`Processing ${lines.length} lines from CSV/TSV/TXT file`);
    
    if (lines.length === 0) {
      console.error("No data found in file");
      return transactions;
    }
    
    // Log sample content for debugging
    console.log("Sample content (first few characters):", text.substring(0, 100));
    console.log("First line:", lines[0]);
    if (lines.length > 1) console.log("Second line:", lines[1]);
    
    let validTransactionsCount = 0;
    let skippedLinesCount = 0;
    let duplicateCount = 0;
    
    let headerLine = lines[0];
    let startIndex = 0;
    let columnIndices = detectHeaderColumns(headerLine);
    
    const isFirstLineHeader = headerLine.toLowerCase().includes('date') || 
        headerLine.toLowerCase().includes('description') || 
        headerLine.toLowerCase().includes('amount') ||
        headerLine.toLowerCase().includes('withdraw') ||
        headerLine.toLowerCase().includes('deposit');
        
    if (isFirstLineHeader) {
      startIndex = 1;
      console.log("Using header line to determine columns:", headerLine);
      console.log("Detected column indices:", columnIndices);
    } else {
      console.log("No header detected, using default column order");
    }
    
    // Track transactions to detect duplicates
    const existingTransactions = new Set();
    
    // Process each line
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Log every 10th line for debugging
      if (i % 10 === 0 || i < 3) {
        console.log(`Processing line ${i+1}: "${line}"`);
      }
      
      let fields;
      
      // Parse line based on delimiter
      if (delimiter === ',') {
        if (line.includes('"')) {
          fields = parseCSVLine(line);
        } else {
          fields = line.split(',').map(field => field.trim());
        }
      } else if (delimiter === '\t') {
        fields = line.split('\t').map(field => field.trim());
      } else {
        fields = line.split(/\s+/).filter(field => field.trim());
      }
      
      // Skip lines with insufficient data
      if (!fields || fields.length < 3) {
        console.log(`Skipping line ${i+1}: Not enough fields. Found: ${fields?.length || 0} fields`);
        skippedLinesCount++;
        continue;
      }
      
      // Extract date and description
      const dateField = fields[columnIndices.dateIndex];
      const descriptionField = fields[columnIndices.descriptionIndex];
      
      if (!dateField || !descriptionField) {
        console.log(`Skipping line ${i+1}: Missing date or description`);
        skippedLinesCount++;
        continue;
      }
      
      let amount;
      let isExpense = false;
      
      // Process amount based on whether we have withdrawal/deposit columns
      if (columnIndices.withdrawalIndex >= 0 && columnIndices.depositIndex >= 0) {
        console.log(`Line ${i+1}: Using withdrawal/deposit format`);
        
        const withdrawalStr = fields[columnIndices.withdrawalIndex]?.trim();
        const depositStr = fields[columnIndices.depositIndex]?.trim();
        
        if (withdrawalStr && withdrawalStr !== '' && withdrawalStr !== '0' && withdrawalStr !== '0.00') {
          // It's a withdrawal (expense)
          amount = parseAmount(withdrawalStr);
          if (amount !== null && amount > 0) {
            isExpense = true;
            console.log(`Line ${i+1}: Using withdrawal amount as EXPENSE: ${amount}`);
          } else {
            console.log(`Line ${i+1}: Invalid withdrawal amount: ${withdrawalStr}`);
            skippedLinesCount++;
            continue;
          }
        } 
        else if (depositStr && depositStr !== '' && depositStr !== '0' && depositStr !== '0.00') {
          // It's a deposit (income)
          amount = parseAmount(depositStr);
          if (amount !== null && amount > 0) {
            isExpense = false;
            console.log(`Line ${i+1}: Using deposit amount as INCOME: ${amount}`);
          } else {
            console.log(`Line ${i+1}: Invalid deposit amount: ${depositStr}`);
            skippedLinesCount++;
            continue;
          }
        }
        else {
          console.log(`Skipping line ${i+1}: No valid withdrawal or deposit amount found`);
          skippedLinesCount++;
          continue;
        }
      } else {
        // Use standard amount column
        const amountField = fields[columnIndices.amountIndex];
        if (!amountField) {
          console.log(`Skipping line ${i+1}: No amount field found`);
          skippedLinesCount++;
          continue;
        }
        
        amount = parseAmount(amountField);
        if (amount === null) {
          console.log(`Skipping line ${i+1}: Invalid amount format: "${amountField}"`);
          skippedLinesCount++;
          continue;
        }
        
        isExpense = amount < 0;
        amount = Math.abs(amount); // Store absolute value
      }
      
      // Skip incomplete records
      if (!dateField || !descriptionField || amount === null) {
        console.log(`Skipping line ${i+1}: Missing essential fields. Found: date=${dateField}, desc=${descriptionField}, amount=${amount}`);
        skippedLinesCount++;
        continue;
      }
      
      const date = parseDate(dateField);
      const description = descriptionField.trim();
      const type = isExpense ? 'expense' : 'income';
      
      // Check for duplicates
      const transactionKey = `${date}|${description}|${amount}`;
      if (existingTransactions.has(transactionKey)) {
        console.log(`Skipping duplicate transaction: ${transactionKey}`);
        duplicateCount++;
        continue;
      }
      existingTransactions.add(transactionKey);
      
      // Use AI for categorization (with sign for proper context)
      let category = await categorizeWithAI(description, isExpense ? -amount : amount);
      
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
    
    console.log(`Parsed ${validTransactionsCount} transactions (skipped: ${skippedLinesCount}, duplicates: ${duplicateCount})`);
    return transactions;
  } catch (error) {
    console.error("Error processing CSV data:", error);
    // Return any transactions we managed to parse before the error
    return transactions;
  }
}
