#!/usr/bin/env python3
"""카드 설명 목소리 파일 만들기 (2026-11-16 · lib/cardVoice.ts)

  python3 -I scripts/make-card-voices.py plan.json [--voice ko-KR-InJoonNeural] [--rate +0%]

plan.json = bun scripts/card-voices.ts 가 낸 [{id, hash, text}].
· 드라이브 동작 영상(153복싱짐 앱 복싱동작 · 편집본 v3)과 같은 목소리(인준)로 읽는다 — edge-tts 필요(pip install edge-tts).
· 파일: public/voice/cards/<id>-<hash>.mp3 (32kbps 모노 · 24kHz — 말소리에 충분하고 작다). 이미 있는 파일은 건너뛴다.
· 목록: src/data/cardVoices.ts 를 plan 에 있는 카드로 다시 쓴다(지금 글과 맞는 지문만 남는다).
· 계획에서 빠진(지워졌거나 글이 바뀐) 옛 파일은 지우지 않고 이름만 알려 준다 — 커밋 전에 git rm 으로 정리.
"""
import argparse
import asyncio
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "voice", "cards")
MANIFEST = os.path.join(ROOT, "src", "data", "cardVoices.ts")


async def synth(text: str, out_mp3: str, voice: str, rate: str) -> None:
    import edge_tts  # noqa: WPS433 — 쓸 때만

    kw = {}
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        kw["proxy"] = proxy
    comm = edge_tts.Communicate(text, voice, rate=rate, **kw)
    await comm.save(out_mp3)


def encode_small(src: str, dst: str) -> None:
    """32kbps 모노 24kHz · 앞뒤 무음 0.15초 정리 · 소리 크기 맞춤(-16 LUFS 쯤)"""
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src,
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ac", "1", "-ar", "24000", "-b:a", "32k", "-codec:a", "libmp3lame", dst,
        ],
        check=True,
    )


def write_manifest(entries: dict) -> None:
    lines = [
        "// 카드 설명 목소리 파일 목록 — 카드 id → 읽은 글 지문 (public/voice/cards/<id>-<지문>.mp3)",
        "// 손으로 고치지 않는다: scripts/make-card-voices.py 가 만든다 (lib/cardVoice.ts 설명)",
        "export const CARD_VOICES: Readonly<Record<string, string>> = {",
    ]
    for cid in sorted(entries):
        lines.append(f'  "{cid}": "{entries[cid]}",')
    lines.append("};")
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--voice", default="ko-KR-InJoonNeural")
    ap.add_argument("--rate", default="+0%")
    args = ap.parse_args()
    with open(args.plan, encoding="utf-8") as f:
        plan = json.load(f)
    os.makedirs(OUT_DIR, exist_ok=True)
    keep = set()
    entries = {}
    made = skipped = failed = 0
    for item in plan:
        cid, h, text = item["id"], item["hash"], item["text"]
        name = f"{cid}-{h}.mp3"
        dst = os.path.join(OUT_DIR, name)
        keep.add(name)
        if os.path.exists(dst) and os.path.getsize(dst) > 1000:
            entries[cid] = h
            skipped += 1
            continue
        for attempt in range(3):
            try:
                with tempfile.TemporaryDirectory() as td:
                    raw = os.path.join(td, "raw.mp3")
                    await synth(text, raw, args.voice, args.rate)
                    encode_small(raw, dst)
                entries[cid] = h
                made += 1
                break
            except Exception as e:  # noqa: BLE001 — 다시 해 보고 안 되면 넘어간다
                if attempt == 2:
                    failed += 1
                    print(f"실패 {cid}: {e}", file=sys.stderr)
                else:
                    await asyncio.sleep(2 + attempt * 3)
    write_manifest(entries)
    stale = sorted(n for n in os.listdir(OUT_DIR) if n.endswith(".mp3") and n not in keep)
    print(f"만듦 {made} · 그대로 {skipped} · 실패 {failed} · 목록 {len(entries)}")
    if stale:
        print("계획에 없는 옛 파일(지워도 됨):", *stale, sep="\n  ")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
