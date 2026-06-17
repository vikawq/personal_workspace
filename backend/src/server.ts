import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CredentialItem, EncryptedVault, PersistedVault, WorkbenchState } from "./types.js";

const port = Number(process.env.PORT ?? 3000);
const dataFile = process.env.DATA_FILE ?? "data/workbench.json";
const apiToken = process.env.API_TOKEN ?? "";
const encryptionKey = readEncryptionKey();
const encryptionSalt = process.env.ENCRYPTION_SALT ?? "personal-workbench:v1";
const maxBodyBytes = 2 * 1024 * 1024;

const emptyState: WorkbenchState = {
  commands: [],
  credentials: [],
  calendar: [],
};

createServer(async (request, response) => {
  setCommonHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, service: "personal-workbench-api", encryptedAtRest: true });
      return;
    }

    if (!url.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      sendJson(response, 200, await readVault());
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/state") {
      const body = await readJsonBody(request);
      const state = extractState(body);
      const vault: PersistedVault = {
        state,
        updatedAt: new Date().toISOString(),
      };
      await writeVault(vault);
      sendJson(response, 200, vault);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    sendJson(response, message.includes("Invalid") ? 400 : 500, { error: message });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`personal-workbench-api listening on ${port}`);
});

function setCommonHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function isAuthorized(request: IncomingMessage): boolean {
  if (!apiToken) {
    return true;
  }

  return request.headers.authorization === `Bearer ${apiToken}`;
}

async function readVault(): Promise<PersistedVault> {
  try {
    const content = await readFile(dataFile, "utf8");
    const raw = JSON.parse(content) as Partial<PersistedVault> | Partial<EncryptedVault>;
    const parsed = isEncryptedVault(raw) ? decryptVault(raw) : raw;
    const state = sanitizeState(parsed.state);
    const vault = {
      state,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
    if (!isEncryptedVault(raw) || JSON.stringify(parsed.state) !== JSON.stringify(state)) {
      vault.updatedAt = new Date().toISOString();
      await writeVault(vault);
    }
    return vault;
  } catch {
    return {
      state: emptyState,
      updatedAt: "",
    };
  }
}

async function writeVault(vault: PersistedVault): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });
  const tempFile = `${dataFile}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(encryptVault(vault), null, 2)}\n`, "utf8");
  await rename(tempFile, dataFile);
}

function readEncryptionKey(): string {
  const value = process.env.ENCRYPTION_KEY;
  if (!value || value.length < 32) {
    throw new Error("ENCRYPTION_KEY must be set and at least 32 characters long");
  }
  return value;
}

function deriveEncryptionKey(): Buffer {
  return scryptSync(encryptionKey, encryptionSalt, 32);
}

function encryptVault(vault: PersistedVault): EncryptedVault {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(vault), "utf8"), cipher.final()]);

  return {
    version: 2,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    updatedAt: vault.updatedAt,
  };
}

function decryptVault(vault: Partial<EncryptedVault>): PersistedVault {
  if (!vault.iv || !vault.authTag || !vault.ciphertext) {
    throw new Error("Invalid encrypted vault");
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(), Buffer.from(vault.iv, "base64"));
  decipher.setAuthTag(Buffer.from(vault.authTag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(vault.ciphertext, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as PersistedVault;
}

function isEncryptedVault(value: Partial<PersistedVault> | Partial<EncryptedVault>): value is Partial<EncryptedVault> {
  return "version" in value && value.version === 2 && "ciphertext" in value;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBodyBytes) {
      throw new Error("Invalid request body: too large");
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    throw new Error("Invalid request body: empty");
  }
  return JSON.parse(text);
}

function extractState(value: unknown): WorkbenchState {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid state payload");
  }

  const candidate = "state" in value ? (value as { state: unknown }).state : value;
  return sanitizeState(candidate);
}

function sanitizeState(value: unknown): WorkbenchState {
  if (typeof value !== "object" || value === null) {
    return emptyState;
  }

  const candidate = value as Partial<WorkbenchState>;
  return {
    commands: Array.isArray(candidate.commands) ? candidate.commands : [],
    credentials: Array.isArray(candidate.credentials) ? candidate.credentials.map(normalizeCredential) : [],
    calendar: Array.isArray(candidate.calendar) ? candidate.calendar : [],
  };
}

function normalizeCredential(item: CredentialItem): CredentialItem {
  return {
    ...item,
    password: normalizeCredentialPassword(item.password ?? ""),
  };
}

function normalizeCredentialPassword(value: string): string {
  return value.replace(/^[\t\r\n]+|[\t\r\n]+$/g, "");
}
