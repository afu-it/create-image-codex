---
name: "create image codex"
description: "Create images on Codex, especially with 9Router (e.g., generate image, edit/inpaint/mask, background removal, transparent background, product shots, concept art, covers, or batch variants). Uses built-in image generation first when enabled, then falls back to the provider endpoint from ~/.codex/config.toml using ~/.codex/auth.json."
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

### 1st choice: Built-in image generation (PREFERRED)
Use built-in `image_generation_call` if **both** conditions are true:
- `~/.codex/config.toml` contains:
  ```toml
  [features]
  image_generation = true
  ```
- the built-in image generation tool is available in this session

If both are true → use it directly. Best quality, no API call needed.  
Skip all steps below if this works.

### 2nd choice: Provider fallback via Codex config
Only if built-in tool is NOT available in this session.

**Step 1 — Read config from `~/.codex/config.toml`:**
```python
import tomllib
from pathlib import Path

config = tomllib.loads((Path.home() / ".codex" / "config.toml").read_text())

features = config.get("features", {})
image_enabled = bool(features.get("image_generation", False))

provider_name = config.get("model_provider", "").strip()
providers     = config.get("model_providers", {})
provider_cfg  = providers.get(provider_name, {})
base_url      = str(provider_cfg.get("base_url", "")).rstrip("/")

image_cfg     = config.get("image_generation", {})
image_model   = str(image_cfg.get("model", "")).strip() or "gpt-image-2"

endpoint = f"{base_url}/images/generations"

print("image_enabled:", image_enabled)
print("endpoint     :", endpoint)
print("model        :", image_model)
```

**Step 2 — Read API key from `~/.codex/auth.json`:**
```python
import json
from pathlib import Path

auth = json.loads((Path.home() / ".codex" / "auth.json").read_text())
api_key = str(auth.get("OPENAI_API_KEY", "")).strip()

if not api_key:
    raise SystemExit("[imagegen] OPENAI_API_KEY missing in ~/.codex/auth.json")
```

> ⚠️ Only use `OPENAI_API_KEY`. Never read `tokens.id_token`, `tokens.access_token`, or `tokens.refresh_token`.

**Step 3 — Call image endpoint:**
```bash
ENDPOINT=$(python3 -c "
import json,tomllib
from pathlib import Path
cfg = tomllib.loads((Path.home()/'.codex'/'config.toml').read_text())
p = cfg['model_provider']
base = cfg['model_providers'][p]['base_url'].rstrip('/')
print(f'{base}/images/generations')
")

API_KEY=$(python3 -c "
import json
from pathlib import Path
a = json.loads((Path.home()/'.codex'/'auth.json').read_text())
print(a['OPENAI_API_KEY'])
")

MODEL=$(python3 -c "
import tomllib
from pathlib import Path
cfg = tomllib.loads((Path.home()/'.codex'/'config.toml').read_text())
m = cfg.get('image_generation', {}).get('model', 'gpt-image-2')
print(m)
")

mkdir -p tmp/imagegen output/imagegen

curl -sS -N -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: text/event-stream" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"<PROMPT>\",\"n\":1,\"size\":\"auto\",\"quality\":\"high\",\"output_format\":\"png\"}" \
  -o tmp/imagegen/response.raw

python3 - <<'PY'
import json, base64
from pathlib import Path

raw = Path('tmp/imagegen/response.raw').read_text(errors='replace')
final = None
for block in raw.strip().split('\n\n'):
    lines = block.splitlines()
    ev   = next((l[6:].strip() for l in lines if l.startswith('event:')), '')
    data = ''.join(l[5:].strip() for l in lines if l.startswith('data:'))
    if ev == 'done' and data:
        final = json.loads(data)

if not final:
    # fallback: try plain JSON response (non-SSE)
    try:
        final = json.loads(raw)
    except Exception:
        raise SystemExit('[imagegen] No valid response from image endpoint.')

b64 = (
    final.get('data', [{}])[0].get('b64_json')
    or final.get('data', [{}])[0].get('url')
)
if not b64:
    raise SystemExit('[imagegen] No image data in response.')

out = Path('output/imagegen/result.png')
out.write_bytes(base64.b64decode(b64))
print(f'[imagegen] Saved: {out} ({out.stat().st_size:,} bytes)')
PY
```

### STOP conditions (strict)
- If `~/.codex/config.toml` is missing → STOP, tell user to set up Codex config
- If `[features] image_generation = true` is missing → STOP, tell user to add it to config.toml
- If `~/.codex/auth.json` is missing or `OPENAI_API_KEY` is empty → STOP, tell user to set up auth.json
- If provider `base_url` is missing → STOP, report which provider is missing
- Do NOT hardcode any API key or endpoint URL
- Do NOT read `tokens.id_token`, `tokens.access_token`, or `tokens.refresh_token`
- Do NOT use the chat model (`model = "cx/gpt-5.5"`) as the image model
- Do NOT use `~/.config/imagegen/auth.json` (old path — deprecated)
- Do NOT use sharp, canvas, jimp, PIL as image substitute
- Do NOT fake image generation with placeholder or solid colour
- If both options fail → report clearly and STOP

---

## Recommended config.toml

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
enabled = true
model = "gpt-image-2"
# For 9Router with dedicated image model:
# model = "cx/gpt-5.4-image"
```

---

## Workflow

0. **Environment check (strict order):**
   - a. `~/.codex/config.toml` exists? → read config
   - b. `[features] image_generation = true`? → enabled
   - c. Built-in `image_generation_call` available? → use it, proceed
   - d. If built-in unavailable → check `~/.codex/auth.json` for `OPENAI_API_KEY`
   - e. Derive endpoint from `config.toml` provider `base_url`
   - f. If anything missing → STOP with clear message
   - g. NEVER ask for or hardcode an API key

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
- Default image model: **`gpt-image-2`** — from `[image_generation].model` in config.toml, fallback `gpt-image-2`
- For 9Router: set `model = "cx/gpt-5.4-image"` in `[image_generation]` if supported
- Prefer built-in tool always
- Use `tmp/imagegen/` for intermediates, `output/imagegen/` for finals
- Never modify scripts; never write one-off replacements
- Auth path: `~/.codex/auth.json` (NOT `~/.config/imagegen/auth.json`)
- Config path: `~/.codex/config.toml`

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
