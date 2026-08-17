/**
 * @dsh-external/ui-git-bash — browser half.
 * Provides a "Git Base" settings page and a dedicated first-class tool card for
 * the `git_bash` tool, replacing the generic "Tool call" row in conversation.
 */
import React, { useEffect, useState } from 'react'

export const inject = ['slots']

const API_PREFIX = '/@dsh-external/ui-git-bash/api'

const GIT_BASH_TOOL_CARD_CSS = `
.dsh-git-bash-tool-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dsh-git-bash-tool-card-row {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  height: 24px;
  min-width: 0;
}

.dsh-git-bash-tool-card-row[data-expandable] {
  cursor: pointer;
}

.dsh-git-bash-tool-card-row[data-state='running']::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 300px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--dsw-alias-bg-base) 60%, transparent) 55%,
    transparent 100%
  );
  animation: dsh-git-bash-tool-card-sweep 2.6s ease-out infinite;
  pointer-events: none;
}

@keyframes dsh-git-bash-tool-card-sweep {
  0% { left: -300px; }
  90%, 100% { left: 100%; }
}

.dsh-git-bash-tool-card-leading {
  position: relative;
  flex: none;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}

.dsh-git-bash-tool-card-title {
  flex: none;
  font-size: 14px;
  line-height: 24px;
  color: var(--dsw-alias-label-secondary);
}

.dsh-git-bash-tool-card-sep {
  flex: none;
  width: 2px;
  height: 2px;
  border-radius: 1px;
  margin: 0 8px;
  background: var(--dsw-alias-label-caption);
}

.dsh-git-bash-tool-card-summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 24px;
  color: var(--dsw-alias-label-tertiary);
}

.dsh-git-bash-tool-card-error-summary {
  color: var(--dsw-alias-state-error-primary);
}

.dsh-git-bash-tool-card-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-left: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
}

.dsh-git-bash-tool-card-row[data-state='ok'] .dsh-git-bash-tool-card-dot {
  background: var(--dsw-alias-state-success-primary);
}

.dsh-git-bash-tool-card-row[data-state='error'] .dsh-git-bash-tool-card-dot {
  background: var(--dsw-alias-state-error-primary);
}

.dsh-git-bash-tool-card-row[data-state='stopped'] .dsh-git-bash-tool-card-dot {
  background: var(--dsw-alias-state-warning-primary, var(--dsw-alias-label-tertiary));
}

.dsh-git-bash-tool-card-body {
  display: flex;
  flex-direction: column;
  margin: 4px 0 4px 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-markdown-code-block);
  font: var(--dsw-font-markdown-code-block-small);
  overflow: hidden;
}

.dsh-git-bash-tool-card-section {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 14px;
  align-items: baseline;
  padding: 12px 16px;
  max-height: 220px;
  overflow: auto;
}

.dsh-git-bash-tool-card-label {
  position: sticky;
  top: 0;
  align-self: start;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  line-height: 16px;
}

.dsh-git-bash-tool-card-text {
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--dsw-font-markdown-code-block-small);
  font-size: 12px;
  line-height: 18px;
}

.dsh-git-bash-tool-card-text[data-error] {
  color: var(--dsw-alias-state-error-primary);
}

.dsh-git-bash-tool-card-divider {
  flex: none;
  height: 1px;
  background: var(--dsw-alias-border-l2);
}

.dsh-git-bash-tool-card-inspect {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
  margin: 4px 0 2px 4px;
  padding: 2px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 100ms ease;
}

.dsh-git-bash-tool-card:hover .dsh-git-bash-tool-card-inspect,
.dsh-git-bash-tool-card-inspect:focus-visible {
  opacity: 1;
}

.dsh-git-bash-tool-card-inspect:hover {
  background: var(--dsw-alias-interactive-bg-hover-solid);
  color: var(--dsw-alias-label-primary);
}
`

function installGitBashToolCardStyles(): () => void {
  const style = document.createElement('style')
  style.setAttribute('data-dsh-git-bash-tool-card', '')
  style.textContent = GIT_BASH_TOOL_CARD_CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}

interface GitBashCardModel {
  command: string
  cwd?: string
  body: string
  output: string | null
  errorSummary: string | null
  state: 'running' | 'ok' | 'error' | 'stopped'
  expandable: boolean
}

interface GitBashArgs {
  command?: unknown
  cwd?: unknown
}

function parseGitBashArgs(argsRaw: string): GitBashArgs {
  if (argsRaw === '') return {}
  try {
    const parsed: unknown = JSON.parse(argsRaw)
    return typeof parsed === 'object' && parsed !== null ? parsed as GitBashArgs : {}
  } catch {
    return {}
  }
}

function flattenGitBashOutput(content: readonly unknown[] | undefined): string {
  if (content === undefined) return ''
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'object' && block !== null && 'type' in block && (block as { type?: unknown }).type === 'text') {
      const text = (block as { text?: unknown }).text
      if (typeof text === 'string') parts.push(text)
      else parts.push(JSON.stringify(block, null, 2))
    } else {
      parts.push(JSON.stringify(block, null, 2))
    }
  }
  return parts.join('\n')
}

function firstLine(text: string): string {
  const nl = text.indexOf('\n')
  return nl === -1 ? text : text.slice(0, nl)
}

function gitBashCardModel(block: any): GitBashCardModel {
  const done = block !== null && typeof block === 'object' && 'kind' in block
  const argsRaw = done
    ? (block.call?.argsRaw ?? '')
    : (block.argsRaw ?? '')
  const args = parseGitBashArgs(argsRaw)
  const command = typeof args.command === 'string' ? args.command : ''
  const cwd = typeof args.cwd === 'string' && args.cwd !== '' ? args.cwd : undefined
  const state: GitBashCardModel['state'] = !done
    ? 'running'
    : block.error?.code === 'interrupted'
      ? 'stopped'
      : block.isError === true
        ? 'error'
        : 'ok'
  const output = done ? (flattenGitBashOutput(block.content) || null) : null
  const errorSummary = state === 'error' && output !== null ? firstLine(output) : null
  const body = argsRaw === '' ? '' : JSON.stringify(args, null, 2)
  const expandable = body !== '' || output !== null
  return { command, cwd, body, output, errorSummary, state, expandable }
}

function GitBashToolCard(props: any) {
  const { block, inspect } = props
  const model = gitBashCardModel(block)
  const [expanded, setExpanded] = React.useState(false)
  const open = expanded && model.expandable

  const toggle = () => { setExpanded(value => !value) }
  const toggleFromKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!model.expandable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    toggle()
  }

  const summary = model.errorSummary ?? (model.command !== '' ? firstLine(model.command) : (block?.callId ?? 'git_bash'))
  const leading = open ? '▾' : model.expandable ? '▸' : '$'
  const status = model.state === 'running' ? 'running'
    : model.state === 'error' ? 'failed'
      : model.state === 'stopped' ? 'stopped'
        : 'ok'

  return React.createElement('div',
    {
      className: 'dsh-git-bash-tool-card',
      'data-tool': 'git_bash',
      'data-state': model.state,
      'data-expandable': model.expandable || undefined,
    },
    React.createElement('div',
      {
        className: 'dsh-git-bash-tool-card-row',
        'data-state': model.state,
        'data-expandable': model.expandable || undefined,
        role: model.expandable ? 'button' : undefined,
        tabIndex: model.expandable ? 0 : undefined,
        'aria-expanded': model.expandable ? open : undefined,
        onClick: model.expandable ? toggle : undefined,
        onKeyDown: model.expandable ? toggleFromKeyboard : undefined,
      },
      React.createElement('span', { className: 'dsh-git-bash-tool-card-leading' }, leading),
      React.createElement('span', { className: 'dsh-git-bash-tool-card-title' }, 'Git Bash'),
      React.createElement('span', { className: 'dsh-git-bash-tool-card-sep', 'aria-hidden': true }),
      React.createElement('span',
        {
          className: model.errorSummary !== null
            ? 'dsh-git-bash-tool-card-summary dsh-git-bash-tool-card-error-summary'
            : 'dsh-git-bash-tool-card-summary',
        },
        summary,
      ),
      React.createElement('span', { className: 'dsh-git-bash-tool-card-dot', 'aria-label': status }),
    ),
    open && React.createElement('div', { className: 'dsh-git-bash-tool-card-body' },
      model.body !== '' && React.createElement('div', { className: 'dsh-git-bash-tool-card-section' },
        React.createElement('span', { className: 'dsh-git-bash-tool-card-label' }, 'IN'),
        React.createElement('span', { className: 'dsh-git-bash-tool-card-text' }, model.body),
      ),
      model.body !== '' && model.output !== null && React.createElement('div', { className: 'dsh-git-bash-tool-card-divider', 'aria-hidden': true }),
      model.output !== null && React.createElement('div', { className: 'dsh-git-bash-tool-card-section' },
        React.createElement('span', { className: 'dsh-git-bash-tool-card-label' }, 'OUT'),
        React.createElement('span',
          {
            className: 'dsh-git-bash-tool-card-text',
            'data-error': model.state === 'error' || undefined,
          },
          model.output,
        ),
      ),
      inspect !== undefined && React.createElement('button',
        {
          type: 'button',
          className: 'dsh-git-bash-tool-card-inspect',
          onClick: inspect,
        },
        'Inspect',
      ),
    ),
  )
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-primary, #ccc)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  fontSize: 13,
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-primary, #ccc)',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--dsw-alias-label-primary)',
}

function GitBaseSettingsPage() {
  const [bashPath, setBashPath] = useState('')
  const [mode, setMode] = useState<'pwsh' | 'git-bash'>('git-bash')
  const [resolved, setResolved] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let current = true
    Promise.all([
      fetch(`${API_PREFIX}/config`).then(response => response.json()),
      fetch(`${API_PREFIX}/status`).then(response => response.json()),
    ]).then(([config, status]) => {
      if (!current) return
      if (typeof config.bashPath === 'string') setBashPath(config.bashPath)
      if (config.mode === 'pwsh' || config.mode === 'git-bash') setMode(config.mode)
      if (typeof status.resolved === 'string') setResolved(status.resolved)
    }).catch(() => { /* Keep empty on failure. */ })
    return () => { current = false }
  }, [])

  async function save() {
    const trimmed = bashPath.trim()
    if (mode === 'git-bash' && trimmed === '') {
      setMessage('请输入 git-bash.exe 或 bash.exe 的完整路径')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`${API_PREFIX}/config`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bashPath: trimmed, mode }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? '保存失败')
      const status = await fetch(`${API_PREFIX}/status`).then(response => response.json())
      setResolved(typeof status.resolved === 'string' ? status.resolved : '')
      setMessage('已保存')
      window.dispatchEvent(new CustomEvent('dsh-git-bash-mode-changed'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  async function useDefault() {
    try {
      const status = await fetch(`${API_PREFIX}/status`).then(response => response.json())
      const path = typeof status.resolved === 'string' ? status.resolved : ''
      if (path !== '') {
        setBashPath(path)
        setMessage('已填入检测到的 Git Bash 路径')
      } else {
        setMessage('未检测到默认 Git Bash 路径，请手动填写')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px', fontSize: 13, lineHeight: 1.6 } },
    React.createElement('h3', { style: { margin: 0, fontSize: 15 } }, 'Git Base'),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #666)' } },
      '选择 pwsh 命令的执行模式。选中“Pwsh”时不替换命令；选中“Git Base”时自动转换为 Git Bash 命令执行。',
    ),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' } },
      ['pwsh', 'git-bash'].map(value => React.createElement('label', {
        key: value,
        style: { display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
      },
      React.createElement('input', {
        type: 'radio',
        name: 'git-bash-mode',
        checked: mode === value,
        onChange: () => setMode(value as 'pwsh' | 'git-bash'),
      }),
      value === 'pwsh' ? 'Pwsh' : 'Git Base',
      )),
    ),
    React.createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
      React.createElement('span', null, 'Git Bash 可执行文件路径'),
      React.createElement('input', {
        type: 'text',
        value: bashPath,
        placeholder: '例如 C:\\Program Files\\Git\\bin\\bash.exe',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setBashPath(event.target.value),
        style: inputStyle,
      }),
    ),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
      React.createElement('button', { type: 'button', onClick: () => void save(), disabled: saving, style: buttonStyle }, saving ? '保存中…' : '保存'),
      React.createElement('button', { type: 'button', onClick: () => void useDefault(), style: buttonStyle }, '使用检测到的默认路径'),
      message === '' ? null : React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #666)' } }, message),
    ),
    resolved === '' ? null : React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #666)' } },
      `当前生效路径：${resolved}`,
    ),
  )
}

export function apply(ctx: any): void {
  ctx.effect(installGitBashToolCardStyles, '@dsh-external/ui-git-bash: tool card styles')

  ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: 'git-base',
      order: 50,
      label: () => 'Git Base',
    }, GitBaseSettingsPage),
  )

  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'git_bash',
    }, GitBashToolCard),
  )
}
