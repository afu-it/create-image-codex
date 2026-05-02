# create-image-codex

> **One command. AI image generation in Codex.** Built-in platform tool first, custom endpoint fallback — no hardcoded keys.

[![version](https://img.shields.io/badge/version-1.0.0-teal?style=flat-square)](./skills/imagegen/SKILL.md)
[![works with](https://img.shields.io/badge/works%20with-Codex%20%7C%20Claude%20%7C%20Cursor%20%7C%20Windsurf-blue?style=flat-square)](#)
[![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#)

---

## Install

```bash
# Install into your current project
npx skills add afu-it/create-image-codex

# Install globally (all projects)
npx skills add afu-it/create-image-codex -g

# Preview before installing
npx skills add afu-it/create-image-codex --list
```

Works with **Codex, Claude Code, Cursor, Windsurf**, and other agents.

---

## How It Works

```
1st → Built-in image_generation_call (platform, best quality, no key needed)
2nd → Custom endpoint from ~/.config/imagegen/auth.json
      ↳ 9Router, OpenRouter, direct OpenAI, or any compatible proxy
```

The skill auto-detects which path to use — you never have to configure anything for the built-in path.

---

## Setup auth.json (for custom endpoint)

Only needed if built-in tool is not available in your session:

```bash
mkdir -p ~/.config/imagegen
cat > ~/.config/imagegen/auth.json << 'EOF'
{
  "endpoint": "YOUR_ENDPOINT/v1/images/generations",
  "api_key": "YOUR_API_KEY_HERE",
  "model": "gpt-image-1"
}
EOF
```

| Provider | endpoint | model |
|---|---|---|
| 9Router / local proxy | `http://localhost:20128/v1/images/generations` | `cx/gpt-5.4-image` |
| OpenRouter | `https://openrouter.ai/api/v1/images/generations` | `openai/gpt-image-1` |
| Direct OpenAI | `https://api.openai.com/v1/images/generations` | `gpt-image-1` |

Full setup guide: [SETUP.md](./SETUP.md)

---

## Usage

Just ask Codex to generate an image:

```
Generate a photorealistic hero image for the landing page
```

```
Generate a product mockup of a coffee mug on a wooden table
```

```
Edit this image: replace the background with a sunset gradient
```

---

## File Structure

```
├── skills/
│   └── imagegen/
│       └── SKILL.md          ← main skill instructions
├── SETUP.md              ← auth.json setup guide
├── auth.json.example     ← template (copy to ~/.config/imagegen/)
└── .gitignore
```

---

## Security

`auth.json` is **never committed** — lives only at `~/.config/imagegen/auth.json` on your machine.

## License

MIT
