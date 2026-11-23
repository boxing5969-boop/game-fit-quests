#!/usr/bin/env python3
"""CLAUDE.md 짧게 — 기능 기록 칸을 docs/ 로 옮기고 CLAUDE.md 에는 목록 한 줄만 남긴다.

지우는 내용은 없다: 옮긴 칸은 docs 파일에 글자 그대로 들어가고(상대 링크만 ../../ 를 붙임),
스크립트가 끝에 「원본 = 남긴 칸 + 옮긴 칸」을 글자 단위로 대조한다. 하나라도 어긋나면 아무것도 쓰지 않는다.

  python3 split_claudemd.py --mode gfq --repo <game-fit-quests 폴더> [--dry-run]
  python3 split_claudemd.py --mode kba --repo <korea-boxing-cert 폴더> [--dry-run]

gfq: 「## 핵심 경로」 안의 ### 칸 → docs/features/NN-이름.md (「AI 코치봇」「Supabase 연결」 칸은 남김)
kba: 「## 11.」 이후 번호 칸 → docs/history/NN-이름.md (1~10절은 남김)
다시 돌려도 된다: 이미 옮긴 뒤 새로 생긴 칸만 다음 번호로 옮긴다.
"""
import argparse, os, re, sys

TODAY = "2026-11-23"
RULE_KEY = "r_7ae26675e2"

LINK_RE = re.compile(r"\]\((?!https?:|mailto:|#|/|\.\./)([^)\s]+)\)")
PATH_RE = re.compile(r"(?<![\w/])((?:src|supabase/functions|supabase/migrations|scripts|public|external)/[\w\-./]+?\.(?:tsx|ts|sql|mjs|js|json|md|html)|supabase/functions/[\w\-]+/)")


def fix_links(text):
    return LINK_RE.sub(lambda m: "](../../" + m.group(1) + ")", text)


def unfix_links(text):
    return text.replace("](../../", "](")


def slugify(title, used):
    t = re.sub(r"^#+\s*", "", title).strip()
    t = re.split(r"\s[(（—–]|[(（]", t)[0]
    t = re.sub(r"^\d+\.\s*", "", t)
    t = re.sub(r"[^0-9A-Za-z가-힣\- ]+", " ", t)
    t = re.sub(r"\s+", "-", t.strip()).strip("-")
    t = t[:36].rstrip("-") or "section"
    base, n = t, 2
    while t in used:
        t = f"{base}-{n}"; n += 1
    used.add(t)
    return t


def short_title(title, limit=34):
    t = re.sub(r"^#+\s*", "", title).strip()
    t = re.sub(r"^\d+\.\s*", "", t)
    t = re.split(r"\s[(（]", t)[0].strip()
    return t if len(t) <= limit else t[:limit - 1] + "…"


def key_files(chunk, k=1):
    found = []
    for m in PATH_RE.finditer(chunk):
        p = m.group(1).rstrip(".")
        if p not in found:
            found.append(p)
    rank = lambda p: (0 if p.startswith("src/") else 1 if p.startswith("supabase/functions/") else 2 if p.startswith("scripts/") else 3)
    return sorted(found, key=lambda p: (rank(p), found.index(p)))[:k]


def next_number(docdir):
    mx = 0
    if os.path.isdir(docdir):
        for f in os.listdir(docdir):
            m = re.match(r"(\d+)-", f)
            if m:
                mx = max(mx, int(m.group(1)))
    return mx + 1


def split_lines_keep(text):
    return text.splitlines(keepends=True)


def segments_gfq(text):
    """[(text, kind, title)] kind = keep | move ; 원본 순서 그대로."""
    lines = split_lines_keep(text)
    start = next((i for i, l in enumerate(lines) if l.startswith("## 핵심 경로")), None)
    if start is None:
        sys.exit("「## 핵심 경로」 칸을 찾지 못했어요")
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    # 끝의 --- · 빈 줄은 남김 칸으로
    tail = end
    while tail - 1 > start and lines[tail - 1].strip() in ("", "---"):
        tail -= 1
    segs = [("".join(lines[:start + 1]), "keep", None)]
    i = start + 1
    pre = []
    while i < tail and not lines[i].startswith("### "):
        pre.append(lines[i]); i += 1
    if pre:
        segs.append(("".join(pre), "keep", None))
    while i < tail:
        j = i + 1
        while j < tail and not lines[j].startswith("### "):
            j += 1
        chunk = "".join(lines[i:j])
        title = lines[i].rstrip("\n")
        keep = title.startswith("### AI 코치봇") or title.startswith("### Supabase 연결") or title.startswith("### 기능 문서 목록")
        segs.append((chunk, "keep" if keep else "move", title))
        i = j
    segs.append(("".join(lines[tail:]), "keep", None))
    return segs


def segments_kba(text):
    lines = split_lines_keep(text)
    heads = [i for i, l in enumerate(lines) if l.startswith("## ")]
    segs = []
    first = heads[0] if heads else len(lines)
    segs.append(("".join(lines[:first]), "keep", None))
    for n, i in enumerate(heads):
        j = heads[n + 1] if n + 1 < len(heads) else len(lines)
        chunk = "".join(lines[i:j])
        title = lines[i].rstrip("\n")
        m = re.match(r"## (\d+)\.", title)
        move = bool(m and int(m.group(1)) >= 11)
        segs.append((chunk, "move" if move else "keep", title))
    return segs


RULES_GFQ = f"""## 문서 규칙 — CLAUDE.md 는 짧게 ({TODAY} 대표님 「이거 모든 작업에 적용하자」 · 앱 규칙 {RULE_KEY} · 공용 스킬 boris-masterclass)

- CLAUDE.md 는 세션마다 처음에 통째로 읽힌다 → **절대 규칙 · 두 계정 협업 · 명령 · 주의 · 기능 목록 한 줄**만 둔다. **3만 자를 넘기지 않는다**(클로드 코드 권장 4만 자 미만).
- 기능 설명(화면 · DB · 함수 · 결정 · 날짜 기록)은 `docs/features/<번호>-<이름>.md` 에 쓴다. 있는 기능이면 그 파일에 덧붙이고, 새 기능이면 새 파일을 만들고 아래 「기능 문서 목록」에 한 줄(`- [번호 이름](docs/features/…) — 핵심 파일`)만 더한다.
- 일하기 전에 「기능 문서 목록」에서 관련 문서를 찾아 **그 파일만** 읽는다.
- {TODAY} 이전 「핵심 경로」 칸들은 글자 그대로 `docs/features/` 로 옮겼다(지운 것 없음 · 상대 링크만 `../../` 붙임). 옛 긴 판은 git 기록에 있다(`git log -- CLAUDE.md`).
- rebase 중 CLAUDE.md 가 충돌하면: 내 쪽에서 「핵심 경로」에 새로 쓴 칸은 `docs/features/` 새 파일로 옮기고 목록에 한 줄 — 옛 긴 판으로 되돌리지 않는다. 같은 정리는 `python3 scripts/split-claudemd.py --mode gfq --repo .` 로 다시 돌릴 수 있다.

---

"""

RULES_KBA = f"""## 0. 문서 규칙 — CLAUDE.md 는 짧게 ({TODAY} 대표님 「이거 모든 작업에 적용하자」 · 앱 규칙 {RULE_KEY} · 공용 스킬 boris-masterclass)

- CLAUDE.md 는 세션마다 처음에 통째로 읽힌다 → 1~10절(프로젝트 · 백엔드 · DB · 역할 · 라우트 · 디자인 · 배포 · 환경 · 로드맵 · 식별자)과 「기능 기록 목록」 한 줄씩만 둔다.
- 새 기능 기록(창 이름 · 날짜 · 무엇을 · 파일 · DB)은 `docs/history/<번호>-<이름>.md` 새 파일로 쓰고, 아래 「기능 기록 목록」에 한 줄만 더한다. CLAUDE.md 에 「## 33.」 같은 새 절을 붙이지 않는다.
- 일하기 전에 목록에서 관련 기록을 찾아 **그 파일만** 읽는다.
- {TODAY} 까지 붙어 있던 11절 이후 기록은 글자 그대로 `docs/history/` 로 옮겼다(지운 것 없음 · 상대 링크만 `../../`). 옛 판 사본: `_backup/{TODAY}_claudemd/CLAUDE.md`.

"""


def build(mode, text, docdir_rel, start_no):
    segs = segments_gfq(text) if mode == "gfq" else segments_kba(text)
    # 1) 대조: 원본 = 모든 칸을 이은 것
    assert "".join(s[0] for s in segs) == text, "칸 나누기 대조 실패"
    used, files, index_lines = set(), [], []
    no = start_no
    for chunk, kind, title in segs:
        if kind != "move":
            continue
        slug = slugify(title, used)
        if mode == "kba":
            no = int(re.match(r"## (\d+)\.", title).group(1))
        name = f"{no:02d}-{slug}.md"
        body = fix_links(chunk)
        assert unfix_links(body) == unfix_links(chunk), f"링크 외 글자가 바뀜: {name}"
        header = f"<!-- CLAUDE.md 에서 옮김 ({TODAY}) — 글자 그대로 · 상대 링크만 ../../ -->\n"
        files.append((name, header + body, chunk))
        kf = key_files(chunk)
        tail = (" — " + " · ".join(f"`{p}`" for p in kf)) if kf else ""
        index_lines.append(f"- [{no:02d} {short_title(title)}]({docdir_rel}/{name}){tail}\n")
        no += 1
    if not files:
        return None
    if mode == "gfq":
        index = ("### 기능 문서 목록 (docs/features/ — 일하기 전에 관련 문서 하나만 열기)\n\n"
                 + "".join(index_lines) + "\n")
    else:
        index = ("## 11~. 기능 기록 목록 (docs/history/ — 일하기 전에 관련 기록 하나만 열기)\n\n"
                 + "".join(index_lines) + "\n")
    out, placed = [], False
    for chunk, kind, title in segs:
        if kind == "move":
            if not placed:
                out.append(index); placed = True
            continue
        if mode == "gfq" and title and title.startswith("### 기능 문서 목록"):
            # 이미 있는 목록에 새 줄을 붙인다
            out.append(chunk.rstrip("\n") + "\n" + "".join(index_lines) + "\n"); placed = True
            continue
        out.append(chunk)
    new = "".join(out)
    rules = RULES_GFQ if mode == "gfq" else RULES_KBA
    if "## 문서 규칙 — CLAUDE.md 는 짧게" not in new and "## 0. 문서 규칙" not in new:
        anchor = "## 별도 시스템" if mode == "gfq" else "## 1. 프로젝트"
        k = new.find(anchor)
        new = new[:k] + rules + new[k:] if k >= 0 else rules + new
    # 2) 대조: 옮긴 칸 글자 수 + 남긴 칸 = 원본
    moved_total = sum(len(f[2]) for f in files)
    kept_total = sum(len(s[0]) for s in segs if s[1] == "keep")
    assert moved_total + kept_total == len(text), "글자 수 대조 실패"
    for name, content, chunk in files:
        body = content.split("\n", 1)[1]
        assert unfix_links(body) == unfix_links(chunk) and len(body) - len(chunk) == 6 * body.count("](../../") - 6 * chunk.count("](../../"), name
    return new, files, moved_total, kept_total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["gfq", "kba"], required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--file", default="CLAUDE.md", help="원본 CLAUDE.md (기본: <repo>/CLAUDE.md)")
    ap.add_argument("--out", help="결과를 쓸 폴더(기본: repo 자리에서 바꿈)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    src = a.file if os.path.isabs(a.file) else os.path.join(a.repo, a.file)
    text = open(src, encoding="utf-8").read()
    docdir_rel = "docs/features" if a.mode == "gfq" else "docs/history"
    root = a.out or a.repo
    docdir = os.path.join(root, docdir_rel)
    start_no = max(next_number(docdir), next_number(os.path.join(a.repo, docdir_rel)))
    res = build(a.mode, text, docdir_rel, start_no)
    if res is None:
        print("옮길 칸 없음 — 이미 짧아요", len(text), "자"); return
    new, files, moved, kept = res
    print(f"원본 {len(text):,}자 → CLAUDE.md {len(new):,}자 · 옮긴 칸 {len(files)}개 {moved:,}자 · 남긴 칸 {kept:,}자")
    for name, content, _ in files[:3]:
        print("  ", name, f"{len(content):,}자")
    if len(files) > 3:
        print("   …", files[-1][0])
    if a.dry_run:
        return
    os.makedirs(docdir, exist_ok=True)
    for name, content, _ in files:
        p = os.path.join(docdir, name)
        if os.path.exists(p):
            sys.exit(f"이미 있는 파일: {p} — 멈춤")
    for name, content, _ in files:
        with open(os.path.join(docdir, name), "w", encoding="utf-8", newline="") as f:
            f.write(content)
    with open(os.path.join(root, "CLAUDE.md"), "w", encoding="utf-8", newline="") as f:
        f.write(new)
    print("썼어요:", os.path.join(root, "CLAUDE.md"), "+", docdir)


if __name__ == "__main__":
    main()
