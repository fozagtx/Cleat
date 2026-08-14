import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { seedInvoices, type AuditRow, type Invoice } from "./data.js";

const app = Fastify({ logger: true });

const invoices: Invoice[] = structuredClone(seedInvoices);
const activity: AuditRow[] = [];
const protocolByCommitment = new Map<
  string,
  { eligible: boolean | null; reason: string | null; status: string | null; requestId: string | null; txHash: string | null }
>();

const TEE_URL = process.env.EXT_PROXY_URL ?? "";

app.addHook("onRequest", async (req, reply) => {
  reply.header("access-control-allow-origin", "*");
  reply.header("access-control-allow-headers", "content-type");
  reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return reply.code(204).send();
  }
});

app.get("/health", async () => ({
  ok: true,
  product: "cleat",
  trust: "not-prisma",
  tee: Boolean(TEE_URL),
}));

app.get("/invoices", async () => ({ invoices }));

app.get("/lender/invoices/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const invoice = invoices.find((row) => row.id === id);
  if (!invoice) {
    return reply.code(404).send({ error: "not found" });
  }
  const commitment = protocolByCommitment.get(invoice.id);
  return {
    commitment: commitment?.requestId ? `pending` : null,
    disclosed: {
      invoiceNumber: "NOT DISCLOSED",
      debtorName: "NOT DISCLOSED",
      amount: "NOT DISCLOSED",
    },
    termsShown: {
      currency: invoice.currency,
      amountMinor: invoice.amountMinor,
      dueDate: invoice.dueDate,
    },
    protocol: commitment ?? {
      eligible: null,
      reason: null,
      status: null,
      requestId: null,
      txHash: null,
    },
  };
});

app.get("/activity", async () => ({ activity }));

app.post("/protocol/:command", async (req, reply) => {
  const { command } = req.params as { command: string };
  const allowed = new Set(["check", "pledge", "release", "status"]);
  if (!allowed.has(command)) {
    return reply.code(400).send({ error: "unknown command" });
  }

  const body = (req.body ?? {}) as { invoiceId?: string; attack?: string };
  const invoice = invoices.find((row) => row.id === body.invoiceId) ?? invoices[0];

  if (!TEE_URL) {
    const row: AuditRow = {
      id: randomUUID(),
      at: new Date().toISOString(),
      event: command.toUpperCase(),
      result: "TEE not reachable",
      commitment: null,
      txHash: null,
    };
    activity.unshift(row);
    return reply.code(503).send({
      ok: false,
      error: "TEE not reachable. Register the extension and set EXT_PROXY_URL.",
      command: command.toUpperCase(),
      invoiceId: invoice.id,
      attack: body.attack ?? null,
    });
  }

  try {
    const res = await fetch(`${TEE_URL.replace(/\/$/, "")}/info`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`proxy ${res.status}`);
    }
  } catch (err) {
    const row: AuditRow = {
      id: randomUUID(),
      at: new Date().toISOString(),
      event: command.toUpperCase(),
      result: "proxy failed",
      commitment: null,
      txHash: null,
    };
    activity.unshift(row);
    return reply.code(502).send({
      ok: false,
      error: err instanceof Error ? err.message : "proxy failed",
    });
  }

  return reply.code(501).send({
    ok: false,
    error: "CHECK/PLEDGE instruction path not registered on Coston2 yet.",
  });
});

const port = Number(process.env.PORT ?? 3001);

await app.listen({ port, host: "0.0.0.0" });
