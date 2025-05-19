
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

// New batch categorization function to process up to 100 transactions at once
export async function categorizeBatch(transactions: { description: string, amount: number }[]): Promise<string[]> {
  if (transactions.length === 0) return [];
  
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY || transactions.length === 1) {
    // For single transaction or no API key, use the regular function
    return Promise.all(
      transactions.map(tx => fallbackCategorization(tx.description, tx.amount))
    );
  }
  
  try {
    console.log(`Batch categorizing ${transactions.length} transactions with OpenAI`);
    
    const systemPrompt = `
      You will be given a list of financial transactions. 
      Categorize each transaction into one of these categories:
      Housing, Transportation, Groceries, Dining Out, Utilities, Subscriptions, Healthcare, Insurance, 
      Child Care, Education, Entertainment, Travel, Personal Care, Gifts/Donations, Savings/Investments, Income, Other.
      
      For each transaction, ONLY return the appropriate category name with proper capitalization.
      Format your response as a JSON array of category names, with one category per transaction, in the same order.
    `;
    
    const userContent = transactions.map((tx, index) => 
      `Transaction ${index + 1}: Description: ${tx.description}, Amount: ${tx.amount < 0 ? "expense" : "income"} $${Math.abs(tx.amount)}`
    ).join("\n");
    
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
            { role: "user", content: userContent }
          ],
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error("OpenAI API batch error:", error);
        throw new Error(`OpenAI API error: ${error}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      
      // Parse the JSON response safely
      try {
        const jsonResponse = JSON.parse(content);
        if (Array.isArray(jsonResponse.categories)) {
          // Ensure we have the correct number of categories
          if (jsonResponse.categories.length === transactions.length) {
            // Standardize each category
            return jsonResponse.categories.map(cat => standardizeCategory(String(cat)));
          }
        }
        
        console.error("Invalid response format from OpenAI batch categorization:", content);
        throw new Error("Invalid response format");
      } catch (parseError) {
        console.error("Error parsing OpenAI batch response:", parseError, "Response was:", content);
        throw parseError;
      }
    } catch (apiError) {
      console.error("Error in OpenAI batch API call:", apiError);
      throw apiError;
    }
  } catch (error) {
    console.error("Batch categorization failed, falling back to individual categorization:", error);
    // Fall back to individual categorization
    return Promise.all(
      transactions.map(tx => fallbackCategorization(tx.description, tx.amount))
    );
  }
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
