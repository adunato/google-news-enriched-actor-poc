import { classifyApiBaseUrl } from "./classify-origin.mjs";

const diagnostic = classifyApiBaseUrl(process.env.APIFY_API_BASE_URL, process.env.APIFY_IS_AT_HOME);
process.stdout.write(`${JSON.stringify(diagnostic)}\n`);
