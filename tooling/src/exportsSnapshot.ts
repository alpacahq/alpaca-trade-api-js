/** Normalized public identities emitted by generated barrel files. */
const STAR_RE_EXPORT = /export\s*\*\s*from\s*(['"])([^'"]+)\1\s*;?/g;
const NAMED_RE_EXPORT =
  /export\s+(type\s+)?\{([^};]*?)\}\s+from\s*(['"])([^'"]+)\3\s*;?/g;
const NAMED_SPECIFIER =
  /^([A-Za-z_$][\w$]*|default)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/;

export function parseExports(src: string): string[] {
  const withoutComments = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const out = new Set<string>();

  for (const match of withoutComments.matchAll(STAR_RE_EXPORT)) {
    out.add(`module:${match[2]}`);
  }

  for (const match of withoutComments.matchAll(NAMED_RE_EXPORT)) {
    const statementIsTypeOnly = Boolean(match[1]);
    const module = match[4];
    for (const rawSpecifier of match[2].split(",")) {
      let specifier = rawSpecifier.trim();
      if (!specifier) continue;

      const specifierIsTypeOnly = specifier.startsWith("type ");
      if (specifierIsTypeOnly) specifier = specifier.slice("type ".length).trim();

      const names = NAMED_SPECIFIER.exec(specifier);
      if (!names) {
        throw new Error(`Unsupported named re-export in generated barrel: ${rawSpecifier.trim()}`);
      }
      const imported = names[1];
      const exported = names[2] ?? imported;
      const alias = exported === imported ? imported : `${imported}->${exported}`;
      const kind = statementIsTypeOnly || specifierIsTypeOnly ? "type-symbol" : "symbol";
      out.add(`${kind}:${module}#${alias}`);
    }
  }

  return [...out].sort();
}

export interface ExportsDiff {
  added: string[];
  removed: string[];
}

export function diffExports(before: string[], after: string[]): ExportsDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((x) => !beforeSet.has(x)).sort(),
    removed: before.filter((x) => !afterSet.has(x)).sort(),
  };
}
