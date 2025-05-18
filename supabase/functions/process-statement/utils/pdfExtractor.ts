
// Function to extract PDF text (without using pdf-parse which has compatibility issues)
export async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    const textDecoder = new TextDecoder('utf-8');
    let text = '';
    
    const str = textDecoder.decode(uint8Array);
    
    const textMarkers = str.match(/BT.*?ET/gs);
    if (textMarkers && textMarkers.length > 0) {
      for (const marker of textMarkers) {
        const textMatches = marker.match(/\((.*?)\)|\<(.*?)\>/g);
        if (textMatches) {
          for (const match of textMatches) {
            const cleaned = match.replace(/^\(|\)$|^\<|\>$/g, '');
            text += cleaned + ' ';
          }
        }
      }
    }
    
    if (text.trim().length === 0) {
      const datePattern = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/g;
      const amountPattern = /\$\s*[\d,]+\.\d{2}|-\$\s*[\d,]+\.\d{2}|\([\d,]+\.\d{2}\)|\d+\.\d{2}\s*DR|\d+\.\d{2}\s*CR/g;
      
      const dates = str.match(datePattern) || [];
      const amounts = str.match(amountPattern) || [];
      
      if (dates.length > 0 && amounts.length > 0) {
        for (let i = 0; i < Math.min(dates.length, amounts.length); i++) {
          const datePos = str.indexOf(dates[i]);
          const amountPos = str.indexOf(amounts[i]);
          
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
export async function extractTransactionsFromPDF(buffer: ArrayBuffer): Promise<{ date: string, description: string, amount: number }[]> {
  try {
    const text = await extractTextFromPDF(buffer);
    console.log("PDF extracted text sample:", text.substring(0, 500));
    
    const lines = text.split('\n').filter(line => line.trim());
    
    const transactions: { date: string, description: string, amount: number }[] = [];
    
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
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      if (line.length < 10) continue;
      
      let dateMatch = null;
      for (const regex of dateRegexes) {
        const match = line.match(regex);
        if (match) {
          dateMatch = match[1];
          break;
        }
      }
      
      if (!dateMatch) continue;
      
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
      
      let description = line;
      description = description.replace(dateMatch, '').trim();
      
      if (line.includes(amountMatch)) {
        description = description.replace(new RegExp('\\$?\\s*' + amountMatch.replace('.', '\\.') + '\\s*(DR|CR)?'), '').trim();
      }
      
      description = description
        .replace(/^\s*-\s*/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      if (description.length < 3 && i > 0) {
        description = lines[i - 1].trim();
      }
      
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
