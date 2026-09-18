@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   2026-09-18 결제 수정 배포
echo   project: whnczhxyjmyywhlfbgsd  (myboxer153)
echo ================================================
echo.
echo [1/2] payssam-callback  (취소 되돌리기 + API키 저장 금지)
call npx supabase functions deploy payssam-callback --project-ref whnczhxyjmyywhlfbgsd --no-verify-jwt
echo.
echo [2/2] sync-members-to-app  (결제 값 덮어쓰기 방지)
call npx supabase functions deploy sync-members-to-app --project-ref whnczhxyjmyywhlfbgsd --no-verify-jwt
echo.
echo ------------------------------------------------
echo  SUCCESS  if you see:  Deployed Functions on project
echo  IF LOGIN / 403 ERROR:  run once   npx supabase login
echo                          then re-run this file.
echo ------------------------------------------------
pause
