use std::fs;
use std::collections::HashMap;
use log::warn;
use serde::{Deserialize};
use std::sync::OnceLock;

// Type alias for clarity
type ApiKeyMap = HashMap<String, String>;

// Static reference to load the file only once per Lambda instance
static API_KEY_MAP: OnceLock<ApiKeyMap> = OnceLock::new();

fn get_api_key_map() -> &'static ApiKeyMap {
    API_KEY_MAP.get_or_init(|| {
        // Load from the deployment package
        let contents = match fs::read_to_string("api_key_map.json") {
            Ok(content) => content,
            Err(e) => {
                warn!("Failed to read API key map file: {}", e);
                "{}".to_string() 
            }
        };
        
        match serde_json::from_str(&contents) {
            Ok(map) => map,
            Err(e) => {
                warn!("Failed to parse API key map: {}", e);
                HashMap::new() 
            }
        }
    })
}

// Function to get user from API key
pub fn get_user_for_api_key(api_key: &str) -> Option<&'static String> {
    get_api_key_map().get(api_key)
}