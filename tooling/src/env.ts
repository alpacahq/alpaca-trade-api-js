import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * openapi-generator-cli requires a working JDK. The Homebrew openjdk is
 * keg-only (not on PATH), and macOS ships a /usr/bin/java stub that is not a
 * real runtime, so we must check that `java -version` actually RUNS. We locate a
 * usable JDK and prepend it to PATH for this process only -- no global changes.
 */
export function javaRuns(): boolean {
  const r = spawnSync("java", ["-version"], { stdio: "ignore", shell: false });
  return r.status === 0;
}

/**
 * A conservative absolute-path allowlist: a leading slash followed by one or
 * more `/`-separated segments of `[A-Za-z0-9._+-]`. This deliberately rejects
 * whitespace and every shell metacharacter, so a path derived from the
 * environment (e.g. `java_home` output) can never carry an injection payload
 * into PATH. Acts as the sanitizer barrier for the env -> child-process flow.
 */
const SAFE_ABS_PATH = /^\/(?:[A-Za-z0-9._+-]+\/)*[A-Za-z0-9._+-]+$/;

/**
 * Prepend a JDK `bin` directory to PATH, but only after validating it is a
 * safe absolute path that actually contains a `java` executable. This prevents
 * an unexpected/empty/tainted value (e.g. from `java_home`) from poisoning PATH.
 */
function prependJavaBinDir(dir: string): boolean {
  if (!SAFE_ABS_PATH.test(dir) || !path.isAbsolute(dir)) return false;
  const javaBin = path.join(dir, "java");
  if (!fs.existsSync(javaBin)) return false;
  process.env.PATH = `${dir}${path.delimiter}${process.env.PATH ?? ""}`;
  return javaRuns();
}

export function ensureJavaOnPath(): void {
  if (javaRuns()) return;

  // macOS: /usr/libexec/java_home prints a real JDK home when one is registered.
  const jh = spawnSync("/usr/libexec/java_home", [], { encoding: "utf8", shell: false });
  if (jh.status === 0 && typeof jh.stdout === "string") {
    const home = jh.stdout.trim();
    if (home && prependJavaBinDir(path.join(home, "bin"))) return;
  }

  // Homebrew keg-only openjdk (fixed, known-good candidate locations).
  for (const dir of ["/opt/homebrew/opt/openjdk/bin", "/usr/local/opt/openjdk/bin"]) {
    if (prependJavaBinDir(dir)) return;
  }

  throw new Error(
    "No working JDK found. openapi-generator needs Java. Install one, e.g.: brew install openjdk\n" +
      "(macOS ships a /usr/bin/java stub that is not a real runtime.)",
  );
}
