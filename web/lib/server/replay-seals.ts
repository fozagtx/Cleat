import { stringToHex } from "viem";
import { DIRECT_API_KEY, TEE_URL } from "@/lib/server/cleat";
import { prisma } from "@/lib/server/db";

export async function replayStoredSeals() {
  if (!TEE_URL || !DIRECT_API_KEY) return;
  const rows = await prisma.invoiceCommitment.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  await Promise.all(
    rows.map(async (row) => {
      const encryptedBlob = `0x${Buffer.from(row.encryptedBlob).toString("hex")}`;
      const response = await fetch(`${TEE_URL.replace(/\/$/, "")}/direct`, {
        body: JSON.stringify({
          message: encryptedBlob,
          opCommand: stringToHex("SEAL", { size: 32 }),
          opType: stringToHex("CLEAT", { size: 32 }),
        }),
        headers: {
          "content-type": "application/json",
          "x-api-key": DIRECT_API_KEY,
        },
        method: "POST",
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      if (!response?.ok) {
        console.error("seal replay failed", row.commitment, response?.status);
      }
    }),
  );
}
