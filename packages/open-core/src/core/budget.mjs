/**
 * Budget checking utilities
 */

/**
 * Check if cost has exceeded budget
 * @param {number} spent - Amount spent (in TWD)
 * @param {number} budget - Budget limit (in TWD)
 * @returns {Object} { exceeded: boolean, spent: number, budget: number, reason?: string }
 */
export function checkBudgetExceeded(spent, budget) {
  // Handle invalid inputs
  if (typeof spent !== 'number' || typeof budget !== 'number') {
    return { exceeded: false, spent: 0, budget: 0 };
  }
  
  // No budget set means no limit
  if (budget <= 0) {
    return { exceeded: false, spent, budget };
  }
  
  const exceeded = spent >= budget;
  const result = { exceeded, spent, budget };
  
  if (exceeded) {
    result.reason = `Budget exceeded: ${spent.toFixed(2)} >= ${budget}`;
  }
  
  return result;
}
