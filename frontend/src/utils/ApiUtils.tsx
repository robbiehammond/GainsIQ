import { GainsIQClient } from "gainsiq-sdk";

// env is determined by the build. If we do start:preprod or build:preprod, REACT_APP_ENV is defined.
export const environment = process.env.REACT_APP_ENV || "prod";
export const apiUrl = environment === "preprod" ? process.env.REACT_APP_API_URL_PREPROD : process.env.REACT_APP_API_URL
export const client = new GainsIQClient(apiUrl!);
