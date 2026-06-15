export interface ParsedSshText {
  host: string;
  username: string;
  port: string;
}

export function parseSshText(value: string): ParsedSshText {
  const parts = value.trim().split(/\s+/);
  const result: ParsedSshText = { host: "", username: "", port: "" };

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (part === "-p" && parts[index + 1]) {
      result.port = parts[index + 1];
      index += 1;
      continue;
    }

    if (part.includes("@")) {
      const [username, host] = part.split("@");
      result.username = username.replace(/^ssh$/, "");
      result.host = host;
      continue;
    }

    if (part !== "ssh" && !part.startsWith("-") && !result.host) {
      result.host = part;
    }
  }

  return result;
}
