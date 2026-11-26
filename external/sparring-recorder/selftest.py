#!/usr/bin/env python3
"""
153 링 녹화 노트북 — 카메라 없이 하는 설치 점검 (2026-11-26)

  python selftest.py   (또는 9_selftest.bat)
    1) 인코더 자동 고르기 (NVIDIA → 인텔 → AMD → libx264)
    2) 실제 녹화 명령을 그대로 — 카메라 대신 시험 화면 8초(1080p 60fps · 실제 시간) → 15분 조각 이름으로 써지는지
    3) 자르기 — 60초 조각 2개 + 가짜 경기 기록(촬영 경기 1 · 촬영 안 함 1) → 경기 파일 1개 · 촬영 안 함 시간의 원본 지움
  결과: 화면과 selftest.log. 모두 통과하면 시험 파일(selftest_tmp)은 지운다.
  열쇠 · 인터넷 · 카메라가 없어도 된다. 회원 영상은 쓰지 않는다.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import sparring_recorder as sr  # noqa: E402

W = HERE / "selftest_tmp"
RESULTS: list[bool] = []
LOG: list[str] = []


def say(s: str) -> None:
    LOG.append(s)
    print(s, flush=True)


def check(name: str, cond, extra: str = "") -> None:
    RESULTS.append(bool(cond))
    say(f"[{'OK' if cond else 'FAIL'}] {name}  {extra}".rstrip())


def info(p: Path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration:stream=codec_name,width,height,r_frame_rate,pix_fmt",
                        "-of", "json", str(p)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    j = json.loads(r.stdout or "{}")
    d = float(j.get("format", {}).get("duration") or 0)
    s = (j.get("streams") or [{}])[0]
    return d, s


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except (ValueError, OSError):
            pass
    sr.need_ffmpeg()
    say("153 링 녹화 설치 점검 " + dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S") + f" · 폴더 {HERE}")
    say(f"python {sys.version.split()[0]} · ffmpeg {shutil.which('ffmpeg')} · 프로그램 md5 "
        + hashlib.md5((HERE / "sparring_recorder.py").read_bytes()).hexdigest())
    cfg_now = sr.load_config()
    say("설정: encoder=%s framerate=%s raw=%s out=%s keep_raw_days=%s camera=%r 열쇠=%s" % (
        cfg_now["encoder"], cfg_now["framerate"], sr.dir_of(cfg_now, "raw_dir"), sr.dir_of(cfg_now, "out_dir"),
        cfg_now["keep_raw_days"], cfg_now["camera"], "있음" if cfg_now.get("recorder_token") else "없음"))

    if W.exists():
        shutil.rmtree(W)
    rec = W / "rec"
    rec.mkdir(parents=True)

    # 1) 인코더
    enc_auto = sr.pick_encoder({"encoder": "auto"})
    check("인코더 자동 고르기", enc_auto in sr.ENCODERS, enc_auto)
    enc = sr.pick_encoder(cfg_now)

    # 2) 실제 녹화 명령 — 카메라 자리만 시험 화면으로 (실제 시간 8초 · 1080p 60fps)
    cfg = dict(cfg_now)
    cfg.update({"framerate": 60})
    orig = sr.camera_input
    sr.camera_input = lambda c: ["-re", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=60"]
    try:
        args = sr.record_args(cfg, enc, 8)
    finally:
        sr.camera_input = orig
    t0 = time.time()
    r = subprocess.run(args, cwd=rec, capture_output=True, text=True, encoding="utf-8", errors="replace")
    wall = time.time() - t0
    segs = sorted(rec.glob("*.ts"))
    check(f"녹화 명령 ({enc} · 1080p60) 끝까지", r.returncode == 0, "" if r.returncode == 0 else (r.stderr or "").strip()[-400:])
    check("시각 이름 조각 파일", bool(segs) and all(sr.SEG_RE.match(p.name) for p in segs), ", ".join(p.name for p in segs))
    tot = 0.0
    fps0 = None
    for p in segs:
        d, s = info(p)
        tot += d
        fps0 = fps0 or s.get("r_frame_rate")
        say(f"   {p.name}: {d:.2f}초 {s.get('codec_name')} {s.get('width')}x{s.get('height')} {s.get('r_frame_rate')} {p.stat().st_size / 1e6:.1f}MB")
    check("길이 8초 안팎 · 60fps", 7.0 <= tot <= 9.5 and fps0 == "60/1", f"합계 {tot:.2f}초 · 걸린 시간 {wall:.1f}초")

    # 3) 자르기 — 60초 조각 2개 + 가짜 경기 기록
    raw = W / "raw"
    out = W / "out"
    raw.mkdir(parents=True)
    day = dt.date.today()
    base = (dt.datetime.now() - dt.timedelta(minutes=10)).replace(second=0, microsecond=0)
    names = []
    for i in range(2):
        st = base + dt.timedelta(seconds=60 * i)
        name = f"{st:%Y%m%d-%H%M%S}.ts"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30",
                        "-t", "60", "-c:v", "libx264", "-preset", "ultrafast", "-g", "60", "-f", "mpegts", name],
                       cwd=raw, check=True)
        names.append(name)
    tz = dt.datetime.now().astimezone().tzinfo

    def iso(x: dt.datetime) -> str:
        return x.replace(tzinfo=tz).isoformat()

    c1 = f"selftest-{day:%y%m%d}-01"
    c2 = f"selftest-{day:%y%m%d}-02"
    feed = {"branch_code": "selftest", "matches": [
        {"code": c1, "start": iso(base + dt.timedelta(seconds=40)), "end": iso(base + dt.timedelta(seconds=80)),
         "film_ok": True, "ended": True, "status": "ended"},
        {"code": c2, "start": iso(base + dt.timedelta(seconds=5)), "end": iso(base + dt.timedelta(seconds=20)),
         "film_ok": False, "ended": True, "status": "ended"},
    ]}
    (W / "feed.json").write_text(json.dumps(feed), encoding="utf-8")
    (W / "config.json").write_text(json.dumps({"raw_dir": str(raw), "out_dir": str(out)}), encoding="utf-8")
    keep = sr.CONFIG_PATH
    sr.CONFIG_PATH = W / "config.json"
    try:
        rc = sr.main(["cut", "--date", day.isoformat(), "--feed-file", str(W / "feed.json")])
    finally:
        sr.CONFIG_PATH = keep
    clip = out / day.isoformat() / f"{c1}.mp4"
    check("자르기 끝까지", rc == 0, f"rc={rc}")
    check("촬영 경기 파일", clip.exists(), clip.name)
    if clip.exists():
        d, s = info(clip)
        check("경기 파일 길이 55초 안팎(시작 5초 전 ~ 끝 10초 뒤)", 50 <= d <= 60, f"{d:.1f}초 {s.get('codec_name')}")
    check("촬영 안 함 경기는 파일 없음", not (out / day.isoformat() / f"{c2}.mp4").exists())
    check("촬영 안 함 시간의 원본 조각 지움", not (raw / names[0]).exists(), names[0])
    check("다른 원본 조각은 남김", (raw / names[1]).exists(), names[1])

    ok = all(RESULTS)
    say(f"결과: {'모두 통과' if ok else '확인 필요'} ({sum(RESULTS)}/{len(RESULTS)})")
    if ok:
        shutil.rmtree(W, ignore_errors=True)
    (HERE / "selftest.log").write_text("\n".join(LOG) + "\n", encoding="utf-8")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
