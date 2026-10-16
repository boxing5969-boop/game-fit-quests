/**
 * 이모지 → 153 입체 아이콘 (2026-10-16 대표님: "아직도 앱에 이모지가 남아있어 이모지는 모두 빼고
 * 일일경영이나 복싱트레이닝에 사용되었던 자산같이 퀄리티있는 디자인 사용하자")
 *
 * 그림: 복싱 트레이닝 3D 아이콘(public/assets/minigame/3d)과 같은 글로시 3D 스타일로 Higgsfield(GPT Image 2.5)에서 그린
 *       public/assets/icons3d/*.webp (192px, 배경 투명). 기존 19개는 minigame/3d 를 그대로 쓴다.
 * 키: 이모지에서 변형 선택자(FE0F)·피부색을 뺀 글자. 값: 아이콘 이름 · null = 지운다(국기 등).
 * 표에 없는 이모지(회원이 직접 쓴 글의 이모지 등)는 건드리지 않는다.
 * 그림을 바꾸면 ICON3D_VERSION 을 올린다 (폰에 남은 옛 그림 캐시를 끊기 위해).
 */

export const ICON3D_VERSION = 1;

/** public/assets/minigame/3d 에 이미 있는 아이콘 (복싱 트레이닝 자산) */
const MINIGAME_ICONS = new Set([
  "bell", "bolt", "book", "calendar", "crown", "fire", "gem", "glove_mint", "glove_red", "headgear",
  "hero_gloves", "medal_bronze", "medal_gold", "medal_silver", "mitt", "shield", "star", "stopwatch", "trophy",
]);

export const icon3dSrc = (name: string) =>
  MINIGAME_ICONS.has(name)
    ? `/assets/minigame/3d/${name}.webp?v=1`
    : `/assets/icons3d/${name}.webp?v=${ICON3D_VERSION}`;

export const EMOJI_ICON: Record<string, string | null> = {
  // ── 복싱 트레이닝 자산 그대로 ──
  "🥊": "glove_red", "🧤": "glove_mint",
  "🏆": "trophy", "🔥": "fire", "⚡": "bolt", "👑": "crown",
  "⭐": "star", "🌟": "star", "💎": "gem", "🔔": "bell",
  "📅": "calendar", "🗓": "calendar", "📆": "calendar",
  "📖": "book", "📚": "book", "📘": "book", "📗": "book", "📕": "book",
  "🛡": "shield", "⏱": "stopwatch",
  "🥇": "medal_gold", "🏅": "medal_gold", "🎖": "medal_gold", "🥈": "medal_silver", "🥉": "medal_bronze",

  // ── 상태 · 안내 ──
  "✅": "check", "☑": "check", "✔": "check", "⭕": "check",
  "❌": "cross", "✖": "cross", "❎": "cross",
  "⚠": "warning", "🚨": "warning", "❗": "warning", "❕": "warning",
  "🔒": "lock", "🔐": "lock", "🔓": "unlock", "🔑": "key", "🗝": "key",
  "❓": "question", "❔": "question", "💡": "bulb",
  "📍": "pin", "📌": "pin", "📋": "clipboard", "📝": "clipboard",
  "✏": "pencil", "✍": "pencil", "🖊": "pencil", "🖋": "pencil",
  "🎯": "target", "🎁": "gift",
  "💵": "money", "💰": "money", "💸": "money", "💴": "money", "🪙": "coin",
  "🎉": "party", "🎊": "party",

  // ── 손 · 사람 ──
  "✨": "sparkles", "💫": "sparkles", "💪": "muscle", "🦾": "muscle", "👏": "clap",
  "👆": "point_up", "☝": "point_up", "👇": "point_down", "👉": "point_right", "👈": "point_left",
  "👍": "thumbs_up", "👊": "punch", "🤜": "punch", "🤛": "punch", "✊": "punch", "🤝": "handshake",
  "🙋": "raise_hand", "✋": "raise_hand", "🖐": "raise_hand", "🙏": "pray", "🙌": "raised_hands",
  "👥": "people", "👨‍👩‍👧": "people", "👪": "people", "👤": "user", "👣": "footprints",

  // ── 얼굴 · 캐릭터 ──
  "😊": "smile", "🙂": "smile", "😀": "smile", "😃": "smile", "😄": "smile", "😁": "smile", "☺": "smile",
  "😂": "joy", "🤣": "joy", "😭": "crying", "😢": "crying", "🤔": "thinking",
  "🤕": "hurt", "😮‍💨": "exhale", "😮": "exhale", "😈": "devil", "🙊": "goblin",
  "🫨": "dizzy", "😵‍💫": "dizzy", "😵": "dizzy", "💤": "zzz", "😴": "zzz",
  "👻": "ghost", "💀": "skull", "🤖": "robot", "🐺": "wolf", "🪨": "golem", "🐉": "dragon", "🐲": "dragon",

  // ── 훈련 · 활동 ──
  "🧘": "yoga", "🪢": "jump_rope", "🦵": "leg", "🪞": "mirror", "🪜": "ladder",
  "👟": "sneaker", "🏃": "sneaker", "🚶": "sneaker", "🧑‍🏫": "whistle",
  "🏁": "flag_finish", "🚩": "flag_red", "⚔": "swords", "🗡": "swords",
  "💥": "boom", "🚀": "rocket", "🎬": "clapper", "📹": "clapper", "🎥": "clapper",
  "📸": "camera", "📷": "camera", "🖼": "picture", "💬": "chat", "🗨": "chat", "🗣": "chat", "💭": "chat",

  // ── 물건 ──
  "🏷": "tag", "🧠": "brain", "📊": "chart", "📈": "chart", "➕": "plus", "🗺": "map",
  "📱": "phone", "📲": "phone", "🔄": "refresh", "🔁": "refresh", "🔃": "refresh", "🗑": "trash",
  "📢": "megaphone", "📣": "megaphone", "🎨": "palette", "🎴": "card", "🃏": "card", "💾": "save",
  "🏢": "building", "🏬": "building", "🏠": "house", "🏡": "house",
  "⏰": "alarm", "⏳": "hourglass", "⌛": "hourglass", "⏸": "pause",
  "👁": "eye", "👀": "eye", "🧭": "compass", "📏": "ruler", "📐": "ruler", "⚖": "scales",
  "🌐": "globe", "🌍": "globe", "🌏": "globe", "🌎": "globe", "🚪": "door", "🪪": "id_card",
  "💯": "hundred", "🕐": "clock", "🕒": "clock", "🕘": "clock", "🗂": "folder", "📁": "folder", "📂": "folder",
  "💳": "credit_card", "♾": "infinity", "🔍": "search", "🔎": "search", "📺": "tv", "📥": "inbox",
  "📦": "box", "🎒": "box", "📞": "phone_call", "☎": "phone_call", "🔊": "speaker", "🔉": "speaker", "🔇": "mute",
  "🎫": "ticket", "🎟": "ticket",
  "✉": "envelope", "📩": "envelope", "📧": "envelope", "📨": "envelope", "📮": "envelope", "📭": "envelope", "📬": "envelope",
  "🛠": "tools", "🔧": "tools", "🔨": "tools", "📄": "document", "📃": "document", "📜": "document", "📑": "document",
  "🩺": "stethoscope", "⚕": "stethoscope", "🎓": "graduation", "🧱": "brick", "👕": "tshirt",
  "🧪": "flask", "🔬": "flask", "🩹": "handwrap", "🔟": "badge_10", "🌱": "seedling",
  "🍽": "plate", "👨‍🍳": "chef", "🧑‍🍳": "chef",
  "⬆": "arrow_up", "⬇": "arrow_down", "⏩": "fast_forward",

  // ── 음식 ──
  "🥗": "salad", "🥬": "salad", "🥦": "salad", "🥑": "avocado", "🍎": "apple", "🍏": "apple",
  "🥚": "egg", "🍳": "egg", "🥩": "meat", "🍗": "meat", "🍖": "meat", "🥤": "drink",
  "💧": "droplet", "💦": "droplet", "🌾": "grain", "🍚": "grain", "🧂": "salt", "🧊": "ice",
  "🎂": "cake", "🍰": "cake",

  // ── 하트 · 리그 색 ──
  "❤": "heart_red", "💖": "heart_red", "💕": "heart_red", "💗": "heart_red", "💓": "heart_red", "♥": "heart_red",
  "🤍": "heart_white", "🖤": "heart_black", "💙": "heart_blue",
  "⚪": "dot_white", "⬜": "dot_white", "🔘": "dot_white", "🔵": "dot_blue", "🔴": "dot_red",
  "⚫": "dot_black", "⬛": "dot_black", "🟢": "dot_green", "🟡": "dot_yellow",

  // ── 하늘 · 자연 (캐릭터 효과) ──
  "🌙": "moon", "🌑": "moon", "🌌": "galaxy", "🌠": "galaxy", "🌈": "rainbow",
  "⛈": "storm", "🌩": "storm", "🌪": "tornado", "🌀": "cyclone",
  "🌸": "sakura", "💮": "sakura", "🌹": "rose", "🪷": "lotus", "💨": "wind", "🌬": "wind",
  "🍀": "clover", "☘": "clover", "❄": "snowflake", "🎵": "music", "🎶": "music",
  "🎆": "firework", "🎇": "firework", "☄": "comet", "🌼": "daisy", "🌻": "sunflower", "🌷": "tulip",
  "🌺": "hibiscus", "💐": "bouquet", "🌅": "sunrise", "🌄": "sunrise", "🐅": "tiger", "🐯": "tiger",
};

/** 그림 문자이지만 글자 기호로 쓰는 것 — 뒤에 FE0F 가 붙어 이모지로 보이면 FE0F 만 떼서 글자로 둔다 */
export const TEXT_SYMBOLS = new Set([
  "▶", "◀", "↔", "↕", "↩", "↪", "⚙", "☀", "✳", "✴", "❇", "‼", "⁉", "〰", "〽", "©", "®", "™", "ℹ",
  "⏏", "⏭", "⏮", "⏯", "⏹", "⏺", "▪", "▫", "◻", "◼", "◽", "◾", "➡", "⬅", "↗", "↘", "↙", "↖", "⤴", "⤵",
]);
