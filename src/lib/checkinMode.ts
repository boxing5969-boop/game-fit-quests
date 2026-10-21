/**
 * 🚪 지점별 출석 방식 (2026-10-21 대표님: "칠금점은 브로제이를 쓰지 않아서 회원님들이 수동으로 해야 해. 모니터는 1개")
 *
 *   · 브로제이(얼굴 인식) 지점 — 선릉역점 등: 문에서 얼굴로 출석이 잡히고, TV QR 은 브로제이가 늦을 때 쓰는 보조 수단.
 *   · QR 출석 지점 — 칠금점: 브로제이가 없다. 회원이 들어와서 TV 라이브보드 QR 을 찍어야 출석이 된다.
 *     TV 는 한 대 → 번호 없는 주소(myboxer153.com/tv/c)로 한 화면에 전부(운동 중 · 오늘 방문 · QR) 띄운다.
 *
 *   지점 이름은 profiles.branch_name 과 정확히 같아야 한다.
 */
export const QR_ONLY_BRANCHES: readonly string[] = ["153복싱짐 칠금점"];

/** 출석을 TV QR 로만 하는 지점인가 (브로제이 없음) */
export const isQrOnlyBranch = (branch: string | null | undefined): boolean =>
  !!branch && QR_ONLY_BRANCHES.includes(branch);

/** TV QR 카드 안내 두 줄 — 지점의 출석 방식에 맞춰 */
export const boardQrNotice = (branch: string | null | undefined): { main: string; sub: string } =>
  isQrOnlyBranch(branch)
    ? { main: "들어오면 이 QR을 찍어 출석해 주세요 👊", sub: "이 지점은 QR로 출석해요 · 찍으면 보드에 바로 떠요" }
    : { main: "브로제이 서버 불안정으로 인해 출석 반영이 늦어지고 있어요~", sub: "앱에서 QR을 통해 출석체크 부탁드립니다" };
