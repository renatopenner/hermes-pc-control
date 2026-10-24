/**
 * PC Control — painel do controle do PC: estado da sessão, killswitch por
 * capacidade e auditoria ao vivo. Backend: dashboard/plugin_api.py.
 */

import { host, useQuery, useMutation, queryClient } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'

const MUTED = { fontSize: 11, color: 'var(--ui-text-tertiary)' }
const ROW = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }

const CAP_LABEL = {
  input: 'mouse e teclado',
  foreground: 'primeiro plano (foco)',
  background: 'segundo plano (sem foco)',
  window: 'janelas',
  elements: 'árvore de controles',
  process: 'processos',
  service: 'serviços',
  power: 'energia / desligar',
  screenshot: 'captura de tela',
  clipboard: 'clipboard',
}

function pill(text, strong) {
  return jsx('span', {
    style: {
      fontSize: 10,
      padding: '1px 6px',
      borderRadius: 999,
      border: '1px solid var(--ui-stroke-secondary)',
      color: strong ? 'var(--ui-accent)' : 'var(--ui-text-tertiary)',
    },
    children: text,
  })
}

function useStateQuery(ctx) {
  return useQuery({
    queryKey: ['pc-control', 'state'],
    queryFn: () => ctx.rest('/state'),
    refetchInterval: 4000,
  })
}

function Toggle({ label, on, onToggle }) {
  return jsxs('button', {
    type: 'button',
    onClick: onToggle,
    title: label,
    style: {
      ...ROW,
      width: '100%',
      background: 'transparent',
      border: 'none',
      padding: '3px 0',
      cursor: 'pointer',
      color: on ? 'var(--ui-text-secondary)' : 'var(--ui-text-tertiary)',
      textAlign: 'left',
    },
    children: [
      jsx('span', { style: { fontSize: 12 }, children: label }),
      jsx('span', {
        style: {
          width: 26,
          height: 14,
          borderRadius: 999,
          border: '1px solid var(--ui-stroke-secondary)',
          background: on ? 'var(--ui-accent)' : 'transparent',
          flexShrink: 0,
        },
      }),
    ],
  })
}

function SessionBlock({ session }) {
  if (!session) return null
  if (session.error) {
    return jsx('div', { style: MUTED, children: `sessão: ${session.error}` })
  }
  const locked = session.locked === true
  const items = [
    pill(locked ? 'sessão BLOQUEADA' : 'sessão interativa', !locked),
    pill(session.elevated ? 'elevado' : 'não elevado', false),
    pill(`${(session.monitors || []).length} monitor(es)`, false),
  ]
  return jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [
    jsx('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' }, children: items }),
    jsx('div', {
      style: { ...MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      children: `foco: ${session.foreground_title || '(nada)'}`,
    }),
    locked
      ? jsx('div', { style: { ...MUTED, color: 'var(--ui-text-secondary)' },
          children: 'Bloqueada: input não é entregue. Desbloqueie a sessão.' })
      : null,
  ] })
}

function AuditList({ items }) {
  if (!items || !items.length) {
    return jsx('div', { style: MUTED, children: 'Nenhuma ação registrada ainda.' })
  }
  return jsx('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: items
    .slice()
    .reverse()
    .map((it, i) => jsxs('div', {
      style: { display: 'flex', gap: 6, fontSize: 11, color: 'var(--ui-text-tertiary)' },
      children: [
        jsx('span', { style: { color: it.ok ? 'var(--ui-text-secondary)' : 'var(--ui-text-tertiary)' },
          children: it.ok ? '•' : '✕' }),
        jsx('span', { style: { fontWeight: 600 }, children: it.tool }),
        jsx('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          children: it.summary || it.action || '' }),
      ],
    }, `${it.ts}-${i}`)) })
}

function PcPane({ ctx }) {
  const query = useStateQuery(ctx)
  const patch = useMutation({
    mutationFn: (body) => ctx.rest('/state', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pc-control'] }),
  })

  const data = query.data || {}
  const allow = data.allow || {}
  const enabled = data.enabled !== false
  const audit = data.audit || []

  const rows = Object.keys(CAP_LABEL).map((cap) =>
    jsx(Toggle, {
      label: CAP_LABEL[cap],
      on: allow[cap] !== false,
      onToggle: () => patch.mutate({ capability: cap, granted: allow[cap] === false }),
    }, cap),
  )

  const children = [
    jsxs('div', { style: { ...ROW, alignItems: 'baseline' }, children: [
      jsx('div', { style: { fontWeight: 600, color: 'var(--ui-text-secondary)' }, children: 'Controle do PC' }),
      jsx('div', { style: MUTED, children: enabled ? 'ativo' : 'desligado' }),
    ] }),
    query.error
      ? jsx('div', { style: MUTED, children: 'Backend indisponível. Habilite pc-control e reinicie o gateway.' })
      : null,
    query.isLoading ? jsx('div', { style: MUTED, children: 'Lendo estado…' }) : null,
    jsx(SessionBlock, { session: data.session }),
    jsx('button', {
      type: 'button',
      onClick: () => patch.mutate({ enabled: !enabled }),
      style: {
        marginTop: 2,
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 6,
        cursor: 'pointer',
        border: '1px solid var(--ui-stroke-secondary)',
        background: enabled ? 'transparent' : 'var(--ui-accent)',
        color: enabled ? 'var(--ui-text-secondary)' : 'var(--ui-text-tertiary)',
      },
      children: enabled ? 'STOP — desligar tudo' : 'Religar',
    }),
    jsx('div', { style: { ...MUTED, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
      children: 'capacidades' }),
    jsx('div', { style: { display: 'flex', flexDirection: 'column' }, children: rows }),
    jsx('div', { style: { ...MUTED, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
      children: 'auditoria' }),
    jsx(AuditList, { items: audit }),
  ]

  return jsx('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 12,
      height: '100%',
      overflow: 'auto',
      fontSize: 13,
      color: 'var(--ui-text-secondary)',
    },
    children,
  })
}

export default {
  id: 'pc-control',
  name: 'PC Control',
  defaultEnabled: true,
  register(ctx) {
    ctx.register({
      id: 'pane',
      area: 'panes',
      title: 'controle do pc',
      data: { placement: 'right', width: '300px' },
      render: () => jsx(PcPane, { ctx }),
    })
  },
}
