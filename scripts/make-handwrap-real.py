#!/usr/bin/env python3
"""붕대 감기 — 대표님 10/20 원본(1080p)에서 '실제 영상' 자료 만들기.

  내 눈으로(앞에서 찍은 영상을 180도 돌려 손을 내려다보는 방향) : 전체 1편 + 단계별 13편 + 끝 장면 + 큰 흐름 사진
  옆에서 : 전체 1편
  원본에는 왼손을 감는 모습이 찍혀 있다 — 오른손은 화면에서 좌우를 뒤집어 보여 준다(영상 안에 글자가 없다).

  쓰는 법: python3 make_real.py <앞에서 원본> <옆에서 원본> <나올 폴더>
"""
import json
import subprocess
import sys
from pathlib import Path

FRONT, SIDE, OUT = sys.argv[1], sys.argv[2], Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)

LOOK = "unsharp=5:5:0.4:5:5:0.0,eq=contrast=1.04:saturation=1.03"
# 내 눈으로: 손 쪽으로 잘라(1280x960) 180도 → 960x720, 가장자리를 살짝 어둡게(손에 눈이 가게)
VF_FRONT = f"crop=1280:960:440:120,hflip,vflip,scale=960:720:flags=lanczos,{LOOK},vignette=angle=PI/4:x0=w*0.47:y0=h*0.5"
VF_SIDE = f"crop=1280:960:340:100,scale=960:720:flags=lanczos,{LOOK},vignette=angle=PI/5:x0=w*0.45:y0=h*0.5"
X264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p", "-g", "30", "-movflags", "+faststart", "-an"]

# 단계 = (번호, 시작 초, 끝 초) — 원본 시각. 클립은 앞 단계 끝 모습에서 살짝 겹쳐 시작한다.
STEPS = [
    (1, 0.00, 2.75),
    (2, 2.75, 7.10),
    (3, 7.00, 8.00),
    (4, 8.00, 12.75),
    (5, 12.70, 15.20),
    (6, 15.20, 17.45),
    (7, 17.45, 19.20),
    (8, 19.10, 20.65),
    (9, 20.60, 24.55),
    (10, 24.50, 27.15),
    (11, 27.10, 30.65),
    (12, 30.60, 41.35),
    (13, 41.35, 43.90),
]
FULL_END = 43.90
SIDE_END = 39.60
HOLD_IN, HOLD_OUT = 0.25, 0.9

# 큰 흐름 사진(정사각형) = (이름, 원본 초, 가운데 x, 가운데 y, 한 변) — 960x720 기준
PHOTOS = [
    ("stage1", 6.95, 430, 450, 400),
    ("stage2", 17.30, 545, 280, 500),
    ("stage3", 18.90, 560, 290, 520),
    ("stage4", 43.40, 490, 500, 380),
    ("done_back", 42.10, 440, 300, 420),
    ("done_fist", 43.40, 490, 500, 380),
]


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def clip(src, vf, start, end, crf, out, hold_in=HOLD_IN, hold_out=HOLD_OUT):
    pad = f",tpad=start_mode=clone:start_duration={hold_in}:stop_mode=clone:stop_duration={hold_out}" if (hold_in or hold_out) else ""
    run(["-ss", f"{start:.3f}", "-t", f"{end - start:.3f}", "-i", src, "-vf", vf + pad + ",format=yuv420p", *X264, "-crf", str(crf), str(out)])


def still(src, vf, at, out, quality=80):
    run(["-ss", f"{at:.3f}", "-i", src, "-frames:v", "1", "-vf", vf, "-c:v", "libwebp", "-quality", str(quality), "-compression_level", "6", str(out)])


def main():
    # 단계별
    for n, a, b in STEPS:
        name = f"step{n:02d}"
        clip(FRONT, VF_FRONT, a, b, 30, OUT / f"{name}.mp4")
        still(FRONT, VF_FRONT, b - 0.034, OUT / f"{name}.webp")
        print(name, round(b - a, 2), (OUT / f"{name}.mp4").stat().st_size // 1024, "KB", flush=True)
    # 전체 — 내 눈으로 · 옆에서 (끝 모습에서 잠깐 멈춤)
    clip(FRONT, VF_FRONT, 0.0, FULL_END, 31, OUT / "full.mp4", hold_in=0, hold_out=1.2)
    still(FRONT, VF_FRONT, 17.30, OUT / "full.webp", 82)
    clip(SIDE, VF_SIDE, 0.0, SIDE_END, 31, OUT / "side.mp4", hold_in=0, hold_out=1.2)
    still(SIDE, VF_SIDE, 12.60, OUT / "side.webp", 82)
    for f in ("full.mp4", "side.mp4"):
        print(f, (OUT / f).stat().st_size // 1024, "KB", flush=True)
    # 큰 흐름 · 완성 확인 사진
    for name, at, cx, cy, size in PHOTOS:
        x, y = max(0, min(960 - size, cx - size // 2)), max(0, min(720 - size, cy - size // 2))
        still(FRONT, f"{VF_FRONT},crop={size}:{size}:{x}:{y},scale=400:400:flags=lanczos", at, OUT / f"{name}.webp", 80)
    total = sum(p.stat().st_size for p in OUT.iterdir())
    (OUT / "_made.json").write_text(json.dumps({"steps": STEPS, "full_end": FULL_END, "side_end": SIDE_END, "hold": [HOLD_IN, HOLD_OUT]}, indent=1))
    print("total", total // 1024, "KB")


main()
