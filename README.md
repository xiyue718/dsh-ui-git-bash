# @dsh-external/ui-git-bash

当 AI 需要执行 Pwsh（PowerShell）命令时，自动将其替换为使用 Git Bash 命令执行，并在设置页提供“Git Base”配置，用于自定义 Git Bash 可执行文件路径。

## 功能

- 注册全新的 `git_bash` 工具结构，与项目中的 `pwsh` / `bash` 工具平级。
- 不再拦截或替换 `pwsh` 工具；当 Git Base 模式启用时，系统提示会引导 AI 直接使用 `git_bash` 工具。
- 调用 `git_bash` 时直接使用 Git Bash 执行，完全不经过 Pwsh。
- 设置页新增“Git Base”：
  - 可切换执行模式：`Pwsh` / `Git Base`；
  - 选中 `Pwsh` 时不替换命令，保持原 PowerShell 执行；
  - 选中 `Git Base` 时自动转换为 Git Bash 命令执行；
  - 可填写 `git-bash.exe` / `bash.exe` 的完整路径；
  - 可一键填入检测到的系统默认路径；
  - 配置通过项目 storage domain 持久化保存。
- 运行时优先使用用户配置的路径；未配置时自动尝试常见默认路径。
- 若未找到 Git Bash，会向 AI 返回明确提示。
- `git_bash` 注册了专属 `tool.call.toolview` 工具卡片，在会话中以“Git Bash”作为一级工具卡片展示，不再落入通用的 `Tool call` 卡片。
- 不修改项目文件，也不做全局文本替换；轨迹/导航中的工具名保留实际工具名 `git_bash`。
- 执行日志写入：
  ```text
  $DSH_HOME/super-injector/ui-git-bash.log
  ```

## 命令执行

`git_bash` 工具直接接收 Git Bash 命令并执行，不进行 PowerShell 转换，也不经过 Pwsh。

## 安装

### 方式一：超级模组注入器（推荐，不修改项目文件）

```text
dev_build_plugin  {"dir": "C:/Users/<user>/.dsh/plugins/ui-git-bash"}
dev_inject_plugin {"dir": "C:/Users/<user>/.dsh/plugins/ui-git-bash"}
```

### 方式二：使用 dsh 命令安装（项目官方方式）

如果你已安装 `dsh` CLI，可以按项目官方教程使用 `dsh plugin` 命令安装：

```bash
dsh plugin --profile web add C:/Users/<user>/.dsh/plugins/ui-git-bash
```

安装后启动：

```bash
dsh --profile web
```

详细命令说明见项目文档：`docs/user/develop/basic/publish.md`。

## 使用

1. 打开 DSH Web。
2. 进入 设置 → Git Base。
3. 填写 Git Bash 路径，或点击“使用检测到的默认路径”。
4. 保存后，AI 后续发出的 `pwsh` 命令会自动通过 Git Bash 执行。

## Host API

```http
GET  /@dsh-external/ui-git-bash/api/config
POST /@dsh-external/ui-git-bash/api/config
GET  /@dsh-external/ui-git-bash/api/status
```

## 构建产物

- host：`lib/index.js`
- client：`lib/client.js`
- 打包文件：`dsh-external-ui-git-bash-0.1.0.tgz`
