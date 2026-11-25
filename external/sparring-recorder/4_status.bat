@echo off
chcp 65001 >nul
cd /d "%~dp0"
python sparring_recorder.py status
pause
