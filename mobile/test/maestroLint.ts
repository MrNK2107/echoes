import { parseAllDocuments } from 'yaml';

const APP_IDS = ['${APP_ID}', 'com.phantom.echoes'];
/** Commands whose selectors must come from app copy. */
const SELECTOR_COMMANDS = new Set(['tapOn', 'assertVisible', 'assertNotVisible', 'scrollUntilVisible', 'extendedWaitUntil']);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Copy templates in source (`Report ${name}` or `Report {name}`) become wildcard patterns. */
function templatePatterns(source: string): RegExp[] {
  const out: RegExp[] = [];
  const add = (raw: string) => {
    if (!/\{[^}]*\}/.test(raw)) return;
    const parts = raw.split(/\$?\{[^}]*\}/);
    // A template that is all placeholder (or nearly) would match any selector.
    if (parts.join('').trim().length < 3) return;
    out.push(new RegExp(parts.map(escapeRe).join('.+')));
  };
  for (const m of source.matchAll(/`([^`\n]*)`/g)) add(m[1]);
  for (const m of source.matchAll(/'([^'\n]*\{[^}'\n]*\}[^'\n]*)'/g)) add(m[1]);
  for (const m of source.matchAll(/"([^"\n]*\{[^}"\n]*\}[^"\n]*)"/g)) add(m[1]);
  return out;
}

/** A Maestro text selector is a regex; `.*` splits it into literal chunks that must each exist. */
function selectorFound(selector: string, source: string, templates: RegExp[]): boolean {
  const chunks = selector
    .split('.*')
    .map((c) => c.replace(/\\(.)/g, '$1'))
    .filter((c) => c.length > 0);
  if (chunks.length === 0) return false;
  return chunks.every((c) => source.includes(c) || templates.some((t) => t.test(c)));
}

function textsOf(value: unknown, problems: string[], command: string): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if ('id' in v) problems.push(`${command}: selects by id; flows must select by visible copy`);
    const nested = (v.element ?? v.visible) as unknown;
    const own = typeof v.text === 'string' ? [v.text] : [];
    return nested ? [...own, ...textsOf(nested, problems, command)] : own;
  }
  return [];
}

export function lintFlow(yamlText: string, sourceText: string): string[] {
  const problems: string[] = [];
  const docs = parseAllDocuments(yamlText);
  const errors = docs.flatMap((d) => d.errors.map((e) => e.message));
  if (errors.length > 0) return errors.map((e) => `YAML: ${e.split('\n')[0]}`);

  const parsed = docs.map((d) => d.toJS() as unknown);
  const header = parsed[0] as { appId?: unknown } | null;
  if (!header || typeof header.appId !== 'string' || !APP_IDS.includes(header.appId)) {
    problems.push(`appId must be one of ${APP_IDS.join(', ')}`);
  }

  const templates = templatePatterns(sourceText);
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const [command, value] of Object.entries(node as Record<string, unknown>)) {
      if (SELECTOR_COMMANDS.has(command)) {
        for (const text of textsOf(value, problems, command)) {
          if (!selectorFound(text, sourceText, templates)) problems.push(`${command}: "${text}" matches no copy in the app`);
        }
      }
      if (command === 'runFlow' || command === 'repeat' || command === 'retry') {
        const body = (value as { commands?: unknown })?.commands;
        if (body) walk(body);
      } else if (typeof value === 'object') {
        walk(value);
      }
    }
  };
  parsed.slice(1).forEach(walk);
  return problems;
}
