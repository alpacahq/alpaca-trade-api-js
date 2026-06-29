const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");

type PaperMode = "true" | "false";

type Args = {
  targetDirectory: string;
  appName?: string;
  createSubdirectory: boolean;
  keyId?: string;
  secret?: string;
  paper: PaperMode;
  allowPlaceholderCredentials: boolean;
};

const appNamePattern = /^[a-z0-9][a-z0-9._-]*$/;
const substitutionFiles = new Set(["package.json", "app/layout.tsx", "README.md"]);

function parseArgs(argv: string[]): Args {
  const args: Args = {
    targetDirectory: "",
    createSubdirectory: false,
    paper: "true",
    allowPlaceholderCredentials: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    const [flag, inlineValue] = raw.includes("=") ? raw.split(/=(.*)/s, 2) : [raw, undefined];

    if (flag === "--create-subdirectory") {
      args.createSubdirectory = true;
      continue;
    }
    if (flag === "--allow-placeholder-credentials") {
      args.allowPlaceholderCredentials = true;
      continue;
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    if (inlineValue === undefined) {
      index += 1;
    }

    switch (flag) {
      case "--target-directory":
        args.targetDirectory = value;
        break;
      case "--app-name":
        args.appName = value;
        break;
      case "--key-id":
        args.keyId = value;
        break;
      case "--secret":
        args.secret = value;
        break;
      case "--paper":
        if (value !== "true" && value !== "false") {
          throw new Error("--paper must be true or false");
        }
        args.paper = value;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!args.targetDirectory) {
    throw new Error("--target-directory is required");
  }

  return args;
}

function expandHome(input: string): string {
  if (input === "~") {
    return process.env.HOME ?? input;
  }
  if (input.startsWith("~/")) {
    return path.join(process.env.HOME ?? "~", input.slice(2));
  }
  return input;
}

function resolveTarget(
  targetDirectory: string,
  appName: string | undefined,
  createSubdirectory: boolean,
): [string, string] {
  const expanded = expandHome(targetDirectory);
  const baseTarget = path.resolve(expanded);

  if (createSubdirectory) {
    if (appName === undefined) {
      throw new Error("app_name is required when --create-subdirectory is set");
    }
    return [path.join(baseTarget, appName), appName];
  }

  return [baseTarget, appName ?? path.basename(baseTarget)];
}

function validateAppName(appName: string): void {
  if (!appNamePattern.test(appName)) {
    throw new Error(
      "app_name must be a lowercase npm package name with no spaces, no uppercase letters, and no leading dot or underscore.",
    );
  }
}

function lstatIfExists(target: string): import("node:fs").Stats | undefined {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function validateTargetDirectory(target: string): void {
  const stat = lstatIfExists(target);
  if (stat?.isSymbolicLink()) {
    throw new Error("target_directory must not be a symlink");
  }
  if (stat !== undefined && !stat.isDirectory()) {
    throw new Error("target_directory exists and is not a directory");
  }
}

function relativePath(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join("/");
}

function listTemplateFiles(templateRoot: string): string[] {
  const files: string[] = [];

  function walk(directory: string): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const source = path.join(directory, entry.name);
      const relative = relativePath(templateRoot, source);

      if (entry.isSymbolicLink()) {
        throw new Error(`template contains unsupported symlink: ${relative}`);
      }
      if (entry.isDirectory()) {
        walk(source);
        continue;
      }
      if (entry.isFile()) {
        files.push(source);
      }
    }
  }

  walk(templateRoot);
  return files;
}

function templateConflicts(templateRoot: string, destination: string): string[] {
  const conflicts = new Set<string>();

  for (const source of listTemplateFiles(templateRoot)) {
    const relative = relativePath(templateRoot, source);
    const parts = relative.split("/");
    let current = destination;

    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      const stat = lstatIfExists(current);
      if (stat?.isSymbolicLink() || (stat !== undefined && !stat.isDirectory())) {
        conflicts.add(relativePath(destination, current));
        break;
      }
    }

    const target = path.join(destination, relative);
    if (lstatIfExists(target) !== undefined) {
      conflicts.add(relative);
    }
  }

  if (lstatIfExists(path.join(destination, ".env.local")) !== undefined) {
    conflicts.add(".env.local");
  }

  return Array.from(conflicts).sort();
}

function copyTemplateTree(templateRoot: string, destination: string, appName: string): void {
  for (const source of listTemplateFiles(templateRoot)) {
    const relative = relativePath(templateRoot, source);
    const target = path.join(destination, relative);

    if (lstatIfExists(target) !== undefined) {
      throw new Error(`Refusing to overwrite existing path: ${relative}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    const content = fs.readFileSync(source);
    if (substitutionFiles.has(relative)) {
      fs.writeFileSync(target, content.toString("utf8").replaceAll("{{APP_NAME}}", appName), "utf8");
    } else {
      fs.writeFileSync(target, content);
    }
  }
}

function resolveCredentials(args: Args): [string, string] {
  const keyId = args.keyId ?? process.env.APCA_API_KEY_ID;
  const secret = args.secret ?? process.env.APCA_API_SECRET_KEY;
  if (keyId && secret) {
    return [keyId, secret];
  }
  if (args.allowPlaceholderCredentials) {
    return ["your_paper_key_id", "your_paper_secret_key"];
  }
  throw new Error(
    "Missing paper trading credentials. Set APCA_API_KEY_ID and APCA_API_SECRET_KEY, pass --key-id/--secret, or use --allow-placeholder-credentials.",
  );
}

function writeEnvLocal(
  target: string,
  options: {
    keyId: string;
    secret: string;
    paper: PaperMode;
  },
): void {
  const envLocal = path.join(target, ".env.local");
  if (lstatIfExists(envLocal) !== undefined) {
    throw new Error("Refusing to overwrite existing path: .env.local");
  }

  fs.writeFileSync(
    envLocal,
    [
      "# Alpaca starter dashboard local environment.",
      "# This file is generated locally by the starter-dashboard skill.",
      "# Never commit real credentials.",
      `APCA_API_KEY_ID=${JSON.stringify(options.keyId)}`,
      `APCA_API_SECRET_KEY=${JSON.stringify(options.secret)}`,
      `APCA_PAPER=${JSON.stringify(options.paper)}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

function main(): number {
  try {
    const args = parseArgs(process.argv.slice(2));
    const skillRoot = path.resolve(__dirname, "..");
    const templateRoot = path.join(skillRoot, "template");

    const templateStat = lstatIfExists(templateRoot);
    if (templateStat === undefined || !templateStat.isDirectory()) {
      throw new Error(`Missing template directory: ${templateRoot}`);
    }

    const [target, appName] = resolveTarget(args.targetDirectory, args.appName, args.createSubdirectory);
    validateAppName(appName);
    validateTargetDirectory(target);

    const conflicts = templateConflicts(templateRoot, target);
    if (conflicts.length > 0) {
      throw new Error(`target_directory has existing generated paths: ${conflicts.join(", ")}`);
    }

    const [keyId, secret] = resolveCredentials(args);

    fs.mkdirSync(target, { recursive: true });
    try {
      copyTemplateTree(templateRoot, target, appName);
      writeEnvLocal(target, { keyId, secret, paper: args.paper });
    } catch (error) {
      if (fs.readdirSync(target).length === 0) {
        fs.rmdirSync(target);
      }
      throw error;
    }

    console.log(JSON.stringify({ target_directory: target, app_name: appName }, null, 2));
    return 0;
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    return 1;
  }
}

process.exitCode = main();
