import { config } from "../src/config.js";

const url = `http://127.0.0.1:${config.port}/health`;

try {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    console.error("UNHEALTHY", res.status, JSON.stringify(body));
    process.exit(1);
  }
  console.log("HEALTHY", JSON.stringify(body));
  process.exit(0);
} catch (e) {
  console.error(`Could not reach ${url}. Is the BFF running (npm run dev)?`, (e as Error).message);
  process.exit(1);
}
