import Fastify from "fastify";
import type { Invoice } from "./data.js";
import { prisma } from "./db.js";

const TEE_URL = process.env.EXT_PROXY_URL ?? "";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("access-control-allow-origin", process.env.CORS_ORIGIN ?? "*");
    reply.header("access-control-allow-headers", "content-type");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.get("/health", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        database: true,
        ok: true,
        product: "cleat",
        protocolAuthority: "coston2",
        teeConfigured: Boolean(TEE_URL),
      };
    } catch {
      return reply.code(503).send({
        database: false,
        ok: false,
        product: "cleat",
        protocolAuthority: "coston2",
        teeConfigured: Boolean(TEE_URL),
      });
    }
  });

  app.get("/invoices", async () => {
    const rows = await prisma.invoice.findMany({ orderBy: { invoiceNumber: "asc" } });
    const invoices: Invoice[] = rows.map((row) => ({
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
      debtorName: row.debtorName,
      dueDate: row.dueDate.toISOString(),
      id: row.id,
      invoiceNumber: row.invoiceNumber,
    }));

    return { invoices };
  });

  app.get("/lender/invoices/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const invoice = await prisma.invoice.findUnique({
      include: {
        commitments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      where: { id },
    });
    if (!invoice) {
      return reply.code(404).send({ error: "not found" });
    }

    const latestCommitment = invoice.commitments[0]?.commitment ?? null;
    return {
      commitment: latestCommitment,
      disclosed: {
        amount: "NOT DISCLOSED",
        debtorName: "NOT DISCLOSED",
        invoiceNumber: "NOT DISCLOSED",
      },
      protocol: {
        eligible: null,
        reason: null,
        requestId: null,
        status: null,
        txHash: null,
      },
      termsShown: null,
    };
  });

  app.get("/activity", async () => {
    const rows = await prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      activity: rows.map((row) => ({
        at: row.createdAt.toISOString(),
        commitment: row.commitment,
        event: row.event,
        id: row.id,
        result: row.result,
        txHash: row.txHash,
      })),
    };
  });

  app.post("/protocol/:command", async (req, reply) => {
    const { command } = req.params as { command: string };
    const allowed = new Set(["check", "pledge", "release", "status"]);
    if (!allowed.has(command)) {
      return reply.code(400).send({ error: "unknown command" });
    }

    const body = (req.body ?? {}) as { invoiceId?: string };
    if (!body.invoiceId) {
      return reply.code(400).send({ error: "invoiceId is required" });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice) {
      return reply.code(404).send({ error: "invoice not found" });
    }

    if (!TEE_URL) {
      await recordAttempt(command, "TEE_NOT_CONFIGURED");
      return reply.code(503).send({
        command: command.toUpperCase(),
        error: "TEE not configured. Set EXT_PROXY_URL.",
        invoiceId: invoice.id,
        ok: false,
      });
    }

    try {
      const res = await fetch(`${TEE_URL.replace(/\/$/, "")}/info`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        throw new Error(`proxy ${res.status}`);
      }
    } catch (error) {
      await recordAttempt(command, "TEE_PROXY_UNREACHABLE");
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "proxy failed",
        ok: false,
      });
    }

    await recordAttempt(command, "CLIENT_SIGNATURE_REQUIRED");
    return reply.code(409).send({
      command: command.toUpperCase(),
      error: "Submit this protocol action from the connected wallet.",
      invoiceId: invoice.id,
      ok: false,
    });
  });

  return app;
}

async function recordAttempt(command: string, result: string) {
  await prisma.auditEvent.create({
    data: {
      commitment: null,
      event: command.toUpperCase(),
      result,
      txHash: null,
    },
  });
}
