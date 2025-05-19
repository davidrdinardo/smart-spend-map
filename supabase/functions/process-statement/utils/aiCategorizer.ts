
import { categories } from "./categories.ts";

// Function to categorize transactions using OpenAI in batches
export async function categorizeWithAI(description: string, amount: number): Promise<string> {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.warn("OpenAI API key not found, falling back to rule-based categorization");
      return fallbackCategorization(description, amount);
    }

    const systemPrompt = `
      Categorize the following transaction into one of these categories:
      Housing, Transportation, Groceries, Dining Out, Utilities, Subscriptions, Healthcare, Insurance, 
      Child Care, Education, Entertainment, Travel, Personal Care, Gifts/Donations, Savings/Investments, Income, Other.
      Return ONLY the category name with proper capitalization.
    `;
    
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Description: ${description}, Amount: ${amount < 0 ? "expense" : "income"} $${Math.abs(amount)}` }
          ],
          temperature: 0.3,
          max_tokens: 20
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error("OpenAI API error:", error);
        return fallbackCategorization(description, amount);
      }
      
      const data = await response.json();
      let category = data.choices[0].message.content.trim();
      
      // Ensure proper formatting
      if (category) {
        return standardizeCategory(category);
      }
      
      return fallbackCategorization(description, amount);
    } catch (error) {
      console.error("Error in OpenAI API call:", error);
      return fallbackCategorization(description, amount);
    }
  } catch (error) {
    console.error("Error categorizing with AI:", error);
    return fallbackCategorization(description, amount);
  }
}

// Estimate tokens for a string (approx 4 chars = 1 token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// New batch categorization function optimized for token efficiency
export async function categorizeBatch(transactions: { description: string, amount: number }[]): Promise<string[]> {
  if (transactions.length === 0) return [];
  
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY || transactions.length === 1) {
    // For single transaction or no API key, use the regular function
    return Promise.all(
      transactions.map(tx => fallbackCategorization(tx.description, tx.amount))
    );
  }
  
  // Token limits and estimates
  const MAX_TOKENS = 4000;
  const MAX_COMPLETION_TOKENS = 500;
  const AVAILABLE_TOKENS = MAX_TOKENS - MAX_COMPLETION_TOKENS;
  
  const systemPrompt = `
    You are a financial transaction categorizer. Categorize each transaction into one of these categories:
    Housing, Transportation, Groceries, Dining Out, Utilities, Subscriptions, Healthcare, Insurance, 
    Child Care, Education, Entertainment, Travel, Personal Care, Gifts/Donations, Savings/Investments, Income, Other.
    
    Format your response as a JSON array with ONLY category names, no explanations. Each category should
    correspond to the transaction at the same index. Example response format: ["Housing", "Groceries", "Income"]
  `;
  
  const systemPromptTokens = estimateTokens(systemPrompt);
  console.log(`System prompt estimated tokens: ${systemPromptTokens}`);
  
  // Split transactions into chunks based on token estimates
  const chunks: Array<{ description: string, amount: number }[]> = [];
  let currentChunk: { description: string, amount: number }[] = [];
  let currentTokens = systemPromptTokens;
  
  for (const tx of transactions) {
    // Estimate tokens for this transaction
    const txText = JSON.stringify({
      description: tx.description,
      amount: tx.amount < 0 ? "expense" : "income",
      value: Math.abs(tx.amount)
    });
    const txTokens = estimateTokens(txText);
    
    // Check if adding this transaction would exceed the token limit
    if (currentTokens + txTokens > AVAILABLE_TOKENS && currentChunk.length > 0) {
      // Start a new chunk
      chunks.push(currentChunk);
      currentChunk = [tx];
      currentTokens = systemPromptTokens + txTokens;
    } else {
      // Add to the current chunk
      currentChunk.push(tx);
      currentTokens += txTokens;
    }
  }
  
  // Add the last chunk if it has any transactions
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  console.log(`Split ${transactions.length} transactions into ${chunks.length} chunks for processing`);
  
  // Process each chunk
  const results: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length} with ${chunk.length} transactions...`);
    
    try {
      // Format transactions as compact JSON
      const txData = chunk.map(tx => ({
        desc: tx.description,
        amt: tx.amount < 0 ? "expense" : "income",
        val: Math.abs(tx.amount)
      }));
      
      // Make the API call
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(txData) }
          ],
          temperature: 0.3,
          max_tokens: MAX_COMPLETION_TOKENS,
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`OpenAI API error for chunk ${i + 1}:`, error);
        throw new Error(`OpenAI API error: ${error}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      
      // Parse the response and get categories
      try {
        const parsedResponse = JSON.parse(content);
        const chunkCategories = Array.isArray(parsedResponse.categories) 
          ? parsedResponse.categories 
          : (Array.isArray(parsedResponse) ? parsedResponse : []);
        
        // Validate we have the right number of categories
        if (chunkCategories.length !== chunk.length) {
          console.error(`Response length mismatch. Expected ${chunk.length}, got ${chunkCategories.length}`);
          // Fall back to rule-based for this chunk
          const fallbackCategories = await Promise.all(
            chunk.map(tx => fallbackCategorization(tx.description, tx.amount))
          );
          results.push(...fallbackCategories);
        } else {
          // Standardize and add categories to results
          const standardizedCategories = chunkCategories.map(cat => standardizeCategory(String(cat)));
          results.push(...standardizedCategories);
        }
      } catch (parseError) {
        console.error(`Error parsing OpenAI response for chunk ${i + 1}:`, parseError, "Response:", content);
        // Fall back to rule-based for this chunk
        const fallbackCategories = await Promise.all(
          chunk.map(tx => fallbackCategorization(tx.description, tx.amount))
        );
        results.push(...fallbackCategories);
      }
      
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
    } catch (chunkError) {
      console.error(`Error processing chunk ${i + 1}:`, chunkError);
      // Fall back to rule-based for this chunk
      const fallbackCategories = await Promise.all(
        chunk.map(tx => fallbackCategorization(tx.description, tx.amount))
      );
      results.push(...fallbackCategories);
    }
  }
  
  return results;
}

// Fallback to rule-based categorization if AI fails
function fallbackCategorization(description: string, amount: number): string {
  const lowerDescription = description.toLowerCase();
  
  // If it's income
  if (amount > 0) {
    return "Income";
  }
  
  // Check each category's keywords
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerDescription.includes(keyword))) {
      // Return properly formatted category name
      return standardizeCategory(category);
    }
  }
  
  // Default category
  return "Other";
}

// Helper function to standardize category names
export function standardizeCategory(category: string): string {
  // Check against recognized categories list first
  const recognizedCategories = [
    "Housing", "Transportation", "Groceries", "Dining Out", "Utilities", 
    "Subscriptions", "Healthcare", "Insurance", "Child Care", "Education", 
    "Entertainment", "Travel", "Personal Care", "Gifts/Donations", 
    "Savings/Investments", "Income", "Other", "Bank Fees", "Taxes", "Uncategorized Expense"
  ];
  
  // Try direct match first (case insensitive)
  for (const validCategory of recognizedCategories) {
    if (category.toLowerCase() === validCategory.toLowerCase()) {
      return validCategory;
    }
  }
  
  // Handle special cases
  if (category.toLowerCase() === 'diningout') return 'Dining Out';
  if (category.toLowerCase() === 'personalcare') return 'Personal Care';
  if (category.toLowerCase() === 'childcare') return 'Child Care';
  if (category.toLowerCase() === 'uncategorizedexpense') return 'Uncategorized Expense';
  if (category.toLowerCase() === 'bankfees') return 'Bank Fees';
  
  // General case: Convert camelCase to Title Case with spaces
  const formattedCategory = category
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim(); // Remove any leading/trailing spaces
  
  // Final check against recognized categories for best match
  for (const validCategory of recognizedCategories) {
    if (formattedCategory.includes(validCategory)) {
      return validCategory;
    }
  }
  
  // If still no match, return the formatted version
  return formattedCategory;
}
