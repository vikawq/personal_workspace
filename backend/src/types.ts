export interface CommandItem {
  id: string;
  title: string;
  command: string;
  tags: string[];
  createdAt: string;
}

export interface CredentialItem {
  id: string;
  name: string;
  host: string;
  username: string;
  port: string;
  password: string;
  note: string;
  createdAt: string;
}

export interface CalendarEntry {
  id: string;
  date: string;
  done: string;
  planned: string;
  note: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  tags: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbenchState {
  commands: CommandItem[];
  credentials: CredentialItem[];
  calendar: CalendarEntry[];
  blogs: BlogPost[];
}

export interface PersistedVault {
  state: WorkbenchState;
  updatedAt: string;
}

export interface EncryptedVault {
  version: 2;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
  updatedAt: string;
}
