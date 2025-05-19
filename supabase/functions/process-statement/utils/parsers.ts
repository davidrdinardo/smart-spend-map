
// Parse CSV line handling quoted fields correctly
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
      continue;
    }
    
    if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        // Handle escaped quotes
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
      continue;
    }
    
    if (char === ',' && !inQuotes) {
      fields.push(currentField.trim());
      currentField = '';
      continue;
    }
    
    currentField += char;
  }
  
  // Add the last field
  fields.push(currentField.trim());
  
  return fields;
}

// Detect headers in CSV files
export function detectHeaderColumns(headerLine: string): { 
  dateIndex: number; 
  descriptionIndex: number; 
  amountIndex: number;
  withdrawalIndex: number;
  depositIndex: number;
} {
  // Default indices - used if we can't detect headers
  let dateIndex = 0;
  let descriptionIndex = 1;
  let amountIndex = 2;
  let withdrawalIndex = -1;
  let depositIndex = -1;
  
  try {
    // Parse the header line
    let headers: string[];
    if (headerLine.includes('"')) {
      headers = parseCSVLine(headerLine);
    } else if (headerLine.includes('\t')) {
      headers = headerLine.split('\t');
    } else if (headerLine.includes(',')) {
      headers = headerLine.split(',');
    } else {
      headers = headerLine.split(/\s+/);
    }
    
    // Normalize headers to lowercase for easier matching
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    // Look for date columns
    const dateKeywords = ['date', 'time', 'day', 'posted'];
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (dateKeywords.some(keyword => normalizedHeaders[i].includes(keyword))) {
        dateIndex = i;
        break;
      }
    }
    
    // Look for description columns
    const descriptionKeywords = ['desc', 'memo', 'narration', 'detail', 'transaction', 'payee', 'name', 'merchant', 'particulars'];
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (descriptionKeywords.some(keyword => normalizedHeaders[i].includes(keyword))) {
        descriptionIndex = i;
        break;
      }
    }
    
    // Check for withdrawal/deposit format
    const withdrawalKeywords = ['withdraw', 'debit', 'payment', 'out', '-amt', 'spent', 'expense'];
    const depositKeywords = ['deposit', 'credit', 'received', 'in', '+amt', 'income', 'revenue'];
    
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (withdrawalKeywords.some(keyword => normalizedHeaders[i].includes(keyword))) {
        withdrawalIndex = i;
      }
      if (depositKeywords.some(keyword => normalizedHeaders[i].includes(keyword))) {
        depositIndex = i;
      }
    }
    
    // If we're not in withdrawal/deposit format, look for amount column
    if (withdrawalIndex === -1 || depositIndex === -1) {
      const amountKeywords = ['amount', 'amt', 'sum', 'value', 'price', 'total', 'cost', 'balance'];
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (amountKeywords.some(keyword => normalizedHeaders[i].includes(keyword))) {
          amountIndex = i;
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error detecting header columns:", error);
    // Use default indices if there's an error
  }
  
  console.log(`Detected column indices: date=${dateIndex}, desc=${descriptionIndex}, amount=${amountIndex}, withdrawal=${withdrawalIndex}, deposit=${depositIndex}`);
  
  return {
    dateIndex,
    descriptionIndex,
    amountIndex,
    withdrawalIndex,
    depositIndex
  };
}

// Parse date string to standard format
export function parseDate(dateString: string): string {
  try {
    // Handle various date formats like MM/DD/YYYY, YYYY-MM-DD, etc.
    const formats = [
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, transform: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, transform: (m: RegExpMatchArray) => `20${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
      { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, transform: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
      { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, transform: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` }
    ];
    
    for (const format of formats) {
      const match = dateString.match(format.regex);
      if (match) {
        return format.transform(match);
      }
    }
    
    // Fallback: return the original string if no format matches
    return dateString;
  } catch (error) {
    console.error("Error parsing date:", dateString, error);
    return dateString;
  }
}

// Parse amount string to number
export function parseAmount(amountString: string): number | null {
  try {
    if (!amountString) return null;
    
    // Clean up the string
    let cleaned = amountString.trim();
    
    // Check if it's a negative amount in parentheses like (123.45)
    const isNegative = cleaned.startsWith('-') || 
                       cleaned.startsWith('(') && cleaned.endsWith(')') || 
                       cleaned.toLowerCase().includes('dr');
    
    // Remove all non-numeric characters except for decimal point
    cleaned = cleaned.replace(/[^\d.-]/g, '');
    
    // Handle case where there might be multiple decimal points
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Convert to number
    let amount = parseFloat(cleaned);
    
    // Apply negative if needed
    if (isNegative && amount > 0) {
      amount = -amount;
    }
    
    return isNaN(amount) ? null : amount;
  } catch (error) {
    console.error("Error parsing amount:", amountString, error);
    return null;
  }
}

// Check if a line appears to contain transaction data
export function looksLikeTransactionLine(line: string): boolean {
  // Check if line contains a date pattern and amount pattern
  const datePattern = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/;
  const amountPattern = /\$?\s*[\d,]+\.\d{2}|-?\$?\s*[\d,]+\.\d{2}|\([\d,]+\.\d{2}\)/;
  
  return datePattern.test(line) && amountPattern.test(line);
}
