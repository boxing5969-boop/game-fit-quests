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
 *   · 2026-11-12 3차 — "캡처해 준 채널들 안에 인기 음악 모음 1위부터 5위까지 모두 집어넣자" → 그 채널 25곳의 인기순 목록에서
 *     30분 넘는 운동 모음집 1~5위를 넣었다(95편 추가). 1~5위 중 못 넣는 것은 그 채널 10위 안에서 다음 순위로 채웠다 —
 *     퍼가기 막힘(Grind Vibe 1·2·4·5·6위, 우쭈 1위) · 표지에 가리지 않은 욕설 글자(쇠맛플레이) · 담배 피우는 그림(Tetoply) ·
 *     악마 · 지옥 그림(riffdose) · 수영복 · 속옷 노출 · 저승(VALHALLA) 그림 · 원래 제목에 욕설(플레이어 위에 잠깐 보인다) · 발라드 모음.
 *     동요 · 재즈 채널은 넣지 않았다. KKIPOP 은 모음집이 1편뿐이다.
 *   · 2026-11-12 4차 — "방금 채널에 있는 최신이면서 인기 있는 목록 추가하자" → 같은 채널들의 최신 업로드(동영상만 · 최신순 목록)에서
 *     최근 2개월(유튜브 '2개월 전'까지) · 30분 넘는 운동 모음집 · 조회수 1천 이상을 조회수 순으로 채널마다 최대 5편(71편 추가).
 *     같은 기준으로 뺐다 — 표지 욕설(쇠맛플레이) · 담배/피 묻은 그림(Tetoply) · 악마 같은 붉은 가면(perli) · 총 겨누는 그림(POMADE) ·
 *     악마/지옥 그림(riffdose) · 노출 · 발라드/보컬 모음 · 퍼가기 막힘. 최근 2개월에 30분 넘는 새 모음집이 없거나 조회 1천이 안 되는
 *     채널(Elite Boxing · 비트 인 더 링 · PULSE LAB · ASTER MUSIC · KKIPOP · 우쭈 · ADRENALINE GYM MUSIC)은 이번에 더한 것이 없다.
 *   · 느린 것(요가 · 걷기 · 칠 · 딥하우스)은 넣지 않는다 — 에너지 있는 운동 음악만.
 *   · 바꾸려면 이 파일만 고치면 된다 — 유튜브 id(11자) · 제목 · 올린 곳 · 카테고리 · 길이(분).
 *     시험(gymMusicQueue.test)이 30분 이상 · id 형식 · 중복을 본다.
 *   · 제목은 짧게(휴대폰 한 줄 — 한글 12자 안팎). 길이는 화면이 `m` 으로 따로 보여 주니 제목에 넣지 않는다.
 *   · 새 모음집은 채널 페이지(/@채널/videos · /@채널/search?query=)에서 찾는다(길이 · 조회수가 같이 보인다).
 *     채널 인기순은 /playlist?list=UULP<채널 id(UC…)에서 UC 뒤 22자> — 유튜브가 만든 '인기 동영상' 목록(쇼츠 제외)이다.
 *     최신순은 /playlist?list=UULF<같은 22자> — '동영상'만(쇼츠 · 라이브 제외) 최신순 100편, 조회수와 올린 지 얼마인지가 같이 나온다.
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
  // ── 복싱 · 킥복싱 믹스 (26) ──
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
  // 11-12 3차 — 대표님이 캡처한 채널의 인기 모음집 1~5위
  { id: "wuimihotpDs", t: "카넬로 · 복싱 BGM", a: "Elite Boxing", c: "box", m: 77 },
  { id: "8ZUKAG8BgfA", t: "복싱 짐 BGM 논스톱", a: "Elite Boxing", c: "box", m: 151 },
  { id: "KdJXFYSj2os", t: "무하마드 알리 · 펑크 소울", a: "Elite Boxing", c: "box", m: 82 },
  { id: "hZJlBu3-HMM", t: "펀치 속도 2배 복싱 플리", a: "비트 인 더 링", c: "box", m: 132 },
  { id: "S_Kb--C578M", t: "운동러 복싱 20곡", a: "비트 인 더 링", c: "box", m: 69 },
  { id: "JyWAC0YWkKM", t: "광고 없는 짐 워크아웃", a: "비트 인 더 링", c: "box", m: 125 },

  // ── 힙합 · 랩 워크아웃 (81) ──
  // 11-12 대표님이 보내 주신 화면에서
  { id: "AaBysEN3F2Q", t: "복싱할 때 트는 힙합", a: "PULSE LAB", c: "hiphop", m: 126 },
  { id: "owX6p7UB4dg", t: "워크아웃 힙합 2시간", a: "PULSE LAB", c: "hiphop", m: 122 },
  { id: "VizX31aDwcI", t: "비스트 모드 랩 믹스", a: "Hip Drop", c: "hiphop", m: 61 },
  { id: "gAl7_hFHt2k", t: "박재훈 올라잇 플리", a: "쇠맛플레이", c: "hiphop", m: 70 },
  { id: "7qgL1QZDQDk", t: "겁먹을 시간에 한 번 더", a: "Tetoply", c: "hiphop", m: 85 },
  { id: "4Gs_eIjjR2A", t: "코치쌤 체육관 플리", a: "perli", c: "hiphop", m: 220 },
  { id: "s167MHQv9o4", t: "주인공 힙합 · R&B", a: "KKIPOP", c: "hiphop", m: 87 },
  { id: "DqsaSoy7cUI", t: "테토남 · 멈추지 않는다", a: "POMADE", c: "hiphop", m: 78 },
  // 11-12 3차 — 대표님이 캡처한 채널의 인기 모음집 1~5위
  { id: "BSHzFhortwE", t: "운동하기 싫은 날 플리", a: "라이스뮤직", c: "hiphop", m: 59 },
  { id: "2LjVbL04V1E", t: "파이팅 넣어 주는 힙합", a: "라이스뮤직", c: "hiphop", m: 89 },
  { id: "PVhiaQbxhk8", t: "헤비급 스파링 힙합", a: "라이스뮤직", c: "hiphop", m: 66 },
  { id: "dkiodZEATqU", t: "지치지 않는 힙합 트랩", a: "라이스뮤직", c: "hiphop", m: 76 },
  { id: "e_--EmZfnXw", t: "복싱 훈련 강렬한 힙합", a: "비트 인 더 링", c: "hiphop", m: 119 },
  { id: "UFy66MX4Y8A", t: "복싱 · 운동 텐션 힙합", a: "PULSE LAB", c: "hiphop", m: 128 },
  { id: "mF4KWf4Kc1k", t: "비스트 모드 · 스파르탄", a: "Hip Drop", c: "hiphop", m: 61 },
  { id: "qcalRy-jcyo", t: "비스트 모드 · 노 페인", a: "Hip Drop", c: "hiphop", m: 60 },
  { id: "pPzlxwx_SCA", t: "비스트 모드 · 언브로큰", a: "Hip Drop", c: "hiphop", m: 60 },
  { id: "ZIEqGHdyMdU", t: "비스트 모드 · 라이즈 업", a: "Hip Drop", c: "hiphop", m: 59 },
  { id: "N2WZgQ-2hQI", t: "비스트 모드 · 스트롱", a: "Hip Drop", c: "hiphop", m: 56 },
  { id: "iytSjCJAReA", t: "10개라도 한 너, 대단해", a: "쇠맛플레이", c: "hiphop", m: 77 },
  { id: "LCl_VS2nSVA", t: "이거 틀고 중량 올려", a: "쇠맛플레이", c: "hiphop", m: 89 },
  { id: "VNARCjXr3SU", t: "무게 앞에 변명은 없다", a: "쇠맛플레이", c: "hiphop", m: 66 },
  { id: "EskhY5ajLxA", t: "중량 전에 텐션부터", a: "쇠맛플레이", c: "hiphop", m: 63 },
  { id: "HzdFkupzuiY", t: "하루 종일 할 수 있어", a: "Tetoply", c: "hiphop", m: 77 },
  { id: "NoK4vyOuG9Q", t: "정상에 서려는 거지", a: "Tetoply", c: "hiphop", m: 62 },
  { id: "7FBGJf4S6TM", t: "나약함은 강함에 죽었다", a: "Tetoply", c: "hiphop", m: 71 },
  { id: "E7iKn8XIzqo", t: "그 정도론 부족할 텐데", a: "Tetoply", c: "hiphop", m: 67 },
  { id: "wVu_JIAjvxw", t: "피티쌤 쌈뽕 플리 2", a: "perli", c: "hiphop", m: 156 },
  { id: "kAQ0b2BWPWQ", t: "피티쌤 쌈뽕 플리", a: "perli", c: "hiphop", m: 65 },
  { id: "LUPt5BvDp8Y", t: "헬스장 힙디엠 노동요", a: "perli", c: "hiphop", m: 624 },
  { id: "BbFn54gEOuU", t: "테토남 · 박살 내기로", a: "POMADE", c: "hiphop", m: 88 },
  { id: "L_o2u1Dx4zs", t: "테토남 · 전투를 위한 차", a: "POMADE", c: "hiphop", m: 75 },
  { id: "lUm8FLKaDGo", t: "테토남 · 지는 게 무섭다", a: "POMADE", c: "hiphop", m: 75 },
  { id: "Kl7QDFdV3NQ", t: "테토남 · 외로움을 들고", a: "POMADE", c: "hiphop", m: 83 },
  { id: "OtHZgvobP1o", t: "하드 랩 · 노 페인", a: "Gorilla Workout", c: "hiphop", m: 30 },
  { id: "gZWRKo5aXlg", t: "어그레시브 랩 플리", a: "Gorilla Workout", c: "hiphop", m: 30 },
  { id: "VLnNLqITHQA", t: "하드 랩 · 페인 이즈 퓨얼", a: "Gorilla Workout", c: "hiphop", m: 30 },
  { id: "yclrH590JLs", t: "랩 · 힙합 짐 모티베이션", a: "PULSE REP", c: "hiphop", m: 32 },
  { id: "kXX4fQ4tE5s", t: "아이언 마인드셋", a: "Relentless Rise", c: "hiphop", m: 47 },
  { id: "QY7-66VTE8M", t: "아이언 멘탈리티", a: "Relentless Rise", c: "hiphop", m: 39 },
  { id: "SMt-TG77Gv4", t: "비트 빵빵 도파민 플리", a: "Grind Vibe", c: "hiphop", m: 125 },
  { id: "h-Bp4Fu-_30", t: "주인장 최애곡 모음", a: "Grind Vibe", c: "hiphop", m: 86 },
  { id: "p9u4AzlSvrw", t: "퇴근 후 러닝 플리", a: "Grind Vibe", c: "hiphop", m: 83 },
  { id: "gw0XqojnAcI", t: "귀로 듣는 천연 부스터", a: "우쭈", c: "hiphop", m: 61 },
  { id: "3lhAp9PtpPA", t: "쇠질 조지기 · 1만 기념", a: "우쭈", c: "hiphop", m: 121 },
  { id: "v-PNsB0-A5k", t: "무슨 일이 있어도 2개 더", a: "우쭈", c: "hiphop", m: 55 },
  { id: "Lgh8Ji3ST3k", t: "어서 쇠질하러 가야지", a: "우쭈", c: "hiphop", m: 58 },
  { id: "EbbNknaL1e8", t: "쇠질용 부스터 플리", a: "우쭈", c: "hiphop", m: 62 },
  { id: "F1BborLDQG4", t: "베이스 파이트 모드 · 랩", a: "Adrenaline Gym", c: "hiphop", m: 30 },
  { id: "-l_hD8FUn0g", t: "아드레날린 짐 뮤직", a: "Adrenaline Gym", c: "hiphop", m: 30 },
  { id: "gm6Sgz2bLfE", t: "파워 언더 프레셔", a: "Adrenaline Gym", c: "hiphop", m: 30 },
  { id: "cu7FhPvU9LU", t: "짐 파이트 모드 · 힙합", a: "Adrenaline Gym", c: "hiphop", m: 32 },
  { id: "myGZn68HLQw", t: "아드레날린 짐 뮤직 2", a: "Adrenaline Gym", c: "hiphop", m: 30 },
  // 11-12 4차 — 같은 채널의 최신 인기 모음집(최근 2개월 · 조회수 순)
  { id: "g1uCPn_BIjs", t: "집중력 끌어올리는 힙합", a: "라이스뮤직", c: "hiphop", m: 107 },
  { id: "PvdPVYi54MQ", t: "한 라운드 더 때려", a: "라이스뮤직", c: "hiphop", m: 50 },
  { id: "-LLzWLm4fKQ", t: "몸부터 움직이는 힙합", a: "라이스뮤직", c: "hiphop", m: 53 },
  { id: "cuEf-hG6gkY", t: "어깨 펴지는 힙합 플리", a: "라이스뮤직", c: "hiphop", m: 65 },
  { id: "8ueQlRdeZDE", t: "타이슨 퓨리 플리", a: "라이스뮤직", c: "hiphop", m: 79 },
  { id: "oGIaOnIE1zs", t: "비스트 모드 · 언브로큰 2", a: "Hip Drop", c: "hiphop", m: 60 },
  { id: "4clJIJ-QFNk", t: "비스트 모드 · 워크 하드", a: "Hip Drop", c: "hiphop", m: 61 },
  { id: "QzRrTQq5e30", t: "비스트 모드 · 노 위크니스", a: "Hip Drop", c: "hiphop", m: 61 },
  { id: "Q4s8Uq7n7Ew", t: "비스트 모드 · 노 리밋", a: "Hip Drop", c: "hiphop", m: 60 },
  { id: "tddiBS8dUtA", t: "비스트 모드 · 스파르탄 2", a: "Hip Drop", c: "hiphop", m: 61 },
  { id: "IVC3HYTRbJ8", t: "끝까지 나는 전사다", a: "Tetoply", c: "hiphop", m: 70 },
  { id: "-ejCxjLNIUA", t: "오늘의 습관이 내일을", a: "Tetoply", c: "hiphop", m: 66 },
  { id: "iJs5OYQ2C5M", t: "인사 없이 떠날 줄 알았어", a: "Tetoply", c: "hiphop", m: 73 },
  { id: "LDD9N6tXGXk", t: "락에 힙합을 곁들인", a: "Tetoply", c: "hiphop", m: 77 },
  { id: "C6TPLR4NUeY", t: "코치쌤 운동 플리 2탄", a: "perli", c: "hiphop", m: 635 },
  { id: "okxsG9Pank8", t: "테토남 · 미친 것과 바보", a: "POMADE", c: "hiphop", m: 93 },
  { id: "p9TNZ3iA9HY", t: "테토남 · 정신은 무엇이든", a: "POMADE", c: "hiphop", m: 90 },
  { id: "S5z777tKedI", t: "테토남 · 평화의 조건", a: "POMADE", c: "hiphop", m: 86 },
  { id: "OD60ovyqVfY", t: "테토남 · 최악에 대비하라", a: "POMADE", c: "hiphop", m: 90 },
  { id: "oFIb1t-mlBo", t: "테토남 · 네 이름을 남겨라", a: "POMADE", c: "hiphop", m: 86 },
  { id: "QYzFHCzQd8w", t: "언브레이커블 마인드셋 · 랩", a: "PULSE REP", c: "hiphop", m: 32 },
  { id: "soMUSRHbHAE", t: "렐렌틀리스 멘탈리티", a: "Relentless Rise", c: "hiphop", m: 48 },
  { id: "P-mWl2kApsA", t: "노 이지 로드 · 워크아웃 랩", a: "Relentless Rise", c: "hiphop", m: 30 },
  { id: "rUBKQaXCB8s", t: "180 BPM 힙합 드랍", a: "달리런", c: "hiphop", m: 120 },
  { id: "Sx2GV8upjBc", t: "헬스장 접수 완료 플리", a: "Grind Vibe", c: "hiphop", m: 76 },
  { id: "AF64Yj3PSa4", t: "왔다 내 도파민", a: "Grind Vibe", c: "hiphop", m: 73 },
  { id: "LnZOPJjfg3s", t: "빡세게 할 사람만", a: "Grind Vibe", c: "hiphop", m: 79 },
  { id: "M54y9CmQLb8", t: "오늘 운동 제대로 플리", a: "Grind Vibe", c: "hiphop", m: 78 },

  // ── EDM 하이에너지 (78) ──
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
  // 11-12 3차 — 대표님이 캡처한 채널의 인기 모음집 1~5위
  { id: "0CN4llvl5BA", t: "하이록스 EDM 플리", a: "PULSE LAB", c: "edm", m: 125 },
  { id: "gZsK2sDCwqk", t: "텐션 끝까지 EDM", a: "PULSE LAB", c: "edm", m: 121 },
  { id: "gw7vvY_nmXE", t: "2026 클럽 믹스 EDM", a: "perli", c: "edm", m: 433 },
  { id: "PJDZXliTw7Y", t: "노 익스큐즈 EDM", a: "GRIDFIT", c: "edm", m: 64 },
  { id: "GEtIRnoaV84", t: "얼티밋 EDM 워크아웃", a: "GRIDFIT", c: "edm", m: 180 },
  { id: "isentEGc058", t: "레이브 워크아웃", a: "GRIDFIT", c: "edm", m: 121 },
  { id: "aXiXbqgco9s", t: "EDM 아드레날린 레이브", a: "GRIDFIT", c: "edm", m: 63 },
  { id: "CS0OM7u752s", t: "피트니스 모티베이션 EDM", a: "Endurance Beats", c: "edm", m: 68 },
  { id: "51VNBLh5GLk", t: "도파민 터지는 신나는 노래", a: "DJ Corgi", c: "edm", m: 220 },
  { id: "Tr5-cBvP22g", t: "기분전환 EDM 뱅어", a: "DJ Corgi", c: "edm", m: 150 },
  { id: "Md3J10_vtFM", t: "도파민 빵빵 클럽 EDM", a: "DJ Corgi", c: "edm", m: 142 },
  { id: "kfz4srjd_eo", t: "시간 순삭 신나는 노래", a: "DJ Corgi", c: "edm", m: 102 },
  { id: "SyIXnTlLn5E", t: "리듬 타다 뜨거워지는 노래", a: "DJ Corgi", c: "edm", m: 74 },
  { id: "B3GJ3EFSmng", t: "2023 클럽 유행곡 #1", a: "ASTER MUSIC", c: "edm", m: 33 },
  { id: "eQr75KSiMJQ", t: "2022 클럽 페스티벌 믹스", a: "ASTER MUSIC", c: "edm", m: 189 },
  { id: "fjX7Y3DKzAA", t: "2025 강남 클럽 믹스 2", a: "ASTER MUSIC", c: "edm", m: 32 },
  { id: "TxJzr51-27s", t: "2025 클럽 오픈 믹스", a: "ASTER MUSIC", c: "edm", m: 57 },
  { id: "XQWHwAe4dyE", t: "2023 클럽 레전드 총결산", a: "ASTER MUSIC", c: "edm", m: 43 },
  { id: "YXsMNdMaulc", t: "이그니션 오버드라이브", a: "Motivation BPM", c: "edm", m: 55 },
  { id: "YsQYbQHpejs", t: "얼티밋 짐 모티베이션", a: "Gorilla Workout", c: "edm", m: 45 },
  { id: "MNCc-CM2pww", t: "베스트 짐 모티베이션 믹스", a: "PULSE REP", c: "edm", m: 30 },
  { id: "fqnLrpLq4DA", t: "짐 모티베이션 송 믹스", a: "PULSE REP", c: "edm", m: 31 },
  { id: "F7nOih5hJ5k", t: "빌트 프롬 프레셔", a: "PULSE REP", c: "edm", m: 51 },
  // 11-12 4차 — 같은 채널의 최신 인기 모음집(최근 2개월 · 조회수 순)
  { id: "TZut6M191uw", t: "라이브 EDM 세트 #3", a: "perli", c: "edm", m: 330 },
  { id: "aXx2rXueRuo", t: "틀자마자 신나는 클럽 EDM", a: "perli", c: "edm", m: 665 },
  { id: "HsNVuOvdxsg", t: "최신 클럽 EDM 믹스", a: "perli", c: "edm", m: 424 },
  { id: "8khXi7fEceE", t: "풀 스로틀 EDM 카디오", a: "GRIDFIT", c: "edm", m: 122 },
  { id: "KrMzU-mufnU", t: "EDM 애프터번", a: "GRIDFIT", c: "edm", m: 124 },
  { id: "1_p6jeEL8Yc", t: "EDM 파워 러시", a: "GRIDFIT", c: "edm", m: 126 },
  { id: "VWwcx-_DYHU", t: "힛 더 개스 EDM", a: "GRIDFIT", c: "edm", m: 183 },
  { id: "VV12s761Xmo", t: "노 슬로다운 카디오 EDM", a: "GRIDFIT", c: "edm", m: 181 },
  { id: "6i6m6yIYWmc", t: "피트니스 EDM 파워 비트", a: "Endurance Beats", c: "edm", m: 125 },
  { id: "ldSWBMWpGnY", t: "워크아웃 모티베이션 EDM 2", a: "Endurance Beats", c: "edm", m: 183 },
  { id: "Tn_TUrUSz1E", t: "스트레스 삭제 신나는 노래", a: "DJ Corgi", c: "edm", m: 105 },
  { id: "j77a-Kybc68", t: "계속 듣게 되는 신나는 노래", a: "DJ Corgi", c: "edm", m: 158 },
  { id: "sOZl-VE5hQ8", t: "당장 뛰쳐나가고 싶은 노래", a: "DJ Corgi", c: "edm", m: 90 },
  { id: "m6AIVj8aqQ8", t: "기분전환 싹 되는 노래", a: "DJ Corgi", c: "edm", m: 89 },
  { id: "2lDyF5nGw28", t: "스트레스 사라지는 노래", a: "DJ Corgi", c: "edm", m: 209 },
  { id: "hfAQi5SZGXg", t: "아이언 디서플린", a: "PULSE REP", c: "edm", m: 33 },
  { id: "naTyrByG9fc", t: "짐 플레이리스트 믹스", a: "PULSE REP", c: "edm", m: 32 },
  { id: "mG3rfrIXJKE", t: "이너프 이즈 이너프", a: "PULSE REP", c: "edm", m: 32 },
  { id: "jqmx83X438M", t: "하이 에너지 짐 뮤직", a: "PULSE REP", c: "edm", m: 39 },
  { id: "APcDL5QJ6PI", t: "노 리밋 · EDM 앤섬", a: "Relentless Rise", c: "edm", m: 41 },
  { id: "6n0Ry-4rYAs", t: "방구석 클럽 개장", a: "Grind Vibe", c: "edm", m: 71 },

  // ── 베이스 · 트랩 · 드럼앤베이스 (28) ──
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
  // 11-12 3차 — 대표님이 캡처한 채널의 인기 모음집 1~5위
  { id: "cah6ZVjjLLU", t: "아이언 어센트 · 하드 트랩", a: "Motivation BPM", c: "bass", m: 59 },
  { id: "qPG6ynrouWs", t: "언더 프레셔 · 하드 트랩", a: "Motivation BPM", c: "bass", m: 61 },
  { id: "sATvIBMzDlQ", t: "NCS × NEFFEX 짐 믹스", a: "Motivation BPM", c: "bass", m: 44 },
  { id: "qCsPaZJOvZ4", t: "폰크 · 헤비 808", a: "Relentless Rise", c: "bass", m: 36 },
  { id: "O7o26KttK_8", t: "렐렌틀리스 퍼포즈", a: "Relentless Rise", c: "bass", m: 44 },
  // 11-12 4차 — 같은 채널의 최신 인기 모음집(최근 2개월 · 조회수 순)
  { id: "TxQIuKxLJ94", t: "브레이크 더 리밋 · 트랩", a: "Motivation BPM", c: "bass", m: 61 },
  { id: "_UPDbb-zcok", t: "노 페인 노 게인 · 트랩", a: "Gorilla Workout", c: "bass", m: 60 },
  { id: "J8SUw6_BErA", t: "마인드셋 · 트랩", a: "Gorilla Workout", c: "bass", m: 62 },
  { id: "MFLw3025YDM", t: "노 제로 데이즈 · 트랩", a: "Gorilla Workout", c: "bass", m: 60 },
  { id: "H20l120rEOk", t: "리질리언스 · 트랩", a: "Gorilla Workout", c: "bass", m: 60 },
  { id: "B005TPO3Dng", t: "디서플린 · 트랩", a: "Gorilla Workout", c: "bass", m: 60 },
  { id: "HYFJdx9wXfM", t: "본 투 파이트", a: "Relentless Rise", c: "bass", m: 37 },
  { id: "ZDq8r-W7ea4", t: "언스토퍼블 마인드셋", a: "Relentless Rise", c: "bass", m: 32 },

  // ── 논스톱 유산소 리믹스 (34) ──
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
  // 11-12 3차 — 대표님이 캡처한 채널의 인기 모음집 1~5위
  { id: "aeCAJ2mO7ms", t: "러닝 뮤직 · 선라이즈 2", a: "Endurance Beats", c: "cardio", m: 128 },
  { id: "fMnfAwJmgNA", t: "가을 러닝 뮤직", a: "Endurance Beats", c: "cardio", m: 183 },
  { id: "yp_R0ZKc32w", t: "180~190 BPM 케이던스", a: "달리런", c: "cardio", m: 205 },
  { id: "GfIUhPHsQts", t: "180 BPM 커버곡 앵콜", a: "달리런", c: "cardio", m: 234 },
  { id: "FAfRIShAl_8", t: "180~185 BPM 밴드 음악", a: "달리런", c: "cardio", m: 92 },
  { id: "u2eyM-tS6QI", t: "180 BPM 클럽 베이스", a: "달리런", c: "cardio", m: 121 },
  // 11-12 4차 — 같은 채널의 최신 인기 모음집(최근 2개월 · 조회수 순)
  { id: "vqx9W5vDDJk", t: "가을 러닝 뮤직 2", a: "Endurance Beats", c: "cardio", m: 183 },
  { id: "f00kDNSNhhI", t: "러닝 뮤직 · 선라이즈 3", a: "Endurance Beats", c: "cardio", m: 139 },
  { id: "lCZNVqaY0Nw", t: "런 투 유어 드림즈", a: "Endurance Beats", c: "cardio", m: 185 },
  { id: "jsCu1p6TgmU", t: "190 BPM 클럽 폭주 3탄", a: "달리런", c: "cardio", m: 241 },
  { id: "KBDvOpw-eBA", t: "180 BPM 클럽 폭주 2탄", a: "달리런", c: "cardio", m: 123 },
  { id: "eVRAtHUbbug", t: "184 BPM 클럽 폭주 5탄", a: "달리런", c: "cardio", m: 120 },
  { id: "hS9M-jOpChM", t: "180 BPM 팝록 · 클럽 드랍", a: "달리런", c: "cardio", m: 121 },

  // ── 록 · 메탈 (11) ──
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
  // 11-12 3차 — 대표님이 캡처한 채널의 인기 모음집 1~5위
  { id: "CH3GYEUkUiM", t: "스틸 아이 파이트 · 랩 록", a: "riffdose", c: "rock", m: 48 },
  { id: "g-KCFBgJ0gk", t: "다크 스타 · 랩 록", a: "riffdose", c: "rock", m: 49 },

  // ── 신나는 팝 · K-POP (30) ──
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
  // 11-12 3차 — 대표님이 캡처한 채널의 인기 모음집 1~5위
  { id: "zHCXTt9aVAQ", t: "숨듣명 플리", a: "오늘도 컴백", c: "pop", m: 112 },
  { id: "0YTG1PTWwc4", t: "레전드 걸그룹 · 여가수", a: "오늘도 컴백", c: "pop", m: 87 },
  { id: "bdHnMIHbyyY", t: "뽕끼 한 스푼 케이팝", a: "오늘도 컴백", c: "pop", m: 69 },
  { id: "jwxifFlcVGo", t: "숨듣명 플리 2탄", a: "오늘도 컴백", c: "pop", m: 155 },
  { id: "kx7ke8zopxI", t: "비트 맛집 노동요", a: "폴스폴름", c: "pop", m: 242 },
  { id: "R6UJhszHX2U", t: "독기 가득 쇠맛 여돌", a: "폴스폴름", c: "pop", m: 49 },
  { id: "0qcL4m-THDo", t: "마라맛 케이팝 노동요", a: "폴스폴름", c: "pop", m: 61 },
  { id: "OhDpUKAWJaY", t: "독기 폭발 쇠맛 케이팝", a: "폴스폴름", c: "pop", m: 42 },
  // 11-12 4차 — 같은 채널의 최신 인기 모음집(최근 2개월 · 조회수 순)
  { id: "97NDkm6r5Rw", t: "세기말 테크노 댄스곡", a: "오늘도 컴백", c: "pop", m: 81 },
  { id: "8QUGjt73fQE", t: "원더걸스 · 카라 · 소시", a: "오늘도 컴백", c: "pop", m: 192 },
  { id: "eP0EssKcCJw", t: "K-아이돌 밴드 모음", a: "오늘도 컴백", c: "pop", m: 170 },
  { id: "24qca9BWP1g", t: "어깨 들썩이는 믹스셋", a: "폴스폴름", c: "pop", m: 72 },
  { id: "ZvPvgi0usmA", t: "박자 맞춰 뛰는 믹스셋", a: "폴스폴름", c: "pop", m: 56 },
  { id: "PzmPFvf1KUE", t: "전투력 최대치 케이팝", a: "폴스폴름", c: "pop", m: 61 },
  { id: "bPdvD5riyjM", t: "헬스 EDM 띵곡 모음", a: "폴스폴름", c: "pop", m: 67 },
];
