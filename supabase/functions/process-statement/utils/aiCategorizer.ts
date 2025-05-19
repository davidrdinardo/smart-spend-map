
import { categories } from "./categories.ts";

// Function to categorize transactions using OpenAI
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
      // Standardize format - capitalize words
      category = category
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
      
      // Check if it's a recognized category, otherwise use "Other"
      const recognizedCategories = [
        "Housing", "Transportation", "Groceries", "Dining Out", "Utilities", 
        "Subscriptions", "Healthcare", "Insurance", "Child Care", "Education", 
        "Entertainment", "Travel", "Personal Care", "Gifts/Donations", 
        "Savings/Investments", "Income", "Other"
      ];
      
      if (!recognizedCategories.includes(category)) {
        category = "Other";
      }
      
      return category;
    }
    
    return fallbackCategorization(description, amount);
  } catch (error) {
    console.error("Error categorizing with AI:", error);
    return fallbackCategorization(description, amount);
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
  // Handle special cases
  if (category === 'diningOut') return 'Dining Out';
  if (category === 'personalCare') return 'Personal Care';
  if (category === 'childcare') return 'Child Care';
  if (category === 'uncategorizedExpense') return 'Other';
  if (category === 'bankFees') return 'Bank Fees';
  
  // General case: Convert camelCase to Title Case with spaces
  return category
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim(); // Remove any leading/trailing spaces
}
