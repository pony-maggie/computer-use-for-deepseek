# 本地验收流程

本文用于验收 `computer use for deepseek` 的本地运行路径。目标是确认普通用户只需要准备 DeepSeek API Key、Docker 和浏览器，就能通过 Web UI 使用产品；同时确认 runtime、文件流、安全确认、成本控制和基础自动化能力可用。

## 1. 验收范围

本次本地验收覆盖：

- 本地启动和停止流程。
- 预构建 runtime 镜像拉取和运行。
- Web UI 创建任务、启动任务、暂停/恢复/取消任务。
- noVNC 桌面画面可见。
- 文件上传、AI 工作区访问、结果下载。
- DeepSeek API Key 缺失时的用户提示。
- token、费用、cache hit/miss、模型信息在 UI/API 中可见。
- runtime action daemon 可执行截图、浏览器快照、bash、text editor 工具调用。

不覆盖：

- 真实付费账号或不可逆账号操作。
- 生产部署。
- 长时间稳定性压测。
- DeepSeek 账单系统对最终费用的结算校验。

## 2. 前置环境

验收机器需要准备：

- macOS、Linux 或 Windows + WSL2。
- Docker Desktop 或 Docker Engine。
- Git。
- 现代浏览器，例如 Chrome、Edge、Firefox 或 Safari。
- 可访问 DeepSeek API 的网络。
- DeepSeek API Key。

检查 Docker：

```bash
docker version
docker compose version
```

如果仓库和 GHCR package 仍然是私有状态，需要先登录 GHCR：

```bash
docker login ghcr.io
```

登录时：

```text
Username: GitHub 用户名，例如 pony-maggie
Password: GitHub Personal Access Token，不是 GitHub 登录密码
```

本地验收结束后，如果你想退出 GHCR 登录：

```bash
docker logout ghcr.io
```

验收通过标准：

- `docker version` 正常输出 client/server 信息。
- `docker compose version` 正常输出版本。
- 如果 runtime 镜像是私有的，`docker login ghcr.io` 成功。
- 如果需要清理本地登录状态，`docker logout ghcr.io` 成功。

## 3. 获取代码

```bash
git clone https://github.com/pony-maggie/computer-use-for-deepseek.git
cd computer-use-for-deepseek
```

如果你已经有本地仓库：

```bash
git pull
```

验收通过标准：

- 当前目录存在 `README.md`、`README.zh-CN.md`、`docker-compose.yml`、`start.sh`、`stop.sh`。

## 4. 配置 `.env`

创建本地配置：

```bash
cp .env.example .env
```

打开 `.env`，至少填写：

```bash
DEEPSEEK_API_KEY=你的_deepseek_api_key
```

建议验收时先使用偏保守配置，避免费用失控：

```bash
APP_MAX_STEPS=30
APP_TOKEN_BUDGET=2000000
APP_COST_BUDGET_USD=0
DEEPSEEK_INPUT_USD_PER_MTOK=0
DEEPSEEK_OUTPUT_USD_PER_MTOK=0
DEEPSEEK_ROUTING=quality_first
```

说明：

- `APP_MAX_STEPS` 控制单个任务最多执行多少轮。
- `APP_TOKEN_BUDGET` 控制单个任务 provider total token 上限，包含 cache-hit token。DeepSeek cache-hit token 较多时，过低的 token budget 会让任务提前失败。
- `APP_COST_BUDGET_USD` 控制单个任务估算费用上限；如果价格字段仍为 `0`，只展示费用，不会产生有效费用拦截。需要真实费用控制时，先填写下面两个价格字段，再把 `APP_COST_BUDGET_USD` 设为你的预算。
- `DEEPSEEK_INPUT_USD_PER_MTOK` 和 `DEEPSEEK_OUTPUT_USD_PER_MTOK` 用于 UI 估算成本，填 DeepSeek 当前价格。
- `DEEPSEEK_ROUTING=cost_first` 时，简单任务会优先走 `DEEPSEEK_FAST_MODEL`，复杂任务会走 `DEEPSEEK_PRO_MODEL`。

验收通过标准：

- `.env` 存在。
- `DEEPSEEK_API_KEY` 非空。
- 成本相关配置符合本次验收预算。

## 5. 启动前静态检查

运行 harness 初始化检查：

```bash
./init.sh
```

检查 Compose 配置：

```bash
docker compose config >/tmp/computer-use-compose.yml
```

验收通过标准：

- `./init.sh` 结束时输出 `Harness init complete.`。
- `docker compose config` 退出码为 `0`。

## 6. 启动应用

```bash
./start.sh
```

看到 `Backend API is ready.` 后打开：

```text
http://localhost:3000
```

同时可以检查容器状态：

```bash
docker compose ps
```

默认启动应使用预构建的 server、web 和 runtime 镜像。正常情况下，不应该看到 server 长时间执行 `pip install`，也不应该看到 web 长时间执行 `npm install`。

验收通过标准：

- Web UI 可以打开。
- `docker compose ps` 中 server、web、runtime 相关服务处于 running/healthy 或等价正常状态。
- 首次启动不应在本机现场构建 Chromium、Debian desktop package 等大依赖；普通用户路径应拉取预构建 runtime 镜像。

## 7. 缺失 API Key 验收

这个步骤用于确认错误提示对普通用户友好。可以在单独环境或临时备份 `.env` 后执行。

```bash
cp .env .env.acceptance.bak
sed -i.bak 's/^DEEPSEEK_API_KEY=.*/DEEPSEEK_API_KEY=/' .env
./start.sh
```

验收通过标准：

- 启动脚本明确提示 `DEEPSEEK_API_KEY` 未配置。
- 不应进入一个看似启动成功但运行必然失败的状态。

恢复配置：

```bash
mv .env.acceptance.bak .env
```

macOS 上 `sed -i.bak` 会额外留下 `.env.bak`，可手动删除。

## 8. Runtime 烟测

运行预构建 runtime 烟测：

```bash
./scripts/smoke-runtime.sh
```

验收通过标准：

- `http://localhost:6080/vnc.html` 可访问。
- 命令输出 `runtime smoke passed`。

补充说明：这个脚本内部会自动向 runtime 发起一次截图工具调用，并检查返回结果里是否包含图片数据。验收者不需要手动查看或复制 `base64_image`。

如果你在验收本地 runtime 开发镜像，而不是 GHCR 预构建镜像：

```bash
./scripts/smoke-runtime.sh --dev-build
```

普通用户验收不要使用 `--dev-build`。

## 9. Web UI 基础任务验收

本项目本地启动后有两个浏览器入口：

- `http://localhost:3000` 是产品 Web UI，也就是用户主要使用的控制台。创建任务、上传文件、启动/暂停/取消任务、查看状态和下载结果都在这里完成。
- `http://localhost:6080/vnc.html` 是 runtime 沙箱电脑的 noVNC 画面。它用于查看或临时接管被 AI 操作的隔离桌面，不用于创建任务。

打开 `http://localhost:3000`，在产品 Web UI 的左侧任务输入框中填写：

```text
打开浏览器，访问 example.com，然后告诉我页面标题。
```

点击左侧 `Create Run` 创建 run。创建成功后，右上角会出现当前 run 摘要和操作按钮。

点击右上角 `Start Run` 启动这个 run。

验收时观察：

- run 状态从 created/running 变更到 completed 或可解释的 failed。
- 右侧或桌面区域可以看到 noVNC 画面。
- timeline/event 区域有创建、启动、使用量或完成状态记录。
- run controls 显示模型名、step 用量、token 用量、cache hit/miss、估算费用。

验收通过标准：

- 模型可以发起工具调用。
- runtime 桌面会执行可见动作。
- 任务最终给出可读结果，或在限制内给出明确 blocker。
- UI 不要求用户理解或操作 Docker 命令。

## 10. 文件工作区验收

准备一个小文件：

1. 在桌面或任意方便的位置新建一个文本文件，文件名为 `input.txt`。
2. 用文本编辑器打开它，写入下面这句话并保存：

```text
请把这一行改写成一句更正式的中文说明。
```

在 Web UI 中：

1. 创建新任务。
2. 上传 `input.txt`。
3. 输入任务：

```text
读取我上传的 input.md，把内容改写得更正式，并保存为 output.txt。
```

验收通过标准：

- 上传文件出现在 workspace 文件列表中。
- 任务执行过程中如果需要文件编辑，系统会要求人工确认敏感的 `bash` 或 `text_editor` 工具调用。
- 完成后 workspace 中可以看到生成文件。
- 下载结果文件后内容符合任务要求。
- 应用没有默认挂载或暴露用户整个 home 目录。

## 11. 安全确认验收

创建任务：

```text
在工作区创建一个 hello.txt，内容是 hello acceptance。
```

验收通过标准：

- 文件编辑类工具调用进入等待确认状态，并在 Current Run 区域显示 `Approval Required`。
- `Approval Required` 区域会显示待确认动作摘要，例如 `bash: ...` 或 `text_editor create: ...`。
- 展开 `Details` 可以查看完整 tool call 参数。
- 用户没有确认前，不应静默执行敏感文件写入。
- 点击 `Approve` 后，应用会执行该动作并继续当前 run。
- 点击 `Reject` 后，run 会以 `confirmation rejected` 结束。
- 点击 `Cancel` 后，状态应变为 `canceled`。

验收重点是：敏感动作必须先展示给用户，只有用户批准后才可以执行。

## 12. 成本控制验收

### 12.1 UI 使用量展示

执行任意成功或失败任务后，检查 Run Controls。

验收通过标准：

- 显示当前模型名。
- 显示 `steps/max_steps`。
- 显示 `total_tokens/token_budget`。
- 显示 cache hit/miss token。
- 显示 estimated cost；如果设置了 `APP_COST_BUDGET_USD`，显示估算费用与预算上限。

### 12.2 token budget 中止

把 `.env` 临时改小：

```bash
APP_TOKEN_BUDGET=1
```

重启：

```bash
./stop.sh
./start.sh
```

创建一个需要模型响应的任务并启动。

验收通过标准：

- run 在收到 provider usage 后失败。
- final text 或事件中出现 `token budget exceeded`。

恢复合理配置后重启。

### 12.3 cost budget 中止

把 `.env` 临时改成：

```bash
APP_COST_BUDGET_USD=0.000001
DEEPSEEK_INPUT_USD_PER_MTOK=1
DEEPSEEK_OUTPUT_USD_PER_MTOK=1
```

重启并执行一个短任务。

验收通过标准：

- run 在估算费用超过预算后失败。
- final text 或事件中出现 `cost budget exceeded`。

恢复合理配置后重启。

## 13. 语音输入与任务控制验收

此功能用于把语音转成任务文本，并支持少量明确的任务控制短命令。

操作步骤：

1. 使用 Chrome 或 Edge 打开 `http://localhost:3000`。
2. 点击 `Task` 输入框旁边的麦克风按钮。
3. 允许浏览器访问麦克风。
4. 说出：`打开 example.com，然后告诉我页面标题。`
5. 确认识别文本出现在 `Task` 输入框中。
6. 手动编辑识别文本。
7. 再次点击麦克风，说出：`创建任务`。
8. 确认页面创建了 run。
9. 再次点击麦克风，说出：`开始运行`。
10. 确认 run 进入运行流程。
11. 如果 run 进入 `Approval Required`，再次点击麦克风，说出：`批准`。
12. 确认页面提示需要手动批准，不会直接执行批准。

预期结果：

- 普通语音内容只影响 `Task` 输入框内容。
- 明确短命令可以触发创建、开始、暂停、继续、取消和清空输入。
- `批准` 和 `拒绝` 不能通过语音直接执行。
- 原有按钮控制流程保持可用。

如果浏览器不支持语音识别，页面应显示不可用提示，手动输入任务仍然可用。

## 14. API 验收

创建 run：

```bash
curl -sS -X POST http://localhost:8000/api/runs \
  -H 'content-type: application/json' \
  -d '{"task":"Take a screenshot"}' | python3 -m json.tool
```

验收返回字段：

- `run_id`
- `status`
- `model`
- `max_steps`
- `token_budget`
- `cost_budget_usd`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `prompt_cache_hit_tokens`
- `prompt_cache_miss_tokens`
- `estimated_cost_usd`

启动 run：

```bash
RUN_ID=替换为上一步返回的_run_id
curl -sS -X POST "http://localhost:8000/api/runs/${RUN_ID}/start" | python3 -m json.tool
```

验收通过标准：

- API 能创建 run。
- 缺失 DeepSeek API Key 时返回明确错误。
- 配置了 API Key 时可以进入执行流程。
- 返回结构包含成本控制字段。

## 15. Runtime action daemon 验收

进入 runtime 容器调用截图：

```bash
docker compose exec -T runtime python3 - <<'PY'
import json
import urllib.request

payload = {
    "tool_call_id": "acceptance_screenshot",
    "name": "computer",
    "computer": {"action": "screenshot"},
}
request = urllib.request.Request(
    "http://localhost:7070/tool-call",
    data=json.dumps(payload).encode("utf-8"),
    headers={"content-type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(request, timeout=20) as response:
    result = json.loads(response.read().decode("utf-8"))

print(json.dumps({
    "has_base64_image": bool(result.get("base64_image")),
    "image_hash": result.get("image_hash"),
    "error": result.get("error"),
}, ensure_ascii=False, indent=2))
PY
```

验收通过标准：

- `has_base64_image` 为 `true`。
- `image_hash` 以 `sha256:` 开头。
- `error` 为 `null` 或不存在。

调用浏览器快照：

```bash
docker compose exec -T runtime python3 - <<'PY'
import json
import urllib.request

payload = {
    "tool_call_id": "acceptance_browser_snapshot",
    "name": "computer",
    "computer": {"action": "browser_snapshot"},
}
request = urllib.request.Request(
    "http://localhost:7070/tool-call",
    data=json.dumps(payload).encode("utf-8"),
    headers={"content-type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(request, timeout=20) as response:
    result = json.loads(response.read().decode("utf-8"))

print(json.dumps(result, ensure_ascii=False, indent=2)[:2000])
PY
```

验收通过标准：

- 返回 `output`。
- `system` 为 `browser_snapshot=dom_first`。
- 如果当前浏览器页面是 http/https/file 页面，`output` 中应包含 url/title，可能包含截断后的 DOM。

## 16. 停止和清理

停止应用：

```bash
./stop.sh
```

确认容器状态：

```bash
docker compose ps
```

可选清理：

```bash
docker compose down
```

验收通过标准：

- `./stop.sh` 能停止本项目服务。
- 再次 `./start.sh` 可以重新启动。

## 17. 常见问题判断

### Web UI 打不开

检查：

```bash
docker compose ps
docker compose logs web --tail=100
docker compose logs server --tail=100
```

常见原因：

- 端口 `3000` 或 `8000` 被占用。
- Docker 未启动。
- 前端服务启动失败。

### noVNC 打不开

检查：

```bash
curl -I http://localhost:6080/vnc.html
docker compose logs runtime --tail=150
```

常见原因：

- runtime 镜像拉取失败。
- GHCR 私有包未登录。
- runtime 容器未正常启动。

### 任务不执行

检查：

```bash
docker compose logs server --tail=150
docker compose logs runtime --tail=150
```

常见原因：

- `DEEPSEEK_API_KEY` 未配置或无效。
- DeepSeek API 网络不可达。
- token 或 cost budget 设置过低。
- 安全策略要求确认，但 UI 还停留在等待确认状态。

### 费用显示为 0

检查 `.env`：

```bash
DEEPSEEK_INPUT_USD_PER_MTOK=0
DEEPSEEK_OUTPUT_USD_PER_MTOK=0
```

如果这两个字段为 `0`，UI 只能展示 token，不会展示真实估算费用。填入 DeepSeek 当前每百万 token 价格后重启应用。

## 18. 最终验收清单

本地验收完成前，逐项确认：

- [ ] `.env` 已配置 DeepSeek API Key。
- [ ] `./init.sh` 通过。
- [ ] `docker compose config` 通过。
- [ ] `./start.sh` 可以启动应用。
- [ ] Web UI 可访问 `http://localhost:3000`。
- [ ] noVNC 可访问 `http://localhost:6080/vnc.html`。
- [ ] `./scripts/smoke-runtime.sh` 通过。
- [ ] 可以创建 run 并启动任务。
- [ ] UI 显示模型、steps、tokens、cache hit/miss、estimated cost。
- [ ] 文件上传、workspace 展示、结果下载可用。
- [ ] 敏感工具调用不会静默执行。
- [ ] token budget 或 cost budget 可触发中止。
- [ ] `./stop.sh` 可以停止服务。

如果以上项目全部通过，可以认为当前版本满足本地验收要求。
