export const useApi = () => {
    const apiUrl = process.env.REACT_APP_API_URL || '';
  
    const fetchData = async <T = any>(endpoint: string, options = {}): Promise<T | string> => {
      try {
        const response = await fetch(`${apiUrl}${endpoint}`, options);
  
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
  
        const responseBody = await response.text(); // Read body as text once
  
        try {
          return JSON.parse(responseBody) as T;
        } catch (jsonError) {
          // If parsing fails, return the plain text
          return responseBody as string;
        }
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
    };
  
    return { fetchData };
  };