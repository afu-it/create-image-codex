#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     create-image-codex installer     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

SKILL_DIR="$HOME/.codex/skills/imagegen"
CONFIG_DIR="$HOME/.config/imagegen"
AUTH_FILE="$CONFIG_DIR/auth.json"
REPO="https://github.com/afu-it/create-image-codex.git"

# Install skill
if [ -d "$SKILL_DIR/.git" ]; then
  echo -e "${YELLOW}► Updating existing skill...${NC}"
  git -C "$SKILL_DIR" pull --quiet
else
  echo -e "${YELLOW}► Installing skill to $SKILL_DIR...${NC}"
  mkdir -p "$(dirname "$SKILL_DIR")"
  git clone --quiet "$REPO" "$SKILL_DIR"
fi
echo -e "${GREEN}✓ Skill installed${NC}"

# Setup config
mkdir -p "$CONFIG_DIR"
if [ ! -f "$AUTH_FILE" ]; then
  cp "$SKILL_DIR/auth.json.example" "$AUTH_FILE"
  echo -e "${GREEN}✓ Created $AUTH_FILE${NC}"
else
  echo -e "${YELLOW}✓ auth.json already exists, skipping${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Installation complete!       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next step — edit your credentials:${NC}"
echo -e "  nano $AUTH_FILE"
echo ""
echo -e "${BLUE}Fill in:${NC}"
echo -e "  endpoint  → your OpenAI-compatible /v1/images/generations URL"
echo -e "  api_key   → your API key for that endpoint"
echo -e "  model     → e.g. gpt-image-1 or cx/gpt-5.4-image"
echo ""
echo -e "${BLUE}Docs:${NC} https://github.com/afu-it/create-image-codex/blob/main/SETUP.md"
echo ""
