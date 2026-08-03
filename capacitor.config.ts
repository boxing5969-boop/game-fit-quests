import type { CapacitorConfig } from "@capacitor/cli";

// 153 얼굴 출석 키오스크 — 안드로이드 설치형 앱.
// 웹 키오스크(/face-kiosk/:branchCode)를 그대로 감싼다.
// 인식 엔진과 등록된 얼굴 특징값은 웹과 100% 동일 — 재등록 불필요.
// 웹 자산을 APK 안에 넣기 때문에 인터넷이 끊겨도 앱이 켜진다.
const config: CapacitorConfig = {
  appId: "kr.co.boxing153.facekiosk",
  appName: "153 얼굴출석",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    // 카메라·자동재생이 사용자 제스처 없이 동작해야 한다(무인 키오스크)
    webContentsDebuggingEnabled: false,
  },
};

export default config;
