export type Tab = "commands" | "credentials" | "calendar";

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

export interface WorkbenchState {
  commands: CommandItem[];
  credentials: CredentialItem[];
  calendar: CalendarEntry[];
}

export type WorkbenchItem = CommandItem | CredentialItem | CalendarEntry;

export interface EditingState {
  type: Tab;
  id: string;
}

export type DraftByTab = {
  commands: Omit<CommandItem, "id">;
  credentials: Omit<CredentialItem, "id">;
  calendar: Omit<CalendarEntry, "id">;
};
