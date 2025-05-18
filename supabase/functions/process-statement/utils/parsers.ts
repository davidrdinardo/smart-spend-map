
// Function to parse CSV lines
export function parseCSVLine(line: string): string[] {
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
export function detectHeaderColumns(headerLine: string): {dateIndex: number, descriptionIndex: number, amountIndex: number, withdrawalIndex: number, depositIndex: number} {
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
  
  return {
    dateIndex: dateIndex >= 0 ? dateIndex : 0,
    descriptionIndex: descriptionIndex >= 0 ? descriptionIndex : 1,
    amountIndex: amountIndex >= 0 ? amountIndex : 2,
    withdrawalIndex: withdrawalIndex,
    depositIndex: depositIndex
  };
}

// Function to parse dates from various formats
export function parseDate(dateStr: string): string {
  try {
    const cleanedDate = dateStr.replace(/[^\w\/-]/g, '').trim();
    console.log(`Parsing date: "${dateStr}" (cleaned: "${cleanedDate}")`);
    
    let match;
    let year, month, day;
    
    if ((match = cleanedDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/))) {
      month = match[1].padStart(2, '0');
      day = match[2].padStart(2, '0');
      year = match[3].length === 2 ? `20${match[3]}` : match[3];
      console.log(`Parsed date as MM/DD/YYYY: ${year}-${month}-${day}`);
      return `${year}-${month}-${day}`;
    }
    
    if ((match = cleanedDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/))) {
      year = match[1];
      month = match[2].padStart(2, '0');
      day = match[3].padStart(2, '0');
      console.log(`Parsed date as YYYY/MM/DD: ${year}-${month}-${day}`);
      return `${year}-${month}-${day}`;
    }
    
    if ((match = cleanedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
      console.log(`Date already in YYYY-MM-DD format: ${cleanedDate}`);
      return cleanedDate;
    }
    
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
export function parseAmount(amountStr: string): number | null {
  try {
    let cleaned = amountStr.toString().replace(/[$,\s]/g, '');
    
    console.log(`Parsing amount: "${amountStr}" (cleaned: "${cleaned}")`);
    
    let multiplier = 1;
    if (cleaned.match(/^\(.*\)$/)) {
      cleaned = cleaned.replace(/[()]/g, '');
      multiplier = -1;
      console.log(`Amount in parentheses, applying negative multiplier. Cleaned: "${cleaned}"`);
    }
    
    if (!/^-?\d*\.?\d*$/.test(cleaned)) {
      console.log(`Invalid amount format: "${cleaned}"`);
      return null;
    }
    
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
export function looksLikeTransactionLine(line: string): boolean {
  if ((line.match(/,/g) || []).length >= 2 || (line.match(/\t/g) || []).length >= 2) {
    const hasDatePattern = /\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(line);
    const hasCurrencyPattern = /\$?\d+\.?\d{0,2}/.test(line);
    console.log(`Line transaction check - Has date: ${hasDatePattern}, Has currency: ${hasCurrencyPattern}`);
    return hasDatePattern || hasCurrencyPattern;
  }
  if (line.split(/\s+/).length >= 3) {
    return /\d{4}-\d{2}-\d{2}/.test(line) || /\$?\d+\.?\d{0,2}/.test(line);
  }
  return false;
}
