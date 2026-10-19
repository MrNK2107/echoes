import { parseAllDocuments } from 'yaml';

const APP_IDS = ['${APP_ID}', 'com.phantom.echoes'];
/** Commands whose selectors must come from app copy. */
const SELECTOR_COMMANDS = new Set(['tapOn', 'assertVisible', 'assertNotVisible', 'scrollUntilVisible', 'extendedWaitUntil']);
/** Regex metacharacters a selector may not use: only `.*` is supported (a lone `.` is just a character). */
const FORBIDDEN = /[\\^$+?()[\]{}|*]/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();

interface Copy {
  /** Plain strings: quoted literals and JSX text. */
  literals: string[];
  /** Copy templates, `Report ${name}` or `Report {name}`, as anchored patterns (placeholder -> `.+`). */
  templates: RegExp[];
}

function extractCopy(source: string): Copy {
  const literals: string[] = [];
  const templates: RegExp[] = [];
  const add = (raw: string) => {
    if (/\{[^}]*\}/.test(raw)) {
      const parts = raw.split(/\$?\{[^}]*\}/);
      // A template that is all placeholder (or nearly) would match any selector.
      if (/[A-Za-z]{3}/.test(parts.join(''))) templates.push(new RegExp(`^${parts.map(escapeRe).join('.+')}$`));
    } else if (raw.trim().length > 0) {
      literals.push(normalise(raw));
    }
  };
  // One left-to-right scan, so an apostrophe inside "double quotes" never opens a literal.
  for (const m of source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g)) {
    add((m[1] ?? m[2] ?? m[3]).replace(/\\(.)/g, '$1'));
  }
  for (const m of source.matchAll(/>([^<>{}]+)</g)) add(m[1]);
  return { literals, templates };
}

/**
 * A Maestro text selector is a regex that must match the whole element text. Only `.*` is
 * supported; it must full-match at least one literal in the app, or one copy template.
 */
function checkSelector(selector: string, copy: Copy): string | null {
  const bad = selector.split('.*').join('').match(FORBIDDEN);
  if (bad) return `"${selector}": only ".*" is supported as a pattern, found "${bad[0]}"`;
  const full = new RegExp(`^${selector.split('.*').map(escapeRe).join('.*')}$`);
  if (copy.literals.some((l) => full.test(l)) || copy.templates.some((t) => t.test(selector))) return null;
  return `"${selector}" does not full-match any copy in the app`;
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

  const copy = extractCopy(sourceText);
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const [command, value] of Object.entries(node as Record<string, unknown>)) {
      if (SELECTOR_COMMANDS.has(command)) {
        for (const text of textsOf(value, problems, command)) {
          const problem = checkSelector(text, copy);
          if (problem) problems.push(`${command}: ${problem}`);
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
