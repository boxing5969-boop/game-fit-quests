/**
 * 153플레이 「복싱 음악」 — 체육관에서 트는 운동 음악 모음집 (한 편 30분 이상)
 *   · 2026-11-12 대표님 "뮤직비디오는 끄고 한 곡에 30분 넘는 모음집만 넣어줘 · 에너지 복싱 운동할 때 듣는 음악으로만 ·
 *     뮤직비디오는 처음에 음악 소리 안 나오는 구간이 길어서 모두 빼" → 11-11 에 넣은 뮤직비디오 200곡을 모두 빼고
 *     처음부터 음악이 이어지는 논스톱 믹스 · 모음집으로 통째로 바꿨다.
 *
 * 고른 기준
 *   · 한 편 30분 이상(m = 길이, 분) · 운동용으로 만든 것만(복싱 · 킥복싱 · 워크아웃 · 러닝 믹스, 레이블 베스트 믹스).
 *   · 레이블 · 운동 음악 회사 · 채널 주인이 직접 올린 영상만(Spinnin' Records · NCS · Monstercat · UKF · Trap Nation ·
 *     Power Music(Workout Music Source) · Hard EDM Workout · The Gym Beats · Epidemic Sound · 핏블리 · SomiFit · 미러볼 뮤직 …).
 *   · 유튜브 퍼가기(oEmbed) 허용 확인 2026-11-12 — 그래도 나중에 막히는 영상은 플레이어가 알아서 건너뛴다.
 *   · 체육관 화면에 영상이 그대로 보이므로 표지 그림도 봤다 — 노출이 심한 것, 해골 · 악마 같은 어두운 그림은 뺐다.
 *   · 랩 · 힙합 모음집은 「힙합」 카테고리에 따로 모았다 — 가사에 영어 욕설이 섞일 수 있어 키즈 · 여성부 수업 때는 그 칩을 빼고 튼다.
 *   · 2026-11-12 2차 — 대표님이 보내 주신 유튜브 추천 화면 3장(36개) "이 채널에 있는 음악들 모두 집어넣어" → 30편 추가.
 *     뺀 것: 퍼가기가 막힌 2편(우쭈 「쇠질하다 덤벨 던져버려도 난 몰라」 · Grind Vibe 「듣는 순간 도파민 폭발」),
 *     운동 음악이 아닌 3개(동요 자동 믹스 · 크리스마스 재즈 · 재즈 힙합), 30분이 안 되는 1편(ADRENALINE GYM MUSIC 22분).
 *   · 느린 것(요가 · 걷기 · 칠 · 딥하우스)은 넣지 않는다 — 에너지 있는 운동 음악만.
 *   · 바꾸려면 이 파일만 고치면 된다 — 유튜브 id(11자) · 제목 · 올린 곳 · 카테고리 · 길이(분).
 *     시험(gymMusicQueue.test)이 30분 이상 · id 형식 · 중복을 본다.
 *   · 제목은 짧게(휴대폰 한 줄 — 한글 12자 안팎). 길이는 화면이 `m` 으로 따로 보여 주니 제목에 넣지 않는다.
 *   · 새 모음집은 채널 페이지(/@채널/videos · /@채널/search?query=)에서 찾는다(길이 · 조회수가 같이 보인다).
 *     유튜브 전체 검색 페이지(/results)는 robots.txt 가 막는 경로라 쓰지 않는다.
 *
 * 영상 위치 확인: https://www.youtube.com/watch?v=<id>
 */

export type GymMusicCat = "box" | "hiphop" | "edm" | "bass" | "cardio" | "rock" | "pop";

export interface GymTrack {
  /** 유튜브 영상 id */
  id: string;
  /** 모음집 제목 */
  t: string;
  /** 올린 곳(레이블 · 채널) — 같은 곳이 연달아 나오지 않게 섞는 데도 쓴다 */
  a: string;
  /** 카테고리 */
  c: GymMusicCat;
  /** 길이(분) — 30 이상 */
  m: number;
}

export const GYM_MUSIC_CATS: { key: GymMusicCat; label: string; title: string; sub: string }[] = [
  { key: "box", label: "복싱", title: "복싱 · 킥복싱 믹스", sub: "복싱 · 킥복싱 수업용 논스톱 믹스 · 줄넘기" },
  { key: "hiphop", label: "힙합", title: "힙합 · 랩 워크아웃", sub: "랩 · 외힙 · R&B — 키즈 수업 땐 빼고 트세요" },
  { key: "edm", label: "EDM", title: "EDM 하이에너지", sub: "워크아웃 · 클럽 믹스 — 쉬지 않고 달리게" },
  { key: "bass", label: "베이스", title: "베이스 · 트랩 · 드럼앤베이스", sub: "묵직한 드롭 — 샌드백 · 미트 라운드" },
  { key: "cardio", label: "논스톱", title: "논스톱 유산소 리믹스", sub: "130~180 BPM 한 박자로 끝까지 — 서킷 · 체력 훈련" },
  { key: "rock", label: "록", title: "록 · 메탈", sub: "기타 리프로 밀어붙이는 라운드" },
  { key: "pop", label: "팝", title: "신나는 팝 · K-POP", sub: "케이팝 · 팝 — 가볍고 신나게, 몸 풀 때" },
];

/** 길이 글 — 59 → '59분' · 60 → '1시간' · 95 → '1시간 35분' */
export const gymMixLength = (m: number): string => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}분`;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
};

export const GYM_MUSIC: GymTrack[] = [
  // ── 복싱 · 킥복싱 믹스 (20) ──
  { id: "Il28QGNJ9iY", t: "복싱 비트 믹스 2021", a: "Spinnin' Records", c: "box", m: 53 },
  { id: "_6Y3fWO1YEI", t: "카디오 복싱 · 135-145 BPM", a: "Power Music", c: "box", m: 59 },
  { id: "hbOkKuELPjA", t: "킥복싱 32카운트 Vol.2", a: "Power Music", c: "box", m: 59 },
  { id: "-MsTn5Uarc8", t: "킥복싱 2021 · 140 BPM", a: "Hard EDM Workout", c: "box", m: 61 },
  { id: "Hj-EAysCb8Y", t: "킥복싱 2020 · 140 BPM", a: "Hard EDM Workout", c: "box", m: 59 },
  { id: "nCN-s7wzaYk", t: "킥복싱 2019 · 140 BPM", a: "Hard EDM Workout", c: "box", m: 59 },
  { id: "zzXjW4wO3x0", t: "킥복싱 2022 · 140 BPM", a: "Hard EDM Workout", c: "box", m: 59 },
  { id: "s690yG0JrYY", t: "킥복싱 2024 · 140 BPM", a: "Hard EDM Workout", c: "box", m: 60 },
  { id: "jHKVV4v8-DY", t: "킥복싱 스프링 히트 2024", a: "Workout Music Archive", c: "box", m: 59 },
  { id: "1fgV5zffvmU", t: "빅 킥복싱 히트 2024", a: "Workout Music Archive", c: "box", m: 60 },
  { id: "HKMYwzkvXV8", t: "울트라믹스 킥복싱 2025", a: "Workout Music Archive", c: "box", m: 60 },
  { id: "BBzM0AT0pPo", t: "아이언 킥복싱 2025", a: "Workout Music Archive", c: "box", m: 59 },
  { id: "idsvAF5y6C8", t: "킥복싱 머스트 해브 2025", a: "Workout Music Archive", c: "box", m: 60 },
  { id: "tvswRmPI7_E", t: "줄넘기 60분 · 130 BPM", a: "Hard EDM Workout", c: "box", m: 60 },
  { id: "2DhPH6YorU8", t: "줄넘기 2026 · 130 BPM", a: "Hard EDM Workout", c: "box", m: 60 },
  // 11-12 대표님이 보내 주신 화면에서
  { id: "IXZARIeR_lg", t: "타이슨 LEGEND CODE", a: "Elite Boxing", c: "box", m: 75 },
  { id: "gVcoHht8UHI", t: "나 지금 타이슨인데", a: "라이스뮤직", c: "box", m: 57 },
  { id: "ee2RG3fILbA", t: "복싱 플레이리스트 20곡", a: "비트 인 더 링", c: "box", m: 152 },
  { id: "ELfU-gZIS2c", t: "김득구 · 복싱 음악", a: "Elite Boxing", c: "box", m: 131 },
  { id: "3D0bNynJR_E", t: "복싱 트레이닝 BGM 2026", a: "Elite Boxing", c: "box", m: 79 },

  // ── 힙합 · 랩 워크아웃 (8) ── 11-12 대표님이 보내 주신 화면에서
  { id: "AaBysEN3F2Q", t: "복싱할 때 트는 힙합", a: "PULSE LAB", c: "hiphop", m: 126 },
  { id: "owX6p7UB4dg", t: "워크아웃 힙합 2시간", a: "PULSE LAB", c: "hiphop", m: 122 },
  { id: "VizX31aDwcI", t: "비스트 모드 랩 믹스", a: "Hip Drop", c: "hiphop", m: 61 },
  { id: "gAl7_hFHt2k", t: "박재훈 올라잇 플리", a: "쇠맛플레이", c: "hiphop", m: 70 },
  { id: "7qgL1QZDQDk", t: "겁먹을 시간에 한 번 더", a: "Tetoply", c: "hiphop", m: 85 },
  { id: "4Gs_eIjjR2A", t: "코치쌤 체육관 플리", a: "perli", c: "hiphop", m: 220 },
  { id: "s167MHQv9o4", t: "주인공 힙합 · R&B", a: "KKIPOP", c: "hiphop", m: 87 },
  { id: "DqsaSoy7cUI", t: "테토남 · 멈추지 않는다", a: "POMADE", c: "hiphop", m: 78 },

  // ── EDM 하이에너지 (34) ──
  { id: "T4N2DtBTfoA", t: "하이 인텐시티 워크아웃", a: "Spinnin' Records", c: "edm", m: 59 },
  { id: "iQyO6hb6zkc", t: "HIIT 트레이닝 믹스", a: "Spinnin' Records", c: "edm", m: 60 },
  { id: "XSNbAwGDC_o", t: "맥시멈 에너지 믹스", a: "Spinnin' Records", c: "edm", m: 56 },
  { id: "JMDucgAu4MM", t: "퓨처 레이브 워크아웃", a: "Spinnin' Records", c: "edm", m: 60 },
  { id: "FWilUwLjSQg", t: "워크아웃 믹스 2024", a: "Spinnin' Records", c: "edm", m: 59 },
  { id: "Yir4WyDi8rU", t: "러닝 믹스 · 135-160 BPM", a: "Spinnin' Records", c: "edm", m: 60 },
  { id: "9GGv9itgzyI", t: "2025 베스트 연말 믹스", a: "Spinnin' Records", c: "edm", m: 86 },
  { id: "MEkaqZecpUQ", t: "EDM 1시간 믹스", a: "NCS", c: "edm", m: 61 },
  { id: "JNl1_hRwpXE", t: "구독자 3천만 기념 믹스", a: "NCS", c: "edm", m: 95 },
  { id: "yUXJjIvhZz8", t: "NCS 10주년 믹스", a: "NCS", c: "edm", m: 180 },
  { id: "NLmt9yrqb0w", t: "100억 뷰 기념 믹스", a: "NCS", c: "edm", m: 39 },
  { id: "KgO96U9HWl8", t: "NCS 13주년 믹스", a: "NCS", c: "edm", m: 59 },
  { id: "34iRPHalw68", t: "베스트 일렉트로닉 믹스", a: "NCS", c: "edm", m: 50 },
  { id: "BLO6LRPMUp8", t: "베스트 하우스 믹스", a: "NCS", c: "edm", m: 46 },
  { id: "Ncu0A9dtieU", t: "EDM 워크아웃 모티베이션", a: "Epidemic Electronic", c: "edm", m: 92 },
  { id: "ruTxmi65snM", t: "하드 일렉트로닉 워크아웃", a: "Epidemic Electronic", c: "edm", m: 59 },
  { id: "-zYGbwg7E6E", t: "고강도 트레이닝 일렉트로닉", a: "Epidemic Electronic", c: "edm", m: 61 },
  { id: "w-NFZ8LYiy8", t: "더 짐 비츠 Vol.4 메가믹스", a: "The Gym Beats", c: "edm", m: 59 },
  { id: "hw-xiFZiMb8", t: "더 짐 비츠 Vol.4.3 숏컷", a: "The Gym Beats", c: "edm", m: 30 },
  { id: "hAS6XNfI8EM", t: "더 짐 비츠 Vol.5 메가믹스", a: "The Gym Beats", c: "edm", m: 60 },
  { id: "qnZ5gHAXIk0", t: "더 짐 비츠 Vol.4.2", a: "The Gym Beats", c: "edm", m: 54 },
  { id: "xETEYG-az9E", t: "프로그레시브 하우스 1", a: "Proximity", c: "edm", m: 54 },
  { id: "OVlayZ2LVYE", t: "프로그레시브 하우스 2", a: "Proximity", c: "edm", m: 56 },
  // 11-12 대표님이 보내 주신 화면에서
  { id: "izT3D7jxZVw", t: "EDM 워크아웃 믹스 2026", a: "GRIDFIT", c: "edm", m: 58 },
  { id: "nwJvgdx1Vhs", t: "하이록스 EDM Vol.10", a: "PULSE LAB", c: "edm", m: 123 },
  { id: "-nw8AdClFQc", t: "피트니스 EDM 2026", a: "Endurance Beats", c: "edm", m: 183 },
  { id: "AD7Mq3xLooE", t: "워크아웃 뮤직 2026", a: "Endurance Beats", c: "edm", m: 129 },
  { id: "tqSM2lY1-Yc", t: "각성모드 200% 클럽 EDM", a: "DJ Corgi", c: "edm", m: 99 },
  { id: "8zhw8doACik", t: "2026 클럽 유행곡 믹스", a: "ASTER MUSIC", c: "edm", m: 33 },
  { id: "x0fraF20mRE", t: "2025 클럽 연말정산 믹스", a: "ASTER MUSIC", c: "edm", m: 70 },
  { id: "dnRBwERSXXw", t: "홍대 축제 DJ 세트 2026", a: "ASTER MUSIC", c: "edm", m: 63 },
  { id: "RYlkvj8lycE", t: "레드라인 도미넌스", a: "Motivation BPM", c: "edm", m: 52 },
  { id: "M64KU_XVKoA", t: "YOU VS YOU 짐 모티베이션", a: "Gorilla Workout", c: "edm", m: 45 },
  { id: "YQFuGy7L0jc", t: "짐 모티베이션 송 2026", a: "PULSE REP", c: "edm", m: 37 },

  // ── 베이스 · 트랩 · 드럼앤베이스 (15) ──
  { id: "WFL__hxlfWw", t: "하디스트 히터스 믹스", a: "Trap Nation", c: "bass", m: 60 },
  { id: "ObIdQa8waAU", t: "게이밍 뮤직 믹스 2020", a: "Trap Nation", c: "bass", m: 154 },
  { id: "SsQCkHcEmjU", t: "2021 베스트 트랩", a: "Trap Nation", c: "bass", m: 129 },
  { id: "RSzITs9f-SY", t: "트랩 네이션 베스트 2018", a: "Trap Nation", c: "bass", m: 59 },
  { id: "qkojd3DmyvE", t: "파워풀 트랩 믹스 2022", a: "Trap City", c: "bass", m: 60 },
  { id: "abhfer_BNoQ", t: "베스트 드럼앤베이스 2025", a: "UKF Drum & Bass", c: "bass", m: 62 },
  { id: "cCtoa1U_1DE", t: "베스트 드럼앤베이스 2024", a: "UKF Drum & Bass", c: "bass", m: 60 },
  { id: "LeMk0yiSoq4", t: "베스트 드럼앤베이스 2023", a: "UKF Drum & Bass", c: "bass", m: 77 },
  { id: "m5J1HWZ4csU", t: "베스트 드럼앤베이스 2021", a: "UKF Drum & Bass", c: "bass", m: 61 },
  { id: "T__q1htHmN4", t: "베스트 덥스텝 믹스", a: "NCS", c: "bass", m: 43 },
  { id: "g9DiRMGOQVM", t: "베스트 트랩 믹스", a: "Monstercat", c: "bass", m: 38 },
  { id: "JVYDN3PmOG4", t: "몬스터캣 베스트 2025", a: "Monstercat", c: "bass", m: 94 },
  { id: "yrcOLbBjJS0", t: "몬스터캣 베스트 2024", a: "Monstercat", c: "bass", m: 93 },
  { id: "qKtY7_GYBOk", t: "몬스터캣 베스트 2023", a: "Monstercat", c: "bass", m: 91 },
  // 11-12 대표님이 보내 주신 화면에서
  { id: "oNretrfa93k", t: "아이언 마인드 · 하드스타일", a: "Relentless Rise", c: "bass", m: 36 },

  // ── 논스톱 유산소 리믹스 (21) ──
  { id: "WDpGMsuQPWc", t: "올 카디오 · 140-150 BPM", a: "Power Music", c: "cardio", m: 60 },
  { id: "9dH2DYjf8uQ", t: "익스트림 카디오 믹스", a: "Power Music", c: "cardio", m: 60 },
  { id: "AnFOm96Y2C0", t: "익스트림 카디오 믹스 3", a: "Power Music", c: "cardio", m: 59 },
  { id: "Oi6heJwXw8I", t: "익스트림 카디오 믹스 36", a: "Power Music", c: "cardio", m: 60 },
  { id: "fycz410ewj8", t: "카디오 블라스트 믹스", a: "Power Music", c: "cardio", m: 60 },
  { id: "Mnl2T-SNysc", t: "EDM 워크아웃 · 132 BPM", a: "Power Music", c: "cardio", m: 60 },
  { id: "8z6GKCwHZuE", t: "러닝 믹스 Vol.2 · 180 BPM", a: "Power Music", c: "cardio", m: 60 },
  { id: "xBJIUpZeW5o", t: "런 투 더 비트 2 · 160 BPM", a: "Power Music", c: "cardio", m: 58 },
  { id: "EJuFbdAwORU", t: "톱 40 히트 리믹스 4", a: "Power Music", c: "cardio", m: 60 },
  { id: "E__QbnBbUdI", t: "하드코어 워크아웃 Vol.12", a: "Power Music", c: "cardio", m: 87 },
  { id: "TAqfqs0sFHE", t: "워크아웃 모티베이션 2026", a: "Power Music", c: "cardio", m: 90 },
  { id: "waDogrZs-pE", t: "논스톱 모티베이션 2026", a: "Power Music", c: "cardio", m: 60 },
  { id: "xq0D9yY_Rp0", t: "워크아웃 믹스 · 150 BPM", a: "Hard EDM Workout", c: "cardio", m: 59 },
  { id: "n9JoOpshkSU", t: "HIIT 파워 앤섬 · 155 BPM", a: "Hard EDM Workout", c: "cardio", m: 59 },
  { id: "E7ipkHQm8os", t: "에어로빅 익스트림 2025", a: "Hard EDM Workout", c: "cardio", m: 60 },
  { id: "Bx2TG99pNVo", t: "러닝 60분 · 150 BPM", a: "Hard EDM Workout", c: "cardio", m: 58 },
  { id: "1GntgYdEUYU", t: "러닝 60분 · 180 BPM", a: "Hard EDM Workout", c: "cardio", m: 58 },
  { id: "DUAsYs-9szg", t: "팻 버닝 2024 · 150 BPM", a: "Hard EDM Workout", c: "cardio", m: 60 },
  { id: "8EI5lOAJIDk", t: "1억 뷰 기념 스페셜", a: "Hard EDM Workout", c: "cardio", m: 60 },
  // 11-12 대표님이 보내 주신 화면에서
  { id: "pFc7rpqUg9s", t: "러닝 뮤직 2026 · 아침 햇살", a: "Endurance Beats", c: "cardio", m: 84 },
  { id: "MCoRcDdSW20", t: "175~185 BPM 케이던스", a: "달리런", c: "cardio", m: 202 },

  // ── 록 · 메탈 (9) ──
  { id: "dVg0d4z2uss", t: "록 워크아웃 · 러닝", a: "Epidemic Rock", c: "rock", m: 60 },
  { id: "PsY8dD90Luw", t: "하드 록 워크아웃", a: "Epidemic Rock", c: "rock", m: 60 },
  { id: "ecZnud07afI", t: "헤비메탈 · 하드 록", a: "Epidemic Rock", c: "rock", m: 59 },
  { id: "ZqfM3UunPd8", t: "메탈 워크아웃", a: "Epidemic Rock", c: "rock", m: 58 },
  { id: "PXH5xHJQVNw", t: "하드 록 — Rock This Way", a: "Epidemic Rock", c: "rock", m: 65 },
  { id: "SEeCK2TLoSk", t: "얼터너티브 록 · 기타 속주", a: "Epidemic Rock", c: "rock", m: 61 },
  { id: "Rq4tB9nd7Sk", t: "록 워크아웃 30분", a: "Epidemic Rock", c: "rock", m: 31 },
  { id: "1T2uOnmvoMc", t: "어그레시브 메탈 믹스", a: "Alec Koff", c: "rock", m: 60 },
  // 11-12 대표님이 보내 주신 화면에서
  { id: "GTzsi2ti1_A", t: "언스토퍼블 · 랩 록", a: "riffdose", c: "rock", m: 49 },

  // ── 신나는 팝 · K-POP (15) ──
  { id: "d8OL6m0ZblA", t: "팝 워크아웃 송", a: "Epidemic Pop", c: "pop", m: 61 },
  { id: "hcysu-opqng", t: "팝 워크아웃 믹스", a: "Epidemic Pop", c: "pop", m: 62 },
  { id: "p7gqjZY0jis", t: "팝 워크아웃 뮤직", a: "Epidemic Pop", c: "pop", m: 62 },
  { id: "sd9Z_kyJOo4", t: "팝 워크아웃 · 근력 · 러닝", a: "Epidemic Pop", c: "pop", m: 61 },
  { id: "Und8bE0LOVc", t: "팝 짐 모티베이션", a: "Epidemic Pop", c: "pop", m: 91 },
  { id: "8ssfXnNgCuo", t: "빠른 팝 댄스", a: "Epidemic Pop", c: "pop", m: 63 },
  { id: "F6MI5hkLNEk", t: "신나는 헬스장 음악", a: "SomiFit", c: "pop", m: 92 },
  { id: "LyOifTAWAeE", t: "비트 믹스 · EDM · 바운스", a: "SomiFit", c: "pop", m: 91 },
  { id: "5MACh6ylf8g", t: "레전드 운동 음악 모음", a: "핏블리 FITVELY", c: "pop", m: 68 },
  { id: "_0pyGclSurg", t: "인생 운동 음악 베스트", a: "핏블리 FITVELY", c: "pop", m: 54 },
  { id: "3eWN4Ebl83E", t: "베스트 워크아웃 뮤직", a: "핏블리 FITVELY", c: "pop", m: 55 },
  { id: "f35UnFaFWVo", t: "운동할 때 듣는 신나는 음악", a: "미러볼 뮤직", c: "pop", m: 58 },
  { id: "SYuGMOv6Zpg", t: "텐션 올리는 일렉트로닉", a: "미러볼 뮤직", c: "pop", m: 50 },
  // 11-12 대표님이 보내 주신 화면에서
  { id: "pxv7TVmtDeg", t: "1세대 걸그룹 빅매치", a: "오늘도 컴백", c: "pop", m: 174 },
  { id: "qrgD7mKdlSg", t: "케이팝 러닝 · 전투력MAX", a: "폴스폴름", c: "pop", m: 52 },
];
