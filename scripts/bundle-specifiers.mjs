export function externalModuleSpecifiers(source) {
    const specifiers = new Set();
    const patterns = [
        /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/g,
        /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
        /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    ];

    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            specifiers.add(match[1]);
        }
    }

    return [...specifiers].sort();
}

export function forbiddenExternalSpecifiers(source, forbiddenDependencies) {
    return externalModuleSpecifiers(source).filter((specifier) =>
        forbiddenDependencies.some(
            (dependency) =>
                specifier === dependency ||
                specifier.startsWith(`${dependency}/`),
        ),
    );
}

export function parseNpmPackJson(output) {
    const jsonStart = output.lastIndexOf("\n[");
    return JSON.parse(jsonStart === -1 ? output : output.slice(jsonStart + 1));
}
