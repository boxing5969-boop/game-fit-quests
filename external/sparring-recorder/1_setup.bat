@echo off
chcp 65001 >nul
cd /d "%~dp0"
python sparring_recorder.py setup
python sparring_recorder.py test-camera
pause
