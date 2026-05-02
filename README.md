# create-image-codex

A [Codex](https://openai.com/codex) skill for AI image generation — supports built-in platform tool and any OpenAI-compatible endpoint via `auth.json`.

## Features

- ✅ Auto-uses built-in `image_generation_call` if available (best quality)
- ✅ Falls back to any custom endpoint via `~/.config/imagegen/auth.json`
- ✅ Works with 9Router, OpenRouter, direct OpenAI, or any compatible proxy
- ✅ No hardcoded API keys — credentials stay on your machine
- ✅ SSE stream parsing for real-time generation
- ✅ Supports generate, edit, and batch workflows

## Quick Start

### 1. Clone / install skill

```bash
git clone https://github.com/afu-it/create-image-codex ~/.codex/skills/imagegen
```

### 2. Setup auth.json

See [SETUP.md](SETUP.md) for full instructions.

```bash
mkdir -p ~/.config/imagegen
cp auth.json.example ~/.config/imagegen/auth.json
# Edit ~/.config/imagegen/auth.json with your endpoint + key
```

### 3. Use in Codex

Just ask Codex to generate an image:

```
Generate a photorealistic hero image of a mountain at sunset
```

Codex will automatically use the best available method.

## How It Works

```
1st → Built-in image_generation_call (platform, no key needed)
2nd → Custom endpoint from ~/.config/imagegen/auth.json
      ↳ 9Router, OpenRouter, direct OpenAI, or any compatible proxy
```

## File Structure

```
├── SKILL.md              ← Main skill instructions for Codex
├── SETUP.md              ← User setup guide
├── auth.json.example     ← Template config (copy to ~/.config/imagegen/)
├── .gitignore            ← Excludes auth.json and outputs
└── references/
    ├── cli.md
    ├── image-api.md
    ├── prompting.md
    └── sample-prompts.md
```

## Security

`auth.json` is **never committed** — it lives only at `~/.config/imagegen/auth.json` on your machine. The `.gitignore` enforces this.

## License

MIT
