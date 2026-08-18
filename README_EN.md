# @dsh-external/ui-git-bash

## Introduction

`ui-git-bash` is the Git Base plugin for DSH. It registers an independent `git_bash` tool alongside `pwsh` / `bash` and adds a "Git Base" settings page. When Git Base mode is enabled, the AI is guided to use Git Bash for shell commands instead of Pwsh.

## Installation

### Method 1: Super Module Injector

```text
dev_build_plugin  {"dir": "C:/Users/<user>/.dsh/plugins/ui-git-bash"}
dev_inject_plugin {"dir": "C:/Users/<user>/.dsh/plugins/ui-git-bash"}
```

Open or refresh DSH Web and go to Settings → Git Base.

### Method 2: dsh CLI (Official Project Way)

If you have the `dsh` CLI installed, follow the official project tutorial to install with `dsh plugin`:

```bash
# Install from a local plugin directory
dsh plugin --profile web add C:/Users/<user>/.dsh/plugins/ui-git-bash

# Or install from the GitHub repository
dsh plugin --profile web add github:xiyue718/dsh-ui-git-bash
```

Start after installation:

```bash
dsh --profile web
```

View the composed configuration:

```bash
dsh --profile web --dump-config
```

See the project documentation for details: `docs/user/develop/basic/publish.md`.

Build artifacts: host `lib/index.js`, client `lib/client.js`, package `dsh-external-ui-git-bash-0.1.1.tgz`.

## Usage

1. Open DSH Web.
2. Go to Settings → Git Base.
3. Choose the execution mode: `Pwsh` or `Git Base`.
4. In Git Base mode, enter the full path to `git-bash.exe` / `bash.exe`, or click "Use detected default path".
5. After saving, in new sessions the AI will prefer calling the `git_bash` tool for shell commands.
6. In a session, `git_bash` is displayed as a dedicated "Git Bash" tool card, matching the `pwsh` / `bash` card style.

## Features

- Registers a new `git_bash` tool structure, peer to the project's `pwsh` / `bash` tools.
- Does not intercept or replace `pwsh`; when Git Base mode is enabled, the system prompt guides the AI to use `git_bash` directly.
- `git_bash` executes directly through Git Bash, without going through Pwsh.
- Adds a "Git Base" settings page:
  - Switch between `Pwsh` and `Git Base` modes;
  - `Pwsh` mode keeps original PowerShell execution without replacement;
  - `Git Base` mode guides the AI to execute commands through Git Bash;
  - Enter the full path to `git-bash.exe` / `bash.exe`;
  - One-click fill with a detected system default path;
  - Configuration is persisted through the project storage domain.
- At runtime, the user-configured path is preferred; if not configured, common default paths are tried automatically.
- If Git Bash is not found, a clear message is returned to the AI.
- `git_bash` registers a dedicated `tool.call.toolview` card, shown as a first-level "Git Bash" card instead of a generic `Tool call` card.
- The tool card is fully aligned with the project's existing Bash tool: single-line summary, whole-row expand/collapse, chevron hover preview, TerminalBlock output, exit status, and Inspect button.
- `git_bash` arguments match the Bash tool: `command` is required, `description` is shown in the tool card summary, and `workdir` sets the working directory (`cwd` is kept as a compatibility alias).
- Supports switching between `Git Base` and `Pwsh` back and forth: the plugin injects the matching mode guidance on each switch, so the AI follows the current mode and uses `git_bash` or `pwsh` accordingly.
- `git_bash` is registered in `Git Base` mode and unregistered in `Pwsh` mode, so the AI cannot keep calling Git Bash after switching back to Pwsh.
- Does not modify project files or perform global text replacement.
- Compatible with `router-standard`'s `standard` mode: after the first tool call, it injects mode guidance so the model uses `git_bash` for later shell commands instead of `pwsh`.
- Execution logs are written to `$DSH_HOME/super-injector/ui-git-bash.log`.

### Host API

```http
GET  /@dsh-external/ui-git-bash/api/config
POST /@dsh-external/ui-git-bash/api/config
GET  /@dsh-external/ui-git-bash/api/status
```

## How It Works

The plugin consists of a host half and a client half.

On the host side, it registers the `git_bash` tool through `ctx.tools.register`. Execution uses `execFile(bashPath, ['-lc', command])` to call Git Bash directly with `MSYS_NO_PATHCONV=1`, without going through Pwsh. The Git Bash path prefers the user configuration and falls back to common default installation paths. The tool declares `card: 'terminal'` through `presentCall` / `presentResult`, and uses `presentationMeta` to pass `stdout` / `stderr` / `exitCode` to the UI, so it shares the same terminal card data model as the Bash tool.

The `git_bash` tool is registered dynamically by mode: it is registered in `Git Base` mode and unregistered in `Pwsh` mode, so the AI cannot keep calling Git Bash after switching back to Pwsh.

The host also uses `ctx.systemPrompt.section` to add the guidance "When executing shell commands, use the git_bash tool directly, not pwsh" in Git Base mode. Because `router-standard`'s `standard` mode strips prompt sections before the first tool call, the plugin listens to `agent/pre-step` and decides whether to inject guidance based on the last mode guidance in the session. This lets `Git Base` ↔ `Pwsh` switches inject the matching guidance each time, overriding the previous mode instruction without repeating the same guidance.

On the client side, it provides the "Git Base" settings page, saves mode and path through the Host API, and registers a dedicated `git_bash` entry on `tool.call.toolview`. It uses `@deepseek-ai/dsh-client-ui-primitives`'s `TerminalBlock`, `StateDot`, and icon components to render a first-level Git Bash tool card fully aligned with `pwsh` / `bash`, including collapse/expand, chevron hover preview, running state, and Inspect button.
