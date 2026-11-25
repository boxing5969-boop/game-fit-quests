@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 153 링 녹화 - 이 창을 닫지 마세요
python sparring_recorder.py record
pause
