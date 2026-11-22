/**
 * Timestamp utilities for Séance.
 * 
 * Wayback Machine timestamps are 14-digit UTC strings in the format
 * YYYYMMDDHHMMSS (year, month, day, hour, minute, second).
 */

/**
 * Parse a 14-digit Wayback timestamp into a Date object.
 * 
 * @param timestamp - A 14-digit string in format YYYYMMDDHHMMSS
 * @returns A Date object representing the timestamp
 * @throws {Error} If the timestamp is invalid (not 14 digits, non-numeric, or impossible date)
 */
export function parseTimestamp(timestamp: string): Date {
  // Validate exact 14 digits
  if (typeof timestamp !== "string" || !/^\d{14}$/.test(timestamp)) {
    throw new Error("invalid-timestamp");
  }

  // Extract components
  const year = parseInt(timestamp.slice(0, 4), 10);
  const month = parseInt(timestamp.slice(4, 6), 10);
  const day = parseInt(timestamp.slice(6, 8), 10);
  const hour = parseInt(timestamp.slice(8, 10), 10);
  const minute = parseInt(timestamp.slice(10, 12), 10);
  const second = parseInt(timestamp.slice(12, 14), 10);

  // Validate ranges
  if (month < 1 || month > 12) {
    throw new Error("invalid-timestamp");
  }

  if (day < 1 || day > 31) {
    throw new Error("invalid-timestamp");
  }

  if (hour < 0 || hour > 23) {
    throw new Error("invalid-timestamp");
  }

  if (minute < 0 || minute > 59) {
    throw new Error("invalid-timestamp");
  }

  if (second < 0 || second > 59) {
    throw new Error("invalid-timestamp");
  }

  // Validate day for the specific month
  const daysInMonth = getDaysInMonth(year, month);
  if (day > daysInMonth) {
    throw new Error("invalid-timestamp");
  }

  // Create Date (UTC)
  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );

  // Verify the date is not invalid (handles cases like Feb 30)
  if (isNaN(date.getTime())) {
    throw new Error("invalid-timestamp");
  }

  // Double-check: the date we created should match our input components
  // This catches edge cases where Date might normalize invalid dates
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new Error("invalid-timestamp");
  }

  return date;
}

/**
 * Format a Date object into a 14-digit Wayback timestamp string.
 * 
 * @param date - A Date object
 * @returns A 14-digit timestamp string in format YYYYMMDDHHMMSS
 */
export function formatTimestamp(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const second = date.getUTCSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 * Format a Wayback timestamp into a human-readable display string.
 * 
 * @param timestamp - A 14-digit Wayback timestamp string
 * @returns A formatted string like "22 Nov 2026, 03:09 UTC"
 */
export function formatDisplay(timestamp: string): string {
  const date = parseTimestamp(timestamp);
  
  const day = date.getUTCDate();
  const daySuffix = getDaySuffix(day);
  const month = getMonthName(date.getUTCMonth());
  const year = date.getUTCFullYear();
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");

  return `${day}${daySuffix} ${month} ${year}, ${hour}:${minute} UTC`;
}

/**
 * Get the number of days in a given month.
 * 
 * @param year - The year
 * @param month - The month (1-12)
 * @returns The number of days in that month
 */
function getDaysInMonth(year: number, month: number): number {
  // Days in each month (non-leap year)
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Check for leap year
  if (month === 2) {
    if ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)) {
      return 29;
    }
  }
  
  return daysInMonth[month - 1];
}

/**
 * Get the ordinal suffix for a day number.
 * 
 * @param day - The day number (1-31)
 * @returns The suffix like "st", "nd", "rd", or "th"
 */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return "th";
  }
  
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Get the month name for a month index (0-11).
 * 
 * @param monthIndex - The month index (0-11)
 * @returns The month name
 */
function getMonthName(monthIndex: number): string {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return monthNames[monthIndex];
}
