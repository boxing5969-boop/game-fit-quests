#!/usr/bin/env python3
"""
153 링 녹화 노트북 — 스파링 영상 1차(유튜브) 녹화 · 자르기
2026-11-25 · 앱 문서 docs/features/64-스파링-영상.md

  하루 흐름
    1) python sparring_recorder.py record   링 옆 카메라를 15분 조각으로 계속 녹화(소리 없음 · 1080p 30fps)
    2) (코치) 앱 타이머 「스파링 기록」에서 두 명 고르고 시작 → 경기 번호 · 시각이 서버에 남는다
    3) python sparring_recorder.py cut      서버에서 오늘 경기 번호 · 시각을 받아 경기마다 파일로 자른다
                                            out/<날짜>/<경기 번호>.mp4 — 파일 이름 = 유튜브 제목(실명 없음)
                                            촬영 안 하는 경기(동의 없음 · 취소)는 자르지 않고 그 원본 조각을 지운다
    4) 코치가 out/<날짜> 파일을 유튜브 스튜디오에 15개씩 끌어다 놓기(업로드 기본값: 일부공개 · 아동용 아님 · 댓글 끔)

  원본 조각은 7일 뒤 지운다(clean · record 시작할 때 저절로).
  필요한 것: Python 3.9+ (표준 라이브러리만) · FFmpeg(ffmpeg · ffprobe)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from email.utils import parsedate_to_datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "config.json"
KST = dt.timezone(dt.timedelta(hours=9))
SEG_RE = re.compile(r"^(\d{8})-(\d{6})\.ts$")
CODE_RE = re.compile(r"^[a-z0-9]+-\d{6}-\d{2,}$")

DEFAULTS = {
    "supabase_url": "https://whnczhxyjmyywhlfbgsd.supabase.co",
    "publishable_key": "sb_publishable_FeW9OXw5ZzQ4jDGzpo2rvw_GILQCOeX",
    "recorder_token": "",
    "camera": "",
    "input_format": "mjpeg",
    "video_size": "1920x1080",
    "framerate": 30,
    "encoder": "auto",
    "quality": 23,
    "segment_minutes": 15,
    "raw_dir": "raw",
    "out_dir": "out",
    "keep_raw_days": 7,
    "keep_out_days": 14,
    "pad_before_sec": 5,
    "pad_after_sec": 10,
}


# ── 설정 ─────────────────────────────────────────────────────────────
def load_config() -> dict:
    cfg = dict(DEFAULTS)
    if CONFIG_PATH.exists():
        cfg.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
    return cfg


def save_config(cfg: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def dir_of(cfg: dict, key: str) -> Path:
    p = Path(cfg[key])
    return p if p.is_absolute() else HERE / p


def need_ffmpeg() -> None:
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"[멈춤] {tool} 을 찾지 못했어요. 윈도우: winget install Gyan.FFmpeg 후 새 창에서 다시 실행해 주세요.")


# ── 서버 (경기 번호 · 시각만) ──────────────────────────────────────────
def fetch_feed(cfg: dict, day: dt.date) -> tuple[dict, float]:
    """반환: (feed, 서버 시계 - 이 노트북 시계 초)"""
    if not cfg.get("recorder_token"):
        sys.exit("[멈춤] 열쇠가 없어요. 먼저 setup 을 해 주세요(앱 타이머 › 스파링 기록 › 링 녹화 노트북 연결).")
    url = cfg["supabase_url"].rstrip("/") + "/rest/v1/rpc/sparvid_recorder_feed"
    body = json.dumps({"_token": cfg["recorder_token"], "_date": day.isoformat()}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"apikey": cfg["publishable_key"], "Content-Type": "application/json"},
    )
    sent = dt.datetime.now(dt.timezone.utc)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode("utf-8"))
            server = r.headers.get("Date")
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", "replace")
        if "bad key" in msg:
            sys.exit("[멈춤] 열쇠가 맞지 않아요. 앱에서 새 열쇠를 만들어 setup 을 다시 해 주세요.")
        sys.exit(f"[멈춤] 서버 오류 {e.code}: {msg[:200]}")
    except urllib.error.URLError as e:
        sys.exit(f"[멈춤] 인터넷 연결을 확인해 주세요: {e.reason}")
    skew = 0.0
    if server:
        try:
            got = dt.datetime.now(dt.timezone.utc)
            mid = sent + (got - sent) / 2
            skew = (parsedate_to_datetime(server) - mid).total_seconds()
        except (TypeError, ValueError):
            skew = 0.0
    return data, skew


def load_feed_file(path: str) -> tuple[dict, float]:
    return json.loads(Path(path).read_text(encoding="utf-8")), 0.0


def parse_ts(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


# ── 원본 조각 ─────────────────────────────────────────────────────────
class Segment:
    def __init__(self, path: Path, start: dt.datetime, duration: float, t0: float = 0.0):
        self.path = path
        self.start = start  # 파일 이름의 벽시계 시각
        self.duration = duration
        self.t0 = t0  # 조각 안 첫 시각(MPEG-TS 는 보통 1.4초에서 시작) — 자르는 위치에 더한다

    @property
    def end(self) -> dt.datetime:
        return self.start + dt.timedelta(seconds=self.duration)


def probe(path: Path) -> tuple[float | None, float]:
    """(길이 초, 첫 시각 초)"""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration,start_time", "-of", "json", str(path)],
            capture_output=True,
            text=True,
            timeout=60,
        ).stdout
        fmt = json.loads(out or "{}").get("format", {})
        dur = float(fmt["duration"]) if fmt.get("duration") not in (None, "N/A") else None
        t0 = float(fmt["start_time"]) if fmt.get("start_time") not in (None, "N/A") else 0.0
        return dur, t0
    except (subprocess.SubprocessError, ValueError, KeyError):
        return None, 0.0


def list_segments(raw: Path, local_tz: dt.tzinfo) -> list[Segment]:
    segs: list[Segment] = []
    if not raw.exists():
        return segs
    files = sorted(p for p in raw.iterdir() if SEG_RE.match(p.name))
    for i, p in enumerate(files):
        m = SEG_RE.match(p.name)
        assert m
        start = dt.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S").replace(tzinfo=local_tz)
        dur, t0 = probe(p)
        if dur is None and i + 1 < len(files):
            n = SEG_RE.match(files[i + 1].name)
            assert n
            nxt = dt.datetime.strptime(n.group(1) + n.group(2), "%Y%m%d%H%M%S").replace(tzinfo=local_tz)
            dur = (nxt - start).total_seconds()
        if dur is None or dur <= 0:
            continue
        segs.append(Segment(p, start, dur, t0))
    return segs


def overlapping(segs: list[Segment], a: dt.datetime, b: dt.datetime) -> list[Segment]:
    return [s for s in segs if s.start < b and s.end > a]


def windows(match: dict, cfg: dict, skew: float) -> tuple[dt.datetime, dt.datetime]:
    """서버 시각 → 이 노트북 시계로 (+ 앞뒤 여유)"""
    corr = dt.timedelta(seconds=skew)
    a = parse_ts(match["start"]) - corr - dt.timedelta(seconds=cfg["pad_before_sec"])
    b = parse_ts(match["end"]) - corr + dt.timedelta(seconds=cfg["pad_after_sec"])
    return a, b


def cut_one(parts: list[Segment], a: dt.datetime, b: dt.datetime, out: Path) -> bool:
    out.parent.mkdir(parents=True, exist_ok=True)
    lst = out.with_suffix(".txt")
    lines = []
    for s in parts:
        inpoint = max(0.0, (a - s.start).total_seconds())
        outpoint = min(s.duration, (b - s.start).total_seconds())
        if outpoint - inpoint < 0.5:
            continue
        lines.append(f"file '{s.path.as_posix()}'")
        if inpoint > 0:
            lines.append(f"inpoint {s.t0 + inpoint:.3f}")
        if outpoint < s.duration:
            lines.append(f"outpoint {s.t0 + outpoint:.3f}")
    if not lines:
        return False
    lst.write_text("\n".join(lines) + "\n", encoding="utf-8")
    tmp = out.with_name(out.stem + ".part.mp4")
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-map", "0:v:0", "-c", "copy", "-an", "-movflags", "+faststart", str(tmp)],
        capture_output=True,
        text=True,
    )
    lst.unlink(missing_ok=True)
    if r.returncode != 0 or not tmp.exists() or tmp.stat().st_size < 10_000:
        tmp.unlink(missing_ok=True)
        print(f"   ✗ ffmpeg: {r.stderr.strip()[:300]}")
        return False
    tmp.replace(out)
    return True


# ── 명령: cut ─────────────────────────────────────────────────────────
def cmd_cut(args: argparse.Namespace) -> int:
    cfg = load_config()
    need_ffmpeg()
    day = dt.date.fromisoformat(args.date) if args.date else dt.datetime.now(KST).date()
    feed, skew = load_feed_file(args.feed_file) if args.feed_file else fetch_feed(cfg, day)
    if abs(skew) > 2:
        print(f"[알림] 노트북 시계가 서버와 {skew:+.0f}초 달라요 — 자를 때 맞춰서 자릅니다(윈도우 설정 › 시간 › 지금 동기화 권장).")
    matches = feed.get("matches", [])
    code = feed.get("branch_code", "")
    local_tz = dt.datetime.now().astimezone().tzinfo or KST
    raw = dir_of(cfg, "raw_dir")
    out_dir = dir_of(cfg, "out_dir") / day.isoformat()
    segs = list_segments(raw, local_tz)
    now_utc = dt.datetime.now(dt.timezone.utc)

    print(f"■ {day} {code} 경기 {len(matches)}개 · 원본 조각 {len(segs)}개")
    film = [m for m in matches if m.get("film_ok")]
    nofilm = [m for m in matches if not m.get("film_ok")]
    done_codes: set[str] = set()
    missing: list[str] = []
    waiting: list[str] = []

    for m in film:
        c = m["code"]
        if not CODE_RE.match(c):
            print(f"   ? 이상한 경기 번호 {c} — 건너뜀")
            continue
        out = out_dir / f"{c}.mp4"
        a, b = windows(m, cfg, skew)
        if not m.get("ended") and parse_ts(m["end"]) > now_utc:
            waiting.append(c)
            continue
        if out.exists() and not args.force:
            done_codes.add(c)
            print(f"   = {c} 이미 있음")
            continue
        parts = overlapping(segs, a, b)
        if not parts:
            missing.append(c)
            print(f"   ✗ {c} 원본 없음 ({a.astimezone(local_tz):%H:%M:%S}~{b.astimezone(local_tz):%H:%M:%S})")
            continue
        if cut_one(parts, a, b, out):
            done_codes.add(c)
            print(f"   ✓ {c}  {(b - a).total_seconds() / 60:.1f}분")
        else:
            missing.append(c)

    # 촬영 안 하는 경기: 자른 파일이 있으면 지우고, 그 시간의 원본 조각도 지운다
    # 단 같은 조각에 아직 못 자른 촬영 경기가 걸쳐 있으면 남겨 두고 알린다(다음에 cut 하면 지움)
    removed = 0
    kept: list[str] = []
    for m in nofilm:
        stale = out_dir / f"{m['code']}.mp4"
        if stale.exists():
            stale.unlink()
            print(f"   - {m['code']} 촬영 안 함 · 잘라 둔 파일 지움")
        a, b = windows(m, cfg, skew)
        for s in overlapping(segs, a, b):
            if not s.path.exists():
                continue
            blockers = [
                f["code"] for f in film
                if f["code"] not in done_codes and overlapping([s], *windows(f, cfg, skew))
            ]
            if blockers:
                kept.append(s.path.name)
                continue
            if args.dry_run:
                print(f"   (지울 원본) {s.path.name}")
            else:
                s.path.unlink(missing_ok=True)
            removed += 1

    print(f"■ 자름 {len(done_codes)} · 원본 없음 {len(missing)} · 아직 진행 중 {len(waiting)} · 촬영 안 함 {len(nofilm)}(원본 조각 {removed}개 지움)")
    if kept:
        print(f"[알림] 촬영 경기를 아직 못 잘라서 남겨 둔 원본 {len(set(kept))}개 — 다시 cut 하면 지웁니다.")
    if done_codes:
        print(f"→ 유튜브 스튜디오에 올릴 폴더: {out_dir}")
        print("  만들기 › 동영상 업로드 › 파일을 15개씩 끌어다 놓기 (제목 = 파일 이름 그대로)")
        if args.open and platform.system() == "Windows":
            os.startfile(out_dir)  # type: ignore[attr-defined]
    return 0 if not missing else 2


# ── 명령: status ──────────────────────────────────────────────────────
def cmd_status(args: argparse.Namespace) -> int:
    cfg = load_config()
    day = dt.date.fromisoformat(args.date) if args.date else dt.datetime.now(KST).date()
    feed, skew = fetch_feed(cfg, day)
    print(f"■ {day} {feed.get('branch_code', '')} · 시계 차이 {skew:+.1f}초")
    for m in feed.get("matches", []):
        st = parse_ts(m["start"]).astimezone(KST)
        en = parse_ts(m["end"]).astimezone(KST)
        film = "촬영" if m.get("film_ok") else "촬영 안 함"
        print(f"  {m['code']}  {st:%H:%M:%S}~{en:%H:%M:%S}  {m['status']}  {film}")
    return 0


# ── 녹화 ─────────────────────────────────────────────────────────────
ENCODERS = {
    "h264_nvenc": ["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", "{q}", "-b:v", "0"],
    "h264_qsv": ["-c:v", "h264_qsv", "-global_quality", "{q}", "-look_ahead", "0"],
    "h264_amf": ["-c:v", "h264_amf", "-quality", "speed", "-rc", "cqp", "-qp_i", "{q}", "-qp_p", "{q}"],
    "libx264": ["-c:v", "libx264", "-preset", "veryfast", "-crf", "{q}", "-sc_threshold", "0"],
}
# 조각 이름은 상대 경로로만 준다 — ffmpeg 를 그 폴더(cwd)에서 돌린다.
# 윈도우의 strftime 은 폴더 이름에 한글이 있으면 빈 이름을 돌려줘 녹화가 바로 멈춘다(2026-11-26 선릉 노트북 · 「앱 자료」 폴더).
SEG_PATTERN = "%Y%m%d-%H%M%S.ts"


def pick_encoder(cfg: dict) -> str:
    if cfg.get("encoder") and cfg["encoder"] != "auto":
        return cfg["encoder"]
    for name in ("h264_nvenc", "h264_qsv", "h264_amf"):
        test = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=640x360:r=30",
                "-t", "0.5", *[a.replace("{q}", "23") for a in ENCODERS[name]], "-f", "null", "-"]
        try:
            if subprocess.run(test, capture_output=True, timeout=30).returncode == 0:
                return name
        except subprocess.SubprocessError:
            pass
    return "libx264"


def camera_input(cfg: dict) -> list[str]:
    size, fps, fmt, cam = cfg["video_size"], str(cfg["framerate"]), cfg.get("input_format") or "", cfg["camera"]
    sysname = platform.system()
    if sysname == "Windows":
        a = ["-f", "dshow", "-rtbufsize", "512M", "-video_size", size, "-framerate", fps]
        if fmt:
            a += ["-vcodec", fmt]
        return a + ["-i", f"video={cam}"]
    if sysname == "Darwin":
        return ["-f", "avfoundation", "-framerate", fps, "-video_size", size, "-i", f"{cam or '0'}:none"]
    a = ["-f", "v4l2", "-video_size", size, "-framerate", fps]
    if fmt:
        a += ["-input_format", fmt]
    return a + ["-i", cam or "/dev/video0"]


def record_args(cfg: dict, enc: str, seconds: float | None = None) -> list[str]:
    """녹화 명령 — 조각을 쓸 폴더를 cwd 로 주고 돌린다(SEG_PATTERN 참고)."""
    q = str(cfg["quality"])
    a = ["ffmpeg", "-hide_banner", "-loglevel", "warning", *camera_input(cfg), "-an",
         "-map", "0:v:0", "-pix_fmt", "yuv420p", *[x.replace("{q}", q) for x in ENCODERS[enc]],
         "-g", str(int(cfg["framerate"]) * 2)]
    if seconds:
        a += ["-t", str(seconds)]
    a += ["-f", "segment", "-segment_time", str(int(cfg["segment_minutes"]) * 60), "-segment_atclocktime", "1",
          "-segment_format", "mpegts", "-reset_timestamps", "1", "-strftime", "1", SEG_PATTERN]
    return a


def cmd_record(args: argparse.Namespace) -> int:
    cfg = load_config()
    need_ffmpeg()
    if not cfg.get("camera") and platform.system() == "Windows":
        sys.exit("[멈춤] 카메라가 정해지지 않았어요. setup 을 먼저 해 주세요.")
    raw = dir_of(cfg, "raw_dir")
    raw.mkdir(parents=True, exist_ok=True)
    clean(cfg, quiet=False)
    free_gb = shutil.disk_usage(raw).free / 1e9
    if free_gb < 20:
        print(f"[알림] 남은 디스크 {free_gb:.0f}GB — 하루 5시간이면 약 10GB를 써요.")
    enc = pick_encoder(cfg)
    print(f"■ 녹화 시작 — {cfg['video_size']} {cfg['framerate']}fps · 소리 없음 · {enc} · {cfg['segment_minutes']}분 조각 → {raw}")
    print("  끝내려면 이 창에서 Ctrl+C (조각은 그대로 남아요)")
    try:
        return subprocess.run(record_args(cfg, enc, args.seconds), cwd=raw).returncode
    except KeyboardInterrupt:
        print("\n■ 녹화를 멈췄어요.")
        return 0


def cmd_test_camera(args: argparse.Namespace) -> int:
    cfg = load_config()
    need_ffmpeg()
    test_dir = HERE / "camera_test"
    test_dir.mkdir(exist_ok=True)
    enc = pick_encoder(cfg)
    print(f"■ 카메라 5초 시험 ({enc}) …")
    r = subprocess.run(record_args(cfg, enc, 5), cwd=test_dir)
    files = sorted(test_dir.glob("*.ts"))
    if r.returncode == 0 and files:
        print(f"✓ 됐어요: {files[-1]} — 열어서 화면이 링 전체를 담는지 보세요.")
        return 0
    print("✗ 녹화가 안 됐어요. setup 에서 카메라 이름 · input_format(mjpeg 를 빈칸으로)을 바꿔 보세요.")
    return 1


# ── 정리 ─────────────────────────────────────────────────────────────
def clean(cfg: dict, quiet: bool = True) -> None:
    today = dt.datetime.now().date()
    raw = dir_of(cfg, "raw_dir")
    n = 0
    if raw.exists():
        for p in raw.iterdir():
            m = SEG_RE.match(p.name)
            if m and (today - dt.datetime.strptime(m.group(1), "%Y%m%d").date()).days >= int(cfg["keep_raw_days"]):
                p.unlink(missing_ok=True)
                n += 1
    out = dir_of(cfg, "out_dir")
    k = 0
    if out.exists():
        for d in out.iterdir():
            try:
                age = (today - dt.date.fromisoformat(d.name)).days
            except ValueError:
                continue
            if d.is_dir() and age >= int(cfg["keep_out_days"]):
                shutil.rmtree(d, ignore_errors=True)
                k += 1
    if not quiet or n or k:
        print(f"■ 정리: {cfg['keep_raw_days']}일 지난 원본 {n}개 · {cfg['keep_out_days']}일 지난 올리기 폴더 {k}개 지움")


def cmd_clean(args: argparse.Namespace) -> int:
    clean(load_config(), quiet=False)
    return 0


# ── 설정 ─────────────────────────────────────────────────────────────
def list_cameras() -> list[str]:
    if platform.system() != "Windows":
        return []
    r = subprocess.run(["ffmpeg", "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    names = []
    for line in r.stderr.splitlines():
        m = re.search(r'"([^"]+)"\s*\(video\)', line)
        if m:
            names.append(m.group(1))
    return names


def cmd_setup(args: argparse.Namespace) -> int:
    cfg = load_config()
    need_ffmpeg()
    print("■ 153 링 녹화 노트북 설정")
    tok = input(f"  앱에서 만든 열쇠 (spk_…) [{'있음' if cfg.get('recorder_token') else '없음'}]: ").strip()
    if tok:
        if not tok.startswith("spk_"):
            print("  ✗ 열쇠는 spk_ 로 시작해요. 다시 해 주세요.")
            return 1
        cfg["recorder_token"] = tok
    cams = list_cameras()
    if cams:
        for i, c in enumerate(cams, 1):
            print(f"   {i}) {c}")
        pick = input(f"  카메라 번호 [{cfg.get('camera') or '없음'}]: ").strip()
        if pick.isdigit() and 1 <= int(pick) <= len(cams):
            cfg["camera"] = cams[int(pick) - 1]
    else:
        cam = input(f"  카메라 (윈도우 장치 이름 · 맥 번호 · 리눅스 /dev/video0) [{cfg.get('camera')}]: ").strip()
        if cam:
            cfg["camera"] = cam
    save_config(cfg)
    print(f"✓ 저장: {CONFIG_PATH}")
    if cfg.get("recorder_token"):
        feed, skew = fetch_feed(cfg, dt.datetime.now(KST).date())
        print(f"✓ 서버 연결됨 — 지점 {feed.get('branch_code')} · 오늘 경기 {len(feed.get('matches', []))}개 · 시계 차이 {skew:+.1f}초")
    return 0


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")  # 윈도우 창에서 한글
        except (ValueError, OSError):
            pass
    ap = argparse.ArgumentParser(description="153 링 녹화 노트북 — 스파링 영상 녹화 · 자르기")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup", help="열쇠 · 카메라 정하기").set_defaults(fn=cmd_setup)
    p = sub.add_parser("record", help="계속 녹화(15분 조각)")
    p.add_argument("--seconds", type=float, default=None, help="시험용: 이 초만큼만")
    p.set_defaults(fn=cmd_record)
    sub.add_parser("test-camera", help="카메라 5초 시험").set_defaults(fn=cmd_test_camera)
    p = sub.add_parser("cut", help="오늘 경기를 경기 번호 파일로 자르기")
    p.add_argument("--date", help="YYYY-MM-DD (기본: 오늘, 한국 시각)")
    p.add_argument("--force", action="store_true", help="이미 자른 경기도 다시")
    p.add_argument("--open", action="store_true", help="끝나면 올릴 폴더 열기(윈도우)")
    p.add_argument("--dry-run", action="store_true", help="원본은 지우지 않고 보여만")
    p.add_argument("--feed-file", help=argparse.SUPPRESS)
    p.set_defaults(fn=cmd_cut)
    p = sub.add_parser("status", help="오늘 경기 번호 · 시각 보기")
    p.add_argument("--date")
    p.set_defaults(fn=cmd_status)
    sub.add_parser("clean", help="오래된 원본 · 올리기 폴더 지우기").set_defaults(fn=cmd_clean)
    args = ap.parse_args(argv)
    return int(args.fn(args) or 0)


if __name__ == "__main__":
    sys.exit(main())
