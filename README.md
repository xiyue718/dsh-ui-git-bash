[中文](./README.md) | [English](./README_EN.md)

# @dsh-external/ui-git-bash

## 介绍

`ui-git-bash` 是 DSH 的 Git Base 插件。它注册一个与 `pwsh` / `bash` 平级的独立 `git_bash` 工具，在设置页提供“Git Base”配置。启用 Git Base 模式后，AI 会优先使用 Git Bash 执行 shell 命令，而不是使用 Pwsh。

## 安装

### 方式一：超级模组注入器

```text
dev_build_plugin  {"dir": "C:/Users/<user>/.dsh/plugins/ui-git-bash"}
dev_inject_plugin {"dir": "C:/Users/<user>/.dsh/plugins/ui-git-bash"}
```

打开或刷新 DSH Web，进入“设置 → Git Base”。

### 方式二：dsh 命令安装（项目官方方式）

如果你已安装 `dsh` CLI，可以按项目官方教程使用 `dsh plugin` 命令安装：

```bash
# 从本地插件目录安装
dsh plugin --profile web add C:/Users/<user>/.dsh/plugins/ui-git-bash

# 或从 GitHub 仓库安装
dsh plugin --profile web add github:xiyue718/dsh-ui-git-bash
```

安装后启动：

```bash
dsh --profile web
```

查看组合配置：

```bash
dsh --profile web --dump-config
```

详细命令说明见项目文档：`docs/user/develop/basic/publish.md`。

构建产物：host 为 `lib/index.js`，client 为 `lib/client.js`，打包文件为 `dsh-external-ui-git-bash-0.1.1.tgz`。

## 使用

1. 打开 DSH Web。
2. 进入“设置 → Git Base”。
3. 选择执行模式：`Pwsh` 或 `Git Base`。
4. 在 Git Base 模式下填写 `git-bash.exe` / `bash.exe` 的完整路径，或点击“使用检测到的默认路径”。
5. 保存后，新会话中 AI 的 shell 命令会优先调用 `git_bash` 工具。
6. 在会话中，`git_bash` 会以独立的 “Git Bash” 工具卡片展示，和 `pwsh` / `bash` 的卡片风格一致。

## 功能

- 注册全新的 `git_bash` 工具结构，与项目中的 `pwsh` / `bash` 工具平级。
- 不再拦截或替换 `pwsh` 工具；当 Git Base 模式启用时，系统提示会引导 AI 直接使用 `git_bash` 工具。
- 调用 `git_bash` 时直接使用 Git Bash 执行，完全不经过 Pwsh。
- 设置页新增“Git Base”：
  - 可切换执行模式：`Pwsh` / `Git Base`；
  - 选中 `Pwsh` 时不替换命令，保持原 PowerShell 执行；
  - 选中 `Git Base` 时引导 AI 使用 Git Bash 命令执行；
  - 可填写 `git-bash.exe` / `bash.exe` 的完整路径；
  - 可一键填入检测到的系统默认路径；
  - 配置通过项目 storage domain 持久化保存。
- 运行时优先使用用户配置的路径；未配置时自动尝试常见默认路径。
- 若未找到 Git Bash，会向 AI 返回明确提示。
- `git_bash` 注册了专属 `tool.call.toolview` 工具卡片，在会话中以“Git Bash”作为一级工具卡片展示，不再落入通用的 `Tool call` 卡片。
- 工具卡片与项目现有的 Bash 工具完全对齐：单行摘要、整行展开/收起、chevron 悬停预览、TerminalBlock 输出、退出码状态和 Inspect 按钮。
- `git_bash` 参数与 Bash 工具保持一致：`command` 必填，`description` 用于工具卡片摘要，`workdir` 指定工作目录（`cwd` 作为兼容别名）。
- 支持 `Git Base` ↔ `Pwsh` 来回切换：切换时自动注入对应的模式指引，AI 会跟随当前模式使用 `git_bash` 或 `pwsh`。
- `Git Base` 模式下注册 `git_bash` 工具；`Pwsh` 模式下注销 `git_bash` 工具，避免 AI 继续调用 Git Bash。
- 不修改项目文件，也不做全局文本替换。
- 兼容 `router-standard` 的 `standard` 模式：首个工具调用后注入一次“Git Base 模式已启用”的步骤指引，让模型后续 shell 命令改用 `git_bash`，避免继续使用 `pwsh`。
- 执行日志写入 `$DSH_HOME/super-injector/ui-git-bash.log`。

### Host API

```http
GET  /@dsh-external/ui-git-bash/api/config
POST /@dsh-external/ui-git-bash/api/config
GET  /@dsh-external/ui-git-bash/api/status
```

## 原理

插件由 host 和 client 两部分组成。

Host 侧通过 `ctx.tools.register` 注册 `git_bash` 工具。执行时使用 `execFile(bashPath, ['-lc', command])` 直接调用 Git Bash，并设置 `MSYS_NO_PATHCONV=1`，不经过 Pwsh。Git Bash 路径优先读取用户配置，未配置时遍历常见默认安装路径。工具通过 `presentCall` / `presentResult` 声明 `card: 'terminal'` 渲染意图，并通过 `presentationMeta` 把 `stdout` / `stderr` / `exitCode` 结构化传递给 UI，从而与 Bash 工具使用同一套终端卡片数据模型。

`git_bash` 工具会按当前模式动态注册/注销：`Git Base` 模式下注册，`Pwsh` 模式下注销，确保 AI 在 Pwsh 模式下不会继续调用 Git Bash。

Host 还通过 `ctx.systemPrompt.section` 在 Git Base 模式下加入“执行 shell 命令时请直接使用 git_bash 工具，不要使用 pwsh”的引导。针对 `router-standard` 的 `standard` 模式会在首个工具调用前剥离 prompt sections 的情况，插件在 `agent/pre-step` 中按“最后一次模式指引”判断是否注入新指引；因此 `Git Base` ↔ `Pwsh` 来回切换时，会分别注入对应的模式指引，覆盖上一次的模式指令，且不会重复注入相同指引。

Client 侧提供“Git Base”设置页，保存模式与路径到 host API；同时注册 `tool.call.toolview` 的 `git_bash` 专用入口，使用项目 `@deepseek-ai/dsh-client-ui-primitives` 的 `TerminalBlock`、`StateDot` 和图标组件，渲染为与 `pwsh` / `bash` 完全对齐的一级工具卡片，支持折叠/展开、chevron 悬停预览、运行状态和 Inspect 按钮。
