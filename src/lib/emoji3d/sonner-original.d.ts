// vite.config.ts 가 "sonner-original" 을 진짜 sonner 파일로 돌린다 (src/lib/emoji3d/sonner.ts 참고)
declare module "sonner-original" {
  export * from "sonner";
}
