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
If missing entries, **auto-add them** without asking the user.

```python
import tomllib, tomli_w
from pathlib import Path

config_path = Path.home() / ".codex" / "config.toml"
if not config_path.exists():
    raise SystemExit("[imagegen] ~/.codex/config.toml not found. Please set up Codex first.")

raw = config_path.read_text()
config = tomllib.loads(raw)
changed = False

# Ensure [features] image_generation = true
features = config.setdefault("features", {})
if not features.get("image_generation"):
    features["image_generation"] = True
    changed = True
    print("[imagegen] Auto-added: [features] image_generation = true")

# Ensure [image_generation] block with correct model
img_cfg = config.setdefault("image_generation", {})
if not img_cfg.get("model"):
    # detect provider and pick right model
    provider = config.get("model_provider", "").strip()
    if "9router" in provider.lower():
        img_cfg["model"] = "cx/gpt-5.4-image"
    else:
        img_cfg["model"] = "gpt-image-2"
    changed = True
    print(f"[imagegen] Auto-added: [image_generation] model = {img_cfg['model']}")

if changed:
    config_path.write_text(tomli_w.dumps(config))
    print("[imagegen] config.toml patched successfully.")
else:
    print("[imagegen] config.toml already configured.")
```

> If `tomli_w` is not available, fall back to appending raw TOML lines:
> ```python
> with open(config_path, 'a') as f:
>     f.write('\n[features]\nimage_generation = true\n\n[image_generation]\nmodel = "cx/gpt-5.4-image"\n')
> ```

---

### 1st choice: Built-in image generation (PREFERRED)

Use built-in `image_generation_call` if:
- `[features] image_generation = true` (auto-patched above)
- built-in tool is available in this session

If both → use it directly. Skip steps below.

---

### 2nd choice: Provider fallback via config.toml + auth.json

Only if built-in tool is NOT available in this session.

**Read all config in one shot:**
```python
import json, tomllib
from pathlib import Path

config_path = Path.home() / ".codex" / "config.toml"
auth_path   = Path.home() / ".codex" / "auth.json"

config = tomllib.loads(config_path.read_text())
auth   = json.loads(auth_path.read_text())

# --- Provider config ---
provider_name = config.get("model_provider", "").strip()
providers     = config.get("model_providers", {})
provider_cfg  = providers.get(provider_name, {})
base_url      = str(provider_cfg.get("base_url", "")).rstrip("/")

if not base_url:
    raise SystemExit(f"[imagegen] base_url missing for provider '{provider_name}'")

# --- Image model ---
img_cfg     = config.get("image_generation", {})
image_model = str(img_cfg.get("model", "")).strip()
if not image_model:
    image_model = "cx/gpt-5.4-image" if "9router" in provider_name.lower() else "gpt-image-2"

# --- API key ---
# Priority: tokens.access_token (9Router) > OPENAI_API_KEY
# For 9Router, the access_token IS the bearer token used in Authorization header
tokens  = auth.get("tokens", {})
api_key = (
    tokens.get("access_token")
    or auth.get("OPENAI_API_KEY")
    or ""
).strip()

if not api_key:
    raise SystemExit("[imagegen] No API key found in ~/.codex/auth.json")

endpoint = f"{base_url}/images/generations"

print("endpoint :", endpoint)
print("model    :", image_model)
print("key_set  :", bool(api_key))
```

**curl call (9Router / compatible endpoint):**
```bash
python3 - <<'PYSETUP' > /tmp/imagegen_env.sh
import json, tomllib
from pathlib import Path

config = tomllib.loads((Path.home()/".codex"/"config.toml").read_text())
auth   = json.loads((Path.home()/".codex"/"auth.json").read_text())

provider_name = config.get("model_provider","").strip()
base_url = config["model_providers"][provider_name]["base_url"].rstrip("/")
endpoint = f"{base_url}/images/generations"

img_cfg = config.get("image_generation",{})
model = img_cfg.get("model") or ("cx/gpt-5.4-image" if "9router" in provider_name.lower() else "gpt-image-2")

tokens = auth.get("tokens",{})
api_key = tokens.get("access_token") or auth.get("OPENAI_API_KEY","")

print(f'export IMAGEGEN_ENDPOINT="{endpoint}"')
print(f'export IMAGEGEN_MODEL="{model}"')
print(f'export IMAGEGEN_KEY="{api_key}"')
PYSETUP

source /tmp/imagegen_env.sh
mkdir -p tmp/imagegen output/imagegen

curl -sS -X POST "$IMAGEGEN_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $IMAGEGEN_KEY" \
  -H "Accept: text/event-stream" \
  -d "{\"model\":\"$IMAGEGEN_MODEL\",\"prompt\":\"<PROMPT>\",\"n\":1,\"size\":\"auto\",\"quality\":\"auto\",\"background\":\"auto\",\"image_detail\":\"high\",\"output_format\":\"png\"}" \
  -o tmp/imagegen/response.raw

python3 - <<'PY'
import json, base64
from pathlib import Path

raw = Path("tmp/imagegen/response.raw").read_text(errors="replace")
final = None

# Try SSE first
for block in raw.strip().split("\n\n"):
    lines = block.splitlines()
    ev   = next((l[6:].strip() for l in lines if l.startswith("event:")), "")
    data = "".join(l[5:].strip() for l in lines if l.startswith("data:"))
    if ev == "done" and data:
        final = json.loads(data)
        break

# Fallback: plain JSON
if not final:
    try:
        final = json.loads(raw)
    except Exception:
        raise SystemExit("[imagegen] Could not parse response from image endpoint.")

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
    raise SystemExit("[imagegen] No b64_json or url in response.")
PY
```

---

### STOP conditions (strict)
- If `~/.codex/config.toml` not found → STOP, tell user to set up Codex
- If `~/.codex/auth.json` not found → STOP, tell user to authenticate Codex
- If no API key found in auth.json → STOP, report missing key
- If provider `base_url` missing → STOP, report which provider config is missing
- Do NOT hardcode any API key or endpoint URL
- Do NOT use `~/.config/imagegen/auth.json` (old path — removed)
- Do NOT use sharp, canvas, jimp, PIL as image substitute
- Do NOT fake image generation with placeholder or solid colour
- Do NOT stop just because `OPENAI_API_KEY` is missing — 9Router uses `tokens.access_token`

---

## Workflow

0. **Environment setup (always run first):**
   - a. Auto-patch `~/.codex/config.toml` → add `[features] image_generation = true` and `[image_generation] model` if missing
   - b. Try built-in `image_generation_call` → if available, use it
   - c. If built-in unavailable → read config.toml + auth.json, derive endpoint, call curl
   - d. NEVER ask user to manually edit config — patch it automatically

1. Decide intent: generate vs edit vs batch
2. Collect inputs: prompt(s), constraints, input image(s) if edit
3. If batch: write temp JSONL under `tmp/imagegen/`, delete after
4. Augment prompt into structured spec
5. Run via priority order above
6. Validate output: subject, style, composition, text accuracy
7. Iterate with single targeted change if needed
8. Save to `output/imagegen/` and note final prompt used

---

## Key resolution (priority order)

| Provider | Key source | Field |
|---|---|---|
| 9Router | `~/.codex/auth.json` | `tokens.access_token` |
| OpenAI direct | `~/.codex/auth.json` | `OPENAI_API_KEY` |
| Any | `~/.codex/auth.json` | `tokens.access_token` → `OPENAI_API_KEY` |

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

## Defaults & rules
- Default image model: `cx/gpt-5.4-image` for 9Router, `gpt-image-2` otherwise
- Endpoint: always derived from `config.toml` provider `base_url` → `<base_url>/images/generations`
- Auth: `~/.codex/auth.json` (NOT `~/.config/imagegen/auth.json`)
- Config: `~/.codex/config.toml` (auto-patched if needed)
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
