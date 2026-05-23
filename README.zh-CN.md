# Computer Use for DeepSeek

[English README](./README.md)

Computer Use for DeepSeek 是一个本地 Web 应用，让 DeepSeek 在隔离的电脑环境里完成桌面操作。你可以输入任务、观看远程桌面、上传需要处理的文件，并在任务完成后下载结果。

应用在本地运行。文件只会进入你上传或显式提供的工作区，AI 会在隔离环境中处理这些文件。

## 和 Claude Computer Use 的关系

这个项目的灵感来自 Anthropic 的 Claude Computer Use。二者的核心思路相同：让 AI 模型观察一个隔离电脑，请求鼠标/键盘动作，并在循环中接收截图或工具执行结果。

Computer Use for DeepSeek 是一个面向 DeepSeek 模型的独立项目。它不是 Anthropic 或 Claude 的官方产品，也不使用 Claude Computer Use API。目标是用 DeepSeek 作为模型后端，提供类似的 computer use 体验。

## 演示

下面两个演示来自本地验收流程。它们展示的是用户实际使用的产品 Web UI，以及 AI 执行动作时可观察的沙箱桌面。

### 浏览器任务

创建一个 run，让 DeepSeek 打开 `example.com`，并返回页面标题。运行过程中，界面会展示任务状态、时间线事件、token 用量和远程桌面画面。

![浏览器任务演示](docs/gif/demo1.gif)

### 文件工作区任务

上传一个本地文件，让 AI 改写内容并保存为 `output.txt`，最后从 workspace 下载结果。用户只需要通过 Web UI 操作，文件处理发生在隔离的任务工作区内。

![文件工作区任务演示](docs/gif/demo2.gif)

## 你需要准备什么

- DeepSeek API Key
- Docker Desktop 或 Docker Engine
- 现代浏览器，例如 Chrome、Edge、Firefox 或 Safari
- 能访问 DeepSeek API 的网络环境

应用底层需要 Docker，但正常使用时你不需要直接操作 Docker。
正常启动时，应用会使用预构建的 server、web 和沙箱 runtime 镜像，不应该在你的机器上现场安装 Python/Node 依赖，也不应该现场构建 Chromium 或桌面依赖。

## 配置

创建本地配置文件：

```bash
cp .env.example .env
```

打开 `.env`，填写：

```bash
DEEPSEEK_API_KEY=你的_api_key
```

其他配置都有默认值，通常不需要修改。

## 启动应用

运行：

```bash
./start.sh
```

启动脚本会先拉取最新发布的镜像，再启动服务，这样每次启动都能拿到最新上线的界面。
它还会重建 Compose 容器，确保真正运行的是刚拉下来的新镜像。

看到 `Backend API is ready.` 后打开：

```text
http://localhost:3000
```

启动脚本会检查配置、启动本地服务，并等待后端 API 就绪。如果缺少配置，或者后端长时间无法启动，它会提示你需要修复什么。

如果你要开发产品本身，并希望源码热更新，可以使用开发 compose 覆盖：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

大多数用户不需要运行这条命令。

发布或构建 runtime 镜像后，可以运行烟测：

```bash
./scripts/smoke-runtime.sh
```

如果要测本地开发镜像，运行：

```bash
./scripts/smoke-runtime.sh --dev-build
```

## 使用文件

在 Web 应用里上传文件到当前任务的工作区。AI 可以读取和编辑这个工作区里的文件，生成的结果也会在 Web 应用里提供下载。

出于安全考虑，应用默认不会挂载你的整个用户目录。

## 语音输入

Web UI 支持持续语音模式和少量明确的任务控制命令。打开 `Voice`，允许浏览器使用麦克风，选择识别语言后直接说自然语言；语音模式开启期间会持续监听。系统会把语音转成文本后再拆分成任务内容和页面动作，并用语音反馈它理解到的内容、将执行的动作，或者追问需要澄清的问题。你可以说 `打开浏览器，访问 baidu.com，开始运行`，也可以说 `创建任务`、`开始运行`、`暂停`、`继续`、`取消`、`清空输入` 这类短命令。

语音控制只调用已有 Web UI 动作。它可以创建 run、开始当前 run、暂停、继续、取消，或者清空任务框，但不能用语音批准或拒绝待确认动作，也不能直接控制沙箱 runtime。Chrome 和 Edge 的支持最好。

## 常用配置

大多数用户只需要配置 `DEEPSEEK_API_KEY`。

可选配置：

```bash
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_PRO_MODEL=deepseek-v4-pro
DEEPSEEK_ROUTING=quality_first
APP_MAX_STEPS=30
APP_TOKEN_BUDGET=2000000
APP_COST_BUDGET_USD=0
DEEPSEEK_INPUT_USD_PER_MTOK=0
DEEPSEEK_OUTPUT_USD_PER_MTOK=0
VOICE_INPUT_ENABLED=true
VOICE_PROVIDER=browser
APP_RUNTIME_MODE=docker
RUNTIME_IMAGE=ghcr.io/pony-maggie/computer-use-for-deepseek-runtime:latest
```

`deepseek-v4-pro` 适合质量优先的任务。设置 `DEEPSEEK_ROUTING=cost_first` 后，简单任务会走 `DEEPSEEK_FAST_MODEL`，复杂任务会走 `DEEPSEEK_PRO_MODEL`。
如果你想更严格控制时间和用量，可以降低 `APP_MAX_STEPS` 或 `APP_TOKEN_BUDGET`。如果希望超出费用预算时自动停止任务，可以同时配置 `APP_COST_BUDGET_USD` 和每百万 token 的输入、输出价格。
当 DeepSeek API 返回 prompt cache 命中/未命中 token 时，UI 会显示这些数据，方便你判断稳定 prompt 缓存是否在降低成本。

如果 GitHub 仓库还是私有的，runtime 镜像包也可能是私有的。启动前需要先登录：

```bash
docker login ghcr.io
```

## 安全提醒

- 涉及敏感操作时，请先人工确认。
- 不要上传任务不需要的文件。
- 每个任务建议使用独立工作区。
- 支付、法律协议、账号不可逆操作等任务，不要在无人审核的情况下交给 AI 完成。

## 停止应用

运行：

```bash
./stop.sh
```

打包版本可以提供停止按钮或一键菜单入口。

## 常见问题

如果应用无法启动：

- 确认 Docker 正在运行。
- 确认 `.env` 文件存在。
- 确认 `DEEPSEEK_API_KEY` 已填写。
- 确认 `3000`、`8000`、`6080` 端口没有被占用。

如果任务卡住，可以在 Web 应用里停止当前任务，然后用更明确的指令重新开始。
