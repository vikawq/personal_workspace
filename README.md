# 个人工作台

一个用 TypeScript + Vite 构建、Nginx 托管，并带本地 TypeScript 后端的个人工作台，用来保存和快速复制常用命令、SSH IP、用户名、密码和工作日历。

## 功能

- 从剪贴板快速粘贴命令或 IP
- 保存命令列表，一键复制命令
- 保存服务器账号，一键复制 IP、用户名、密码或 SSH 登录命令
- 工作日历，记录每天已经做了的事情和计划去做的事情
- 日历记录可编辑、删除，并可一键复制日报文本
- 博客模式，支持新建、查看、修改和删除 Markdown 博客
- Markdown 编辑时支持实时渲染预览
- 搜索名称、命令、标签、IP、用户名
- 导入 / 导出 JSON
- 数据会同步到本地后端；浏览器 localStorage 作为离线缓存

## 本地开发

先准备 `.env`，并填入 `ENCRYPTION_KEY`：

```powershell
Copy-Item .env.example .env
```

可以用 WSL 生成密钥：

```bash
openssl rand -base64 32
```

安装依赖：

```powershell
npm.cmd install
```

启动本地后端：

```powershell
npm.cmd run dev:backend
```

另开一个终端启动 Vite 前端：

```powershell
npm.cmd run dev:frontend
```

打开：

```text
http://localhost:5173
```

后端健康检查：

```text
http://localhost:3000/api/health
```

## 构建

类型检查、前端生产构建和后端构建：

```powershell
npm.cmd run build
```

构建产物会输出到 `dist/`。

## WSL / Docker 一键部署

如果公司网络需要 npm 镜像源或代理，先复制一份环境变量文件：

```bash
cp .env.example .env
```

后端磁盘文件只保存密文，必须在 `.env` 里配置加密密钥：

```bash
openssl rand -base64 32
```

把输出填到：

```bash
ENCRYPTION_KEY=这里填 openssl 生成的随机值
```

`ENCRYPTION_KEY` 丢失后，Docker volume 里的历史数据将无法解密。已有明文 `workbench.json` 会在后端首次读取时自动迁移为密文。

只需要 npm 镜像源时，在 `.env` 里设置：

```bash
NPM_REGISTRY=https://registry.npmmirror.com
```

需要公司代理时，在 `.env` 里设置：

```bash
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1,backend,frontend
```

项目里的 `.npmrc` 已默认设置：

```text
always-auth=false
strict-ssl=false
```

如果公司 npm 代理使用自签证书，这能减少 Docker 构建阶段的证书校验问题。若后续切到公网或安全要求更严格的环境，建议把 `strict-ssl` 改回 `true`。

在 WSL 里进入项目目录后运行：

```bash
docker compose up -d --build
```

如果 Docker 在 `RUN npm ci` 报 `Exit handler never called!`，先清理旧构建缓存后重建：

```bash
docker compose down
docker builder prune -f
docker compose build --no-cache
docker compose up -d
```

打开：

```text
http://localhost:8080
```

停止：

```bash
docker compose down
```

数据保存在 Docker volume `workbench-data`。普通 `docker compose down` 不会删除数据；如果要彻底清空容器数据，才使用 `docker compose down -v`。

## 安全说明

后端 Docker volume 里只保存 AES-256-GCM 密文，密钥来自 `.env` 的 `ENCRYPTION_KEY`。浏览器 localStorage 仍会缓存一份前端数据，因此这仍适合单人、本机、低摩擦使用；如果浏览器所在机器也需要更强保护，下一步可以继续加前端主密码加密。

## 文件结构

```text
src/
  main.ts
  api.ts
  styles.css
  storage.ts
  clipboard.ts
  ssh.ts
  types.ts
backend/
  src/
    server.ts
    types.ts
  Dockerfile
index.html
vite.config.ts
tsconfig.json
Dockerfile
nginx.conf
docker-compose.yml
```
