
// Categories for transaction classification
export const categories = {
  housing: ["rent", "mortgage", "property tax", "home insurance", "home repair", "maintenance", "hoa", "apartment", "lease", "real estate", "furniture", "decor", "hardware store", "home depot", "lowe's", "ikea"],
  
  utilities: ["electric", "electricity", "water", "gas", "internet", "wifi", "phone", "mobile", "utility", "utilities", "cable", "sewage", "trash", "garbage", "comcast", "verizon", "at&t", "t-mobile", "sprint", "spectrum", "xfinity"],
  
  groceries: ["grocery", "supermarket", "food", "market", "safeway", "kroger", "trader joe's", "whole foods", "aldi", "walmart", "costco", "target", "sam's club", "publix", "wegmans", "food lion", "sprouts", "meijer", "albertsons", "ralphs", "winn-dixie", "giant", "h-e-b", "farmers market", "bakery"],
  
  diningOut: ["restaurant", "cafe", "coffee", "starbucks", "mcdonalds", "dining", "pizza", "burger", "takeout", "ubereats", "doordash", "grubhub", "seamless", "postmates", "delivery", "fast food", "denny's", "applebee's", "chili's", "olive garden", "outback", "chipotle", "panera", "subway", "wendy's", "burger king", "taco bell", "kfc", "ihop", "waffle house", "cheesecake factory", "red lobster", "buffet", "sushi", "thai", "chinese", "mexican", "italian"],
  
  transportation: [
    // Car-related
    "gas", "fuel", "chevron", "shell", "car payment", "auto loan", "car insurance", "auto insurance", "car registration", "vehicle registration", "dmv", "parking", "car wash", "oil change", "repair shop", "auto parts", "tire", "autozone", "o'reilly", "dealership", "car rental", "hertz", "enterprise", "avis", "aamco", "jiffy lube", "midas", "toyota", "honda", "ford", "tesla",
    
    // Public and shared transportation
    "uber", "lyft", "taxi", "cab", "transit", "train", "subway", "bus", "metro", "rail", "ferry", "toll", "transport", "amtrak", "greyhound", "megabus", "rail", "mta", "bart", "caltrain", "commuter"
  ],
  
  healthcare: [
    // Medical providers
    "doctor", "physician", "hospital", "medical", "clinic", "urgent care", "emergency", "specialist", "primary care", "pediatrician", "obgyn", "dermatologist", "orthopedic", "cardiologist", "neurologist", 
    
    // Dental & vision
    "dental", "dentist", "orthodontist", "optometrist", "eye doctor", "glasses", "contacts", "vision", 
    
    // Pharmacy & insurance
    "pharmacy", "prescription", "medicine", "drug store", "cvs", "walgreens", "rite aid", "health insurance", "medical insurance", "copay", "deductible", "medicare", "medicaid"
  ],
  
  entertainment: [
    // Streaming services
    "netflix", "hulu", "disney+", "hbo", "amazon prime", "apple tv", "paramount+", "peacock", "spotify", "pandora", "apple music", "tidal", "youtube premium", "audible", 
    
    // Activities
    "movie", "theater", "cinema", "amc", "regal", "concert", "festival", "theme park", "disney", "universal", "six flags", "museum", "gallery", "zoo", "aquarium", "event", "ticket", "ticketmaster", "stubhub", "seatgeek", "fandango", "entertainment", "bowling", "arcade", "laser tag", "escape room", "comedy", "show"
  ],
  
  shopping: [
    // General retail
    "amazon", "walmart", "target", "costco", "department store", "mall", "outlet", "retail", "online shopping", "ebay", "etsy", 
    
    // Clothing
    "clothing", "apparel", "fashion", "shoes", "boots", "sneakers", "accessories", "jewelry", "watch", "gap", "old navy", "h&m", "zara", "nike", "adidas", "under armour", "lululemon", "macy's", "nordstrom", "tj maxx", "marshall's", "ross", "forever 21", "american eagle", "urban outfitters", "foot locker",
    
    // Electronics
    "electronics", "best buy", "apple store", "microsoft", "gamestop", "computer", "laptop", "phone", "headphone", "camera", "tv", "console", "gaming"
  ],
  
  subscriptions: [
    // Digital subscriptions
    "subscription", "membership", "monthly fee", "annual fee", "recurring", "auto-renewal", 
    
    // Software & services
    "software", "app", "google", "apple", "microsoft", "adobe", "dropbox", "aws", "icloud", "microsoft 365", "office 365", "antivirus", "vpn", "domain", "hosting",
    
    // Memberships
    "gym", "fitness", "planet fitness", "equinox", "la fitness", "club", "association", "society", "organization"
  ],
  
  personalCare: [
    // Beauty services
    "haircut", "salon", "spa", "massage", "nail", "manicure", "pedicure", "facial", "waxing", "barber", "hair color", "beauty", 
    
    // Products
    "cosmetics", "makeup", "skincare", "soap", "shampoo", "lotion", "perfume", "cologne", "grooming", "sephora", "ulta", "bath & body works"
  ],
  
  education: [
    // Formal education
    "tuition", "school", "university", "college", "campus", "student loan", "education", "course", "class", "degree", "academic", "books", "textbooks", "learning", 
    
    // Professional development
    "workshop", "seminar", "conference", "certification", "training", "udemy", "coursera", "skillshare", "masterclass", "bootcamp", "tutorial"
  ],
  
  childcare: ["childcare", "daycare", "nanny", "babysitter", "preschool", "kid", "children", "baby", "toy", "diaper", "formula", "pediatrician", "school supplies", "children's clothing", "playground"],
  
  pets: ["pet", "veterinarian", "vet", "pet store", "petco", "petsmart", "pet food", "pet supplies", "pet insurance", "grooming", "kennel", "boarding", "dog", "cat", "animal"],
  
  travel: [
    // Accommodations
    "hotel", "motel", "inn", "resort", "airbnb", "vrbo", "booking.com", "expedia", "lodging", "stay", 
    
    // Transportation
    "flight", "airline", "airport", "united", "delta", "american airlines", "southwest", "jetblue", "tsa", "cruise", "train", "rental car", 
    
    // General travel
    "vacation", "travel", "trip", "tour", "tourism", "sightseeing", "excursion"
  ],
  
  gifts: ["gift", "present", "donation", "charity", "nonprofit", "contribution", "wedding gift", "birthday gift", "holiday gift", "registry"],
  
  taxes: ["tax", "taxes", "irs", "state tax", "property tax", "tax preparation", "turbotax", "h&r block", "accountant", "cpa", "tax return"],
  
  insurance: ["insurance", "premium", "life insurance", "home insurance", "renter's insurance", "auto insurance", "liability", "umbrella policy", "insurance claim"],
  
  income: ["paycheck", "deposit", "salary", "income", "payment received", "venmo received", "zelle received", "transfer received", "freelance", "interest", "dividend", "refund", "reimbursement", "cash back", "bonus", "commission", "profit", "revenue"],
  
  savings: ["savings", "investment", "401k", "ira", "roth", "etf", "stock", "bond", "mutual fund", "retirement", "brokerage", "fidelity", "vanguard", "charles schwab", "robinhood", "coinbase", "crypto", "bitcoin", "transfer to savings"],
  
  debt: ["loan payment", "credit card payment", "student loan", "debt", "principal", "interest", "financing", "installment", "lending", "credit", "chase", "bank of america", "wells fargo", "citibank", "capital one", "discover", "amex", "american express", "loan servicing"]
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
