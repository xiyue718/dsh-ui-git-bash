/**
 * @dsh-external/ui-git-bash — host half.
 * Intercepts AI `pwsh` tool calls, converts the PowerShell command to a
 * Git Bash equivalent, and executes it with the user-configured Git Bash
 * executable. The Git Bash path is persisted through the project storage
 * domain and exposed through a settings API.
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { homedir } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from 'cordis'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z as zod } from 'zod'
import z from 'schemastery'

export const name = '@dsh-external/ui-git-bash'
export const inject = ['webServer', 'storageDomain', 'tools', 'systemPrompt']

const API_PREFIX = '/@dsh-external/ui-git-bash/api'
const CONFIG_PATH = '/@dsh-external/ui-git-bash/api/config'
const STATUS_PATH = '/@dsh-external/ui-git-bash/api/status'

const DEFAULT_BASH_CANDIDATES = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\git-bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
]

const gitBashConfigSchema = zod.object({
  bashPath: zod.string(),
  mode: zod.enum(['pwsh', 'git-bash']).optional(),
})

const GIT_BASH_DOMAIN_SPEC = defineDomain({
  name: 'dsh_external_git_bash',
  version: 1,
  tables: {
    config: domainTable<string, zod.infer<typeof gitBashConfigSchema>>(gitBashConfigSchema),
  },
})

export const Config = z.object({})

interface GitBashState {
  bashPath: string
  mode: 'pwsh' | 'git-bash'
}

let gitBashState: GitBashState | null = null

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer | string) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function log(message: string): void {
  try {
    const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
    const logFile = join(dshHome, 'super-injector', 'ui-git-bash.log')
    mkdirSync(dirname(logFile), { recursive: true })
    appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    // Logging is best-effort.
  }
}

/** Resolve the actual bash executable from a user-provided git-bash path. */
function resolveBashExecutable(candidate: string): string | undefined {
  if (candidate === '' || !existsSync(candidate)) return undefined
  const base = basename(candidate).toLowerCase()
  if (base === 'bash.exe' || base === 'sh.exe') return candidate
  if (base === 'git-bash.exe') {
    const sibling = join(dirname(candidate), 'bin', 'bash.exe')
    if (existsSync(sibling)) return sibling
    return candidate
  }
  return undefined
}

function findDefaultBashPath(): string | undefined {
  for (const candidate of DEFAULT_BASH_CANDIDATES) {
    const resolved = resolveBashExecutable(candidate)
    if (resolved !== undefined) return resolved
  }
  return undefined
}

function currentBashPath(): string | undefined {
  const configured = gitBashState?.bashPath
  if (configured !== undefined && configured !== '') {
    const resolved = resolveBashExecutable(configured)
    if (resolved !== undefined) return resolved
  }
  return findDefaultBashPath()
}

/** Best-effort conversion from common PowerShell syntax to Git Bash syntax. */
async function executeGitBashCommand(
  command: string,
  cwd: string | undefined,
): Promise<{ stdout: string; stderr: string; exitCode: number; bashPath: string }> {
  const bashPath = currentBashPath()
  if (bashPath === undefined) {
    throw new Error('Git Bash 未找到。请在 设置 → Git Base 中配置 git-bash.exe 的完整路径。')
  }
  const result = await runGitBash(bashPath, command, cwd)
  return { ...result, bashPath }
}

function runGitBash(bashPath: string, command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(bashPath, ['-lc', command], {
      cwd,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, MSYS_NO_PATHCONV: '1' },
    }, (error, stdout, stderr) => {
      const exitCode = error === null
        ? 0
        : typeof (error as any)?.code === 'number'
          ? (error as any).code
          : 1
      resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), exitCode })
    })
  })
}

export async function apply(ctx: Context): Promise<void> {
  const storageDomain = (ctx as any).storageDomain
  let gitBashDomain: any
  if (storageDomain !== undefined) {
    try {
      gitBashDomain = await storageDomain.open(GIT_BASH_DOMAIN_SPEC)
      const saved = gitBashDomain.table('config').get('main')
      if (saved !== undefined) gitBashState = { bashPath: saved.bashPath, mode: saved.mode ?? 'git-bash' }
      ctx.effect(() => () => { void gitBashDomain?.close?.() }, '@dsh-external/ui-git-bash: storage domain')
    } catch {
      gitBashDomain = undefined
    }
  }

  ctx.tools.register(defineTool({
    name: 'git_bash',

    description: 'Execute a Git Bash command and return its stdout/stderr/exit code. Use this tool when Git Base mode is enabled or when a command should run in Git Bash.',
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: 'The Git Bash command to execute.',
      },
      description: {
        type: 'string',
        description: 'Short description of what the command does. It appears in the tool card summary.',
      },
      workdir: {
        type: 'string',
        description: 'Optional working directory. Defaults to the current session working directory.',
      },
      cwd: {
        type: 'string',
        description: 'Alias for workdir. Prefer workdir for parity with the bash tool.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stdout: { type: 'string', required: true },
          stderr: { type: 'string', required: true },
          exitCode: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [value.stdout, value.stderr].filter(Boolean).join('\n').trim() || '(no output)',
      }],
      presentationMeta: (_args, value) => value,
    },
    presentCall: (args: any) => ({
      card: 'terminal',
      title: typeof args.command === 'string' ? args.command : '',
      ...(typeof args.description === 'string' && args.description !== '' ? { description: args.description } : {}),
      ...(typeof args.workdir === 'string' && args.workdir !== ''
        ? { cwd: args.workdir }
        : typeof args.cwd === 'string' && args.cwd !== ''
          ? { cwd: args.cwd }
          : {}),
    }),
    presentResult: (_args: any, result: any) => {
      if (result.isError === true) {
        return { card: 'generic', content: result.content }
      }
      const meta = result.meta as { stdout?: string; stderr?: string; exitCode?: number } | undefined
      const output = [meta?.stdout, meta?.stderr].filter(Boolean).join('\n').trim()
      return {
        card: 'terminal',
        ...(output === '' ? {} : { output }),
        ...(typeof meta?.exitCode === 'number' ? { exitCode: meta.exitCode } : {}),
      }
    },
    async execute(args: any, exec: any) {
      const command = typeof args.command === 'string' ? args.command : ''
      if (command.trim() === '') throw new Error('command is required')
      const workdir = typeof args.workdir === 'string' && args.workdir !== ''
        ? args.workdir
        : typeof args.cwd === 'string' && args.cwd !== ''
          ? args.cwd
          : undefined
      const cwd = workdir ?? exec.cwd ?? exec.agent?.session?.header?.cwd ?? process.cwd()
      const result = await executeGitBashCommand(command, cwd)
      return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }
    },
  }))

  ctx.systemPrompt.section({
    name: 'tool:git_bash',
    order: 106,
    text: () => gitBashState?.mode === 'git-bash'
      ? 'Git Base 模式已启用：执行 shell 命令时请直接使用 git_bash 工具，不要使用 pwsh。'
      : '',
  })

  // router-standard 的 standard 模式会在首个工具调用前剥离 prompt sections 并
  // 只暴露 shell + str_replace_editor；首个工具调用后完整工具目录虽已放开，
  // sections 仍保持最小化。这里在首个工具调用后的下一步注入一次显式指引，
  // 让模型从后续步骤开始优先使用 git_bash，而不是继续使用 pwsh。
  ctx.effect(() => ctx.events.on('agent/pre-step', async (payload: any, next: any) => {
    const decision = await next()
    if (decision?.kind !== 'enter') return decision
    const session = payload?.agent?.session
    if (session === undefined || gitBashState?.mode !== 'git-bash') return decision
    if (!Array.isArray(session.events) || !session.events.some((event: any) => event.type === 'tool/call')) {
      return decision
    }
    const alreadyGuided = session.events.some((event: any) => {
      if (event.type !== 'user/message') return false
      const data = event.data ?? {}
      return data.source?.kind === 'plugin'
        && data.source?.plugin === '@dsh-external/ui-git-bash'
        && Array.isArray(data.content)
        && data.content.some((block: any) => block.type === 'text'
          && typeof block.text === 'string'
          && block.text.includes('Git Base 模式已启用'))
    })
    if (alreadyGuided) return decision
    const guidance = {
      role: 'user',
      source: { kind: 'plugin', plugin: '@dsh-external/ui-git-bash' },
      content: [{ type: 'text', text: 'Git Base 模式已启用：后续 shell 命令请直接使用 git_bash 工具，不要使用 pwsh。' }],
    }
    return { ...decision, messages: [...(decision.messages ?? []), guidance] }
  }), '@dsh-external/ui-git-bash: git base step guidance')

  ctx.effect(() => (ctx as any).webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const pathname = new URL(req.url ?? '/', 'http://x').pathname

      if (req.method === 'GET' && pathname === STATUS_PATH) {
        sendJson(res, 200, {
          mode: gitBashState?.mode ?? 'git-bash',
          configured: gitBashState?.bashPath ?? '',
          resolved: currentBashPath() ?? '',
        })
        return
      }

      if (req.method === 'GET' && pathname === CONFIG_PATH) {
        sendJson(res, 200, {
          bashPath: gitBashState?.bashPath ?? '',
          mode: gitBashState?.mode ?? 'git-bash',
        })
        return
      }

      if (req.method === 'POST' && pathname === CONFIG_PATH) {
        let body: any
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const parsed = gitBashConfigSchema.safeParse(body)
        if (!parsed.success) {
          sendJson(res, 400, { error: 'bashPath is required' })
          return
        }
        gitBashState = {
          bashPath: parsed.data.bashPath.trim(),
          mode: parsed.data.mode ?? 'git-bash',
        }
        await gitBashDomain?.table('config').put('main', gitBashState)
        sendJson(res, 200, { ok: true })
        return
      }

      sendJson(res, 404, { error: 'not found' })
    },
  }), '@dsh-external/ui-git-bash: api')
}
