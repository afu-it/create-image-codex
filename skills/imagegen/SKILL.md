---
name: "create image codex"
description: "Create images on codex esp with 9router (e.g., generate image, edit/inpaint/mask, background removal, transparent background, product shots, concept art, covers, or batch variants). Runs built-in image_generation_call first, then falls back to custom endpoint via auth.json."
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

### 1st choice: Built-in image_generation_call (PREFERRED)
If built-in tool is available in this session → use it directly.  
Best quality, no API key needed, platform-handled.  
Skip all steps below if this works.

### 2nd choice: Custom endpoint via auth.json
Only if built-in tool is NOT available in this session.

Read credentials from `~/.config/imagegen/auth.json`:
```json
{
  "endpoint": "https://your-proxy-or-api/v1/images/generations",
  "api_key": "YOUR_KEY_HERE",
  "model": "gpt-image-1"
}
```

Auto-detect and run:
```bash
python3 - <<'PY'
import json, sys
from pathlib import Path

auth_path = Path.home() / '.config' / 'imagegen' / 'auth.json'
if not auth_path.exists():
    sys.exit("[imagegen] auth.json not found. See: https://github.com/afu-it/create-image-codex/blob/main/SETUP.md")

auth = json.loads(auth_path.read_text())
endpoint = auth.get('endpoint', '').strip()
api_key  = auth.get('api_key', '').strip()
model    = auth.get('model', 'gpt-image-1').strip()

if not endpoint or not api_key:
    sys.exit("[imagegen] auth.json is missing 'endpoint' or 'api_key'.")

print(f'[imagegen] endpoint: {endpoint}')
print(f'[imagegen] model   : {model}')
PY
```

Full curl call with SSE parser:
```bash
ENDPOINT=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path.home().joinpath('.config/imagegen/auth.json').read_text()); print(d['endpoint'])")
API_KEY=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path.home().joinpath('.config/imagegen/auth.json').read_text()); print(d['api_key'])")
MODEL=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path.home().joinpath('.config/imagegen/auth.json').read_text()); print(d.get('model','gpt-image-1'))")

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
    raise SystemExit('[imagegen] No done event in SSE response.')

out = Path('output/imagegen/result.png')
out.write_bytes(base64.b64decode(final['data'][0]['b64_json']))
print(f'[imagegen] Saved: {out} ({out.stat().st_size:,} bytes)')
PY
```

### STOP conditions (strict)
- Do NOT hardcode any API key or endpoint URL
- Do NOT use direct api.openai.com unless user sets it in auth.json
- Do NOT use sharp, canvas, jimp, PIL as image substitute
- Do NOT fake image generation with placeholder or solid colour
- If built-in unavailable AND auth.json missing → tell user to run `npx skills add afu-it/create-image-codex`, then STOP
- If both options fail → report clearly and STOP

---

## Workflow

0. **Environment check (strict order):**
   - a. Built-in `image_generation_call` available? → use it, proceed
   - b. `~/.config/imagegen/auth.json` exists and valid? → use curl path, proceed
   - c. Neither → STOP. Tell user: `npx skills add afu-it/create-image-codex` then setup auth.json
   - d. NEVER ask for or hardcode an API key

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
- Default model from `auth.json` field `model`. Fallback: `gpt-image-1`
- Prefer built-in tool always
- Use `tmp/imagegen/` for intermediates, `output/imagegen/` for finals
- Never modify scripts; never write one-off replacements

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
