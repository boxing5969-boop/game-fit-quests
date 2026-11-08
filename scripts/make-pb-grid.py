#!/usr/bin/env python3
"""
153 PB 라이브보드 TV1 「코스 보드」 8분할 시범 영상 만들기 (2026-11-08)

  왜 영상 1개인가: TV 브라우저는 영상 여러 개를 함께 틀면 버벅인다(10/26 라이브보드 렉).
  그래서 시범 영상 8편(public/test153/pb1~8.mp4 · 1080×1080)의 위쪽 동작 화면(1080×600)만 잘라
  6초씩 이어 붙인 2×4 한 판 영상(public/test153/pb-grid.mp4)을 만든다. TV 는 이 영상 1개만 튼다.
  칸 자리는 src/lib/pbBoard.ts PB_GRID 와 같아야 한다(그리드 1856×734 · 칸 452×359 · 사이 16 · 테두리 2 · 영상 높이 231).
  칸 위 두 모서리는 둥글게(반지름 20) — 화면 카드 테두리(22)와 맞춘다.

  쓰는 법:  python3 scripts/make-pb-grid.py            (ffmpeg · Pillow 필요)
  시범 영상을 다시 찍었거나 종목 순서를 바꿨으면 다시 돌린다.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "test153"
OUT_MP4 = SRC / "pb-grid.mp4"
OUT_JPG = SRC / "pb-grid.jpg"

GRID_W, GRID_H = 1856, 734
CELL_W, CELL_H, GAP, BORDER = 452, 359, 16, 2
TILE_W, TILE_H = CELL_W - BORDER * 2, 231
RADIUS = 20
BG = (0xF5, 0xF8, 0xF7)
START_SEC = 10  # 각 시범 영상에서 가져올 시작 (박자가 붙은 중간)
LOOP_SEC = 6
FPS = 24


def tile_pos(i: int) -> tuple[int, int]:
    return (i % 4) * (CELL_W + GAP) + BORDER, (i // 4) * (CELL_H + GAP) + BORDER


def make_mask(path: Path) -> None:
    """칸 위 두 모서리 바깥을 바닥색으로 칠한 투명 PNG (4배 샘플링으로 매끈하게)"""
    ss = 4
    img = Image.new("RGBA", (GRID_W, GRID_H), (0, 0, 0, 0))
    px = img.load()
    for i in range(8):
        tx, ty = tile_pos(i)
        cy = ty + RADIUS
        # (모서리 네모의 왼쪽 x, 원 중심 x) — 왼쪽 위 · 오른쪽 위
        for x0, cx in ((tx, tx + RADIUS), (tx + TILE_W - RADIUS, tx + TILE_W - RADIUS)):
            for y in range(ty, ty + RADIUS):
                for x in range(x0, x0 + RADIUS):
                    outside = sum(
                        1
                        for sy in range(ss)
                        for sx in range(ss)
                        if (x + (sx + 0.5) / ss - cx) ** 2 + (y + (sy + 0.5) / ss - cy) ** 2 > RADIUS * RADIUS
                    )
                    if outside:
                        px[x, y] = (*BG, round(255 * outside / (ss * ss)))
    img.save(path)


def main() -> int:
    mask = ROOT / "node_modules" / ".cache" / "pb-grid-mask.png"
    mask.parent.mkdir(parents=True, exist_ok=True)
    make_mask(mask)

    cmd = ["ffmpeg", "-v", "error", "-y"]
    for n in range(1, 9):
        cmd += ["-ss", str(START_SEC), "-t", str(LOOP_SEC), "-i", str(SRC / f"pb{n}.mp4")]
    cmd += ["-loop", "1", "-i", str(mask)]
    scaled_h = round(600 * TILE_W / 1080)  # 249
    parts = [f"color=c=0x{BG[0]:02X}{BG[1]:02X}{BG[2]:02X}:s={GRID_W}x{GRID_H}:r={FPS}:d={LOOP_SEC}[b]"]
    for i in range(8):
        parts.append(
            f"[{i}:v]crop=1080:600:0:0,scale={TILE_W}:{scaled_h},crop={TILE_W}:{TILE_H}:0:6,"
            f"fps={FPS},setpts=PTS-STARTPTS[t{i}]"
        )
    prev = "b"
    for i in range(8):
        x, y = tile_pos(i)
        parts.append(f"[{prev}][t{i}]overlay={x}:{y}:shortest=1[o{i}]")
        prev = f"o{i}"
    parts.append(f"[{prev}][8:v]overlay=0:0:shortest=1,format=yuv420p[out]")
    cmd += [
        "-filter_complex", ";".join(parts), "-map", "[out]", "-t", str(LOOP_SEC),
        "-c:v", "libx264", "-profile:v", "main", "-level", "4.0", "-pix_fmt", "yuv420p",
        "-preset", "slow", "-crf", "27", "-g", str(FPS * 2), "-movflags", "+faststart", "-an", str(OUT_MP4),
    ]
    subprocess.run(cmd, check=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", "2", "-i", str(OUT_MP4), "-frames:v", "1", "-q:v", "4", str(OUT_JPG)],
        check=True,
    )
    print(f"✓ {OUT_MP4.relative_to(ROOT)} ({OUT_MP4.stat().st_size // 1024} KB) · {OUT_JPG.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
