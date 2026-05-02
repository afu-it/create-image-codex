---
name: "imagegen"
description: "Use when the user asks to generate or edit images (e.g., generate image, edit/inpaint/mask, background removal, transparent background, product shots, concept art, covers, or batch variants). Runs built-in image_generation_call first, then falls back to custom endpoint via auth.json."
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
  "model": "cx/gpt-5.4-image"
}
```

Auto-detect and run:
```bash
python3 - <<'PY'
import json, os, subprocess, sys
from pathlib import Path

auth_path = Path.home() / '.config' / 'imagegen' / 'auth.json'
if not auth_path.exists():
    sys.exit("[imagegen] auth.json not found. See SETUP.md for instructions.")

auth = json.loads(auth_path.read_text())
endpoint = auth.get('endpoint', '').strip()
api_key  = auth.get('api_key', '').strip()
model    = auth.get('model', 'gpt-image-1').strip()

if not endpoint or not api_key:
    sys.exit("[imagegen] auth.json is missing 'endpoint' or 'api_key'.")

print(f"[imagegen] Using endpoint: {endpoint}")
print(f"[imagegen] Model: {model}")
PY
```

Full curl call:
```bash
python3 scripts/image_gen.py generate \
  --prompt "<PROMPT>" \
  --model "$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path.home().joinpath('.config/imagegen/auth.json').read_text()); print(d.get('model','gpt-image-1'))")"\
  --out output/imagegen/<filename>.png
```

OR via direct curl (SSE stream):
```bash
ENDPOINT=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path.home().joinpath('.config/imagegen/auth.json').read_text()); print(d['endpoint'])")
API_KEY=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path.home().joinpath('.config/imagegen/auth.json').read_text()); print(d['api_key'])")
MODEL=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path.home().joinpath('.config/imagegen/auth.json').read_text()); print(d.get('model','gpt-image-1'))")

curl -sS -N -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: text/event-stream" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"<PROMPT>\",\"n\":1,\"size\":\"auto\",\"quality\":\"high\",\"output_format\":\"png\"}" \
  -o tmp/imagegen/response.raw

# Parse SSE and save PNG
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
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(base64.b64decode(final['data'][0]['b64_json']))
print(f'[imagegen] Saved: {out} ({out.stat().st_size:,} bytes)')
PY
```

### STOP conditions (strict)
- Do NOT hardcode any API key or endpoint URL in code or skill files
- Do NOT use direct OpenAI API (api.openai.com) unless user explicitly sets it in auth.json
- Do NOT use sharp, canvas, jimp, PIL, or any programmatic library as image substitute
- Do NOT fake image generation with placeholder or solid colour
- If built-in tool unavailable AND auth.json missing → inform user to create auth.json, then STOP
- If both option 1 and 2 fail → report clearly and STOP

---

## Workflow

0. **Environment check (strict order):**
   - a. Built-in `image_generation_call` tool available? → use it, proceed to step 1
   - b. `~/.config/imagegen/auth.json` exists and valid? → use curl/SDK path, proceed
   - c. Neither available → STOP. Report: "Built-in tool unavailable and auth.json not found. See SETUP.md."
   - d. NEVER ask for or use a hardcoded API key

1. Decide intent: generate vs edit vs batch (see decision tree above)
2. Collect inputs: prompt(s), exact text (verbatim), constraints, and any input image(s)/mask(s)
3. If batch: write temp JSONL under `tmp/imagegen/`, run once, delete JSONL after
4. Augment prompt into a short labeled spec (structure + constraints)
5. Run image generation via priority order above
6. Inspect outputs and validate: subject, style, composition, text accuracy, constraints
7. Iterate with single targeted change if needed
8. Save final outputs to `output/imagegen/` and note the final prompt used

---

## Defaults & rules
- Default model from `auth.json` → field `model`. If missing, default to `gpt-image-1`
- Assume the user wants a new image unless they explicitly ask for an edit
- Prefer built-in tool over curl path always
- Prefer the bundled CLI (`scripts/image_gen.py`) over writing new one-off scripts
- Never modify `scripts/image_gen.py`
- Use `tmp/imagegen/` for intermediates, `output/imagegen/` for final assets

---

## Prompt augmentation

Reformat user prompts into a structured spec. Only make implicit details explicit; do not invent new requirements.

Template:
```
Use case: <taxonomy slug>
Asset type: <where the asset will be used>
Primary request: <user's main prompt>
Scene/background: <environment>
Subject: <main subject>
Style/medium: <photo/illustration/3D/etc>
Composition/framing: <wide/close/top-down; placement>
Lighting/mood: <lighting + mood>
Color palette: <palette notes>
Quality: <low/medium/high/auto>
Text (verbatim): "<exact text>"
Constraints: <must keep/must avoid>
Avoid: <negative constraints>
```

## Use-case taxonomy
Generate: `photorealistic-natural`, `product-mockup`, `ui-mockup`, `infographic-diagram`, `logo-brand`, `illustration-story`, `stylized-concept`, `historical-scene`  
Edit: `text-localization`, `identity-preserve`, `precise-object-edit`, `lighting-weather`, `background-extraction`, `style-transfer`, `compositing`, `sketch-to-render`

---

## Reference map
- `references/cli.md` — how to run image_gen.py CLI
- `references/image-api.md` — API parameters reference
- `references/prompting.md` — prompting principles
- `references/sample-prompts.md` — copy-paste prompt recipes
- `SETUP.md` — user setup instructions (auth.json, dependencies)
