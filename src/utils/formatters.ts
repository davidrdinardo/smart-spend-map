
/**
 * Format a number as currency
 * @param amount - The amount to format
 * @returns The formatted currency string
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format a date string to a more readable format
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}
