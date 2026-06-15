import type { WorkbenchState } from "./types";

export interface RemoteVault {
  state: WorkbenchState;
  updatedAt: string;
}

const timeoutMs = 2500;

export async function loadRemoteState(): Promise<RemoteVault> {
  const response = await fetchWithTimeout("/api/state", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return (await response.json()) as RemoteVault;
}

export async function saveRemoteState(state: WorkbenchState): Promise<RemoteVault> {
  const response = await fetchWithTimeout("/api/state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return (await response.json()) as RemoteVault;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}
