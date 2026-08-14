import { buildApp } from "./app.js";
import { prisma } from "./db.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

await app.listen({ host: "0.0.0.0", port });

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
