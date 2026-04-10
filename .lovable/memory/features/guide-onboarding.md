---
name: Guide & Onboarding System
description: First-run onboarding, guide hub, weekly dashboard, value map, safety check, exercise why cards
type: feature
---
- 6-slide onboarding at /onboarding, stored in localStorage (153_onboarding_done)
- Safety check at /safety-check with Starter Mode (153_safety_done, 153_starter_mode)
- Guide hub at /guide with 6 sub-pages: program, science, value-map, exercise-purpose, safety, faq
- WeeklyDashboard widget on /home with activity ring, strength counter, intensity gauge
- RankUpPage at /rank-up with 1-40 value map + unlock rewards
- ExerciseWhyCard component on MissionCard (optional purposeSummary/purposeTags props)
- BottomNav: 홈 / 훈련 / 랭크업 / 가이드 / 내정보 (5 tabs)
- All data in src/data/ files, no DB changes needed
- "WHO·CDC·ACSM 권고안을 참고해 설계됨" — never claim official certification
