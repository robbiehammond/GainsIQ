use std::env;
use std::collections::HashMap;
use std::sync::OnceLock;

use log::warn;

static API_KEY_MAP: OnceLock<HashMap<String, String>> = OnceLock::new();

fn get_api_key_map() -> &'static HashMap<String, String> {
    API_KEY_MAP.get_or_init(|| {
        // Get the JSON mapping from environment variable
        match env::var("API_KEY_MAP") {
            Ok(json_str) => match serde_json::from_str(&json_str) {
                Ok(map) => map,
                Err(e) => {
                    warn!("Failed to parse API_KEY_MAP: {}", e);
                    HashMap::new()
                }
            },
            Err(_) => HashMap::new()
        }
    })
}

pub fn get_user_for_api_key(api_key: &str) -> Option<&'static String> {
    get_api_key_map().get(api_key)
}