# 个人工作台

一个用 TypeScript + Vite 构建、Nginx 托管，并带本地 TypeScript 后端的个人工作台，用来保存和快速复制常用命令、SSH IP、用户名、密码和工作日历。

## 功能

- 从剪贴板快速粘贴命令或 IP
- 保存命令列表，一键复制命令
- 保存服务器账号，一键复制 IP、用户名、密码或 SSH 登录命令
- 工作日历，记录每天已经做了的事情和计划去做的事情
- 日历记录可编辑、删除，并可一键复制日报文本
- 搜索名称、命令、标签、IP、用户名
- 导入 / 导出 JSON
- 数据会同步到本地后端；浏览器 localStorage 作为离线缓存

## 本地开发

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

在 WSL 里进入项目目录后运行：

```bash
docker compose up -d --build
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

当前版本是本地后端，密码会保存到本机 Docker volume，同时浏览器 localStorage 会缓存一份。它适合单人、本机、低摩擦使用。如果要保存高敏凭据，建议下一步增加主密码加密或接入系统密钥管理。

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
