import { GainsIQClient } from "../api/GainsIQClient";

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


export const apiKey = getApiKeyFromCookie()
export const client = new GainsIQClient(apiUrl!, apiKey);
