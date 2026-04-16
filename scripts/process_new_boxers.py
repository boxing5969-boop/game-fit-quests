"""
process_new_boxers.py
- Copy images from Desktop/새 폴더 to src/assets/boxers/
- Remove backgrounds from .jpg files via rembg
- Rename UUID filenames to boxer_new_XX.png
- Patch characterPresets.ts with new imports + PREBUILT_CHARACTERS entries
"""
import os
import re
import shutil
import sys
from pathlib import Path

from PIL import Image
from rembg import remove as rembg_remove

SRC_DIR    = r"C:\Users\82104\Desktop\새 폴더"
DST_DIR    = r"C:\Users\82104\game-fit-quests\src\assets\boxers"
PRESETS_TS = r"C:\Users\82104\game-fit-quests\src\data\characterPresets.ts"

UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    re.IGNORECASE,
)

def is_uuid_name(filename: str) -> bool:
    return bool(UUID_RE.match(filename))

def safe_var(filename: str) -> str:
    """boxer_new_01.png  →  boxer_new_01"""
    return re.sub(r'[^a-zA-Z0-9_]', '_', os.path.splitext(filename)[0])

# ── Step 1: Copy ──────────────────────────────────────────────
print("=" * 50)
print("Step 1: Copying images …")
src_files = sorted(os.listdir(SRC_DIR))
copied_jpg = []
copied_png = []

for name in src_files:
    src = os.path.join(SRC_DIR, name)
    dst = os.path.join(DST_DIR, name)
    if not os.path.isfile(src):
        continue
    shutil.copy2(src, dst)
    ext = os.path.splitext(name)[1].lower()
    if ext == ".jpg":
        copied_jpg.append(name)
    elif ext == ".png":
        copied_png.append(name)
    print(f"  Copied: {name}")

print(f"  → {len(copied_jpg)} jpg, {len(copied_png)} png copied")

# ── Step 2: rembg on .jpg files ────────────────────────────────
print()
print("Step 2: Removing backgrounds …")
rembg_pngs = []   # resulting png names (still UUID)

for jpg_name in sorted(copied_jpg):
    jpg_path = os.path.join(DST_DIR, jpg_name)
    png_name = os.path.splitext(jpg_name)[0] + ".png"
    png_path = os.path.join(DST_DIR, png_name)

    print(f"  rembg: {jpg_name} → {png_name}")
    with open(jpg_path, "rb") as f_in:
        input_data = f_in.read()
    output_data = rembg_remove(input_data)
    with open(png_path, "wb") as f_out:
        f_out.write(output_data)
    os.remove(jpg_path)
    rembg_pngs.append(png_name)

# Also include any UUID .png that came directly
for p in copied_png:
    if is_uuid_name(p):
        rembg_pngs.append(p)

print(f"  → {len(rembg_pngs)} png files ready for rename")

# ── Step 3: Rename UUID → boxer_new_XX ────────────────────────
print()
print("Step 3: Renaming files …")
rembg_pngs.sort()   # deterministic order
renamed = []   # (var_name, file_name)

for i, old_name in enumerate(rembg_pngs, start=1):
    new_name = f"boxer_new_{i:02d}.png"
    old_path = os.path.join(DST_DIR, old_name)
    new_path = os.path.join(DST_DIR, new_name)
    if os.path.exists(new_path):
        print(f"  SKIP (exists): {new_name}")
        renamed.append((safe_var(new_name), new_name))
        continue
    os.rename(old_path, new_path)
    print(f"  {old_name} → {new_name}")
    renamed.append((safe_var(new_name), new_name))

# ── Step 4: Patch characterPresets.ts ─────────────────────────
print()
print("Step 4: Patching characterPresets.ts …")

with open(PRESETS_TS, "r", encoding="utf-8") as f:
    content = f.read()

# Build import lines
import_lines = "".join(
    f'import {var_name} from "@/assets/boxers/{file_name}";\n'
    for var_name, file_name in renamed
)

# Build PREBUILT_CHARACTERS entries
entry_lines = "".join(
    f'  {{ style: "new_{i:02d}", label: "새 파이터 {i:02d}", gender: "male", image: {var_name}, color: "new" }},\n'
    for i, (var_name, _) in enumerate(renamed, start=1)
)

# Guard: skip if already patched
if "boxer_new_01" in content:
    print("  Already patched — nothing to do.")
else:
    # Insert imports after the last existing import line
    last_import_end = max(
        content.rfind("\nimport "),
        0
    )
    eol = content.find("\n", last_import_end + 1)
    content = content[:eol + 1] + import_lines + content[eol + 1:]

    # Insert entries before the closing ];  of PREBUILT_CHARACTERS
    bracket_pos = content.rfind("];")
    content = content[:bracket_pos] + entry_lines + content[bracket_pos:]

    with open(PRESETS_TS, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"  → Added {len(renamed)} imports + {len(renamed)} entries")

print()
print("=" * 50)
print(f"Done!  {len(renamed)} new characters added.")
for var_name, file_name in renamed:
    print(f"  {file_name}  ({var_name})")
