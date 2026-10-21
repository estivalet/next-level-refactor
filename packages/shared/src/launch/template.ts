// Launch argument templates (data model §2.1, FR-EMU-3). A profile's args are rendered element
// by element into an argv array; nothing is ever joined into a command string (ADR-004).

/** The only tokens a template may use. */
export const TEMPLATE_TOKENS = [
  'rom',
  'romDir',
  'romName',
  'romFile',
  'romExt',
  'systemId',
  'systemDir',
  'emulatorDir',
  'core',
  'extraArgs',
] as const;

export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];

export type TemplateIssue = {
  message: 'unknownToken' | 'unclosedBrace' | 'extraArgsAlone';
  token?: string;
  index: number;
};

export type TokenContext = Record<Exclude<TemplateToken, 'extraArgs'>, string> & {
  extraArgs: readonly string[];
};

type Part = { kind: 'text'; text: string } | { kind: 'token'; name: string; index: number };

const KNOWN = new Set<string>(TEMPLATE_TOKENS);

/** Splits a template into literal text and `{token}` parts; `{{`/`}}` are literal braces. */
function scan(template: string): { parts: Part[]; issues: TemplateIssue[] } {
  const parts: Part[] = [];
  const issues: TemplateIssue[] = [];
  let text = '';
  let i = 0;
  while (i < template.length) {
    const char = template.charAt(i);
    const next = template.charAt(i + 1);
    if ((char === '{' && next === '{') || (char === '}' && next === '}')) {
      text += char;
      i += 2;
    } else if (char === '{') {
      const end = template.indexOf('}', i + 1);
      if (end < 0) {
        issues.push({ message: 'unclosedBrace', index: i });
        break;
      }
      if (text) parts.push({ kind: 'text', text });
      text = '';
      parts.push({ kind: 'token', name: template.slice(i + 1, end), index: i });
      i = end + 1;
    } else if (char === '}') {
      issues.push({ message: 'unclosedBrace', index: i });
      i += 1;
    } else {
      text += char;
      i += 1;
    }
  }
  if (text) parts.push({ kind: 'text', text });
  return { parts, issues };
}

/**
 * Problems in one template. `arg` is one argv element, where `{extraArgs}` may stand alone;
 * `value` is a cwd or env value, where it may not appear at all.
 */
export function templateIssues(template: string, where: 'arg' | 'value'): TemplateIssue[] {
  const { parts, issues } = scan(template);
  for (const part of parts) {
    if (part.kind !== 'token') continue;
    if (!KNOWN.has(part.name)) {
      issues.push({ message: 'unknownToken', token: part.name, index: part.index });
    } else if (part.name === 'extraArgs' && (where === 'value' || parts.length > 1)) {
      issues.push({ message: 'extraArgsAlone', token: part.name, index: part.index });
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}

/** Whether a template uses a token (literal `{{token}}` doesn't count). */
export function usesToken(template: string, token: TemplateToken): boolean {
  return scan(template).parts.some((part) => part.kind === 'token' && part.name === token);
}

/** Renders a template that has no issues; `{extraArgs}` is not allowed here. */
export function renderValue(template: string, ctx: TokenContext): string {
  return scan(template)
    .parts.map((part) => {
      if (part.kind === 'text') return part.text;
      if (part.name === 'extraArgs' || !KNOWN.has(part.name)) {
        throw new Error(`token {${part.name}} can't be rendered here`);
      }
      return ctx[part.name as Exclude<TemplateToken, 'extraArgs'>];
    })
    .join('');
}

/** Renders a profile's args into argv; an element that is exactly `{extraArgs}` expands in place. */
export function renderArgs(args: readonly string[], ctx: TokenContext): string[] {
  return args.flatMap((arg) =>
    arg === '{extraArgs}' ? [...ctx.extraArgs] : [renderValue(arg, ctx)],
  );
}

/** Quotes one element the way CommandLineToArgvW reads it back. */
function quoteArg(arg: string): string {
  if (arg !== '' && !/[\s"]/.test(arg)) return arg;
  let out = '"';
  let backslashes = 0;
  for (const char of arg) {
    if (char === '\\') {
      backslashes += 1;
    } else if (char === '"') {
      out += '\\'.repeat(backslashes * 2 + 1) + '"';
      backslashes = 0;
    } else {
      out += '\\'.repeat(backslashes) + char;
      backslashes = 0;
    }
  }
  return out + '\\'.repeat(backslashes * 2) + '"';
}

/** The command line for display only; launching always passes the argv array. */
export function formatCommandLine(executable: string, args: readonly string[]): string {
  return [executable, ...args].map(quoteArg).join(' ');
}
