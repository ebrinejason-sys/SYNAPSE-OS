#!/usr/bin/env node
/**
 * Check Vercel deployment status for SYNAPSE projects.
 * Requires: vercel CLI authenticated (`vercel login`)
 * Usage: npm run deploy:status
 */

import { execSync } from "node:child_process";

const PROJECTS = ["synpase-os", "synapse-pharm", "synapse-demo"];

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

console.log("SYNAPSE deployment status\n");

for (const project of PROJECTS) {
  try {
    const out = run(`npx vercel ls ${project} 2>/dev/null | head -5`);
    const lines = out.split("\n").filter(Boolean);
    const latest = lines.find((l) => l.includes("●"));
    const status = latest?.includes("Ready") ? "READY" : latest?.includes("Error") ? "ERROR" : "UNKNOWN";
    const icon = status === "READY" ? "✓" : status === "ERROR" ? "✗" : "?";
    console.log(`${icon} ${project}: ${status}`);
    if (latest) console.log(`  ${latest.trim()}`);
  } catch (err) {
    console.log(`? ${project}: could not fetch (${err.message?.slice(0, 60)})`);
  }
}

console.log("\nGitHub CI: gh run list --workflow=deploy.yml --limit 3");
try {
  const gh = run("gh run list --workflow=deploy.yml --limit 3 2>/dev/null");
  console.log(gh);
} catch {
  console.log("(gh not available or not authenticated)");
}
