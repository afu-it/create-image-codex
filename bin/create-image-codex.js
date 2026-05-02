#!/usr/bin/env node
'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const RED    = '\x1b[31m';

console.log('');
console.log(`${BLUE}╔══════════════════════════════════════╗${RESET}`);
console.log(`${BLUE}║     create-image-codex installer     ║${RESET}`);
console.log(`${BLUE}╚══════════════════════════════════════╝${RESET}`);
console.log('');

const SKILL_DIR  = path.join(os.homedir(), '.codex', 'skills', 'imagegen');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'imagegen');
const AUTH_FILE  = path.join(CONFIG_DIR, 'auth.json');
const REPO       = 'https://github.com/afu-it/create-image-codex.git';

// Install or update skill
try {
  if (fs.existsSync(path.join(SKILL_DIR, '.git'))) {
    console.log(`${YELLOW}► Updating existing skill...${RESET}`);
    execSync(`git -C "${SKILL_DIR}" pull --quiet`, { stdio: 'inherit' });
  } else {
    console.log(`${YELLOW}► Installing skill to ${SKILL_DIR}...${RESET}`);
    fs.mkdirSync(path.dirname(SKILL_DIR), { recursive: true });
    execSync(`git clone --quiet "${REPO}" "${SKILL_DIR}"`, { stdio: 'inherit' });
  }
  console.log(`${GREEN}✓ Skill installed${RESET}`);
} catch (err) {
  console.error(`${RED}✗ Failed to install skill: ${err.message}${RESET}`);
  process.exit(1);
}

// Setup config
fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(AUTH_FILE)) {
  fs.copyFileSync(path.join(SKILL_DIR, 'auth.json.example'), AUTH_FILE);
  console.log(`${GREEN}✓ Created ${AUTH_FILE}${RESET}`);
} else {
  console.log(`${YELLOW}✓ auth.json already exists, skipping${RESET}`);
}

console.log('');
console.log(`${GREEN}╔══════════════════════════════════════╗${RESET}`);
console.log(`${GREEN}║         Installation complete!       ║${RESET}`);
console.log(`${GREEN}╚══════════════════════════════════════╝${RESET}`);
console.log('');
console.log(`${BLUE}Next step — edit your credentials:${RESET}`);
console.log(`  ${AUTH_FILE}`);
console.log('');
console.log(`${BLUE}Fill in:${RESET}`);
console.log('  endpoint  → your OpenAI-compatible /v1/images/generations URL');
console.log('  api_key   → your API key for that endpoint');
console.log('  model     → e.g. gpt-image-1 or cx/gpt-5.4-image');
console.log('');
console.log(`${BLUE}Docs:${RESET} https://github.com/afu-it/create-image-codex/blob/main/SETUP.md`);
console.log('');
