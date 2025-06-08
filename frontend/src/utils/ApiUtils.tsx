import { GainsIQClient } from "../api/GainsIQClient";
import { WorkoutSet } from "../types";

// env is determined by the build. If we do start:preprod or build:preprod, REACT_APP_ENV is defined.
export const environment = process.env.REACT_APP_ENV || "prod";
export const apiUrl = environment === "preprod" ? process.env.REACT_APP_API_URL_PREPROD : process.env.REACT_APP_API_URL

const getApiKeyFromCookie = () => {
    const cookies = document.cookie.split(';');
    const apiKeyCookie = cookies.find(cookie => cookie.trim().startsWith('GainsIqApiKey='));
    
    if (apiKeyCookie) {
      return apiKeyCookie.split('=')[1].trim();
    }
    
    return "no key found."
  };

/**
 * Get all sets for a specific calendar date
 * @param date - The date to get sets for (can be Date object or timestamp)
 * @returns Promise<WorkoutSet[]> - Array of workout sets for that date
 */
export const getSetsForDate = async (date: Date | number = new Date()): Promise<WorkoutSet[]> => {
  const targetDate = date instanceof Date ? date : new Date(date);
  
  // Get start and end of the target day in seconds (API expects seconds, not milliseconds)
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

  const startTs = Math.floor(startOfDay / 1000);
  const endTs = Math.floor(endOfDay / 1000);

  const data = await client.getSets({ start: startTs, end: endTs });
  if (!data) return []
  else return data
};

/**
 * Get all sets for today
 * @returns Promise<WorkoutSet[]> - Array of workout sets for today
 */
export const getTodaysSets = async (): Promise<WorkoutSet[]> => {
  return await getSetsForDate(new Date());
};

export const apiKey = getApiKeyFromCookie()
export const client = new GainsIQClient(apiUrl!, apiKey);
