# ✦ Spark — 코드 작업 기획서 v4.1

> 개발자용 간소화 버전 | 기획 배경·히스토리 제외 | 구현 스펙만 수록

---

## 1. 작업 순서

> ⚠️ 이 순서대로 진행. 앞 단계 완료 후 다음 단계 시작.

### P0 — 개발 시작 전 (DB·환경)
1. DB 마이그레이션 — users에 `nickname`, `writing_motivation` / user_categories에 `score` 추가
2. `layout.tsx` — 타이틀 "spark", `lang="ko"`, Pretendard 폰트 적용
3. `auth/callback/route.ts` — Google 닉네임 자동 저장 로직 추가
4. `middleware.ts` — `onboarding_completed` 체크 → `writing_motivation` null 체크로 교체

### P1 — 핵심 기능
5. 온보딩 — 시작 계기 선택 화면 신규 작성
6. 에디터 — 글감 위치 변경 (고정 헤더 → 본문 위 스크롤 연동)
7. 에디터 — 이어쓰기 구현
8. 에디터 — 코칭 구현
9. 홈 — 글감 알고리즘 가중치 쿼리 적용
10. 홈 — 글감 좋아요/싫어요 아이콘 추가
11. 아카이브 — 전면 재작성

### P2 — 보완
12. 글감 소진 UX
13. 아카이브 — 카테고리 수동 조정 연동
14. 에디터 — 첫 진입 시 저장 안내 문구

---

## 2. DB 스키마

### 마이그레이션 SQL

```sql
ALTER TABLE users
ADD COLUMN nickname text,
ADD COLUMN writing_motivation text
  CHECK (writing_motivation IN ('complex', 'unclear', 'expression', 'curious'));

ALTER TABLE user_categories
ADD COLUMN score integer DEFAULT 0;
```

### 전체 테이블

| 테이블 | 주요 컬럼 | RLS |
|---|---|---|
| users | id, email, nickname, writing_motivation, onboarding_completed | 본인만 |
| topics | id, content | 전체 공개 |
| writings | id, user_id, topic_id, topic_content, body | 본인만 |
| user_seen_topics | id, user_id, topic_id | 본인만 |
| topic_categories | topic_id, category | 전체 공개 |
| user_categories | user_id, category, score, click_order, is_removed, selected_at | 본인만 |

- `writings.topic_content` — 글감 스냅샷. 원본 글감이 수정·삭제돼도 작성 당시 글감 표시용
- `writings.topic_id` null → 자유 주제 글

---

## 3. middleware.ts

### 접근 제어 로직

| 조건 | 리다이렉트 |
|---|---|
| 비로그인 | /login |
| 로그인 + writing_motivation이 null | /onboarding |
| 로그인 + writing_motivation 있음 | / (홈) |

> ⚠️ 기존 유저도 `writing_motivation`이 null이면 온보딩 1회 진행. `onboarding_completed` 체크 로직 제거.

---

## 4. 온보딩 (`/onboarding`)

### UI

```
spark를 시작한 이유를 알려주시면
나에게 맞는 글감을 먼저 보여드릴게요

○  머릿속이 너무 복잡할 때      → complex
○  내 생각이 뭔지 모를 때       → unclear
○  하고 싶은 말이 막힐 때       → expression
○  그냥 써보고 싶었어요         → curious (스킵과 동일)
```

### 동작
- 선택 즉시 `users.writing_motivation` 업데이트
- 저장 완료 → `router.push('/')` 홈으로

### 선택값 → placeholder 매핑

| 코드 | 에디터 placeholder |
|---|---|
| complex | 지금 가장 먼저 떠오르는 장면부터요. |
| unclear | 떠오르는 대로 써봐요. 정답 없어요. |
| expression | 말하듯이 써봐요. |
| curious | 떠오르는 장면부터 써봐요. |

### 카테고리 초기 가중치 매핑

| 코드 | 우선 카테고리 |
|---|---|
| complex | 감정 → 철학 → 인간관계 |
| unclear | 철학 → 커리어 → 취향 |
| expression | 크리에이티브 → 감정 → 컬쳐 |
| curious | 셔플 (기본값) |

---

## 5. 홈 (`MainClient.tsx`)

> ⚠️ 홈 전면 재설계는 v2. MVP에서는 아래 항목만 수정.

### 변경 항목
- 글감 뽑기 쿼리 → 알고리즘 가중치 반영 쿼리로 교체
- 글감 카드 하단에 👍 👎 아이콘 추가 (선택, 작게)

### 글감 알고리즘 쿼리

```sql
SELECT t.* FROM topics t
JOIN topic_categories tc ON t.id = tc.topic_id
LEFT JOIN user_categories uc
  ON tc.category = uc.category AND uc.user_id = $1
WHERE t.id NOT IN (
  SELECT topic_id FROM user_seen_topics WHERE user_id = $1
)
ORDER BY (random() * COALESCE(uc.score, 1)) DESC
LIMIT 20;
```

### score 반영 액션 (`actions/main.ts`)

| 행동 | score 변화 |
|---|---|
| 글 저장 완료 | +3 |
| 에디터 진입 | +2 |
| 글감 좋아요 탭 | +2 |
| 글감 싫어요 탭 | -2 |

---

## 6. 에디터 (`EditorClient.tsx`)

### 기본 스펙

| 항목 | 내용 |
|---|---|
| 최대 너비 | 390px (모바일 우선) |
| 글감 위치 | 본문 위 — 스크롤 시 사라짐, 위로 스크롤 시 다시 보임 |
| 글감 수정 | 가능. 저장 시 원본 topic_id 고정 |
| 자동 저장 | 타이핑 멈추고 1.5초 후 디바운스 |
| 저장 상태 | 헤더 우측: "저장 중..." / "✓ 저장됨" / "저장 실패" |
| 이탈 | 뒤로가기 → 즉시 저장 → 홈 복귀 |

### 이어쓰기 구현 스펙

| 항목 | 내용 |
|---|---|
| 멈춤 감지 | 타이핑 멈추고 3~4초 후 API 호출 |
| API 컨텍스트 | 현재 문단 전체 + 직전 문단 첫 문장만 전송 |
| 제안 | 1문장만 생성 |
| 표시 | 커서 뒤 회색 흐릿한 텍스트 (opacity 낮게) |
| 수락 | 하단 고정 ✓ 버튼 → 한 글자씩 타이핑 애니메이션으로 본문 합류 |
| 거절 | 하단 고정 ✕ 버튼 → 제안 텍스트 사라짐 |
| 버튼 문구 | 없음 (아이콘만) |
| 첫 등장 | 말풍선으로 기능 1회 설명. 이후 버튼만 표시 |

### 이어쓰기 API 프롬프트

```
system:
당신은 글쓰기 보조자입니다.
사용자 글의 흐름과 톤을 그대로 유지하며
자연스럽게 이어지는 1문장만 생성하세요.
문장 끝에 마침표를 포함하세요.
다른 설명이나 부가 문장 없이 1문장만 출력하세요.

user:
[직전 문단 첫 문장 + 현재 문단 전체]
```

- 모델: `claude-sonnet-4-6`
- `max_tokens`: 100

### 코칭 구현 스펙

| 항목 | 내용 |
|---|---|
| 트리거 | 에디터 하단 "✦ 흐름 보기" 버튼 |
| API 컨텍스트 | 글 전체 본문 |
| 결과 표시 | 하단 시트 (bottom sheet) |
| 모델 | claude-sonnet-4-6 |

### 코칭 API 프롬프트

```
system:
당신은 따뜻한 글쓰기 코치입니다.
아래 글을 읽고 다음 세 가지를 짧게 말해주세요.
1. 이 글에서 잘 된 부분 1가지
2. 더 나아갈 수 있는 방향 1가지
평가하듯 말하지 말고, 옆에서 이야기하듯 써주세요.
해요체를 사용하세요.

user:
[글 전체 본문]
```

---

## 7. 아카이브 (`/archive/page.tsx`)

> ⚠️ 전면 재작성. 기존 코드 참고 없이 새로 작성.

### 3단 레이아웃

```
─────────────────────────────
상단 — 프로필
  [Google 사진]  OOO님          로그아웃
  닉네임 변경 →
  총 N편 썼어요  ·  이번 주 N편
─────────────────────────────
중단 — 진행도 (기본 접힘, 탭하면 펼침)
  커리어  ████░░░░  4편
  감정    ██░░░░░░  2편
  조정하기 →
─────────────────────────────
하단 — 글 목록
  [전체] [커리어] [감정] [철학]
  제목 또는 첫 줄    커리어  5월 6일
─────────────────────────────
```

### 세부 스펙

| 항목 | 내용 |
|---|---|
| 닉네임 변경 | 프로필 섹션에서 인라인 수정 |
| 로그아웃 | 프로필 섹션 우측 |
| 진행도 쿠폰 | 첫 진입 시 각 카테고리 2편 미리 채움 |
| 스트릭 | 주간 리셋 월요일. 미달성 페널티 없음 |
| 글 삭제 | 스와이프 or ··· → 삭제 확인 모달 |
| 빈 상태 | "아직 쓴 글이 없어요. 첫 글을 써볼까요?" + 홈 버튼 |

---

## 8. 파일별 작업 목록

| 파일 | 작업 내용 |
|---|---|
| `middleware.ts` | `onboarding_completed` 체크 → `writing_motivation` null 체크로 교체 |
| `layout.tsx` | 타이틀 spark, lang=ko, Pretendard 폰트 |
| `auth/callback/route.ts` | Google 닉네임 자동 저장 |
| `onboarding/page.tsx` | 시작 계기 선택 UI 전면 재작성 |
| `page.tsx` (홈 서버) | 알고리즘 쿼리 교체 |
| `MainClient.tsx` | 글감 좋아요/싫어요 아이콘 추가 |
| `actions/main.ts` | score 업데이트 액션 추가 |
| `editor/EditorClient.tsx` | 글감 위치 변경 + 이어쓰기 + 코칭 |
| `actions/editor.ts` | 이어쓰기 API 호출 액션 추가 |
| `archive/page.tsx` | 전면 재작성 |

---

## 9. 확정 문구 모음

| 상황 | 문구 |
|---|---|
| 자유 주제 버튼 | 자유롭게 써볼게요 |
| 빈 아카이브 | 아직 쓴 글이 없어요. 첫 글을 써볼까요? |
| 네트워크 오류 | 연결이 잠깐 끊겼어요. 다시 시도해볼게요. |
| 글감 소진 | 모든 글감을 다 봤어요. 처음부터 다시 볼까요? |
| 코칭 버튼 | ✦ 흐름 보기 |
| 저장 안내 | 자동으로 저장돼요 |
| 저장 중 | 저장 중... |
| 저장 완료 | ✓ 저장됨 |
| 저장 실패 | 저장 실패 |

### 톤앤매너 핵심
- 해요체. 합쇼체 X. 반말 X
- "~해보세요!" 금지
- 버튼 레이블은 기능 설명이 아닌 유저의 심리·행동으로
