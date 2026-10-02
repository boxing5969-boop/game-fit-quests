/**
 * 🔊 복싱 트레이닝 사운드 엔진 (2026-10-01 스튜디오 음원 개편).
 *
 * 음원은 우리가 직접 작곡·믹싱해 렌더한 파일 (public/assets/minigame/audio, 약 950KB):
 *   · bgm_lobby      — 메뉴·결과 화면 배경 (92 BPM, 8마디 루프)
 *   · bgm_play_*     — 플레이 배경 3스템 (128 BPM, 15초 루프). 셋을 동시에 틀고 강도(1·2·3)에 따라
 *                      볼륨만 섞는다 → 박자가 어긋나지 않고 긴장감이 올라간다
 *   · 효과음 16개     — 타격 3종·퍼펙트·미스·휘두름·가드·벨·카운트다운·환호·팡파르·콤보·탭·클리어·실패
 *
 * 파일을 아직 못 받았거나(첫 터치 직후) 재생이 막힌 기기에서는 예전 합성음으로 대신 낸다 — 소리가 비는 일은 없다.
 * 공개 API 는 게임 엔진들이 쓰던 그대로 (punch · perfectHit · miss · bell · beep · cheer · fanfare ·
 * startBgm · setBgmIntensity · stopBgm · setEnabled · isEnabled) + 새로 tap · whoosh · block · combo ·
 * roundClear · fail · startLobby · stopLobby · preload.
 */

type SfxName =
  | 'punch_1' | 'punch_2' | 'punch_3' | 'perfect' | 'miss' | 'whoosh' | 'block' | 'bell'
  | 'beep_low' | 'beep_high' | 'cheer' | 'fanfare' | 'combo' | 'tap' | 'round_clear' | 'fail';

type MusicName = 'bgm_lobby' | 'bgm_play_base' | 'bgm_play_mid' | 'bgm_play_top';

const AUDIO_BASE = '/assets/minigame/audio';
const AUDIO_VERSION = 1;

/** 루프 길이(초) — 마디 수 × 박자 (manifest.json 과 같은 값, 서버 요청 없이 쓰려고 적어 둔다) */
const LOOP_SECONDS: Record<MusicName, number> = {
  bgm_lobby: 8 * 4 * 60 / 92,
  bgm_play_base: 15,
  bgm_play_mid: 15,
  bgm_play_top: 15,
};
/** MP3 앞머리(인코더 지연 576 + 디코더 529 샘플) — 갭리스 정보를 안 읽는 디코더용 */
const MP3_LEAD_IN_SEC = 1105 / 44100;
/** 음원 받기에 실패하면 이 시간 동안은 같은 파일을 다시 요청하지 않는다 */
const LOAD_RETRY_AFTER_MS = 15_000;

const SFX_NAMES: SfxName[] = [
  'punch_1', 'punch_2', 'punch_3', 'perfect', 'miss', 'whoosh', 'block', 'bell',
  'beep_low', 'beep_high', 'cheer', 'fanfare', 'combo', 'tap', 'round_clear', 'fail',
];

/** 스템 강도별 볼륨 (base / mid / top) */
const STEM_MIX: Record<1 | 2 | 3, [number, number, number]> = {
  1: [1, 0, 0],
  2: [1, 1, 0],
  3: [1, 1, 1],
};

const MUSIC_GAIN = 0.55;
const LOBBY_GAIN = 0.5;
const SFX_GAIN = 0.9;

type BgmState = { kind: 'lobby' } | { kind: 'play'; intensity: 1 | 2 | 3 } | null;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;

  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  /** 받기 실패한 시각 — 한동안 다시 요청하지 않는다 (실패 → 재시도 → 실패의 무한 요청 방지, 2026-10-01 검수) */
  private failedAt = new Map<string, number>();
  private preloaded = false;

  // 재생 중인 음악
  private lobbyNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private stems: { src: AudioBufferSourceNode; gain: GainNode }[] | null = null;
  private stemIntensity: 1 | 2 | 3 = 1;
  /** 마지막으로 요청받은 음악 — 파일이 늦게 도착하거나 소리를 다시 켤 때 이어 튼다 */
  private wanted: BgmState = null;
  private lobbyWanted = false;
  private punchIdx = 0;

  // ───────────────────────── 기반 ─────────────────────────
  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      // 효과음·음악이 겹쳐도 깨지지 않게 마지막에 가볍게 눌러 준다
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = SFX_GAIN;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 1;
      this.musicBus.connect(this.master);
    }
    // 'suspended' 뿐 아니라 iOS 의 'interrupted'(통화·백그라운드 뒤) 에서도 다시 깨운다
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private url(name: string) {
    return `${AUDIO_BASE}/${name}.mp3?v=${AUDIO_VERSION}`;
  }

  private load(name: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return Promise.resolve(cached);
    const inflight = this.loading.get(name);
    if (inflight) return inflight;
    const failed = this.failedAt.get(name);
    if (failed && Date.now() - failed < LOAD_RETRY_AFTER_MS) return Promise.resolve(null);
    const ctx = this.getCtx();
    if (!ctx) return Promise.resolve(null);
    const p = fetch(this.url(name))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => {
        this.buffers.set(name, buf);
        this.failedAt.delete(name);
        return buf;
      })
      .catch(() => {
        this.failedAt.set(name, Date.now());
        return null;
      })
      .finally(() => this.loading.delete(name));
    this.loading.set(name, p);
    return p;
  }

  /** 게임 화면에 들어오면 (첫 터치 뒤) 미리 받아 둔다 — 첫 타격부터 진짜 소리가 나게 */
  preload() {
    if (this.preloaded || typeof window === 'undefined') return;
    this.preloaded = true;
    const names: string[] = ['tap', 'punch_1', 'punch_2', 'punch_3', 'perfect', 'miss', 'bell', 'beep_low', 'beep_high',
      'bgm_lobby', 'bgm_play_base', 'bgm_play_mid', 'bgm_play_top',
      'cheer', 'fanfare', 'combo', 'whoosh', 'block', 'round_clear', 'fail'];
    // 순서대로 조금씩 — 한꺼번에 받아 화면이 버벅이지 않게
    let i = 0;
    const next = () => {
      if (i >= names.length) return;
      const n = names[i++];
      this.load(n).finally(() => setTimeout(next, 30));
    };
    next();
    next();
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      this.stopAllMusic(0.15);
    } else {
      // 다시 켜면 직전에 틀던 음악을 이어 튼다
      if (this.lobbyWanted) this.startLobby();
      else if (this.wanted?.kind === 'play') this.startBgm(this.wanted.intensity);
    }
  }
  isEnabled() { return this.enabled; }

  // ───────────────────────── 효과음 ─────────────────────────
  private playSfx(name: SfxName, opts: { gain?: number; rate?: number; delay?: number } = {}): boolean {
    if (!this.enabled) return true;
    const ctx = this.getCtx();
    if (!ctx || !this.sfxBus) return false;
    const buf = this.buffers.get(name);
    if (!buf) {
      void this.load(name);
      return false;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g).connect(this.sfxBus);
    src.start(ctx.currentTime + (opts.delay ?? 0));
    return true;
  }

  /** 글러브가 미트를 때리는 소리 — 세 가지를 돌려 쓰고 음높이도 살짝 흔든다 */
  punch() {
    if (!this.enabled) return;
    this.punchIdx = (this.punchIdx + 1) % 3;
    const name = (['punch_1', 'punch_2', 'punch_3'] as const)[this.punchIdx];
    if (!this.playSfx(name, { rate: 0.96 + Math.random() * 0.08 })) this.synthPunch();
  }

  perfect() { this.perfectHit(); }
  perfectHit() {
    if (!this.enabled) return;
    if (!this.playSfx('perfect')) { this.synthPunch(); this.synthSparkle(); }
  }

  miss() {
    if (!this.enabled) return;
    if (!this.playSfx('miss')) this.synthMiss();
  }

  /** 라운드 벨 (땡땡) */
  bell() {
    if (!this.enabled) return;
    if (!this.playSfx('bell')) this.synthBell();
  }

  /** 카운트다운 — high = GO */
  beep(high = false) {
    if (!this.enabled) return;
    if (!this.playSfx(high ? 'beep_high' : 'beep_low')) this.synthBeep(high);
  }

  cheer() {
    if (!this.enabled) return;
    if (!this.playSfx('cheer')) this.synthCheer();
  }

  fanfare() {
    if (!this.enabled) return;
    if (!this.playSfx('fanfare')) this.synthFanfare();
  }

  /** 콤보 마일스톤 — 올라가는 짧은 리프 */
  combo() {
    if (!this.enabled) return;
    if (!this.playSfx('combo')) this.synthSparkle();
  }

  /** 버튼 탭 */
  tap() {
    if (!this.enabled) return;
    if (!this.playSfx('tap', { gain: 0.8 })) this.synthBeep(false, 0.05);
  }

  /** 휘두름 (헛침·페인트) */
  whoosh() {
    if (!this.enabled) return;
    if (!this.playSfx('whoosh', { rate: 0.95 + Math.random() * 0.1 })) this.synthMiss(0.5);
  }

  /** 가드로 막음 */
  block() {
    if (!this.enabled) return;
    if (!this.playSfx('block', { rate: 0.97 + Math.random() * 0.06 })) this.synthPunch(0.7);
  }

  roundClear() {
    if (!this.enabled) return;
    if (!this.playSfx('round_clear')) this.synthFanfare();
  }

  fail() {
    if (!this.enabled) return;
    if (!this.playSfx('fail')) this.synthMiss();
  }

  // ───────────────────────── 음악 ─────────────────────────
  private loopPoints(buf: AudioBuffer, name: MusicName): { start: number; end: number } {
    const seconds = LOOP_SECONDS[name];
    // 디코더가 MP3 앞뒤 여백을 잘라 줬으면 길이가 딱 맞는다. 안 잘랐으면 앞머리를 건너뛴다.
    const untrimmed = buf.duration - seconds > 0.012;
    const start = untrimmed ? MP3_LEAD_IN_SEC : 0;
    return { start, end: Math.min(buf.duration, start + seconds) };
  }

  private makeLoop(buf: AudioBuffer, name: MusicName, gain: number, when: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.loopPoints(buf, name);
    src.loop = true;
    src.loopStart = lp.start;
    src.loopEnd = lp.end;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.musicBus!);
    src.start(when, lp.start);
    return { src, gain: g };
  }

  private fadeOutAndStop(node: { src: AudioBufferSourceNode; gain: GainNode }, seconds: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(node.gain.gain.value, t);
      node.gain.gain.linearRampToValueAtTime(0, t + seconds);
      node.src.stop(t + seconds + 0.05);
      setTimeout(() => { try { node.gain.disconnect(); } catch { /* 이미 끊김 */ } }, (seconds + 0.2) * 1000);
    } catch { /* 이미 멈춘 노드 */ }
  }

  private stopAllMusic(fade = 0.25) {
    this.stopSynthBgm();
    if (this.lobbyNode) { this.fadeOutAndStop(this.lobbyNode, fade); this.lobbyNode = null; }
    if (this.stems) { this.stems.forEach((s) => this.fadeOutAndStop(s, fade)); this.stems = null; }
  }

  /** 메뉴·결과 화면 음악 — 켜 둔 채로 두면 플레이 음악이 시작될 때 자연스럽게 바뀐다 */
  startLobby() {
    this.lobbyWanted = true;
    this.wanted = { kind: 'lobby' };
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    if (this.lobbyNode) return;
    const buf = this.buffers.get('bgm_lobby');
    if (!buf) {
      // 받고 나서 틀되, 실패했으면 여기서 멈춘다 (다음 화면 전환 때 백오프 지나면 다시 시도)
      void this.load('bgm_lobby').then((loaded) => {
        if (loaded && this.lobbyWanted && this.enabled && !this.lobbyNode) this.startLobby();
      });
      return;
    }
    if (this.stems) { this.stems.forEach((s) => this.fadeOutAndStop(s, 0.3)); this.stems = null; }
    const node = this.makeLoop(buf, 'bgm_lobby', 0, ctx.currentTime + 0.02);
    node.gain.gain.linearRampToValueAtTime(LOBBY_GAIN, ctx.currentTime + 0.6);
    this.lobbyNode = node;
  }

  stopLobby() {
    this.lobbyWanted = false;
    if (this.wanted?.kind === 'lobby') this.wanted = null;
    if (this.lobbyNode) { this.fadeOutAndStop(this.lobbyNode, 0.35); this.lobbyNode = null; }
  }

  /** 플레이 음악 — 강도 1(기본) · 2(스네어·코드) · 3(아르페지오·리드) */
  startBgm(intensity: 1 | 2 | 3 = 1) {
    this.lobbyWanted = false;
    this.wanted = { kind: 'play', intensity };
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    if (this.stems) { this.setBgmIntensity(intensity); return; }
    const names: MusicName[] = ['bgm_play_base', 'bgm_play_mid', 'bgm_play_top'];
    const bufs = names.map((n) => this.buffers.get(n));
    if (bufs.some((b) => !b)) {
      // 아직 안 받았으면 받고 나서 (그 사이 플레이가 끝났으면 틀지 않는다). 하나라도 실패하면 합성 비트로 간다.
      void Promise.all(names.map((n) => this.load(n))).then((loaded) => {
        if (loaded.every(Boolean) && this.wanted?.kind === 'play' && this.enabled && !this.stems) this.startBgm(this.wanted.intensity);
      });
      if (!this.lobbyNode) this.synthBgmFallback();
      return;
    }
    this.stopSynthBgm();
    if (this.lobbyNode) { this.fadeOutAndStop(this.lobbyNode, 0.3); this.lobbyNode = null; }
    const when = ctx.currentTime + 0.05;
    const mix = STEM_MIX[intensity];
    this.stems = names.map((n, i) => this.makeLoop(bufs[i]!, n, 0, when));
    this.stems.forEach((s, i) => s.gain.gain.linearRampToValueAtTime(mix[i] * MUSIC_GAIN, when + 0.4));
    this.stemIntensity = intensity;
  }

  setBgmIntensity(intensity: 1 | 2 | 3) {
    if (this.wanted?.kind === 'play') this.wanted = { kind: 'play', intensity };
    if (!this.stems || !this.ctx) return;
    if (this.stemIntensity === intensity) return;
    this.stemIntensity = intensity;
    const mix = STEM_MIX[intensity];
    const t = this.ctx.currentTime;
    this.stems.forEach((s, i) => {
      s.gain.gain.cancelScheduledValues(t);
      s.gain.gain.setValueAtTime(s.gain.gain.value, t);
      // 올릴 땐 빠르게, 내릴 땐 천천히
      s.gain.gain.linearRampToValueAtTime(mix[i] * MUSIC_GAIN, t + (mix[i] > 0 ? 0.35 : 1.2));
    });
  }

  stopBgm() {
    if (this.wanted?.kind === 'play') this.wanted = null;
    this.stopSynthBgm();
    if (this.stems) { this.stems.forEach((s) => this.fadeOutAndStop(s, 0.4)); this.stems = null; }
  }

  // ───────────────────────── 합성 폴백 (파일이 없을 때만) ─────────────────────────
  private synthPunch(level = 1) {
    const ctx = this.getCtx(); if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(120, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
    bodyGain.gain.setValueAtTime(0.6 * level, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    bodyOsc.connect(bodyGain).connect(this.sfxBus);
    bodyOsc.start(t); bodyOsc.stop(t + 0.22);
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 1.2;
    const ng = ctx.createGain(); ng.gain.value = 0.4 * level;
    noise.connect(bp).connect(ng).connect(this.sfxBus);
    noise.start(t);
  }
  private synthSparkle() {
    const ctx = this.getCtx(); if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    [1568, 2093].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq;
      const start = t + 0.02 + i * 0.04;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.16, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(g).connect(this.sfxBus!);
      osc.start(start); osc.stop(start + 0.27);
    });
  }
  private synthMiss(level = 1) {
    const ctx = this.getCtx(); if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.linearRampToValueAtTime(70, t + 0.3);
    gain.gain.setValueAtTime(0.2 * level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t); osc.stop(t + 0.35);
  }
  private synthBell() {
    const ctx = this.getCtx(); if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    [880, 1320, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28 / (i + 1), t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.connect(gain).connect(this.sfxBus!);
      osc.start(t); osc.stop(t + 1.6);
    });
  }
  private synthBeep(high: boolean, dur = 0.15) {
    const ctx = this.getCtx(); if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = high ? 1320 : 660;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.01);
  }
  private synthCheer() {
    const ctx = this.getCtx(); if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI) * 0.6;
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 1.5;
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    noise.connect(filter).connect(ng).connect(this.sfxBus);
    noise.start(t);
  }
  private synthFanfare() {
    const ctx = this.getCtx(); if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq;
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.16, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(g).connect(this.sfxBus!);
      osc.start(start); osc.stop(start + 0.42);
    });
  }

  // 파일이 오기 전 잠깐 깔아 두는 아주 가벼운 합성 비트 (킥 + 하이햇)
  private synthBgm: { stop: () => void } | null = null;
  private synthBgmFallback() {
    const ctx = this.getCtx(); if (!ctx || !this.musicBus || this.synthBgm) return;
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(this.musicBus);
    const stepDur = 60 / 128 / 2;
    let step = 0; let stopped = false;
    let next = ctx.currentTime + 0.05;
    const tick = () => {
      if (stopped) return;
      while (next < ctx.currentTime + 0.3) {
        if (step % 4 === 0) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(120, next); o.frequency.exponentialRampToValueAtTime(40, next + 0.1);
          g.gain.setValueAtTime(0.6, next); g.gain.exponentialRampToValueAtTime(0.001, next + 0.18);
          o.connect(g).connect(master); o.start(next); o.stop(next + 0.2);
        }
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
        const g = ctx.createGain(); g.gain.value = step % 2 === 0 ? 0.12 : 0.07;
        src.connect(hp).connect(g).connect(master); src.start(next);
        next += stepDur; step++;
      }
      setTimeout(tick, 80);
    };
    this.synthBgm = { stop: () => { stopped = true; master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => master.disconnect(), 400); } };
    tick();
  }
  private stopSynthBgm() {
    if (this.synthBgm) { this.synthBgm.stop(); this.synthBgm = null; }
  }
}

export const audio = new AudioEngine();

let vibrationEnabled = true;
export function setVibrationEnabled(v: boolean) { vibrationEnabled = v; }
export function isVibrationEnabled() { return vibrationEnabled; }

export function vibrate(pattern: number | number[]) {
  if (!vibrationEnabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* 지원 안 함 */ }
  }
}

export const SFX_FILES = SFX_NAMES;
