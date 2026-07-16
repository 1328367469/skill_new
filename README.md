# AI EffiHub - AI 降本增效与提效技术资讯聚合平台

AI EffiHub 是一个专门帮助企业和个人了解最新、最实用的 AI 技术与软件工具的聚合平台。通过收集 Hacker News 热门讨论和 GitHub 趋势项目，结合 DeepSeek API 进行智能筛选、分类和翻译，实现“一键获取，自动排重，多维度提效”。

---

## ✨ 核心功能

*   **📰 双栏分栏展示**：
    *   **AI 新闻聚合 (左栏)**：精选 Hacker News 上最热门的 AI 相关技术报道、企业降本增效应用和行业最新趋势。
    *   **效率工具与平台推荐 (右栏)**：汇总 GitHub 最新热门 AI 工具、大模型微调/部署框架、提效插件及开源软件。
*   **💾 本地 SQLite 缓存与排重**：
    *   自动使用本地 SQLite 数据库 (`data.db`) 进行数据持久化。
    *   **全自动增量更新**：对已经获取过的新闻链接进行自动排重，防止数据重复刷新，确保每次同步仅请求最新条目，极大节省 API Token 开销。
*   **⚖️ Token 消耗优化模式**：
    *   内置“极度省流”、“均衡推荐”与“深度雷达”三种数据同步级别，用户可根据预算自由调整 DeepSeek API 的调用深度和输入字符截断。
*   **🔒 本地安全配置**：
    *   API 密钥（DeepSeek Key）、自定义 API URL 等配置信息安全保存在本地 SQLite 数据库中，每次进入页面无需重新填入。
*   **🛡️ 真实数据防幻觉**：
    *   通过极其严苛的 LLM 提示词约束，限制系统仅对抓取到的真实条目进行翻译与精炼，禁止大模型虚构项目或纂改原始链接。

---

## 📂 项目结构

```text
d:\workspace\skill_new\
├── data.db             # 本地 SQLite 数据库（自动创建，保存配置与新闻数据）
├── server.py           # 轻量级 Python 单线程 Web 服务器和后端 API 路由
├── index.html          # 精致的玻璃拟物化（Glassmorphism）暗黑主题前端主页
├── app.js              # 前端交互与 API 交互逻辑控制层
├── styles.css          # 前端响应式网格及微动画样式表
├── start_server.bat    # Windows 一键启动服务器脚本
├── git_push.bat        # Windows 一键推送 GitHub 脚本
└── docker_build.bat    # Windows 一键构建 Docker 镜像脚本
```

---

## 🚀 快速上手指南

### 1. 本地启动服务
双击运行项目根目录下的 **`start_server.bat`** 启动脚本（如果提示权限不足，请右键选择 **“以管理员身份运行”**）。
*   服务会自动运行在 **`8234`** 端口上。
*   启动成功后，在浏览器中打开：👉 **`http://localhost:8234/`** 👈。

### 2. 首次运行配置
1.  进入页面后，点击右上角的 **“配置 API Key”** 按钮。
2.  填入您的 **DeepSeek API Key**（若使用自定义代理地址，可一并修改 API Base URL）。
3.  点击 **保存配置**（配置将安全保存在本地 `data.db` 中）。
4.  点击主页中心的 **“同步最新资讯”**，系统将自动拉取数据并通过 DeepSeek 智能分类展示。

### 3. Docker 容器化部署
我们为您配置好了完整的 Docker 支持，以便您在隔离的容器环境中运行它：
1.  双击运行 **`docker_build.bat`**。它会自动检测 Docker 守护进程状态，并构建名为 `ai-effihub` 的 Docker 镜像。
2.  构建成功后，在终端中执行以下命令运行容器（支持本地 SQLite 数据库文件挂载，保证数据不丢失）：
    ```bash
    docker run -d -p 8234:8234 --name ai-effihub -v "%cd%/data.db:/app/data.db" ai-effihub
    ```
3.  在浏览器中打开：👉 **`http://localhost:8234/`** 👈。

---

## 📦 推送到 GitHub

如果您想将此项目上传到您自己的 GitHub 仓库中，只需：
1.  双击运行根目录下的 **`git_push.bat`**。
2.  按照提示输入您的 GitHub 仓库 URL（如 `https://github.com/您的用户名/您的仓库名.git`）。
3.  脚本会自动帮您完成 Git 暂存、提交，并推送到远程 `main` 分支。

---

## 🛠️ 技术栈说明
*   **后端**：Python 3.10+ (仅依赖标准库 `http.server`、`sqlite3`、`urllib`，无需通过 `pip` 安装额外包)
*   **前端**：原生 HTML5, Vanilla CSS3 (未加载第三方庞大框架，实现极速渲染), JavaScript (ES6)
