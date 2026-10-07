import "dotenv/config";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { buildHost } from "./host";

const port = Number(process.env.PORT ?? 3210);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535.");
const { app } = await buildHost({
  directory: process.env.SESSION_DIRECTORY ?? "./sessions",
  assets: path.resolve("dist"),
  requireCode: process.env.REQUIRE_CODE_TO_JOIN_PROJECT,
});
await app.listen({ host: "0.0.0.0", port });
console.log(`Constellation tracker: http://localhost:${port}`);
for (const addresses of Object.values(networkInterfaces()))
  for (const address of addresses ?? []) {
    if (!address.internal && address.family === "IPv4")
      console.log(`Local network: http://${address.address}:${port}`);
  }
console.log(
  "Keep this host running while editors are connected. Sessions save automatically.",
);
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    void app.close().then(() => process.exit(0));
  });
