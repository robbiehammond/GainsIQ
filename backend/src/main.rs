use handler::handler;
use lambda_runtime::{service_fn, Error};

pub mod exercises;
pub mod utils;
pub mod sets;
pub mod handler;
pub mod weight;

#[tokio::main]
async fn main() -> Result<(), Error> {
    env_logger::init();
    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}