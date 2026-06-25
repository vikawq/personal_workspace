import MarkdownIt from "markdown-it";
import { loadRemoteState, saveRemoteState } from "./api";
import { copyText, readClipboard } from "./clipboard";
import { parseSshText } from "./ssh";
import { loadState, normalizeCredentialPassword, sanitizeState, saveState } from "./storage";
import type {
  CalendarEntry,
  AppMode,
  BlogPost,
  CommandItem,
  CredentialItem,
  DraftByTab,
  EditingState,
  Tab,
  WorkbenchItem,
  WorkbenchState,
} from "./types";
import "./styles.css";

let state = loadState();
let appMode: AppMode = "console";
let activeTab: Tab = "commands";
let editing: EditingState | null = null;
let selectedBlogId: string | null = null;
let editingBlogId: string | null = null;
let toastTimer = 0;
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const els = {
  consoleModeBtn: query<HTMLButtonElement>("#consoleModeBtn"),
  blogModeBtn: query<HTMLButtonElement>("#blogModeBtn"),
  consoleModeView: query<HTMLElement>("#consoleModeView"),
  blogModeView: query<HTMLElement>("#blogModeView"),
  commandForm: query<HTMLFormElement>("#commandForm"),
  commandTitle: query<HTMLInputElement>("#commandTitle"),
  commandTags: query<HTMLInputElement>("#commandTags"),
  commandText: query<HTMLTextAreaElement>("#commandText"),
  credentialForm: query<HTMLFormElement>("#credentialForm"),
  credentialName: query<HTMLInputElement>("#credentialName"),
  credentialHost: query<HTMLInputElement>("#credentialHost"),
  credentialUser: query<HTMLInputElement>("#credentialUser"),
  credentialPort: query<HTMLInputElement>("#credentialPort"),
  credentialPassword: query<HTMLInputElement>("#credentialPassword"),
  credentialNote: query<HTMLInputElement>("#credentialNote"),
  calendarForm: query<HTMLFormElement>("#calendarForm"),
  calendarDate: query<HTMLInputElement>("#calendarDate"),
  calendarDone: query<HTMLTextAreaElement>("#calendarDone"),
  calendarPlanned: query<HTMLTextAreaElement>("#calendarPlanned"),
  calendarNote: query<HTMLInputElement>("#calendarNote"),
  pasteCommandBtn: query<HTMLButtonElement>("#pasteCommandBtn"),
  pasteIpBtn: query<HTMLButtonElement>("#pasteIpBtn"),
  todayBtn: query<HTMLButtonElement>("#todayBtn"),
  searchInput: query<HTMLInputElement>("#searchInput"),
  list: query<HTMLDivElement>("#list"),
  emptyState: query<HTMLDivElement>("#emptyState"),
  toast: query<HTMLDivElement>("#toast"),
  backendStatus: query<HTMLSpanElement>("#backendStatus"),
  tabs: Array.from(document.querySelectorAll<HTMLButtonElement>(".tab")),
  exportBtn: query<HTMLButtonElement>("#exportBtn"),
  importInput: query<HTMLInputElement>("#importInput"),
  clearAllBtn: query<HTMLButtonElement>("#clearAllBtn"),
  commandTemplate: query<HTMLTemplateElement>("#commandCardTemplate"),
  credentialTemplate: query<HTMLTemplateElement>("#credentialCardTemplate"),
  calendarTemplate: query<HTMLTemplateElement>("#calendarCardTemplate"),
  newBlogBtn: query<HTMLButtonElement>("#newBlogBtn"),
  blogList: query<HTMLDivElement>("#blogList"),
  blogViewer: query<HTMLDivElement>("#blogViewer"),
  blogForm: query<HTMLFormElement>("#blogForm"),
  editBlogBtn: query<HTMLButtonElement>("#editBlogBtn"),
  deleteBlogBtn: query<HTMLButtonElement>("#deleteBlogBtn"),
  cancelBlogBtn: query<HTMLButtonElement>("#cancelBlogBtn"),
  blogTitleView: query<HTMLHeadingElement>("#blogTitleView"),
  blogMetaView: query<HTMLParagraphElement>("#blogMetaView"),
  blogRenderedView: query<HTMLElement>("#blogRenderedView"),
  blogEditorTitle: query<HTMLHeadingElement>("#blogEditorTitle"),
  blogTitleInput: query<HTMLInputElement>("#blogTitleInput"),
  blogTagsInput: query<HTMLInputElement>("#blogTagsInput"),
  blogContentInput: query<HTMLTextAreaElement>("#blogContentInput"),
  blogLivePreview: query<HTMLElement>("#blogLivePreview"),
};

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function showToast(message: string): void {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function setBackendStatus(message: string, mode: "idle" | "ok" | "warn" = "idle"): void {
  els.backendStatus.textContent = message;
  els.backendStatus.dataset.mode = mode;
}

async function copyWithToast(text: string, label = "已复制"): Promise<void> {
  await copyText(text);
  showToast(label);
}

function normalizeTags(value: string): string[] {
  return value
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function setActiveTab(tab: Tab): void {
  activeTab = tab;
  els.tabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  render();
}

function setAppMode(mode: AppMode): void {
  if (appMode === mode) {
    return;
  }

  appMode = mode;
  els.consoleModeBtn.classList.toggle("active", mode === "console");
  els.blogModeBtn.classList.toggle("active", mode === "blog");
  els.consoleModeView.hidden = mode !== "console";
  els.blogModeView.hidden = mode !== "blog";

  if (mode === "blog") {
    renderBlogs();
  } else {
    render();
  }
}

function resetEditing(): void {
  editing = null;
  query<HTMLButtonElement>("#commandForm button[type='submit']").textContent = "保存命令";
  query<HTMLButtonElement>("#credentialForm button[type='submit']").textContent = "保存账号";
  query<HTMLButtonElement>("#calendarForm button[type='submit']").textContent = "保存日历";
}

function render(): void {
  els.list.dataset.tab = activeTab;
  const keyword = els.searchInput.value.trim().toLowerCase();
  const items = state[activeTab].filter((item) => stringifyItem(item).includes(keyword));

  els.list.innerHTML = "";
  els.emptyState.hidden = items.length > 0;

  [...items]
    .sort(sortItems)
    .forEach((item) => {
      if (activeTab === "commands") {
        els.list.appendChild(renderCommand(item as CommandItem));
      } else if (activeTab === "credentials") {
        els.list.appendChild(renderCredential(item as CredentialItem));
      } else {
        els.list.appendChild(renderCalendarEntry(item as CalendarEntry));
      }
    });
}

function renderBlogs(): void {
  if (!selectedBlogId && state.blogs.length > 0) {
    selectedBlogId = sortBlogs(state.blogs)[0]?.id ?? null;
  }

  renderBlogDirectory();

  const selected = getSelectedBlog();
  els.editBlogBtn.disabled = !selected;
  els.deleteBlogBtn.disabled = !selected;

  if (!selected) {
    els.blogTitleView.textContent = "选择一篇博客";
    els.blogMetaView.textContent = "从左侧目录选择，或新建一篇 Markdown 博客。";
    els.blogRenderedView.innerHTML = "";
    return;
  }

  els.blogTitleView.textContent = selected.title || "未命名博客";
  els.blogMetaView.textContent = formatBlogMeta(selected);
  els.blogRenderedView.innerHTML = renderMarkdown(selected.content);
}

function renderBlogDirectory(): void {
  els.blogList.innerHTML = "";
  const blogs = sortBlogs(state.blogs);

  if (blogs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "blog-empty";
    empty.textContent = "暂无博客";
    els.blogList.appendChild(empty);
    return;
  }

  blogs.forEach((blog) => {
    const button = document.createElement("button");
    button.className = "blog-list-item";
    button.type = "button";
    button.classList.toggle("active", blog.id === selectedBlogId);
    button.innerHTML = "<strong></strong><span></span>";
    queryIn<HTMLElement>(button, "strong").textContent = blog.title || "未命名博客";
    queryIn<HTMLSpanElement>(button, "span").textContent = formatBlogMeta(blog);
    button.addEventListener("click", () => {
      selectedBlogId = blog.id;
      hideBlogEditor();
      renderBlogs();
    });
    els.blogList.appendChild(button);
  });
}

function sortBlogs(blogs: BlogPost[]): BlogPost[] {
  return [...blogs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function getSelectedBlog(): BlogPost | null {
  return state.blogs.find((blog) => blog.id === selectedBlogId) ?? null;
}

function formatBlogMeta(blog: BlogPost): string {
  const date = formatDate(blog.updatedAt);
  const tags = blog.tags.length > 0 ? ` · ${blog.tags.join(", ")}` : "";
  return `${date}${tags}`;
}

function renderMarkdown(value: string): string {
  return markdown.render(value || "");
}

function showBlogEditor(blog?: BlogPost): void {
  editingBlogId = blog?.id ?? null;
  els.blogViewer.hidden = true;
  els.blogForm.hidden = false;
  els.blogEditorTitle.textContent = blog ? "修改博客" : "新建博客";
  els.blogTitleInput.value = blog?.title ?? "";
  els.blogTagsInput.value = blog?.tags.join(", ") ?? "";
  els.blogContentInput.value = blog?.content ?? "# 新博客\n\n开始记录你的想法。";
  updateBlogPreview();
  els.blogTitleInput.focus();
}

function hideBlogEditor(): void {
  editingBlogId = null;
  els.blogForm.hidden = true;
  els.blogViewer.hidden = false;
}

function updateBlogPreview(): void {
  els.blogLivePreview.innerHTML = renderMarkdown(els.blogContentInput.value);
}

function sortItems(a: WorkbenchItem, b: WorkbenchItem): number {
  if ("date" in a && "date" in b) {
    return b.date.localeCompare(a.date) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function stringifyItem(item: WorkbenchItem): string {
  return Object.values(item).flat().join(" ").toLowerCase();
}

function cloneTemplate(template: HTMLTemplateElement): HTMLElement {
  const element = template.content.firstElementChild?.cloneNode(true);
  if (!(element instanceof HTMLElement)) {
    throw new Error("Template must contain a root element");
  }
  return element;
}

function renderCommand(item: CommandItem): HTMLElement {
  const node = cloneTemplate(els.commandTemplate);
  queryIn<HTMLHeadingElement>(node, "h3").textContent = item.title || "未命名命令";
  queryIn<HTMLSpanElement>(node, ".time").textContent = formatDate(item.createdAt);
  queryIn<HTMLPreElement>(node, "pre").textContent = item.command;

  const tagBox = queryIn<HTMLDivElement>(node, ".tags");
  item.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tagBox.appendChild(chip);
  });

  queryIn<HTMLButtonElement>(node, ".copy").addEventListener("click", () => void copyWithToast(item.command, "命令已复制"));
  queryIn<HTMLButtonElement>(node, ".edit").addEventListener("click", () => editCommand(item));
  queryIn<HTMLButtonElement>(node, ".delete").addEventListener("click", () => deleteItem("commands", item.id));
  return node;
}

function renderCredential(item: CredentialItem): HTMLElement {
  const node = cloneTemplate(els.credentialTemplate);
  queryIn<HTMLHeadingElement>(node, "h3").textContent = item.name || item.host || "未命名账号";
  queryIn<HTMLSpanElement>(node, ".time").textContent = formatDate(item.createdAt);
  queryIn<HTMLParagraphElement>(node, ".note").textContent = item.note || "";

  const grid = queryIn<HTMLDivElement>(node, ".credential-grid");
  [
    ["IP / Host", item.host],
    ["用户名", item.username],
    ["端口", item.port || "22"],
  ].forEach(([label, value]) => {
    const cell = document.createElement("div");
    const key = document.createElement("span");
    const content = document.createElement("strong");
    cell.className = "kv";
    key.textContent = label;
    content.textContent = value || "-";
    cell.append(key, content);
    grid.appendChild(cell);
  });

  queryIn<HTMLButtonElement>(node, ".copy-host").addEventListener("click", () => void copyWithToast(item.host, "IP 已复制"));
  queryIn<HTMLButtonElement>(node, ".copy-user").addEventListener("click", () => void copyWithToast(item.username, "用户名已复制"));
  queryIn<HTMLButtonElement>(node, ".copy-password").addEventListener("click", () =>
    void copyWithToast(normalizeCredentialPassword(item.password), "密码已复制"),
  );
  queryIn<HTMLButtonElement>(node, ".copy-ssh").addEventListener("click", () => {
    const port = item.port || "22";
    void copyWithToast(`ssh -p ${port} ${item.username}@${item.host}`, "SSH 命令已复制");
  });
  queryIn<HTMLButtonElement>(node, ".edit").addEventListener("click", () => editCredential(item));
  queryIn<HTMLButtonElement>(node, ".delete").addEventListener("click", () => deleteItem("credentials", item.id));
  return node;
}

function renderCalendarEntry(item: CalendarEntry): HTMLElement {
  const node = cloneTemplate(els.calendarTemplate);
  queryIn<HTMLHeadingElement>(node, "h3").textContent = formatCalendarTitle(item.date);
  queryIn<HTMLSpanElement>(node, ".time").textContent = formatDate(item.createdAt);
  queryIn<HTMLParagraphElement>(node, ".done").textContent = item.done || "未记录";
  queryIn<HTMLParagraphElement>(node, ".planned").textContent = item.planned || "未记录";
  queryIn<HTMLParagraphElement>(node, ".note").textContent = item.note || "";

  queryIn<HTMLButtonElement>(node, ".copy").addEventListener("click", () => void copyWithToast(formatDailyReport(item), "日报已复制"));
  queryIn<HTMLButtonElement>(node, ".edit").addEventListener("click", () => editCalendarEntry(item));
  queryIn<HTMLButtonElement>(node, ".delete").addEventListener("click", () => deleteItem("calendar", item.id));
  return node;
}

function queryIn<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required child element: ${selector}`);
  }
  return element;
}

function deleteItem(type: Tab, id: string): void {
  if (!confirm("确定删除这条记录吗？")) {
    return;
  }

  if (type === "commands") {
    state.commands = state.commands.filter((item) => item.id !== id);
  } else if (type === "credentials") {
    state.credentials = state.credentials.filter((item) => item.id !== id);
  } else {
    state.calendar = state.calendar.filter((item) => item.id !== id);
  }

  persistState();
  render();
  showToast("已删除");
}

function editCommand(item: CommandItem): void {
  editing = { type: "commands", id: item.id };
  els.commandTitle.value = item.title;
  els.commandTags.value = item.tags.join(", ");
  els.commandText.value = item.command;
  query<HTMLButtonElement>("#commandForm button[type='submit']").textContent = "更新命令";
  els.commandText.focus();
  setActiveTab("commands");
}

function editCredential(item: CredentialItem): void {
  editing = { type: "credentials", id: item.id };
  els.credentialName.value = item.name;
  els.credentialHost.value = item.host;
  els.credentialUser.value = item.username;
  els.credentialPort.value = item.port || "22";
  els.credentialPassword.value = normalizeCredentialPassword(item.password);
  els.credentialNote.value = item.note;
  query<HTMLButtonElement>("#credentialForm button[type='submit']").textContent = "更新账号";
  els.credentialHost.focus();
  setActiveTab("credentials");
}

function editCalendarEntry(item: CalendarEntry): void {
  editing = { type: "calendar", id: item.id };
  els.calendarDate.value = item.date;
  els.calendarDone.value = item.done;
  els.calendarPlanned.value = item.planned;
  els.calendarNote.value = item.note;
  query<HTMLButtonElement>("#calendarForm button[type='submit']").textContent = "更新日历";
  els.calendarDone.focus();
  setActiveTab("calendar");
}

function upsert<T extends Tab>(type: T, item: DraftByTab[T]): void {
  if (editing && editing.type !== type) {
    resetEditing();
  }

  if (editing?.type === type) {
    updateExisting(type, item);
    resetEditing();
    showToast("已更新");
  } else {
    appendNew(type, item);
    showToast("已保存");
  }

  persistState();
  render();
}

function persistState(): void {
  saveState(state);
  void saveRemoteState(state)
    .then(() => setBackendStatus("后端已同步", "ok"))
    .catch(() => setBackendStatus("本地模式，后端未连接", "warn"));
}

function updateExisting<T extends Tab>(type: T, item: DraftByTab[T]): void {
  if (!editing) {
    return;
  }

  if (type === "commands") {
    state.commands = state.commands.map((current) =>
      current.id === editing?.id ? { ...current, ...(item as DraftByTab["commands"]), id: current.id } : current,
    );
  } else if (type === "credentials") {
    state.credentials = state.credentials.map((current) =>
      current.id === editing?.id ? { ...current, ...(item as DraftByTab["credentials"]), id: current.id } : current,
    );
  } else {
    state.calendar = state.calendar.map((current) =>
      current.id === editing?.id ? { ...current, ...(item as DraftByTab["calendar"]), id: current.id } : current,
    );
  }
}

function appendNew<T extends Tab>(type: T, item: DraftByTab[T]): void {
  const withId = { id: crypto.randomUUID(), ...item };
  if (type === "commands") {
    state.commands.push(withId as CommandItem);
  } else if (type === "credentials") {
    state.credentials.push(withId as CredentialItem);
  } else {
    state.calendar.push(withId as CalendarEntry);
  }
}

els.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = els.commandText.value.trim();
  if (!command) {
    showToast("命令不能为空");
    return;
  }

  upsert("commands", {
    title: els.commandTitle.value.trim() || command.split("\n")[0].slice(0, 40),
    command,
    tags: normalizeTags(els.commandTags.value),
    createdAt: new Date().toISOString(),
  });
  els.commandForm.reset();
  setActiveTab("commands");
});

els.credentialForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const host = els.credentialHost.value.trim();
  if (!host) {
    showToast("IP / Host 不能为空");
    return;
  }

  upsert("credentials", {
    name: els.credentialName.value.trim(),
    host,
    username: els.credentialUser.value.trim() || "root",
    port: els.credentialPort.value.trim() || "22",
    password: normalizeCredentialPassword(els.credentialPassword.value),
    note: els.credentialNote.value.trim(),
    createdAt: new Date().toISOString(),
  });
  els.credentialForm.reset();
  setActiveTab("credentials");
});

els.calendarForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const done = els.calendarDone.value.trim();
  const planned = els.calendarPlanned.value.trim();
  if (!done && !planned) {
    showToast("至少记录一项已完成或计划");
    return;
  }

  upsert("calendar", {
    date: els.calendarDate.value || getToday(),
    done,
    planned,
    note: els.calendarNote.value.trim(),
    createdAt: new Date().toISOString(),
  });
  els.calendarForm.reset();
  setToday();
  setActiveTab("calendar");
});

els.pasteCommandBtn.addEventListener("click", async () => {
  const text = await readClipboard();
  if (!text) {
    showToast("浏览器阻止读取剪贴板，请手动粘贴");
    return;
  }

  els.commandText.value = text;
  if (!els.commandTitle.value.trim()) {
    els.commandTitle.value = text.split("\n")[0].slice(0, 40);
  }
  showToast("已粘贴到命令输入框");
});

els.pasteIpBtn.addEventListener("click", async () => {
  const text = (await readClipboard()).trim();
  if (!text) {
    showToast("浏览器阻止读取剪贴板，请手动粘贴");
    return;
  }

  const parsed = parseSshText(text);
  els.credentialHost.value = parsed.host || text;
  if (parsed.username) {
    els.credentialUser.value = parsed.username;
  }
  if (parsed.port) {
    els.credentialPort.value = parsed.port;
  }
  showToast("已粘贴到账号输入框");
});

els.todayBtn.addEventListener("click", () => {
  setToday();
  els.calendarDone.focus();
});

els.consoleModeBtn.addEventListener("click", () => setAppMode("console"));
els.blogModeBtn.addEventListener("click", () => setAppMode("blog"));

els.tabs.forEach((button) =>
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    if (tab === "commands" || tab === "credentials" || tab === "calendar") {
      setActiveTab(tab);
    }
  }),
);
els.searchInput.addEventListener("input", render);

els.newBlogBtn.addEventListener("click", () => showBlogEditor());
els.editBlogBtn.addEventListener("click", () => {
  const selected = getSelectedBlog();
  if (selected) {
    showBlogEditor(selected);
  }
});
els.deleteBlogBtn.addEventListener("click", () => {
  const selected = getSelectedBlog();
  if (!selected || !confirm("确定删除这篇博客吗？")) {
    return;
  }

  state.blogs = state.blogs.filter((blog) => blog.id !== selected.id);
  selectedBlogId = state.blogs[0]?.id ?? null;
  hideBlogEditor();
  persistState();
  renderBlogs();
  showToast("博客已删除");
});
els.cancelBlogBtn.addEventListener("click", () => {
  hideBlogEditor();
  renderBlogs();
});
els.blogContentInput.addEventListener("input", updateBlogPreview);

els.blogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const now = new Date().toISOString();
  const title = els.blogTitleInput.value.trim() || "未命名博客";
  const tags = normalizeTags(els.blogTagsInput.value);
  const content = els.blogContentInput.value;

  if (editingBlogId) {
    state.blogs = state.blogs.map((blog) =>
      blog.id === editingBlogId
        ? {
            ...blog,
            title,
            tags,
            content,
            updatedAt: now,
          }
        : blog,
    );
    selectedBlogId = editingBlogId;
    showToast("博客已更新");
  } else {
    const blog: BlogPost = {
      id: crypto.randomUUID(),
      title,
      tags,
      content,
      createdAt: now,
      updatedAt: now,
    };
    state.blogs.push(blog);
    selectedBlogId = blog.id;
    showToast("博客已保存");
  }

  hideBlogEditor();
  persistState();
  renderBlogs();
});

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `personal-workbench-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", async (event) => {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const [file] = Array.from(input.files ?? []);
  if (!file) {
    return;
  }

  try {
    const imported = JSON.parse(await file.text()) as Partial<WorkbenchState>;
    state = sanitizeState(imported);
    persistState();
    render();
    showToast("导入完成");
  } catch {
    showToast("导入失败，请检查 JSON 格式");
  } finally {
    input.value = "";
  }
});

els.clearAllBtn.addEventListener("click", () => {
  if (!confirm("确定清空所有本地数据吗？此操作不可撤销。")) {
    return;
  }

  state = { commands: [], credentials: [], calendar: [], blogs: [] };
  selectedBlogId = null;
  hideBlogEditor();
  resetEditing();
  persistState();
  render();
  renderBlogs();
  showToast("已清空");
});

function getToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

function setToday(): void {
  els.calendarDate.value = getToday();
}

function formatCalendarTitle(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function formatDailyReport(item: CalendarEntry): string {
  const lines = [`${formatCalendarTitle(item.date)} 工作记录`, "", "已经做了：", item.done || "未记录", "", "计划去做：", item.planned || "未记录"];
  if (item.note) {
    lines.push("", "备注：", item.note);
  }
  return lines.join("\n");
}

async function hydrateFromBackend(): Promise<void> {
  setBackendStatus("后端连接中", "idle");

  try {
    const remote = await loadRemoteState();
    if (hasContent(remote.state)) {
      const sanitized = sanitizeState(remote.state);
      const shouldRepairRemote = JSON.stringify(remote.state) !== JSON.stringify(sanitized);
      state = sanitized;
      saveState(state);
      if (shouldRepairRemote) {
        await saveRemoteState(state);
      }
      render();
      renderBlogs();
      setBackendStatus("后端已连接", "ok");
      return;
    }

    if (hasContent(state)) {
      await saveRemoteState(state);
      setBackendStatus("后端已初始化", "ok");
      return;
    }

    setBackendStatus("后端已连接", "ok");
  } catch {
    setBackendStatus("本地模式，后端未连接", "warn");
  }
}

function hasContent(value: WorkbenchState): boolean {
  return value.commands.length > 0 || value.credentials.length > 0 || value.calendar.length > 0 || value.blogs.length > 0;
}

setToday();
render();
renderBlogs();
void hydrateFromBackend();
