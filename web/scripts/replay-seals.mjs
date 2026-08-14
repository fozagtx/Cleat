import { PrismaClient } from "@prisma/client";
import { stringToHex } from "viem";

const TEE_URL = (process.env.EXT_PROXY_URL ?? "").replace(/\/$/, "");
const DIRECT_API_KEY = process.env.DIRECT_API_KEY ?? "";

const prisma = new PrismaClient();

async function main() {
  if (!TEE_URL || !DIRECT_API_KEY) {
    throw new Error("EXT_PROXY_URL and DIRECT_API_KEY are required");
  }
  const rows = await prisma.invoiceCommitment.findMany({
    include: { invoice: true },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    const encryptedBlob = `0x${Buffer.from(row.encryptedBlob).toString("hex")}`;
    const response = await fetch(`${TEE_URL}/direct`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": DIRECT_API_KEY,
      },
      body: JSON.stringify({
        message: encryptedBlob,
        opCommand: stringToHex("SEAL", { size: 32 }),
        opType: stringToHex("CLEAT", { size: 32 }),
      }),
    });
    const detail = await response.text();
    console.log(
      `${row.invoice.invoiceNumber} ${row.commitment.slice(0, 10)} ${response.status} ${detail.slice(0, 120)}`,
    );
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
