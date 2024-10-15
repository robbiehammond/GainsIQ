use lambda_runtime::{service_fn, Error};
use backend_rs::handler;

#[tokio::main]
async fn main() -> Result<(), Error> {
    env_logger::init();
    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}