# Setup Guide

This Codex skill supports **two image generation paths** — no direct OpenAI API key required.

---

## Priority Order

| Priority | Method | Requires |
|---|---|---|
| 1st | Built-in `image_generation_call` (platform) | Nothing — auto |
| 2nd | Custom endpoint via `auth.json` | Your own endpoint + key |

---

## Option 1 — Built-in Tool (Nothing to configure)

If your Codex session exposes the built-in image generation tool, the skill uses it automatically. No setup needed.

---

## Option 2 — Custom Endpoint (auth.json)

Use your own OpenAI-compatible image endpoint — works with:
- **9Router / local proxy** (e.g. `http://localhost:20128`)
- **OpenRouter** (`https://openrouter.ai/api/v1`)
- **Direct OpenAI** (`https://api.openai.com/v1`)
- **Any OpenAI-compatible API**

### Step 1 — Create config directory

```bash
mkdir -p ~/.config/imagegen
```

### Step 2 — Create auth.json

```bash
cat > ~/.config/imagegen/auth.json << 'EOF'
{
  "endpoint": "YOUR_ENDPOINT/v1/images/generations",
  "api_key": "YOUR_API_KEY_HERE",
  "model": "gpt-image-1"
}
EOF
```

### Step 3 — Fill in your values

| Field | Example | Notes |
|---|---|---|
| `endpoint` | `http://localhost:20128/v1/images/generations` | Full URL to `/v1/images/generations` |
| `api_key` | `sk-xxxxxxxxxxxx` | Your key for that endpoint |
| `model` | `gpt-image-1` or `cx/gpt-5.4-image` | Depends on your provider |

### Examples by provider

**9Router / local proxy:**
```json
{
  "endpoint": "http://localhost:20128/v1/images/generations",
  "api_key": "sk-your-9router-key",
  "model": "cx/gpt-5.4-image"
}
```

**OpenRouter:**
```json
{
  "endpoint": "https://openrouter.ai/api/v1/images/generations",
  "api_key": "sk-or-xxxxxxxxxxxx",
  "model": "openai/gpt-image-1"
}
```

**Direct OpenAI:**
```json
{
  "endpoint": "https://api.openai.com/v1/images/generations",
  "api_key": "sk-xxxxxxxxxxxx",
  "model": "gpt-image-1"
}
```

---

## Install Dependencies

```bash
# Preferred
uv pip install openai pillow

# Alternative
python3 -m pip install openai pillow
```

---

## Verify Setup

```bash
python3 -c "
import json
from pathlib import Path
auth = json.loads(Path.home().joinpath('.config/imagegen/auth.json').read_text())
print('endpoint:', auth.get('endpoint'))
print('model   :', auth.get('model'))
print('key set :', bool(auth.get('api_key')))
"
```

---

## Security

`auth.json` contains your API key — **never commit it to git.**

The skill reads it at runtime from `~/.config/imagegen/auth.json` on your local machine only.
