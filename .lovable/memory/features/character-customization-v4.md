---
name: Preset-Specific PNG Parts System
description: DB-driven preset-aware customization using preset_customization_variants table
type: feature
---

## Architecture (v4 — preset-specific PNG parts)

### Core principle
Every body-attached customization (gloves, accessories) uses **preset-specific** assets
stored in `preset_customization_variants` DB table. No generic one-size-fits-all overlays.

### Data flow
1. User selects base preset (12 approved PNG boxers)
2. `usePresetVariants(presetStyle)` fetches active variants for that preset
3. CustomizeTab shows only categories/options with active DB entries
4. `PresetOverlayRenderer` renders positioned PNG overlays using per-preset anchor data
5. Saved to `character_presets.parts_json` as `{ style, customization: { gloveStyle, accessory, effect, frame, title } }`

### DB table: preset_customization_variants
- preset_style: which boxer preset this variant belongs to
- category_code: "gloves" | "accessory"
- option_key: e.g. "glove_red", "sunglasses", "crown"
- asset_url: public URL to overlay PNG in character-overlays bucket
- anchor_x, anchor_y: % position (center point)
- scale: overlay size as fraction of container
- rotation: degrees
- z_order: rendering layer
- is_active: only active variants shown

### Categories
- **gloves** — DB-driven, preset-specific PNG glove overlays
- **accessory** — DB-driven, preset-specific PNG accessories (sunglasses, crown, headband, bandage)
- **effect** — static CSS particles (position-independent, always works)
- **frame** — static CSS ring (position-independent)
- **title** — static text label

### Supported presets (Phase 1)
male_01, female_01, male_02, female_02 — each with 4 glove colors + 3-4 accessories

### Key files
- `src/hooks/usePresetVariants.ts` — DB fetch hook
- `src/components/PresetOverlayRenderer.tsx` — renders DB-driven overlays
- `src/components/CharacterSprite.tsx` — accepts presetVariants prop
- `src/pages/CharacterStudioPage.tsx` — preset-aware CustomizeTab

### Storage
- Bucket: `character-overlays` (public)
- Assets: glove_red_v2.png, glove_blue_v2.png, glove_gold_v2.png, glove_black_v2.png, acc_sunglasses_v2.png, acc_crown_v2.png, acc_headband_red_v2.png, acc_bandage_v2.png
