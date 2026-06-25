import type { CredentialItem, WorkbenchState } from "./types";

export const STORE_KEY = "personal-workbench-v1";

const now = new Date().toISOString();

export const defaultState: WorkbenchState = {
  commands: [
    {
      id: crypto.randomUUID(),
      title: "查看 GPU 状态",
      command: "watch -n 1 nvidia-smi",
      tags: ["gpu", "debug"],
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: "后台训练模板",
      command: "nohup python train.py --config configs/exp.yaml > logs/train.log 2>&1 &",
      tags: ["train", "nohup"],
      createdAt: now,
    },
  ],
  credentials: [],
  calendar: [],
  blogs: [],
};

export function loadState(): WorkbenchState {
  const saved = localStorage.getItem(STORE_KEY);
  if (!saved) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(saved) as Partial<WorkbenchState>;
    return sanitizeState(parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state: WorkbenchState): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export function sanitizeState(value: Partial<WorkbenchState>): WorkbenchState {
  return {
    commands: Array.isArray(value.commands) ? value.commands : [],
    credentials: Array.isArray(value.credentials) ? value.credentials.map(normalizeCredential) : [],
    calendar: Array.isArray(value.calendar) ? value.calendar : [],
    blogs: Array.isArray(value.blogs) ? value.blogs : [],
  };
}

export function normalizeCredentialPassword(value: string): string {
  return value.replace(/^[\t\r\n]+|[\t\r\n]+$/g, "");
}

function normalizeCredential(item: CredentialItem): CredentialItem {
  return {
    ...item,
    password: normalizeCredentialPassword(item.password ?? ""),
  };
}
