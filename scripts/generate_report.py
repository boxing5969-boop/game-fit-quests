"""Generate project status PDF report."""
import os
from fpdf import FPDF

FONT_PATH = r"C:\Windows\Fonts\malgun.ttf"
OUTPUT = r"C:\Users\82104\Desktop\game-fit-quests_코드현황보고서.pdf"


class Report(FPDF):
    def header(self):
        if os.path.exists(FONT_PATH):
            self.set_font("malgun", "B", 11)
        else:
            self.set_font("Helvetica", "B", 11)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "Game Fit Quests - Code Status Report", align="R", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title):
        self.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "B", 14)
        self.set_text_color(30, 30, 30)
        self.set_fill_color(240, 240, 245)
        self.cell(0, 10, title, fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def sub_title(self, title):
        self.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "B", 11)
        self.set_text_color(50, 50, 50)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        f = "malgun" if os.path.exists(FONT_PATH) else "Helvetica"
        self.set_font(f, "", 10)
        self.set_text_color(60, 60, 60)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def status_badge(self, label, status, color):
        self.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "", 10)
        self.set_text_color(60, 60, 60)
        self.cell(80, 7, label)
        r, g, b = color
        self.set_text_color(r, g, b)
        self.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "B", 10)
        self.cell(0, 7, status, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(60, 60, 60)

    def table_row(self, cells, bold=False, fill=False):
        f = "malgun" if os.path.exists(FONT_PATH) else "Helvetica"
        style = "B" if bold else ""
        self.set_font(f, style, 9)
        if fill:
            self.set_fill_color(245, 245, 250)
        widths = [70, 30, 30, 30, 30]
        for i, (cell, w) in enumerate(zip(cells, widths)):
            self.cell(w, 7, str(cell), border=1, fill=fill, align="C" if i > 0 else "L")
        self.ln()


pdf = Report()
pdf.alias_nb_pages()
if os.path.exists(FONT_PATH):
    pdf.add_font("malgun", "", FONT_PATH)
    pdf.add_font("malgun", "B", FONT_PATH)

pdf.add_page()

# ===== Title =====
pdf.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "B", 22)
pdf.set_text_color(20, 20, 20)
pdf.cell(0, 15, "Game Fit Quests", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "", 12)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 8, "코드 현황 보고서  |  2026-04-16", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(8)

# ===== 1. Build Status =====
pdf.section_title("1. 빌드 & 타입 체크 상태")
pdf.status_badge("TypeScript (tsc --noEmit)", "PASS - 오류 0건", (0, 150, 0))
pdf.status_badge("Vite Build", "PASS - 8.2초 빌드 완료", (0, 150, 0))
pdf.status_badge("Dev Server", "http://localhost:8080 정상 구동", (0, 150, 0))
pdf.status_badge("빌드 경고", "chunk size > 500kB (index.js 2MB) - 코드 스플릿 권장", (200, 150, 0))
pdf.ln(3)

# ===== 2. Git Status =====
pdf.section_title("2. Git 상태 (미커밋 변경사항)")
pdf.sub_title("수정된 파일 (Modified) - 10개")
modified = [
    ("src/pages/CharacterStudioPage.tsx", "1,113줄", "프리셋/꾸미기 탭 UX 대폭 개선"),
    ("src/pages/AvatarPage.tsx", "332줄", "아이템 상점 완전 재구성"),
    ("src/data/characterCustomizationData.ts", "365줄", "꾸미기 시스템 대폭 확장"),
    ("src/data/characterPresets.ts", "131줄", "캐릭터 이름/리그/가격 변경"),
    ("src/hooks/useWallet.ts", "101줄", "useSpendGems 훅 추가"),
    ("src/hooks/useRankingData.ts", "-", "명예의전당 체크 훅 추가"),
    ("src/components/CharacterSprite.tsx", "-", "스프라이트 렌더러"),
    ("src/components/BlackLeagueAura.tsx", "-", "블랙리그 오라 효과"),
    ("src/index.css", "-", "커스텀 애니메이션 추가"),
    ("src/pages/HomePage.tsx", "-", "홈페이지 수정"),
]
for path, lines, desc in modified:
    pdf.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "", 9)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(85, 6, path)
    pdf.cell(25, 6, lines, align="C")
    pdf.cell(0, 6, desc, new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)

pdf.sub_title("삭제된 파일 (Deleted) - 2개")
pdf.body_text("- src/components/PresetOverlayRenderer.tsx (미사용 제거)\n- src/hooks/usePresetVariants.ts (미사용 제거)")

pdf.sub_title("신규 파일 (Untracked) - 20개")
pdf.body_text("- src/assets/boxers/boxer_new_01~18.png (AI 캐릭터 이미지 18개)\n- scripts/ (이미지 처리 스크립트)\n- .claude/ (Claude 설정)")
pdf.ln(2)

# ===== 3. Architecture =====
pdf.section_title("3. 주요 파일 아키텍처")

pdf.sub_title("CharacterStudioPage.tsx (1,113줄)")
pdf.body_text(
    "5개 탭 구성: 내 캐릭터 | 프리셋 선택 | 꾸미기 | 성장 | 효과\n\n"
    "[프리셋 선택 탭]\n"
    "- 리그별 필터: 화이트/블루/레드/블랙/전설\n"
    "- grid-cols-2 대형 카드 (min-h 190px)\n"
    "- 상태별 액션 버튼: 무료획득/구매/적용/잠금\n"
    "- 구매 확인 모달 (PurchaseConfirmModal)\n"
    "- 보유 캐릭터 localStorage 추적\n"
    "- 젬 차감: useSpendGems 훅 연동\n\n"
    "[꾸미기 탭]\n"
    "- embla-carousel 좌우 스와이프\n"
    "- 카테고리 pill 탭 + dot 인디케이터\n"
    "- 리그별 잠금 (CUSTOMIZATION_LEAGUE_ORDER)\n"
    "- 전설 아이템 명예의전당 잠금"
)

pdf.sub_title("AvatarPage.tsx (332줄)")
pdf.body_text(
    "[구조]\n"
    "- 젬 잔액 카드 (상단 대형 gradient)\n"
    "- 캐릭터 섹션: 리그별 5개 카드 가로 스크롤\n"
    "- 꾸미기 아이템 섹션: 카테고리 탭 + 2열 그리드\n"
    "- 구매 확인 모달 (backdrop-blur)\n\n"
    "[관리자 기능]\n"
    "- isAdmin: 무제한 젬, 모든 잠금 해제"
)

pdf.sub_title("characterCustomizationData.ts (365줄)")
pdf.body_text(
    "CustomizationOption 인터페이스:\n"
    "  key, label, price, league, rarity, description, requirement\n\n"
    "4개 카테고리, 총 105개 아이템:\n"
    "  - 이펙트: 22개 (화이트6 / 블루5 / 레드6 / 블랙5)\n"
    "  - 프레임: 28개 (화이트5 / 블루7 / 레드9 / 블랙7)\n"
    "  - 칭호:   27개 (화이트5 / 블루6 / 레드8 / 블랙5 / 전설3)\n"
    "  - 오라:   28개 (화이트2 / 블루6 / 레드7 / 블랙11 / 전설2)\n\n"
    "가격 범위: 무료 ~ 15,000젬 (전설: 100,000젬)\n"
    "희귀도: common / uncommon / rare / epic / legendary"
)
pdf.ln(2)

# ===== 4. Character Presets =====
pdf.add_page()
pdf.section_title("4. 캐릭터 프리셋 현황 (47개)")

pdf.table_row(["리그", "총 수", "무료", "유료", "HOF"], bold=True, fill=True)
pdf.table_row(["화이트 (White)", "13", "3", "10", "-"])
pdf.table_row(["블루 (Blue)", "5", "-", "5", "-"], fill=True)
pdf.table_row(["레드 (Red)", "4", "-", "4", "-"])
pdf.table_row(["블랙 (Black)", "25", "-", "8", "17"], fill=True)
pdf.table_row(["합계", "47", "3", "27", "17"])
pdf.ln(3)

pdf.body_text(
    "가격 분포:\n"
    "  화이트: 무료 ~ 500젬\n"
    "  블루: 800 ~ 1,200젬\n"
    "  레드: 1,500 ~ 2,500젬\n"
    "  블랙: 3,000 ~ 15,000젬\n"
    "  명예의 전당 (HOF): 100,000젬 (hall_of_fame 필수)"
)

# ===== 5. Key Features =====
pdf.section_title("5. 주요 기능 체크리스트")
features = [
    ("관리자 무제한 젬/잠금해제", "완료", (0, 150, 0)),
    ("캐릭터 프리셋 선택 & 저장", "완료", (0, 150, 0)),
    ("캐릭터 구매 모달 (젬 차감)", "완료", (0, 150, 0)),
    ("보유 캐릭터 추적 (localStorage)", "완료", (0, 150, 0)),
    ("꾸미기 탭 embla 스와이프", "완료", (0, 150, 0)),
    ("꾸미기 리그별 잠금 체크", "완료", (0, 150, 0)),
    ("꾸미기 전설 아이템 HOF 잠금", "완료", (0, 150, 0)),
    ("아이템 상점 젬 잔액 카드", "완료", (0, 150, 0)),
    ("아이템 상점 구매 확인 모달", "완료", (0, 150, 0)),
    ("아이템 상점 캐릭터 섹션", "완료", (0, 150, 0)),
    ("꾸미기 아이템 구매 (젬 차감)", "미구현 - DB RPC 필요", (200, 100, 0)),
    ("꾸미기 아이템 보유 추적 (DB)", "미구현 - DB 테이블 필요", (200, 100, 0)),
    ("confetti 구매성공 효과", "미구현", (200, 100, 0)),
    ("진동 피드백 (haptic)", "미구현", (200, 100, 0)),
]
for label, status, color in features:
    pdf.status_badge(f"  {label}", status, color)
pdf.ln(3)

# ===== 6. Hooks =====
pdf.section_title("6. 커스텀 훅 현황")
hooks = [
    ("useWallet", "젬 잔액 조회"),
    ("useSpendGems", "젬 차감 (NEW)"),
    ("usePurchaseItem", "아바타 아이템 구매"),
    ("useGrantGems", "젬 지급 (관리자)"),
    ("useIsInHallOfFame", "명예의전당 등재 여부"),
    ("useDivisionRanking", "디비전 랭킹"),
    ("useTemplatePresets", "캐릭터 프리셋 템플릿"),
    ("useAssignCharacter", "캐릭터 배정"),
    ("useSaveCustomization", "꾸미기 저장"),
    ("useAvatarCategories", "아바타 카테고리 목록"),
    ("useAvatarItems", "아바타 아이템 목록"),
    ("useOwnedItems", "보유 아이템 조회"),
    ("useEquippedItems", "장착 아이템 조회"),
]
for name, desc in hooks:
    pdf.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "B", 9)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(55, 6, name)
    pdf.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "", 9)
    pdf.cell(0, 6, desc, new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)

# ===== 7. Dependencies =====
pdf.section_title("7. 핵심 의존성")
deps = [
    ("React 18", "UI 프레임워크"),
    ("TypeScript", "타입 안전성"),
    ("Vite 5", "빌드 & 개발 서버"),
    ("Tailwind CSS", "유틸리티 CSS"),
    ("Supabase", "백엔드 (Auth, DB, RPC)"),
    ("TanStack Query", "서버 상태 관리"),
    ("embla-carousel-react 8", "스와이프 캐러셀"),
    ("Lucide React", "아이콘"),
    ("Sonner", "토스트 알림"),
    ("shadcn/ui", "UI 컴포넌트"),
]
for name, desc in deps:
    pdf.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "B", 9)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(55, 6, name)
    pdf.set_font("malgun" if os.path.exists(FONT_PATH) else "Helvetica", "", 9)
    pdf.cell(0, 6, desc, new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)

# ===== 8. Recommendations =====
pdf.add_page()
pdf.section_title("8. 권장 후속 작업")
recs = [
    "1. [높음] 변경사항 git commit & push (12개 파일 수정, 1,506줄 추가)",
    "2. [높음] 꾸미기 아이템 구매 시스템 백엔드 구현 (purchase_customization RPC)",
    "3. [높음] 보유 꾸미기 아이템 DB 테이블 생성 (user_owned_customizations)",
    "4. [중간] 코드 스플릿: React.lazy + dynamic import (빌드 2MB -> 분할)",
    "5. [중간] 이미지 최적화: boxer_new 이미지 WebP 변환 (평균 1MB/장)",
    "6. [낮음] confetti 구매성공 이펙트 (canvas-confetti 라이브러리)",
    "7. [낮음] 진동 피드백 (navigator.vibrate API)",
    "8. [낮음] E2E 테스트 추가 (Playwright/Cypress)",
]
for rec in recs:
    pdf.body_text(rec)

pdf.output(OUTPUT)
print(f"PDF saved: {OUTPUT}")
