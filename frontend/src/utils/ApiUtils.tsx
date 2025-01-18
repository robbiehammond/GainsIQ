// env is determined by the build. If we do start:preprod or build:preprod, REACT_APP_ENV is defined.
export const environment = process.env.REACT_APP_ENV || "prod";
export const apiUrl = environment === "preprod" ? process.env.REACT_APP_API_URL_PREPROD : process.env.REACT_APP_API_URL

export const useApi = () => {
    const fetchData = async <T = any>(endpoint: string, options = {}): Promise<T | string> => {
      try {
        const response = await fetch(`${apiUrl}${endpoint}`, options);
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
        console.log(response);
        return await response.json();

      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
    };
  
    return { fetchData };
  };
