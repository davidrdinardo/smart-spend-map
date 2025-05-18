
// Categories for transaction classification
export const categories = {
  housing: ["rent", "mortgage", "property", "home", "hoa", "apartment", "childcare"],
  utilities: ["electric", "water", "gas", "internet", "wifi", "phone", "utility", "utilities"],
  groceries: ["grocery", "supermarket", "food", "market", "safeway", "kroger", "trader", "whole foods", "aldi", "walmart"],
  diningOut: ["restaurant", "cafe", "coffee", "starbucks", "mcdonalds", "dining", "pizza", "burger", "takeout", "ubereats", "doordash", "grubhub"],
  transportation: ["gas", "fuel", "uber", "lyft", "taxi", "transit", "train", "subway", "bus", "car", "auto", "vehicle", "insurance"],
  healthcare: ["doctor", "hospital", "medical", "dental", "pharmacy", "health", "insurance"],
  entertainment: ["movie", "netflix", "spotify", "hbo", "amazon prime", "disney", "hulu", "theater", "concert"],
  shopping: ["amazon", "target", "clothing", "department", "store", "retail", "online"],
  subscriptions: ["subscription", "membership", "monthly", "gym"],
  personal: ["haircut", "salon", "spa", "gym", "fitness"],
  education: ["tuition", "school", "course", "book", "university", "college"],
  travel: ["hotel", "flight", "airline", "airbnb", "vacation", "travel"],
  income: ["paycheck", "deposit", "salary", "income", "payment received", "venmo received", "zelle received", "transfer received", "freelance", "interest"],
  savings: ["savings", "investment", "transfer"]
};

// Function to categorize a transaction based on its description
export function categorizeTransaction(description: string, amount: number): string {
  description = description.toLowerCase();
  
  // Check for income first (deposits are typically positive amounts)
  if (amount > 0) {
    return "Income";
  }
  
  // Check expense categories
  for (const [category, keywords] of Object.entries(categories)) {
    if (category === 'income') continue; // Skip the income category for expense transactions
    
    if (keywords.some(keyword => description.includes(keyword))) {
      // Convert first letter to uppercase for category name
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  
  // Default category
  return "Other";
}
