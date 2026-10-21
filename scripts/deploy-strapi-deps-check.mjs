#!/usr/bin/env node
/**
 * Compare root package.json dependencies with the git commit at the last
 * successful Strapi deploy (from build-deploy.log). Warn only on real diffs.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logPath = path.join(root, process.env.DEPLOY_LOG_FILE || "build-deploy.log");
const pkgPath = path.join(root, "package.json");

function isStrapiDeployCommand(command) {
  if (/backoffice/i.test(command)) return false;
  return /\bdeploy\b/i.test(command);
}

function parseLastSuccessfulStrapiDeploy(logText) {
  const marker = "--- deploy event ---";
  const blocks = logText.split(marker).slice(1);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const date = block.match(/^date: (.+)$/m)?.[1]?.trim();
    const command = block.match(/^command: (.+)$/m)?.[1]?.trim();
    const build = block.match(/^build: (.+)$/m)?.[1]?.trim();
    const ftp = block.match(/^ftp: (.+)$/m)?.[1]?.trim();
    if (!date || !command) continue;
    if (!isStrapiDeployCommand(command)) continue;
    if (build !== "success" || ftp !== "success") continue;
    return { date, command };
  }
  return null;
}

function gitCommitAt(deployDate) {
  try {
    return execSync(`git rev-list -1 --until='${deployDate}' HEAD`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function dependenciesFromCommit(commit) {
  const raw = execSync(`git show ${commit}:package.json`, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(raw).dependencies ?? {};
}

function dependenciesFromFile(file) {
  return JSON.parse(fs.readFileSync(file, "utf8")).dependencies ?? {};
}

function diffDependencies(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const name of [...keys].sort()) {
    const was = before[name];
    const now = after[name];
    if (was === undefined) {
      changes.push({ kind: "added", name, to: now });
    } else if (now === undefined) {
      changes.push({ kind: "removed", name, from: was });
    } else if (was !== now) {
      changes.push({ kind: "changed", name, from: was, to: now });
    }
  }
  return changes;
}

function main() {
  if (!fs.existsSync(logPath)) return;
  if (!fs.existsSync(pkgPath)) return;

  const logText = fs.readFileSync(logPath, "utf8");
  const last = parseLastSuccessfulStrapiDeploy(logText);
  if (!last) return;

  const commit = gitCommitAt(last.date);
  if (!commit) return;

  let before;
  try {
    before = dependenciesFromCommit(commit);
  } catch {
    return;
  }

  const after = dependenciesFromFile(pkgPath);
  const changes = diffDependencies(before, after);
  if (changes.length === 0) return;

  const short = commit.slice(0, 7);
  process.stderr.write("\n");
  process.stderr.write(
    "\x1b[1;31mFIGYELEM: a package.json dependencies (Strapi) eltér az utolsó sikeres deploy óta rögzített git állapottól.\x1b[0m\n"
  );
  process.stderr.write(
    `\x1b[1;31mA szerveren NPM Install szükséges (majd alkalmazás újraindítás).\x1b[0m\n\n`
  );
  process.stderr.write(
    `Utolsó Strapi deploy: ${last.date} (${last.command})\n`
  );
  process.stderr.write(
    `Összehasonlítás: git ${short} (package.json @ deploy időpont) → mostani working tree\n\n`
  );

  for (const c of changes) {
    if (c.kind === "added") {
      process.stderr.write(`  + ${c.name}@${c.to}\n`);
    } else if (c.kind === "removed") {
      process.stderr.write(`  - ${c.name} (volt: ${c.from})\n`);
    } else {
      process.stderr.write(`  ~ ${c.name}: ${c.from} → ${c.to}\n`);
    }
  }
  process.stderr.write("\n");
}

main();
