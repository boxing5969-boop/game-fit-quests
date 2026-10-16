-- 붕대 감기 — 그림 단계를 지우고 영상으로 (2026-10-17 대표님: "2가지 방식 모두 지워줘. 내가 직접 영상 찍어서 올려야 할 것 같아").
--   훈련 라이브러리 '복싱 붕대 감기' 글에서 '그림 13단계' 안내만 '영상'으로 바꾼다. 글의 ①~⑬ 순서와 코치·관장이 고친 다른 글은 그대로.
update public.training_exercises
set summary = replace(summary, '그림 13단계는 메뉴 ‘붕대 감기’', '영상·집 연습 미션은 메뉴 ‘붕대 감기’'),
    description = replace(description, '그림으로 따라 하기와 집 연습 미션은', '영상과 집 연습 미션은'),
    updated_at = now()
where name = '복싱 붕대 감기'
  and (summary like '%그림 13단계는 메뉴%' or description like '%그림으로 따라 하기와 집 연습 미션은%');
