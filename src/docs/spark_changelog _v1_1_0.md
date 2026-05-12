# Spark 개발 변경사항 기록
_최종 업데이트: 2026-05-11_

---

## P0 — 기반 작업 (완료)

### DB 마이그레이션 (Supabase SQL 직접 실행)
- `users` 테이블에 `nickname`, `writing_motivation` 컬럼 추가
- `user_categories` 테이블에 `score` 컬럼 추가
- `writings` 테이블에 `is_system` 컬럼 추가
- `user_seen_topics` 테이블에 `expires_at`, `seen_at` 컬럼 추가
- `writings.topic_content` NOT NULL → NULL 허용으로 변경

### `src/app/layout.tsx`
- 타이틀 → "spark", 언어 → `ko`, Geist → Pretendard (CDN)

### `src/app/auth/callback/route.ts`
- Google 닉네임 자동 저장, 온보딩 제거, 홈 직행

### `middleware.ts`
- 온보딩 체크 제거, 비로그인 → `/login`, 로그인+/login → `/`

---

## P1 — 핵심 기능 (완료)

### `src/app/page.tsx`
- 닉네임 + 글감 + 소개 글 병렬 로드
- 첫 진입 시 `is_system = true` 소개 글 자동 생성 (최초 1회)

### `src/app/actions/main.ts`
- `user_categories` 의존성 제거, MVP 전체 랜덤 노출
- 좋아요/싫어요 기록, 싫어요 30일 제한

### `src/app/MainClient.tsx`
- 아카이브 아이콘, 좌우 화살표, 입력창 pulse, 글감 소진 뷰
- SVG 미니멀 좋아요/싫어요 아이콘
- 진입 fadeIn + slideUp 애니메이션

### `src/app/editor/page.tsx`
- `returnTo` props, `writingId` 수정 모드, 로딩 스켈레톤

### `src/app/editor/EditorClient.tsx`
- 글감 본문 위, 커서 자동 포커스, 자동저장 1.5초
- 자동저장 안내 1.5초 소멸
- 이어쓰기: 3.5초 감지 → 제안, 60ms/char 타이핑, 툴팁 6초
- ✦ 피드백 버튼 (50자 이상 활성), 복귀 분기

### `src/app/api/suggest/route.ts` (신규)
- 다음 문장 1개 제안 API

### `src/app/api/feedback/route.ts` (신규 → 업데이트 필요)
- 현재: `empathy` + `structure` + `highlights` + `question` JSON
- **업데이트 예정**: 문장 단위 `highlights` (이유+예시) + `flow` + `next`

### `src/app/actions/archive.ts` (신규)
- 프로필/통계/글목록/닉네임수정/삭제/로그아웃

### `src/app/archive/page.tsx` (신규)
- 프로필 + 글 목록 병렬 로드

### `src/app/archive/ArchiveClient.tsx` (신규)
- 프로필, 통계, 글 목록, 검색, 삭제 모달, 홈 버튼, 진입 애니메이션

---

## 그룹 A 개선 (완료)

| 번호 | 항목 | 내용 |
|---|---|---|
| 1 | 페이지 전환 | fadeIn + translateY(10px→0) |
| 2 | 화살표 강조 | strokeWidth 2, zinc-700 |
| 4 | 좋아요/싫어요 | SVG 엄지 아이콘 |
| 5,7 | 타이핑 효과 | 60ms/char |
| 8 | 툴팁 시간 | 6초 |
| 9 | 아카이브 홈 버튼 | 하단 고정 |
| 10 | 커서 포커스 | 진입 시 자동 |
| 11 | 글 목록 제목 | topic_content 우선 |
| 12 | 자동저장 안내 | 1.5초 |

---

## 그룹 B — 피드백 UX (설계 확정, 구현 대기)

### 확정된 피드백 플로우

```
① ✦ 피드백 버튼 탭 (50자 이상 활성)
② 피드백 모드 전환 — 헤더+테두리 블랙으로 변경
③ 스캔 애니메이션 — 원문 blur(2px)+opacity(0.45) + 흰 스캔 라인
④ 피드백 결과 표시
   - 상단 구조 배너 1줄 (글 흐름 관찰)
   - 원문에 하이라이트 직접 표시
     · 초록 #dcfce7 + ✓ 배지 — 잘된 문장
     · 노랑 #fef9c3 + → 배지 — 보완할 문장
⑤ 하이라이트 문장 탭
   - 이유 (왜 좋은지 / 왜 문제인지)
   - 예시 (어떤 방향인지 감 주는 문장)
   - 수정창 (인라인 직접 입력 + 반영 버튼)
⑥ 반영 → 원문 해당 문장 교체
```

### 모드 전환 시각 스펙

```
일반 모드
  테두리: #e4e4e7
  헤더: 흰 배경 + 회색 텍스트
  본문: #ffffff

스캔 중
  테두리: #18181b
  헤더: #18181b + 흰 텍스트 + 점 애니메이션
  원문: blur(2px) + opacity(0.45)
  스캔 라인: 검정 반투명 위→아래
  본문 배경: #ffffff 유지

피드백 결과
  테두리: #18181b 유지
  헤더: 블랙 유지 + 종료 버튼
  본문: #ffffff 유지
  구조 배너: #f4f4f5 + 블랙 왼쪽 선
  긍정: #dcfce7 bg + #166534 텍스트 + ✓
  부정: #fef9c3 bg + #713f12 텍스트 + →

수정 포인트 탭
  이유: #f4f4f5 + 회색 왼쪽 선
  예시: #fefce8 + 앰버 왼쪽 선
  수정창: 흰 배경 + 반영 버튼 #18181b
```

### 피드백 API 응답 구조 (업데이트 예정)

```json
{
  "flow": "글 전체 흐름 1줄 관찰",
  "highlights": [
    {
      "text": "원문 발췌 (20자 이내)",
      "type": "positive",
      "reason": "잘된 이유"
    },
    {
      "text": "원문 발췌",
      "type": "negative",
      "reason": "문제인 이유",
      "example": "방향 감 주는 예시 문장"
    }
  ],
  "next": "다음에 시도해볼 것 1가지"
}
```

### 비판 검토에서 반영된 결정들

- 사이드바 제거 → 피드백 모드 전환 방식으로 (피그마 디자인/개발 모드 참고)
- 배경 완전 전환 거부 → 헤더+테두리만 블랙 (이질감 방지)
- 블러 재도입 → 흰 배경 위에서 스캔 중임을 인지시킴
- 힌트 → 예시 문구로 교체 (방향만 주는 게 아니라 감을 주기 위해)
- 이유+힌트+질문 3단 → 이유+예시 2단으로 축소 (최소화)
- 공감 코멘트 제거 (행동 유발 안 함)
- "다시 쓰러 가기" 버튼 → 수정창 반영 버튼으로 대체 (인라인)

---

## 업데이트 필요한 파일

### 즉시 업데이트 필요 (구현 대기)

| 파일 | 변경 내용 |
|---|---|
| `src/app/api/feedback/route.ts` | API 응답 구조 변경 (flow + highlights[이유+예시] + next) |
| `src/app/editor/EditorClient.tsx` | 피드백 모드 전환 UI 전체 재작성 |

### v2 예정

| 항목 | 내용 |
|---|---|
| 피드백 이력 저장 | 아카이브에 before/after 기록 |
| 글감 알고리즘 고도화 | 좋아요/싫어요 가중치 적용 |
| 로그인 화면 | Spark 브랜드 정돈 |
| 메인 UI 디자인 시스템 | 레퍼런스 조사 후 보완 |
