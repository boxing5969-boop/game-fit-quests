import { describe, expect, it } from "vitest";
import {
  buildContractDoc,
  checkFreelance,
  checkLabor,
  contractFileName,
  contractNeeds,
  dayRow,
  daysFromRules,
  defaultFreelanceTerms,
  defaultInsurance,
  defaultLaborTerms,
  josa,
  latestRates,
  monthlyPaidHours,
  staffContractState,
  visibleContracts,
  weeklyHolidayMin,
  weeklyWorkMin,
  type ContractBrief,
  type ContractEmployer,
  type LaborTerms,
} from "./opsContract";
import type { OpsRule, OpsStaff } from "./opsWork";

const emp: ContractEmployer = {
  biz_name: "153복싱짐 선릉역점",
  owner_name: "홍대표",
  biz_number: "000-00-00000",
  address: "서울 강남구",
  phone: "02-000-0000",
  sign: "data:image/png;base64,AAAA",
};

const staff = (over: Partial<OpsStaff> = {}): OpsStaff => ({
  id: "s1",
  user_id: "u1",
  name: "김코치",
  kind: "parttime",
  pay_type: "hourly",
  hourly_wage: 12000,
  monthly_salary: null,
  pt_freelancer: false,
  checkin_required: true,
  start_date: "2026-11-10",
  end_date: null,
  active: true,
  ...over,
});

const rule = (weekday: number, start: string, end: string, over: Partial<OpsRule> = {}): OpsRule => ({
  id: `${weekday}${start}`,
  staff_id: "s1",
  weekday,
  start_time: start,
  end_time: end,
  valid_from: "2026-10-01",
  valid_to: null,
  ...over,
});

// 월 · 수 · 금 18:00~22:00 (4시간 → 휴게 30분) · 화 10~12 + 15~17 (사이 3시간이 휴게)
const RULES = [rule(1, "18:00", "22:00"), rule(3, "18:00", "22:00"), rule(5, "18:00", "22:00"), rule(2, "10:00", "12:00"), rule(2, "15:00", "17:00")];

const labor = (over: Partial<LaborTerms> = {}): LaborTerms => ({
  ...defaultLaborTerms({ branch: "153복싱짐 선릉역점", staff: staff(), rules: RULES, employer: emp, today: "2026-11-03" }),
  ...over,
});

describe("계약서 — 글 조각", () => {
  it("받침에 맞는 조사", () => {
    expect(josa("153복싱짐 선릉역점", "과", "와")).toBe("과");
    expect(josa("김코치", "은", "는")).toBe("는");
    expect(josa("박준", "은", "는")).toBe("은");
    expect(josa("Boxing 153", "과", "와")).toBe("과(와)");
  });

  it("시간표 → 근로일 (월요일부터 · 4시간 이어지면 휴게 30분 · 쪼갠 시간은 사이가 휴게)", () => {
    const days = daysFromRules("s1", RULES, "2026-11-03");
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 5]);
    expect(days[0]).toEqual({ weekday: 1, segs: [{ start: "18:00", end: "22:00" }], breakMin: 30 });
    expect(days[1].breakMin).toBe(0);
    expect(dayRow(days[1])).toEqual(["화요일", "10:00", "17:00", "12:00~15:00", "4시간"]);
    expect(dayRow(days[0])).toEqual(["월요일", "18:00", "22:00", "근무 중 30분", "3시간 30분"]);
    // 3.5 × 3 + 4 = 14.5시간
    expect(weeklyWorkMin(days)).toBe(14.5 * 60);
  });

  it("앞으로 시작할 시간표만 있으면 그것을 쓴다", () => {
    const future = [rule(4, "07:00", "09:00", { valid_from: "2026-12-01" })];
    expect(daysFromRules("s1", future, "2026-11-03").map((d) => d.weekday)).toEqual([4]);
  });

  it("주휴 · 월 소정근로시간", () => {
    expect(weeklyHolidayMin(14 * 60)).toBe(0);
    expect(weeklyHolidayMin(20 * 60)).toBe(4 * 60);
    expect(weeklyHolidayMin(50 * 60)).toBe(8 * 60);
    expect(monthlyPaidHours(40 * 60)).toBeCloseTo(208.57, 1); // 표준 209시간
  });
});

describe("계약서 — 근로계약서 글", () => {
  it("주 15시간 미만 단시간 — 주휴 · 연차 없음 · 가산율 · 교부 조항", () => {
    const t = labor();
    const doc = buildContractDoc(t, emp, "2026-11-03");
    expect(doc.title).toBe("단시간근로자 표준근로계약서");
    expect(doc.intro).toBe('153복싱짐 선릉역점(이하 "사업주"라 함)과 김코치(이하 "근로자"라 함)는 다음과 같이 근로계약을 체결한다.');
    const heads = doc.items.map((i) => i.head);
    expect(heads).toEqual([
      "근로개시일",
      "근무장소",
      "업무의 내용",
      "근로일 및 근로일별 근로시간",
      "임금",
      "연차유급휴가",
      "사회보험 적용여부",
      "근로계약서 교부",
      "근로계약, 취업규칙 등의 성실한 이행의무",
      "기타",
    ]);
    const time = doc.items[3];
    expect(time.table?.rows).toHaveLength(4);
    expect(time.lines).toContain("주휴일: 없음 (1주 소정근로시간 15시간 미만)");
    const wage = doc.items[4].lines;
    expect(wage[0]).toBe("시간급: 12,000원");
    expect(wage).toContain("초과근로에 대한 가산임금률: 50%");
    expect(wage[1]).not.toContain("주휴수당");
    expect(doc.items[5].lines[0]).toContain("적용하지 않음");
    // 주 14.5시간이어도 한 달(× 4.345주) 63시간 → 4대보험
    expect(doc.items[6].lines[0]).toBe("고용보험 적용 · 산재보험 적용 · 국민연금 적용 · 건강보험 적용");
    // 월요일 하루(3.5시간)만이면 한 달 15시간 → 산재만
    const oneDay = [t.days[0]];
    expect(defaultInsurance(oneDay)).toEqual({ employment: false, accident: true, pension: false, health: false });
    expect(buildContractDoc(labor({ days: oneDay, insurance: defaultInsurance(oneDay) }), emp, "2026-11-03").items[6].lines[0]).toBe(
      "고용보험 적용 안 함 · 산재보험 적용 · 국민연금 적용 안 함 · 건강보험 적용 안 함",
    );
    expect(doc.employer.rows.map((r) => r[0])).toEqual(["사업체명", "전화", "사업자등록번호", "주소"]);
    expect(doc.employer.owner).toBe("홍대표");
  });

  it("주 40시간 월급 — 표준근로계약서(기간 없음) · 주휴일 · 기간이 있으면 근로계약기간", () => {
    const days = [1, 2, 3, 4, 5].map((w) => ({ weekday: w, segs: [{ start: "09:00", end: "18:00" }], breakMin: 60 }));
    const t = labor({ days, weeklyHoliday: 0, payType: "monthly", wage: 2_500_000 });
    const doc = buildContractDoc(t, emp, "2026-11-03");
    expect(doc.title).toBe("표준근로계약서");
    expect(doc.basis).toContain("기간의 정함이 없는 경우");
    expect(doc.items[3].head).toBe("소정근로시간 · 근무일");
    expect(doc.items[3].lines).toEqual(["1주 소정근로시간: 40시간 (매주 5일 근무)", "주휴일: 매주 일요일"]);
    expect(doc.items[4].lines.join("\n")).not.toContain("가산임금률");
    expect(doc.items[4].lines[1]).toContain("주휴수당 포함");
    const fixed = buildContractDoc({ ...t, end: "2027-11-09", probationMonths: 3, special: "수업 준비 시간도 근로시간에 넣는다\n\n " }, emp, "2026-11-03");
    expect(fixed.basis).toContain("기간의 정함이 있는 경우");
    expect(fixed.items[0]).toEqual({
      head: "근로계약기간",
      lines: ["2026년 11월 10일부터 2027년 11월 9일까지", "수습기간: 근로개시일부터 3개월 (수습기간에도 임금은 아래와 같음)"],
    });
    expect(fixed.items.find((i) => i.head === "특약")?.lines).toEqual(["수업 준비 시간도 근로시간에 넣는다"]);
  });
});

describe("계약서 — 점검", () => {
  it("문제없는 단시간 계약 — 오류 없음, 2027 최저시급 안내", () => {
    expect(checkLabor(labor(), { hasRules: true })).toEqual({ errors: [], warns: [] });
    const c = checkLabor(labor({ wage: 10500 }), { hasRules: true });
    expect(c.errors).toEqual([]);
    expect(c.warns).toContain("2027년 1월부터 최저시급은 10,700원이에요 — 그때 임금을 올려 주세요");
    // 2026년 안에 끝나는 계약이면 안내 없음
    expect(checkLabor(labor({ wage: 10500, end: "2026-12-31" })).warns).toEqual([]);
  });

  it("최저시급 · 월급 환산 · 주휴일 · 쉬는 날", () => {
    expect(checkLabor(labor({ wage: 10000 })).errors).toContain("시간급이 그해 최저시급(10,320원)보다 낮아요");
    const full = [1, 2, 3, 4, 5].map((w) => ({ weekday: w, segs: [{ start: "09:00", end: "18:00" }], breakMin: 60 }));
    const low = checkLabor(labor({ days: full, weeklyHoliday: 0, payType: "monthly", wage: 2_000_000 }));
    expect(low.errors.some((e) => e.startsWith("월급이 최저임금보다 낮아요"))).toBe(true);
    expect(checkLabor(labor({ days: full, weeklyHoliday: null, payType: "monthly", wage: 2_500_000 })).errors).toContain("주휴일(쉬는 날)을 골라 주세요");
    expect(checkLabor(labor({ days: full, weeklyHoliday: 1, payType: "monthly", wage: 2_500_000 })).errors).toContain("주휴일은 일하지 않는 요일이어야 해요");
    const seven = [0, 1, 2, 3, 4, 5, 6].map((w) => ({ weekday: w, segs: [{ start: "10:00", end: "13:00" }], breakMin: 0 }));
    expect(checkLabor(labor({ days: seven, weeklyHoliday: 0, wage: 12000 })).errors).toContain("1주에 쉬는 날이 하루는 있어야 해요");
  });

  it("휴게 · 겹침 · 특약 경고", () => {
    const noBreak = labor({ days: [{ weekday: 1, segs: [{ start: "18:00", end: "22:00" }], breakMin: 0 }] });
    expect(checkLabor(noBreak).warns.some((w) => w.includes("휴게 30분"))).toBe(true);
    const overlap = labor({ days: [{ weekday: 1, segs: [{ start: "10:00", end: "13:00" }, { start: "12:00", end: "14:00" }], breakMin: 0 }] });
    expect(checkLabor(overlap).errors).toContain("월요일 시간이 겹쳐요");
    expect(checkLabor(labor({ special: "무단 결근하면 위약금 10만 원" })).warns.some((w) => w.includes("20조"))).toBe(true);
    expect(checkLabor(labor({ special: "4대보험료는 공제한다" })).warns.some((w) => w.includes("43조"))).toBe(false);
    expect(checkLabor(labor({ special: "지각하면 1만 원 공제" })).warns.some((w) => w.includes("43조"))).toBe(true);
    expect(checkLabor(labor({ workerName: " ", place: "", duties: "" })).errors).toEqual(
      expect.arrayContaining(["근로자 이름을 넣어 주세요", "근무장소를 넣어 주세요", "업무의 내용을 넣어 주세요"]),
    );
  });

  it("위탁 — 월 고정은 근로자성 안내 · 금액 없으면 못 보냄", () => {
    const pt = defaultFreelanceTerms({
      branch: "153복싱짐 선릉역점",
      staff: staff({ pt_freelancer: true }),
      rules: RULES,
      employer: emp,
      today: "2026-11-03",
      ptRates: [
        { team_size: 1, sessions: 10, session_rate: 40000, valid_from: "2026-01-01" },
        { team_size: 1, sessions: 10, session_rate: 50000, valid_from: "2026-06-01" },
        { team_size: 4, sessions: 10, session_rate: 80000, valid_from: "2026-01-01" },
      ],
    });
    expect(pt.feeType).toBe("per_session");
    expect(pt.rates).toEqual([
      { team: 1, sessions: 10, rate: 50000 },
      { team: 4, sessions: 10, rate: 80000 },
    ]);
    expect(checkFreelance(pt).errors).toEqual([]);
    const doc = buildContractDoc(pt, emp, "2026-11-03");
    expect(doc.title).toBe("업무위탁 계약서");
    expect(doc.worker.label).toBe("수탁자");
    expect(doc.items.find((i) => i.head === "수수료")?.table?.rows).toEqual([
      ["1:1 · 10회권", "50,000원", "50,000원"],
      ["4인 팀 · 10회권", "80,000원", "20,000원"],
    ]);
    const monthly = checkFreelance({ ...pt, feeType: "monthly", monthlyFee: null }, { staffKind: "freelancer", hasRules: true });
    expect(monthly.errors).toContain("월 위탁 수수료를 넣어 주세요");
    expect(monthly.warns).toHaveLength(2);
  });
});

describe("계약서 — 근무자별 상태", () => {
  const brief = (over: Partial<ContractBrief>): ContractBrief => ({
    id: "c",
    staff_id: "s1",
    branch: "153복싱짐 선릉역점",
    kind: "labor",
    title: "단시간근로자 표준근로계약서",
    start_date: "2026-11-10",
    end_date: null,
    status: "signed",
    sent_at: "2026-11-03T09:00:00Z",
    viewed_at: null,
    signed_at: "2026-11-03T10:00:00Z",
    in_person: false,
    delivered_at: "2026-11-03T10:00:00Z",
    delivered_how: "app",
    void_at: null,
    void_reason: null,
    has_app: true,
    ...over,
  });

  it("필요한 계약서", () => {
    expect(contractNeeds({ kind: "volunteer", pt_freelancer: false })).toEqual([]);
    expect(contractNeeds({ kind: "freelancer", pt_freelancer: false })).toEqual(["freelance"]);
    expect(contractNeeds({ kind: "parttime", pt_freelancer: true })).toEqual(["labor", "freelance"]);
  });

  it("없음 · 서명 기다림 · 끝난 계약 · 사본 아직", () => {
    const s = { id: "s1", kind: "parttime" as const, pt_freelancer: true };
    expect(staffContractState(s, [], "2026-11-03")).toEqual({ missing: ["labor", "freelance"], waiting: [], undelivered: [] });
    const st = staffContractState(
      s,
      [brief({}), brief({ id: "f", kind: "freelance", status: "sent", signed_at: null, delivered_at: null })],
      "2026-11-03",
    );
    expect(st).toEqual({ missing: [], waiting: ["freelance"], undelivered: [] });
    expect(staffContractState(s, [brief({ end_date: "2026-10-31" })], "2026-11-03").missing).toContain("labor");
    expect(staffContractState(s, [brief({ in_person: true, delivered_at: null, delivered_how: null })], "2026-11-03").undelivered).toHaveLength(1);
  });

  it("새 계약서로 바뀐 서명 전 계약서는 목록에서 뺀다", () => {
    const list = [brief({ id: "a" }), brief({ id: "b", status: "void", signed_at: null, void_reason: "새 계약서로 바꿈" }), brief({ id: "c", status: "void", void_reason: "시급 잘못" })];
    expect(visibleContracts(list).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("수당표는 같은 팀 · 횟수 중 가장 최근 것 · 파일 이름", () => {
    expect(latestRates([{ team_size: 1, sessions: 10, session_rate: 1, valid_from: "2027-01-01" }], "2026-11-03")).toEqual([]);
    expect(contractFileName("labor", "김 코치", "2026-11-03")).toBe("근로계약서_김코치_20261103.pdf");
  });
});
