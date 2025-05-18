
import { parseCSVLine, detectHeaderColumns, parseDate, parseAmount, looksLikeTransactionLine } from "./parsers.ts";
import { categorizeTransaction } from "./categories.ts";

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
  
  let delimiter = ',';
  if (text.includes('\t')) {
    delimiter = '\t';
  } else if (!text.includes(',') && text.trim().split('\n')[0].includes(' ')) {
    delimiter = ' ';
  }
  
  console.log("Detected delimiter:", delimiter === ',' ? "comma" : delimiter === '\t' ? "tab" : "space");
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  console.log(`Processing ${lines.length} lines from CSV/TSV/TXT file`);
  
  if (lines.length === 0) {
    console.error("No data found in file");
    return transactions;
  }
  
  let validTransactionsCount = 0;
  let skippedLinesCount = 0;
  
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
  } else {
    console.log("No header detected, using default column order");
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    let fields;
    
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
    
    console.log(`Line ${i+1}: Fields detected:`, fields);
    
    if (!fields || fields.length < 3) {
      console.log(`Skipping line ${i+1}: Not enough fields. Found: ${fields?.length || 0} fields`);
      skippedLinesCount++;
      continue;
    }
    
    const dateField = fields[columnIndices.dateIndex];
    const descriptionField = fields[columnIndices.descriptionIndex];
    
    let amount;
    let isExpense = false;
    
    if (columnIndices.withdrawalIndex >= 0 && columnIndices.depositIndex >= 0) {
      console.log("Using separate withdrawal/deposit columns");
      
      const withdrawalStr = fields[columnIndices.withdrawalIndex]?.trim();
      const depositStr = fields[columnIndices.depositIndex]?.trim();
      
      console.log(`Line ${i+1}: Processing withdrawal: "${withdrawalStr}", deposit: "${depositStr}"`);
      
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
    
    if (!dateField || !descriptionField || amount === null) {
      console.log(`Skipping line ${i+1}: Missing essential fields. Found: date=${dateField}, desc=${descriptionField}, amount=${amount}`);
      skippedLinesCount++;
      continue;
    }
    
    const date = parseDate(dateField);
    const description = descriptionField.trim();
    
    console.log(`Line ${i+1}: Parsed values:`, { date, description, amount, isExpense });
    
    const type = isExpense ? 'expense' : 'income';
    
    console.log(`Line ${i+1}: Transaction type: ${type}`);
    
    // Fixed categorization logic here
    let category;
    if (type === 'income') {
      category = 'Income';
    } else {
      // For expenses, ensure we're passing a negative value to categorize correctly
      category = categorizeTransaction(description, -1);
    }
    
    console.log(`Line ${i+1}: Determined category: ${category} for description: ${description}`);
    
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
  return transactions;
}
