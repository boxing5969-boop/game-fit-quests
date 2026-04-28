/**
 * 21일 다이어트 기능 전체 코드 스냅샷 → PDF.
 *
 * 출력: docs/153_diet_21day_spec.pdf
 *
 * 목적: 다른 AI(Claude Code, GPT 등)에게 21일 다이어트 코어/연장/식단/챌린지의
 *       전체 코드 + 파일 구조를 한 문서로 전달. 기능 추가·수정 시 충돌·중복 구현 방지.
 *
 * 실행: bun run scripts/build-diet-spec-pdf.mjs
 *      또는 node scripts/build-diet-spec-pdf.mjs
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1")), "..");
const OUT_DIR = path.join(ROOT, "docs");
const OUT_PDF = path.join(OUT_DIR, "153_diet_21day_spec.pdf");

// 섹션 구성 — AI 가 기능을 추가/수정할 때 봐야 할 핵심 파일 묶음.
const SECTIONS = [
  {
    title: "1. 21일 코어 — 데이터 / 규칙",
    intro:
      "21일 다이어트 프로그램의 미션 템플릿, 일일 행동, 점수 규칙. 일일 미션 생성·점수 계산 변경 시 이 파일들부터 검토.",
    files: [
      "src/data/diet/missionTemplates.ts",
      "src/data/diet/maintenanceVariants.ts",
      "src/data/diet/comebackMissions.ts",
      "src/data/diet/dietQuotes.ts",
      "src/data/diet/coachTemplates.ts",
      "src/data/dietProgramData.ts",
      "src/data/postProgramMissions.ts",
      "src/data/extendPlaybooks.ts",
      "src/lib/diet/ruleEngine.ts",
      "src/lib/diet/scoreEngine.ts",
      "src/lib/diet/recommendEngine.ts",
      "src/lib/diet/extendPatternEngine.ts",
      "src/lib/diet/postProgramTypes.ts",
      "src/lib/diet/preferences.ts",
      "src/lib/diet/analytics.ts",
      "src/lib/diet/attendanceBridge.ts",
      "src/lib/dietTrack.ts",
    ],
  },
  {
    title: "2. 자동 식단 — 영양·메뉴·엔진",
    intro:
      "BMR/TDEE 계산, 5대 영양소 추적, 메뉴 라이브러리(266개), 식단 생성/보강/스왑 엔진. 식단 모드(자동·가정집 한식·업무용 초간단) 라우팅 포함.",
    files: [
      "src/lib/diet/nutritionEngine.ts",
      "src/lib/diet/mealPlanEngine.ts",
      "src/lib/diet/mealAnalyzer.ts",
      "src/data/nutrition/mealLibrary.ts",
      "src/data/diet/mealPlan.ts",
    ],
  },
  {
    title: "3. 다이어트 페이지·라우팅",
    intro: "회원 진입 경로(허브/온보딩/트래커/자동 식단/사후 프로그램 등) 페이지.",
    files: [
      "src/pages/diet/DietHubPage.tsx",
      "src/pages/diet/DietOnboardingPage.tsx",
      "src/pages/diet/DietTrackerPage.tsx",
      "src/pages/diet/DietProgressPage.tsx",
      "src/pages/diet/DietAutoMealsPage.tsx",
      "src/pages/diet/DietMealPlanPage.tsx",
      "src/pages/diet/DietPostProgramPage.tsx",
      "src/pages/diet/DietAfter21GuidePage.tsx",
      "src/pages/diet/DietFoodGuidePage.tsx",
      "src/pages/diet/DietPhotoGalleryPage.tsx",
      "src/pages/diet/DietRankingPage.tsx",
      "src/pages/diet/DietValuePage.tsx",
    ],
  },
  {
    title: "4. 21일 코어 컴포넌트",
    intro: "온보딩/체크리스트/일일 미션/사진 업로드/리마인더 등 21일 코어 UI.",
    files: [
      "src/components/diet/DietOnboardingStep.tsx",
      "src/components/diet/DietConsentGate.tsx",
      "src/components/diet/DietSettingsSection.tsx",
      "src/components/diet/DailyHabitCheckList.tsx",
      "src/components/diet/DailyMissionList.tsx",
      "src/components/diet/DietPhotoUpload.tsx",
      "src/components/diet/DietReminderBanner.tsx",
      "src/components/diet/DietRiskWarningBanner.tsx",
      "src/components/diet/DietMoodPicker.tsx",
      "src/components/diet/DietTimelineStrip.tsx",
      "src/components/diet/DietTrackBadge.tsx",
      "src/components/diet/DietSubNav.tsx",
      "src/components/diet/DietLoadingOverlay.tsx",
      "src/components/diet/DietCompletionModal.tsx",
      "src/components/diet/MealAnalysisBadge.tsx",
      "src/components/diet/ComebackButton.tsx",
      "src/components/diet/ComebackMissionDialog.tsx",
      "src/components/diet/OsamCoachPopup.tsx",
    ],
  },
  {
    title: "5. 사후 프로그램 (9·11단계 — 유지·연장)",
    intro:
      "21일 종료 후 분기(유지 컨설팅 / 건강리셋 연장)·재평가 wizard·6 패턴 분류·주차 미션·자동 식단 패널.",
    files: [
      "src/components/diet/post/PostProgramRouter.tsx",
      "src/components/diet/post/MaintenanceHome.tsx",
      "src/components/diet/post/ExtendHome.tsx",
      "src/components/diet/post/ExtendCycleResult.tsx",
      "src/components/diet/post/ExtendReassessmentWizard.tsx",
      "src/components/diet/post/NextStepChooser.tsx",
      "src/components/diet/post/CompletionReportCard.tsx",
      "src/components/diet/post/CoachPostProgramPanel.tsx",
      "src/components/diet/post/AutoMealPlanSection.tsx",
      "src/components/diet/post/MyMealPlan.tsx",
      "src/components/diet/post/MealSwapDialog.tsx",
      "src/components/diet/post/CustomMealDialog.tsx",
      "src/components/diet/post/NutritionOnboardingCard.tsx",
      "src/components/diet/post/NutritionScienceCard.tsx",
      "src/components/diet/post/WeeklyCheckinDialog.tsx",
    ],
  },
  {
    title: "6. 챌린지 / 커뮤니티",
    intro: "21일 챌린지 MVP — 팀, 목표, 리더보드, 진행률 ring.",
    files: [
      "src/pages/ChallengesPage.tsx",
      "src/services/challengeService.ts",
      "src/hooks/useChallenges.ts",
    ],
  },
  {
    title: "7. 코치 / 사진 분석",
    intro: "코치 인박스 + 회원 상세 + 사진 분석 훅.",
    files: [
      "src/pages/diet/coach/DietCoachInboxPage.tsx",
      "src/pages/diet/coach/DietMemberDetailPage.tsx",
      "src/components/diet/coach/DietApprovalCard.tsx",
      "src/components/diet/coach/DietCoachTemplatePicker.tsx",
      "src/hooks/useMealPhotoAnalysis.ts",
    ],
  },
  {
    title: "8. 훅 / 서비스 / 타입",
    intro: "다이어트 데이터 훅·Supabase 서비스 레이어·DB 타입.",
    files: [
      "src/hooks/useDietEnrollment.ts",
      "src/hooks/useDietAttendance.ts",
      "src/hooks/useDietDailyLog.ts",
      "src/hooks/useDietNutrition.ts",
      "src/hooks/useDietPostProgram.ts",
      "src/hooks/useDietPreferences.ts",
      "src/hooks/useDietAnalytics.ts",
      "src/hooks/useDietRanking.ts",
      "src/hooks/useDietCoach.ts",
      "src/services/dietService.ts",
      "src/services/dietNutritionService.ts",
      "src/services/dietPostProgramService.ts",
    ],
  },
  {
    title: "9. Supabase 마이그레이션 (다이어트 관련)",
    intro:
      "다이어트 기능에 사용하는 모든 DB 스키마/RPC. 새 컬럼·RPC 추가 시 충돌 방지를 위해 기존 정의를 먼저 확인.",
    files: [
      "supabase/migrations/20260424000000_diet_program_foundation.sql",
      "supabase/migrations/20260425000000_diet_streak_perfect_badges.sql",
      "supabase/migrations/20260426000000_diet_integrations.sql",
      "supabase/migrations/20260427000000_diet_self_tracking.sql",
      "supabase/migrations/20260428000000_diet_photo_lifecycle.sql",
      "supabase/migrations/20260430000000_diet_post_program.sql",
      "supabase/migrations/20260501000000_diet_extend_deep.sql",
      "supabase/migrations/20260502000000_diet_nutrition_profile.sql",
      "supabase/migrations/20260504000000_diet_photo_analysis.sql",
      "supabase/migrations/20260505000000_diet_challenges.sql",
    ],
  },
  {
    title: "10. 핵심 외부 연동 — 오삼 코치(AI) / 인덕션 튜토리얼",
    intro:
      "AI 코치(오삼)·홈 진입 튜토리얼은 다이어트와 강하게 연결돼 있어 함께 첨부.",
    files: [
      "src/components/ChatAssistant.tsx",
      "src/components/induction/InductionStepCard.tsx",
      "src/components/induction/InductionCeremonyOverlay.tsx",
      "src/components/induction/InductionCompleteCelebration.tsx",
      "src/components/induction/InductionProofRenderer.tsx",
      "src/components/induction/InductionRewardPreview.tsx",
      "src/components/induction/InductionProgressBar.tsx",
      "src/data/inductionTutorialSteps.ts",
      "src/lib/errorMessages.ts",
      "supabase/functions/chat-assistant/index.ts",
      "supabase/functions/_shared/systemPrompt153.ts",
      "supabase/functions/_shared/knowledge153.ts",
    ],
  },
];

const RULES = [
  "기존 UI/레이아웃 유지. 새 페이지·새 챗박스·새 실험 컴포넌트 추가 금지.",
  "AI 코치는 src/components/ChatAssistant.tsx + supabase/functions/chat-assistant 하나만. 새 챗 박스 만들지 말 것.",
  "최소 수정 우선. 파일 전체 재작성 대신 Edit 로 필요한 라인만 교체.",
  "작업 후 반드시 bun run build 로 타입체크/빌드 확인.",
  "Supabase 운영 owner = Lovable. 로컬 CLI 로 functions deploy 시 403 가능 — Lovable 채팅 또는 SQL Editor 수동 실행으로 위임.",
  "메뉴 라이브러리(src/data/nutrition/mealLibrary.ts)에 새 항목 추가 시 MealItem 인터페이스 모든 필드 채우기. code 는 unique.",
  "식단 모드는 PlanMode 타입(random/home_korean/office_quick) 한정. 새 모드 추가 시 modeFilterFor + ModeTab UI 둘 다 수정.",
  "단백질 95% 보장은 PROTEIN_TARGET_RATIO 상수에 의존. 변경 시 prependPreMealShake / guaranteeProtein 동시 영향.",
  "다시 뽑기 누적 회피 큐 = MyMealPlan.tsx 의 EXCLUDE_QUEUE_LIMIT (기본 30). 회피 풀이 너무 좁아지면 fallback.",
  "사진 인증 보상은 도덕적 해이 우려로 제거됨. 다시 도입하지 말 것.",
  "65세 이상 안전 체크 / SafetyCheckPage 는 영구 제거 — safetyDone 항상 true.",
  "에러 메시지는 src/lib/errorMessages.ts (translateAuthError) 단일 출처로 한국어화.",
];

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function readSafe(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return { rel, missing: true };
  try {
    const stats = await stat(abs);
    const content = await readFile(abs, "utf8");
    return { rel, content, bytes: stats.size, lines: content.split("\n").length };
  } catch (err) {
    return { rel, error: String(err) };
  }
}

function langOf(rel) {
  if (rel.endsWith(".sql")) return "sql";
  if (rel.endsWith(".tsx")) return "tsx";
  if (rel.endsWith(".ts")) return "ts";
  if (rel.endsWith(".json")) return "json";
  return "text";
}

async function buildHtml() {
  const today = new Date().toISOString().slice(0, 10);
  let totalFiles = 0;
  let totalLines = 0;

  // 섹션별 본문 + TOC
  const tocItems = [];
  const sectionHtml = [];

  for (const [sIdx, sec] of SECTIONS.entries()) {
    const sId = `section-${sIdx + 1}`;
    tocItems.push(
      `<li><a href="#${sId}"><span class="toc-num">${sIdx + 1}</span> ${escapeHtml(sec.title.replace(/^\d+\.\s*/, ""))}</a></li>`,
    );

    const fileBlocks = [];
    for (const rel of sec.files) {
      const f = await readSafe(rel);
      if (f.missing) {
        fileBlocks.push(
          `<div class="file"><div class="file-head"><span class="path">${escapeHtml(rel)}</span><span class="meta missing">파일 없음</span></div></div>`,
        );
        continue;
      }
      if (f.error) {
        fileBlocks.push(
          `<div class="file"><div class="file-head"><span class="path">${escapeHtml(rel)}</span><span class="meta error">읽기 실패: ${escapeHtml(f.error)}</span></div></div>`,
        );
        continue;
      }
      totalFiles++;
      totalLines += f.lines;
      const lang = langOf(rel);
      fileBlocks.push(
        `<div class="file">
  <div class="file-head">
    <span class="path">${escapeHtml(rel)}</span>
    <span class="meta">${f.lines.toLocaleString()} lines · ${(f.bytes / 1024).toFixed(1)} KB · <code>${lang}</code></span>
  </div>
  <pre class="code"><code>${escapeHtml(f.content)}</code></pre>
</div>`,
      );
    }

    sectionHtml.push(
      `<section class="section" id="${sId}">
  <h2><span class="sec-num">${sIdx + 1}</span> ${escapeHtml(sec.title.replace(/^\d+\.\s*/, ""))}</h2>
  <p class="intro">${escapeHtml(sec.intro)}</p>
  ${fileBlocks.join("\n")}
</section>`,
    );
  }

  const rulesHtml = RULES.map((r) => `<li>${escapeHtml(r)}</li>`).join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>153 다이어트 21일 — 전체 기능·코드 스냅샷 (${today})</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', 'Malgun Gothic', system-ui, -apple-system, sans-serif;
    color: #111; font-size: 11px; line-height: 1.55; margin: 0;
  }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.2px; }
  h2 { font-size: 16px; margin: 14px 0 6px; padding-top: 10px; border-top: 2px solid #111; }
  h2 .sec-num { display: inline-block; width: 22px; height: 22px; line-height: 22px;
    border-radius: 6px; background: #111; color: #fff; font-size: 12px; text-align: center;
    margin-right: 8px; vertical-align: 2px; }
  .cover { page-break-after: always; padding: 8mm 0 0; }
  .cover .stamp { display: inline-block; padding: 4px 10px; border: 1.5px solid #111;
    border-radius: 4px; font-weight: 800; font-size: 10px; letter-spacing: 0.5px; }
  .cover .meta-line { color: #444; font-size: 11px; margin-top: 4px; }
  .summary, .rules { margin: 14px 0; padding: 10px 12px; border: 1px solid #ddd;
    border-radius: 8px; background: #fafafa; }
  .rules h3, .summary h3 { font-size: 13px; margin: 0 0 6px; }
  .rules ol { margin: 0; padding-left: 18px; }
  .rules li { margin: 2px 0; }
  .toc { columns: 1; margin: 14px 0 0; padding: 10px 12px; border: 1px solid #ddd;
    border-radius: 8px; }
  .toc h3 { font-size: 13px; margin: 0 0 6px; }
  .toc ul { list-style: none; padding-left: 0; margin: 0; }
  .toc li { margin: 2px 0; }
  .toc a { color: #111; text-decoration: none; }
  .toc-num { display: inline-block; width: 18px; color: #888; }
  .section { page-break-before: always; }
  .section .intro { color: #555; font-size: 11px; margin: 0 0 8px; }
  .file { margin: 8px 0 12px; border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden;
    page-break-inside: avoid; }
  .file-head { background: #f4f4f4; padding: 4px 8px; display: flex; justify-content: space-between;
    align-items: baseline; font-size: 10px; }
  .file-head .path { font-family: 'Consolas', 'Menlo', monospace; font-weight: 700; color: #111; }
  .file-head .meta { color: #666; }
  .file-head .meta.missing { color: #b00; }
  .file-head .meta.error { color: #b00; }
  pre.code { margin: 0; padding: 8px 10px; background: #fff; font-family: 'Consolas', 'Menlo', monospace;
    font-size: 9.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word;
    overflow-wrap: anywhere; color: #111; }
  pre.code code { font-family: inherit; }
  footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #ccc;
    font-size: 9.5px; color: #777; }
</style>
</head>
<body>

<div class="cover">
  <div class="stamp">153 BOXING GYM · INTERNAL HANDOVER DOC</div>
  <h1>153 다이어트 21일 — 전체 기능·코드 스냅샷</h1>
  <p class="meta-line">생성일 ${today} · ${totalFiles}개 파일 · ${totalLines.toLocaleString()} 라인 · branch <code>main</code></p>

  <div class="summary">
    <h3>이 문서의 목적</h3>
    <p>
      다른 AI(Claude Code, GPT 등)가 153 다이어트 기능에 신규 추가/수정 작업을 할 때
      <strong>충돌·중복 구현·기존 동작 파괴를 피하도록</strong> 현재 구현 전체를 한 문서로 묶어 둔 핸드오버 자료입니다.
      모든 코드는 실제 저장소에서 자동 추출됨 — 수정은 항상 원본 파일에서 진행하세요.
    </p>
  </div>

  <div class="rules">
    <h3>AI 작업자 필독 규칙</h3>
    <ol>${rulesHtml}</ol>
  </div>

  <div class="toc">
    <h3>목차</h3>
    <ul>${tocItems.join("\n")}</ul>
  </div>
</div>

${sectionHtml.join("\n")}

<footer>
  생성: build-diet-spec-pdf.mjs · ${totalFiles}개 파일 · ${totalLines.toLocaleString()} 라인 · 153 복싱짐 / 랭킹업
</footer>

</body>
</html>`;
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  console.log("[1/3] HTML 생성 중...");
  const html = await buildHtml();
  const tmpHtml = path.join(OUT_DIR, "_diet_spec.tmp.html");
  await writeFile(tmpHtml, html, "utf8");
  console.log(`     → ${tmpHtml} (${(html.length / 1024).toFixed(1)} KB)`);

  console.log("[2/3] Playwright 브라우저 시작...");
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("file:///" + tmpHtml.replace(/\\/g, "/"), {
    waitUntil: "networkidle",
  });

  console.log("[3/3] PDF 출력 중...");
  await page.pdf({
    path: OUT_PDF,
    format: "A4",
    margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;color:#888;width:100%;text-align:right;padding:0 12mm;">153 다이어트 21일 — 전체 기능·코드 스냅샷</div>`,
    footerTemplate: `<div style="font-size:8px;color:#888;width:100%;text-align:right;padding:0 12mm;">
      <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>`,
  });
  await browser.close();

  console.log(`\n✓ PDF 생성 완료: ${OUT_PDF}`);
}

main().catch((err) => {
  console.error("PDF 생성 실패:", err);
  process.exit(1);
});
