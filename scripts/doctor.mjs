import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, ".env.local");
const envExamplePath = path.join(projectRoot, ".env.example");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const majorVersion = Number.parseInt(process.versions.node.split(".")[0], 10);
if (Number.isNaN(majorVersion) || majorVersion < 22) {
  fail(`Node.js 22 or newer is required. Current version: ${process.versions.node}`);
}

if (!process.env.npm_config_user_agent?.includes("pnpm")) {
  fail("Run this repo with pnpm so installs and scripts stay consistent.");
}

if (!fs.existsSync(envExamplePath)) {
  fail("Missing .env.example. Restore the tracked template before continuing.");
}

if (!fs.existsSync(envPath)) {
  fail(
    "Missing .env.local. Copy .env.example to .env.local and fill Agora credentials."
  );
}

const envContents = fs.readFileSync(envPath, "utf8");

function hasValue(keys) {
  return keys.some((key) => {
    const matcher = new RegExp(`^${key}=[^\\s#]+`, "m");
    return matcher.test(envContents);
  });
}

if (!hasValue(["NEXT_PUBLIC_AGORA_APP_ID", "AGORA_APP_ID"])) {
  fail(
    ".env.local is missing App ID. Set NEXT_PUBLIC_AGORA_APP_ID (or legacy AGORA_APP_ID)."
  );
}

if (!hasValue(["NEXT_AGORA_APP_CERTIFICATE", "AGORA_APP_CERTIFICATE"])) {
  fail(
    ".env.local is missing App Certificate. Set NEXT_AGORA_APP_CERTIFICATE (or legacy AGORA_APP_CERTIFICATE)."
  );
}

console.log("Doctor checks passed");
