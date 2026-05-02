---
name: "create image codex"
description: "Create images on Codex, especially with 9Router (e.g., generate image, edit/inpaint/mask, background removal, transparent background, product shots, concept art, covers, or batch variants). Auto-patches ~/.codex/config.toml if needed. Uses built-in image generation first, then falls back to provider endpoint via config.toml + auth.json."
---

# Image Generation Skill

Generates or edits images for the current project (website assets, game assets, UI mockups, product mockups, logos, photorealistic images, infographics).

## When to use
- Generate a new image (concept art, product shot, cover, website hero)
- Edit an existing image (inpainting, masked edits, background replacement, object removal)
- Batch runs (many prompts or many variants)

## Decision tree (generate vs edit vs batch)
- If the user provides an input image OR says "edit/retouch/inpaint/mask" → **edit**
- Else if the user needs many different prompts/assets → **generate-batch**
- Else → **generate**

---

## Environment — Priority Order

### Step 0: Auto-patch config.toml (run first, always)

Before anything else, ensure `~/.codex/config.toml` has the required image generation settings.
If missing entries, **auto-add them without asking the user**.

```python
from pathlib import Path
import sys

config_path = Path.home() / ".codex" / "config.toml"
if not config_path.exists():
    raise SystemExit("[imagegen] ~/.codex/config.toml not found. Please set up Codex first.")

raw = config_path.read_text()
lines_to_add = []

# Check [features] image_generation
if "image_generation" not in raw:
    lines_to_add.append("\n[features]\nimage_generation = true")
    print("[imagegen] Auto-adding: [features] image_generation = true")

# Check [image_generation] model block
if "[image_generation]" not in raw:
    # Detect provider from existing config
    provider = ""
    for line in raw.splitlines():
        if line.strip().startswith("model_provider"):
            provider = line.split("=")[-1].strip().strip('"').lower()
            break
    model = "cx/gpt-5.4-image" if "9router" in provider else "gpt-image-2"
    lines_to_add.append(f"\n[image_generation]\nmodel = \"{model}\"")
    print(f"[imagegen] Auto-adding: [image_generation] model = {model}")

if lines_to_add:
    with open(config_path, "a") as f:
        f.write("\n" + "\n".join(lines_to_add) + "\n")
    print("[imagegen] config.toml patched.")
else:
    print("[imagegen] config.toml already configured.")
```

---

### 1st choice: Built-in image generation (PREFERRED)

Use built-in `image_generation_call` if:
- `[features] image_generation = true` is set (auto-patched above)
- built-in tool is available in this session

If both → use it directly. Skip steps below.

---

### 2nd choice: Provider fallback via config.toml + auth.json

Only if built-in tool is NOT available in this session.

**Setup env vars:**
```bash
python3 - <<'PYSETUP' > /tmp/imagegen_env.sh
import json, tomllib
from pathlib import Path

config = tomllib.loads((Path.home() / ".codex" / "config.toml").read_text())
auth   = json.loads((Path.home() / ".codex" / "auth.json").read_text())

provider_name = config.get("model_provider", "").strip()
base_url = config["model_providers"][provider_name]["base_url"].rstrip("/")
endpoint = f"{base_url}/images/generations"

img_cfg = config.get("image_generation", {})
model = img_cfg.get("model") or ("cx/gpt-5.4-image" if "9router" in provider_name.lower() else "gpt-image-2")

# KEY RESOLUTION (confirmed working order for 9Router):
# 1. OPENAI_API_KEY in auth.json  — this is the 9Router sk-... key
# 2. tokens.access_token          — this is an OpenAI JWT, NOT a 9Router key; do NOT use for 9Router
# If OPENAI_API_KEY is present, always prefer it regardless of provider
tokens  = auth.get("tokens", {})
api_key = (
    auth.get("OPENAI_API_KEY", "")
    or tokens.get("access_token", "")
).strip()

if not api_key:
    raise SystemExit("[imagegen] No API key found in ~/.codex/auth.json")

print(f'export IMAGEGEN_ENDPOINT={json.dumps(endpoint)}')
print(f'export IMAGEGEN_MODEL={json.dumps(model)}')
print(f'export IMAGEGEN_KEY={json.dumps(api_key)}')
PYSETUP

source /tmp/imagegen_env.sh
```

**Build request JSON:**
```bash
python3 - <<'PY' > tmp/imagegen/request.json
import json, os
prompt = """<PROMPT>""".strip()
print(json.dumps({
    "model": os.environ["IMAGEGEN_MODEL"],
    "prompt": prompt,
    "n": 1,
    "size": "auto",
    "quality": "auto",
    "background": "auto",
    "image_detail": "high",
    "output_format": "png"
}))
PY
```

**Call endpoint:**
```bash
mkdir -p tmp/imagegen output/imagegen

curl -sS -X POST "$IMAGEGEN_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $IMAGEGEN_KEY" \
  -H "Accept: text/event-stream" \
  --data-binary @tmp/imagegen/request.json \
  -o tmp/imagegen/response.raw
```

**Parse response (handles both SSE and plain JSON):**
```python
import json, base64
from pathlib import Path

raw = Path("tmp/imagegen/response.raw").read_text(errors="replace")
final = None

# Try SSE event stream first
for block in raw.strip().split("\n\n"):
    lines = block.splitlines()
    ev   = next((l[6:].strip() for l in lines if l.startswith("event:")), "")
    data = "".join(l[5:].strip() for l in lines if l.startswith("data:"))
    if ev == "done" and data:
        final = json.loads(data)
        break

# Fallback: plain JSON response (9Router returns plain JSON)
if not final:
    try:
        final = json.loads(raw)
    except Exception as exc:
        print(raw[:1000])
        raise SystemExit(f"[imagegen] Could not parse response: {exc}")

if "error" in final:
    raise SystemExit(f"[imagegen] API error: {final['error']}")

item = final.get("data", [{}])[0]
b64  = item.get("b64_json", "")
url  = item.get("url", "")

out = Path("output/imagegen/result.png")
if b64:
    out.write_bytes(base64.b64decode(b64))
    print(f"[imagegen] Saved: {out} ({out.stat().st_size:,} bytes)")
elif url:
    import urllib.request
    urllib.request.urlretrieve(url, out)
    print(f"[imagegen] Downloaded: {out} ({out.stat().st_size:,} bytes)")
else:
    print(raw[:1000])
    raise SystemExit("[imagegen] No b64_json or url in response.")
```

---

### STOP conditions (strict)
- If `~/.codex/config.toml` not found → STOP, tell user to set up Codex
- If `~/.codex/auth.json` not found → STOP, tell user to authenticate Codex (`codex auth login`)
- If no API key found in auth.json → STOP, report missing key
- If provider `base_url` missing → STOP, report which provider config is incomplete
- Do NOT hardcode any API key or endpoint URL
- Do NOT use `tokens.access_token` as image API key for 9Router — it is an OpenAI JWT, not a 9Router bearer key
- Do NOT use `~/.config/imagegen/auth.json` (old path — removed)
- Do NOT use sharp, canvas, jimp, PIL as image substitute
- Do NOT fake image generation with placeholder or solid colour

---

## Key resolution (confirmed working)

| Priority | Field in `auth.json` | When to use |
|---|---|---|
| ✅ 1st | `OPENAI_API_KEY` | Always — this is the 9Router `sk-...` key |
| ⚠️ 2nd | `tokens.access_token` | Fallback only — OpenAI JWT, fails on 9Router |
| ❌ Never | `tokens.id_token` | OpenAI identity token, never use for API calls |
| ❌ Never | `tokens.refresh_token` | Token refresh only, not an API key |

> **Why:** `OPENAI_API_KEY` in Codex auth.json holds the actual 9Router `sk-...` bearer key.
> `tokens.access_token` is an OpenAI-issued JWT used only for OpenAI services, not 9Router.

---

## Model resolution (priority order)

| Source | Field | Example |
|---|---|---|
| config.toml | `[image_generation].model` | `cx/gpt-5.4-image` |
| Auto-detect (9Router) | provider name contains `9router` | `cx/gpt-5.4-image` |
| Default fallback | — | `gpt-image-2` |

---

## Recommended config.toml (9Router)

```toml
[features]
image_generation = true

model = "cx/gpt-5.5"
model_provider = "9router"

[model_providers.9router]
name = "9Router"
base_url = "http://localhost:20128/v1"
wire_api = "responses"

[agents.subagent]
model = "cx/gpt-5.5"

[image_generation]
model = "cx/gpt-5.4-image"
```

---

## Workflow

0. **Environment setup (always run first):**
   - a. Auto-patch `~/.codex/config.toml` → append `[features]` and `[image_generation]` blocks if missing
   - b. Try built-in `image_generation_call` → if available, use it
   - c. If built-in unavailable → read config.toml + auth.json, derive endpoint, call curl
   - d. NEVER ask user to manually edit config — patch it automatically
   - e. NEVER try `tokens.access_token` before `OPENAI_API_KEY`

1. Decide intent: generate vs edit vs batch
2. Collect inputs: prompt(s), constraints, input image(s) if edit
3. If batch: write temp JSONL under `tmp/imagegen/`, delete after
4. Augment prompt into structured spec
5. Run via priority order above
6. Validate output: subject, style, composition, text accuracy
7. Iterate with single targeted change if needed
8. Save to `output/imagegen/` and note final prompt used

---

## Defaults & rules
- Default image model: `cx/gpt-5.4-image` for 9Router, `gpt-image-2` otherwise
- Endpoint: always derived from `config.toml` provider `base_url` → `<base_url>/images/generations`
- Auth: `~/.codex/auth.json` key field `OPENAI_API_KEY`
- Config: `~/.codex/config.toml` (auto-patched if missing entries)
- Use `tmp/imagegen/` for intermediates, `output/imagegen/` for finals

---

## Prompt augmentation template
```
Use case: <taxonomy slug>
Asset type: <where used>
Primary request: <user prompt>
Scene/background: <environment>
Subject: <main subject>
Style/medium: <photo/illustration/3D>
Composition/framing: <layout>
Lighting/mood: <lighting>
Color palette: <palette>
Quality: <low/medium/high/auto>
Text (verbatim): "<exact text>"
Constraints: <must keep/avoid>
```

## Use-case taxonomy
Generate: `photorealistic-natural`, `product-mockup`, `ui-mockup`, `infographic-diagram`, `logo-brand`, `illustration-story`, `stylized-concept`, `historical-scene`
Edit: `text-localization`, `identity-preserve`, `precise-object-edit`, `lighting-weather`, `background-extraction`, `style-transfer`, `compositing`, `sketch-to-render`
