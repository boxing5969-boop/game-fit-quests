/**
 * 랭킹업 ↔ CRM 통합 핸드오프 PDF 빌더.
 *
 * 출력: docs/153_rankingup_crm_handoff.pdf
 *
 * 목적:
 *   외부 CRM 프로그램에서 랭킹업 앱의 회원 등록 / 홀딩 / 연장 / 결제 흐름을
 *   동일한 데이터 모델·RPC 위에서 동작시킬 수 있도록 전체 핵심 자료를 한 문서로 묶음.
 *
 *   섹션 구성: CRM 통합 포인트 → 인증·권한 → 지점·회원 → 다이어트 21일 / 사후 프로그램
 *   (홀딩·연장) → 결제·파이트머니(젬) → DB 스키마 / RPC / Edge Functions / 코드 레이어.
 *
 * 실행:
 *   node scripts/build-rankingup-crm-handoff-pdf.mjs
 */
import { readFile, writeFile, mkdir, stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(
  path.dirname(
    new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1"),
  ),
  "..",
);
const OUT_DIR = path.join(ROOT, "docs");
const OUT_PDF = path.join(OUT_DIR, "153_rankingup_crm_handoff.pdf");

// ──────────────────────────────────────────────────────────────────
// CRM 통합 안내 — 표지에 노출
// ──────────────────────────────────────────────────────────────────

const CRM_INTRO = `
랭킹업(RANKING-UP) 앱은 153복싱짐의 회원 운영 시스템(스포츠 RPG · 21일 다이어트 ·
파이트머니 상점 · 챌린지 등) 입니다. CRM 프로그램이 다음 4가지를 책임지면 동일한
회원 흐름이 됩니다 — 모두 본 문서의 RPC / 테이블로 처리 가능합니다.

  ① 회원 등록   : auth.users + profiles + branch_members 행 생성. is_approved 플래그.
  ② 홀딩        : enrollment.status='paused' 또는 회원 차단(profiles.is_active=false)
                   → 코치 승인 흐름과 다이어트 자동 전환 모두 일관 처리.
  ③ 연장        : 21일 종료 후 maintenance / extend 두 갈래 선택. CRM 에서 계약 갱신
                   시점에 selected_path 만 set 하면 앱은 NextStepChooser 우회 가능.
  ④ 결제        : 결제 게이트웨이 → Supabase 측 customer_orders 또는 wallet 충전 RPC.
                   파이트머니(젬) 잔액은 wallet 테이블 단일 출처.

핵심 RPC 14종 / 테이블 22종 / Edge Function 7종 / 마이그레이션 66종 모두 본 문서 수록.
모든 SECURITY DEFINER RPC 는 SECURITY DEFINER + 권한 가드(본인/매니저/super_admin) 동일 패턴.
`;

// ──────────────────────────────────────────────────────────────────
// 운영 규칙 — 표지 삽입
// ──────────────────────────────────────────────────────────────────

const RULES = [
  "Supabase 운영 owner = Lovable. 로컬 CLI 로 functions deploy 시 403 가능 — Lovable 채팅 또는 Dashboard SQL Editor 수동 실행으로 위임.",
  "마이그레이션 파일명: YYYYMMDDhhmmss_*.sql. 단조 증가 보장. 외부 DB 직접 수정 금지 — 항상 마이그레이션 통해서만.",
  "auth.uid() 는 SQL Editor 에서 NULL — 테스트 쿼리는 명시적 user_id = '...' 사용.",
  "모든 쓰기 RPC 는 SECURITY DEFINER + 권한 가드(본인/is_branch_manager_of/has_role(super_admin)).",
  "RLS: 본인 데이터 SELECT/INSERT/UPDATE 가능. 매니저는 지점 회원 SELECT, super_admin 은 전사.",
  "wallet 잔액은 RPC(grant_gems / spend_gems) 경유만 변경. 클라이언트 직접 update 금지.",
  "is_approved=false 회원은 자동 로그아웃 — 코치 승인 후 로그인 가능.",
  "diet_program_enrollments.status: not_started/active/paused/completed/dropped 5개. paused = 홀딩.",
  "CRM 등록 시 profiles.is_active=true, branch_id, role='member' 필수. user_id = auth.users.id 동일.",
  "21일 후 자동 status='completed' 전환은 submit_diet_daily_log 가 milestone_21 도달 시 트리거.",
];

// ──────────────────────────────────────────────────────────────────
// 섹션 — CRM 통합 관점 우선순위로 정렬
// ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: "1. CRM 통합 — 핵심 흐름 코드",
    intro:
      "회원 등록·홀딩·연장·결제 4가지 핵심 흐름이 어떤 코드와 RPC를 통해 일어나는지 한눈에. CRM 외부 시스템이 호출할 진입점.",
    files: [
      "src/contexts/AuthContext.tsx",
      "src/hooks/useDietEnrollment.ts",
      "src/hooks/useDietPostProgram.ts",
      "src/hooks/useWallet.ts",
      "src/services/dietService.ts",
      "src/services/dietPostProgramService.ts",
      "src/services/dietNutritionService.ts",
    ],
  },
  {
    title: "2. 인증 / 권한 / 역할",
    intro:
      "Supabase Auth + profiles + role 시스템(member/coach/branch_manager/admin/super_admin). 회원 차단·재활성화도 여기.",
    files: [
      "src/integrations/supabase/client.ts",
      "src/contexts/AuthContext.tsx",
      "src/lib/errorMessages.ts",
      "src/pages/LoginPage.tsx",
      "src/pages/SignupPage.tsx",
    ],
  },
  {
    title: "3. 지점 (Branches)",
    intro: "지점 정보 + 지점장 역할 매핑. CRM 에서 회원 가입 시 branch_id 결정.",
    files: [
      "src/pages/SelectBranchPage.tsx",
      "src/components/admin/BranchPicker.tsx",
      "src/components/admin/BranchManagement.tsx",
    ],
  },
  {
    title: "4. 회원 등록 / 온보딩",
    intro: "신규 가입 → 코치 승인 → 지점 선택 → 온보딩 → 입단식. is_approved 게이트.",
    files: [
      "src/pages/SignupPage.tsx",
      "src/pages/OnboardingPage.tsx",
      "src/pages/SafetyCheckPage.tsx",
      "src/components/induction/InductionStepCard.tsx",
      "src/components/induction/InductionCeremonyOverlay.tsx",
    ],
  },
  {
    title: "5. 21일 다이어트 — 등록 / 진행 / 홀딩 / 완료",
    intro:
      "다이어트 enrollment 생성 / 자가 기록 / paused 홀딩 / 21일 자동 completed 전환. 모든 status 전환 트리거.",
    files: [
      "src/pages/diet/DietHubPage.tsx",
      "src/pages/diet/DietOnboardingPage.tsx",
      "src/pages/diet/DietTrackerPage.tsx",
      "src/pages/diet/DietProgressPage.tsx",
      "src/lib/diet/ruleEngine.ts",
      "src/lib/diet/scoreEngine.ts",
      "src/lib/diet/questEvents.ts",
      "src/lib/diet/questTimingEngine.ts",
      "src/lib/diet/questMessageEngine.ts",
    ],
  },
  {
    title: "6. 사후 프로그램 — 유지 / 연장 (= CRM 연장 결제 시점)",
    intro:
      "21일 후 두 갈래(유지/연장) 진입. CRM 결제 갱신 후 selected_path 와 cycle 길이를 set 하면 앱이 자동으로 다음 단계 미션 부여.",
    files: [
      "src/pages/diet/DietPostProgramPage.tsx",
      "src/components/diet/post/PostProgramRouter.tsx",
      "src/components/diet/post/NextStepChooser.tsx",
      "src/components/diet/post/MaintenanceHome.tsx",
      "src/components/diet/post/ExtendHome.tsx",
      "src/components/diet/post/ExtendCycleResult.tsx",
      "src/components/diet/post/ExtendReassessmentWizard.tsx",
      "src/components/diet/post/PostProgramDailyCheckCard.tsx",
      "src/lib/diet/postProgramTypes.ts",
      "src/lib/diet/postProgramCoachEngine.ts",
      "src/lib/diet/recommendEngine.ts",
      "src/lib/diet/extendPatternEngine.ts",
      "src/data/diet/postProgramDailyMissions.ts",
      "src/data/diet/maintenanceVariants.ts",
      "src/data/extendPlaybooks.ts",
      "src/data/postProgramMissions.ts",
    ],
  },
  {
    title: "7. 결제 / 파이트머니(젬) 시스템",
    intro:
      "wallet 잔액 + 상점 구매 + RPC(grant_gems, spend_gems, purchase_customization). CRM 결제 후 잔액 충전 진입점.",
    files: [
      "src/hooks/useWallet.ts",
      "src/hooks/useCustomizationPurchase.ts",
      "src/pages/RewardsPage.tsx",
      "src/pages/CharacterStudioPage.tsx",
    ],
  },
  {
    title: "8. 챌린지 / 커뮤니티",
    intro:
      "지점·전사 챌린지 시스템 — CRM 에서 시즌 단위 챌린지 생성/종료 시 활용.",
    files: [
      "src/pages/ChallengesPage.tsx",
      "src/services/challengeService.ts",
      "src/hooks/useChallenges.ts",
    ],
  },
  {
    title: "9. 코치 / 지점장 / 슈퍼 관리자 인터페이스",
    intro:
      "회원 승인·미션 검토·홀딩 처리·결제 확인 인터페이스. CRM 으로 외부에서 같은 작업 가능.",
    files: [
      "src/pages/CoachPage.tsx",
      "src/pages/BranchManagerPage.tsx",
      "src/pages/AdminPage.tsx",
      "src/pages/diet/coach/DietCoachInboxPage.tsx",
      "src/pages/diet/coach/DietMemberDetailPage.tsx",
      "src/components/diet/coach/DietApprovalCard.tsx",
      "src/components/diet/coach/DietCoachTemplatePicker.tsx",
    ],
  },
  {
    title: "10. AI 코치(오삼) / 카카오톡 talktalk 연동",
    intro:
      "AI 챗봇 + 카카오톡 talktalk 발송. CRM 에서 회원 알림(가입·연장 임박·홀딩 안내)에 활용.",
    files: [
      "src/components/ChatAssistant.tsx",
      "supabase/functions/chat-assistant/index.ts",
      "supabase/functions/_shared/systemPrompt153.ts",
      "supabase/functions/_shared/knowledge153.ts",
      "supabase/functions/talktalk-chilgeum/index.ts",
      "supabase/functions/talktalk-webhook/index.ts",
      "supabase/functions/qr-checkin/index.ts",
      "supabase/functions/qr-token-refresh/index.ts",
      "supabase/functions/verify-identity-reset/index.ts",
      "supabase/functions/delete-user/index.ts",
    ],
  },
  {
    title: "11. DB 스키마 — 핵심 마이그레이션 (회원·다이어트·결제·챌린지)",
    intro:
      "CRM 이 같은 DB 위에서 동작하므로 모든 테이블/RPC/RLS 정책을 알아야 함. 다이어트 + 다이어트 후 + 챌린지 + 결제 + 회원 인프라 핵심 마이그레이션.",
    files: [
      "supabase/migrations/20260408075544_fea10476-48bb-4986-9a65-69bc5d8c49fd.sql",
      "supabase/migrations/20260420130000_tutorial_and_unlock_rpcs.sql",
      "supabase/migrations/20260420140000_tutorial_state_columns.sql",
      "supabase/migrations/20260420160000_master_track.sql",
      "supabase/migrations/20260421000000_hof_purchase_gate.sql",
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
      "supabase/migrations/20260506000000_add_diet_quest_events.sql",
      "supabase/migrations/20260507000000_diet_early_start_post_program.sql",
    ],
  },
  {
    title: "12. 핵심 데이터 / 상수",
    intro: "트랙·스테이지·미션 템플릿·상품 카탈로그 등 — CRM 에서 동일 식별자 참조.",
    files: [
      "src/lib/dietTrack.ts",
      "src/lib/diet/postProgramTypes.ts",
      "src/data/diet/missionTemplates.ts",
      "src/data/diet/coachTemplates.ts",
      "src/data/diet/comebackMissions.ts",
      "src/data/dietProgramData.ts",
      "src/data/sharedConstants.ts",
      "src/data/unlockRules.ts",
    ],
  },
];

// ──────────────────────────────────────────────────────────────────
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
    return {
      rel,
      content,
      bytes: stats.size,
      lines: content.split("\n").length,
    };
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

async function listAllMigrations() {
  const dir = path.join(ROOT, "supabase/migrations");
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return [];
  }
}

async function buildHtml() {
  const today = new Date().toISOString().slice(0, 10);
  const allMigrations = await listAllMigrations();
  let totalFiles = 0;
  let totalLines = 0;

  const tocItems = [];
  const sectionHtml = [];

  for (const [sIdx, sec] of SECTIONS.entries()) {
    const sId = `section-${sIdx + 1}`;
    tocItems.push(
      `<li><a href="#${sId}"><span class="toc-num">${sIdx + 1}</span> ${escapeHtml(
        sec.title.replace(/^\d+\.\s*/, ""),
      )}</a></li>`,
    );

    const fileBlocks = [];
    for (const rel of sec.files) {
      const f = await readSafe(rel);
      if (f.missing) {
        fileBlocks.push(
          `<div class="file"><div class="file-head"><span class="path">${escapeHtml(rel)}</span><span class="meta missing">파일 없음(스킵)</span></div></div>`,
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
  const migrationsHtml = allMigrations
    .map((m) => `<li><code>${escapeHtml(m)}</code></li>`)
    .join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>153 랭킹업 — CRM 핸드오프 (${today})</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif;
    color: #111; font-size: 11px; line-height: 1.55; margin: 0;
  }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.2px; }
  h2 { font-size: 16px; margin: 14px 0 6px; padding-top: 10px; border-top: 2px solid #111; }
  h2 .sec-num { display:inline-block; width:22px; height:22px; line-height:22px;
    border-radius:6px; background:#111; color:#fff; font-size:12px; text-align:center;
    margin-right:8px; vertical-align:2px; }
  h3 { font-size: 13px; margin: 0 0 6px; }
  .cover { page-break-after: always; padding: 8mm 0 0; }
  .stamp { display:inline-block; padding:4px 10px; border:1.5px solid #111;
    border-radius:4px; font-weight:800; font-size:10px; letter-spacing:0.5px; }
  .meta-line { color:#444; font-size:11px; margin-top:4px; }
  .summary, .rules, .toc, .migrations {
    margin: 14px 0; padding: 10px 12px; border:1px solid #ddd;
    border-radius:8px; background:#fafafa;
  }
  .rules ol, .migrations ul, .toc ul { margin:0; padding-left: 18px; list-style: none; }
  .rules li, .migrations li, .toc li { margin: 2px 0; }
  .toc a { color:#111; text-decoration:none; }
  .toc-num { display:inline-block; width:18px; color:#888; }
  .section { page-break-before: always; }
  .section .intro { color:#555; font-size:11px; margin: 0 0 8px; }
  .file { margin: 8px 0 12px; border:1px solid #e5e5e5; border-radius:6px; overflow:hidden;
    page-break-inside: avoid; }
  .file-head { background:#f4f4f4; padding:4px 8px; display:flex; justify-content:space-between;
    align-items:baseline; font-size:10px; }
  .file-head .path { font-family:'Consolas','Menlo',monospace; font-weight:700; color:#111; }
  .file-head .meta { color:#666; }
  .file-head .meta.missing { color:#b00; }
  .file-head .meta.error { color:#b00; }
  pre.code { margin:0; padding:8px 10px; background:#fff; font-family:'Consolas','Menlo',monospace;
    font-size:9.5px; line-height:1.45; white-space:pre-wrap; word-break:break-word;
    overflow-wrap:anywhere; color:#111; }
  pre.code code { font-family: inherit; }
  footer { margin-top:18px; padding-top:8px; border-top:1px solid #ccc;
    font-size:9.5px; color:#777; }
  .crm-intro {
    margin:14px 0; padding:14px; border:2px solid #29c39c;
    border-radius:10px; background:#ecfdf5;
  }
  .crm-intro p { margin:0; white-space:pre-wrap; font-size:11.5px; line-height:1.6; }
</style>
</head>
<body>

<div class="cover">
  <div class="stamp">153 BOXING GYM · RANKING-UP × CRM HANDOFF</div>
  <h1>랭킹업 ↔ CRM 통합 핸드오프 문서</h1>
  <p class="meta-line">생성일 ${today} · ${totalFiles}개 코드 파일 · ${totalLines.toLocaleString()} 라인 · 마이그레이션 ${allMigrations.length}개 · branch <code>main</code></p>

  <div class="crm-intro">
    <h3>CRM 통합 — 4가지 핵심 흐름</h3>
    <p>${escapeHtml(CRM_INTRO.trim())}</p>
  </div>

  <div class="rules">
    <h3>운영 규칙 (CRM 측 개발자 필독)</h3>
    <ol>${rulesHtml}</ol>
  </div>

  <div class="toc">
    <h3>목차</h3>
    <ul>${tocItems.join("\n")}</ul>
  </div>

  <div class="migrations">
    <h3>전체 마이그레이션 (${allMigrations.length}개) — 적용 순서</h3>
    <p style="margin:0 0 6px;font-size:10px;color:#555;">아래는 본 문서 발행 시점의 마이그레이션 파일 전체 목록 (파일명 = 적용 순서). 핵심 회원·다이어트·결제 인프라는 11번 섹션에 본문 수록.</p>
    <ul>${migrationsHtml}</ul>
  </div>
</div>

${sectionHtml.join("\n")}

<footer>
  생성: build-rankingup-crm-handoff-pdf.mjs · ${totalFiles}개 코드 파일 · ${totalLines.toLocaleString()} 라인 · 마이그레이션 ${allMigrations.length}개 · 153 복싱짐 / 랭킹업 ↔ CRM
</footer>

</body>
</html>`;
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  console.log("[1/3] HTML 생성 중...");
  const html = await buildHtml();
  const tmpHtml = path.join(OUT_DIR, "_rankingup_crm_handoff.tmp.html");
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
    headerTemplate: `<div style="font-size:8px;color:#888;width:100%;text-align:right;padding:0 12mm;">랭킹업 × CRM 핸드오프 — 153 복싱짐</div>`,
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
