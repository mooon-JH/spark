# ✦ Spark — 기획안 v1.3.0
_최종 업데이트: 2026-05-12_

> AI co-writing service

---

## 컨텍스트 인계

너는 전문적인 PM이자 개발자야. 본질에 집중하여 최대한 단순하고 간소화된 방향으로 개발해야 해. 내 의견을 항상 비판적으로 분석해야 해.

---

## 1. 제품 개요

### 핵심 가치
- **시작을 쉽게** — 글감이 질문이고 입력창이 답변 공간. 첫 글자를 치면 바로 에디터 페이지로
- **본질에 집중** — 자동저장 + 이어쓰기로 흐름 유지. 글쓰는 과정 몰입 유지
- **지속성** — 글이 누적되어 습관화. 아카이브에서 시각적으로 확인

### 궁극적 목적
글감에서 출발하되, 궁극적으로는 사용자가 자신의 생각을 구조화하고 표현하는 법을 글쓰기를 통해 연습하고 성장할 수 있게 만드는 것. 쓸수록 나에게 맞는 글감이 나오는 구조.

### 타겟 사용자

| 구분 | 내용 |
|---|---|
| 연령대 | 20대 중반 ~ 30대 중반 |
| 타입 1 | 스타트업 종사자 / 커리어 성장에 관심 있는 직장인 |
| 타입 2 | 창업을 희망하는 사람 (막연히 꿈꾸는 직장인 + 예비 창업자) |
| 타입 3 | 나의 내면을 잘 가꾸어내고 싶은 사람 |
| 페인포인트 | 내 생각을 구조화하는 데 어려움이 있어 글쓰기로 키우고 싶은 사람 |

### 비전 로드맵

| 단계 | 내용 |
|---|---|
| MVP (완료) | 로그인 → 홈 → 에디터 (이어쓰기 + 피드백 + 참고 메모) → 아카이브 |
| v2 | 피드백 이력 저장 + 글감 알고리즘 고도화 + UI 디자인 시스템 보완 |
| v3 | 글 공개 및 공유로 인한 네트워크 커뮤니티화 |

---

## 2. 기술 스택

| 역할 | 기술 | 상태 |
|---|---|---|
| 프론트엔드 + 백엔드 | Next.js 16 (App Router, TypeScript, Tailwind 4) | ✅ 완료 |
| DB + 로그인 | Supabase | ✅ 완료 |
| AI 모델 | Claude API (claude-sonnet-4-6) | ✅ 완료 |
| 배포 | Vercel (spark-theta-one.vercel.app) | ✅ 완료 |
| 폰트 | Pretendard (CDN) | ✅ 완료 |

---

## 3. 화면 구조

### 전체 흐름

```
로그인 → 홈 → 에디터 → 아카이브
```

### 최초 진입 흐름

```
링크 접속
  ↓
로그인 — Google 버튼
  ↓ Google 로그인 (최초 1회)
홈 (첫 진입 — Spark 소개 글 자동 생성)
  ↓ 첫 글자 입력 즉시
에디터
  ↓ 저장
홈
```

> ✅ 온보딩(writing_motivation 선택) 완전 제거. 로그인 즉시 홈 진입. 첫 진입 경험 자체가 온보딩.

### 반복 사용 흐름

```
홈 — 글감 카드 + 입력창
  ↓ 첫 글자 입력 즉시
에디터 — 글쓰기 + 자동저장 + 이어쓰기 + 피드백
  ↓ 저장 or 뒤로가기
홈 복귀 (자동저장)
```

### 아카이브 흐름

```
홈 상단 아카이브 아이콘
  ↓
아카이브 — 프로필 + 통계 + 글 목록 + 검색
  ↓ 글 탭
에디터 (수정 모드) — 저장 후 아카이브 복귀
```

### 네비게이션 원칙

- 탭바 없음. 홈 상단 우측 아카이브 아이콘 하나
- 에디터 복귀 분기: 새 글 작성 → 홈 / 기존 글 수정 → 아카이브

---

## 4. 온보딩 UX ✅ 완료

로그인 직후 홈 진입. writing_motivation 선택 단계 완전 제거.

### middleware 처리

| 조건 | 처리 |
|---|---|
| 비로그인 | /login 리다이렉트 |
| 로그인 상태에서 /login 접근 | / 리다이렉트 |
| 로그인 | 홈 직행 |

### Spark 소개 글 (자동 생성) ✅ 완료

홈 첫 진입 시 `writings` 테이블 자동 삽입. `is_system = true`.

```
Spark를 소개합니다. ✦

매일 다른 글감, 쓸수록 내 취향으로.

글이 막히면 AI가 다음 문장을 조용히 제안해요.
✦ 피드백 버튼으로 전체 흐름도 살펴볼 수 있어요.

글은 아카이브에 쌓여요.
쌓일수록 내 생각의 구조가 보여요.
```

---

## 5. 홈 UX ✅ 완료

### 레이아웃

```
──────────────────────────────────────
OOO님, 안녕하세요   [아카이브 아이콘]
──────────────────────────────────────

[←]  잘하고 싶은 마음이 오히려 발목을 잡은 적 있나요?  [→]
           👍 👎  (SVG 미니멀 아이콘)

[떠오르는 장면부터 써봐요...]  ← pulse 애니메이션
──────────────────────────────────────
자유롭게 써볼게요
──────────────────────────────────────
```

### 확정 항목

| 항목 | 내용 |
|---|---|
| 상단 | 닉네임 인사 (Google 자동 연동) + 아카이브 아이콘 |
| 글감 전환 | [←] [→] 버튼. strokeWidth 2, zinc-700 강조 |
| 첫 진입 화살표 | 오른쪽 [→]만 노출. 글감 넘긴 후부터 [←] [→] 양쪽 노출 |
| 시각적 유도 | 입력창 pulse 애니메이션 |
| 글감 일일 제한 | 하루 20개. 초과 시 ExhaustedView 표시 |
| 에디터 전환 | 첫 글자 입력 즉시 전환 |
| 자유 주제 | "자유롭게 써볼게요" 텍스트 링크 |
| 진입 애니메이션 | fadeIn + translateY(10px→0) |
| 좋아요/싫어요 | SVG 엄지 아이콘. 싫어요 시 자동으로 다음 글감 |

---

## 6. 에디터 UX ✅ v1.3.0 완료

### 기본 스펙

| 항목 | 내용 |
|---|---|
| 기기 | 모바일 우선 / 최대 너비 390px / safe-area 설정 |
| 레이아웃 | Flexbox 3단 구조 (헤더 고정 + 본문 스크롤 + 툴바 고정) |
| 글감 위치 | 본문 위 — 스크롤 내려가면 자연스럽게 사라짐 |
| 글감 수정 | 가능 (원본 topic_id 고정 저장) |
| 자동 저장 | 타이핑 멈추고 1.5초 후 디바운스 저장 |
| 저장 상태 | "저장 중..." / "✓ 저장됨" / "저장 실패" |
| 자동저장 안내 | 첫 진입 시 "자동으로 저장돼요." 1.5초 후 소멸 |
| 커서 | 진입 시 textarea 자동 포커스 + 커서 끝으로 |
| 서식 | 볼드 / 이탤릭 툴바. 키보드 위 고정 |
| 글자 크기 | [−] 16 [+] 버튼으로 14-18px 조절 |
| 복귀 분기 | 새 글 → 홈 / 수정 → 아카이브 |
| 진입 애니메이션 | fadeIn + translateY(10px→0) |

### 모바일 키보드 대응 ✅ v1.3.0

#### iOS Safari
```tsx
// visualViewport API 사용
const vv = window.visualViewport
vv.addEventListener('resize', () => {
  const keyboardHeight = window.innerHeight - vv.height
  setKeyboardHeight(keyboardHeight > 150 ? keyboardHeight : 0)
})

// 툴바를 키보드 위로
<div style={{ bottom: `${keyboardHeight}px` }}>
```

#### Android Chrome/Firefox
```tsx
// layout.tsx
export const viewport = {
  interactiveWidget: 'resizes-content' as const
}

// dvh 유닛 사용
<div style={{ height: '100dvh' }}>
```

#### 레이아웃 구조
```
height: 100dvh (전체 화면 고정)
  ├─ header (flex-none, sticky top)
  ├─ main (flex-1, overflow-y-auto) ← 독립 스크롤
  └─ toolbar (flex-none, bottom: keyboardHeight)
```

### 이어쓰기 ✅ 완료

```
타이핑 멈춤 (3.5초)
  ↓
백그라운드 API 호출
  ↓
커서 뒤에 회색 흐릿한 텍스트로 1문장 제안
  ↓
✓ 수락 → 60ms/char 타이핑 효과로 본문 합류
× 거절 → 제안 텍스트 사라짐
타이핑 재개 → 제안 자동 소멸
```

| 항목 | 내용 |
|---|---|
| 멈춤 감지 | 3.5초 |
| 컨텍스트 | 현재 문단 + 직전 문단 첫 문장 |
| 수락 애니메이션 | 60ms/char 타이핑 효과 |
| 수락 후 쿨다운 | 10초 |
| 첫 등장 툴팁 | 6초 노출 후 자동 소멸 |
| API 실패 | 조용히 무시 |

### ✦ 피드백 ✅ v1.3.0 완료

#### 진입 조건
- 버튼명: `✦ 피드백`
- 50자 이상 작성 시 활성화
- 툴바 우측에 위치 (키보드 위로 자동 이동)

#### 피드백 모드 전환 플로우

```
① ✦ 피드백 버튼 탭
② 피드백 모드 전환
   - 테두리: #e4e4e7 → #18181b (블랙)
   - 헤더: 흰 배경 → #18181b 블랙 배경 + 흰 텍스트
   - 본문 배경: #ffffff 유지 (이질감 방지)
   - 뒤로가기 버튼 숨김 (닫기만 표시)
③ 스캔 애니메이션 (API 호출 중)
   - 원문: blur(2px) + rgba(255,255,255,0.6) 오버레이
   - 중앙 상단: "피드백을 위해 글을 분석하고 있어요" 배지
   - 스캔 라인: 검정 반투명 위→아래
④ 피드백 결과 표시
   - 상단: 💡 글 흐름 파악 배너 (amber-50 + amber-500 왼쪽 선)
   - 원문에 하이라이트 직접 표시
     · 초록 (#dcfce7 + #166534): 잘된 문장 + ✓ 배지
     · 노랑 (#fef9c3 + #713f12): 보완할 문장 + → 배지
   - 하단: ✍️ 이렇게 써보면 어떨까요? 배너 (blue-50 + blue-500 왼쪽 선)
⑤ 하이라이트 문장 탭
   - 이유 (#f4f4f5 + 회색 왼쪽 선)
   - 예시 (#fefce8 + 앰버 왼쪽 선, 이탤릭)
   - 수정창 (흰 배경 입력창 + 블랙 반영 버튼)
⑥ 반영 버튼 탭 → 원문 해당 문장 교체
⑦ [× 닫기] 버튼 → 일반 모드 복귀
```

#### 참고 메모 시스템 ✅ v1.3.0

```
피드백 제안 박스
  ↓
[📝 아래에 추가하기] 버튼 클릭
  ↓
피드백 모드 자동 종료
  ↓
본문에 파란색 메모 박스 추가
  - 점선 테두리 (blue-200)
  - contentEditable로 편집 가능
  - 우측 상단 × 버튼 (44x44px) 삭제
```

#### 피드백 API 응답 구조

```json
{
  "flow": "글 전체 흐름 1줄 관찰 (판단 없이 서술)",
  "highlights": [
    {
      "text": "원문 발췌 (20자 이내)",
      "type": "positive",
      "reason": "잘된 이유 1~2문장"
    },
    {
      "text": "원문 발췌",
      "type": "negative",
      "reason": "문제인 이유 1~2문장",
      "example": "방향 감 주는 예시 문장 (답 아님)"
    }
  ],
  "next": "다음에 시도해볼 것 1가지"
}
```

#### 설계 원칙 (비판 검토 반영)

| 제거된 것 | 이유 |
|---|---|
| 공감 코멘트 | 행동 유발 안 함 |
| 사이드바 | 원문에 직접 표시로 대체 |
| 이유+힌트+질문 3단 | 이유+예시 2단으로 축소 (최소화) |
| "다시 쓰러 가기" 버튼 | 수정창 인라인으로 대체 |
| 배경 완전 전환 | 이질감 유발 → 헤더+테두리만 변경 |
| 플로팅 툴바 | 하단 고정 툴바로 변경 (키보드 대응) |

---

## 7. 아카이브 UX ✅ 완료

### 레이아웃

```
──────────────────────────────────────
상단 — 프로필 섹션
  [Google 사진]  OOO님 ✏️      로그아웃
  총 N편 썼어요 · 이번 주 N편
  마지막으로 쓴 날: N일 전
──────────────────────────────────────
하단 — 글 목록

  [검색창] (10편 이상일 때만 노출)

  topic_content (없으면 body 첫 줄)    5월 6일
  본문 미리보기 2줄
  ...
──────────────────────────────────────
[홈으로]  ← 하단 고정
──────────────────────────────────────
```

### 프로필 섹션

| 항목 | 내용 |
|---|---|
| 사진 | Google 프로필 이미지 자동 연동 |
| 닉네임 | 연필 아이콘 탭 → 인라인 수정 → 확인/취소 |
| 통계 | "총 N편 썼어요 · 이번 주 N편". 주간 리셋 월요일 |
| 마지막 작성일 | "마지막으로 쓴 날: N일 전". 오늘 쓴 경우 표시 안 함 |
| 로그아웃 | 확인 모달 후 /login으로 |

### 글 목록

| 항목 | 내용 |
|---|---|
| 제목 | topic_content 우선. 없으면 body 첫 줄 |
| 미리보기 | body 2줄 |
| 검색 | 10편 이상 노출. body + topic_content 전문 검색 |
| 정렬 | 최신순 고정 |
| 삭제 | ••• 메뉴 → 삭제 확인 모달 |
| 소개 글 삭제 | "처음 쓴 글이에요. 지워도 괜찮아요." [삭제할게요] [남겨둘게요] |
| 빈 상태 | "아직 쓴 글이 없어요. 첫 글을 써볼까요?" + 홈 이동 |
| 홈 버튼 | 하단 고정 |

---

## 8. 글감 알고리즘

### MVP (현재) ✅ 완료

- 전체 랜덤 노출 (가중치 없음)
- user_seen_topics 기준 본인이 본 글감 제외
- 좋아요/싫어요/에디터 진입 데이터 수집 중

### v2 예정

- 실제 행동 데이터 기반 카테고리 가중치 적용
- 노출 비율: 상위 70% / 하위 20% / 미경험 10%

---

## 9. DB 스키마

### 전체 테이블

| 테이블 | 주요 컬럼 | RLS |
|---|---|---|
| users | id, email, nickname, writing_motivation | 본인만 |
| topics | id, content | 전체 공개 |
| writings | id, user_id, topic_id, topic_content, body, is_system | 본인만 |
| user_seen_topics | id, user_id, topic_id, expires_at, seen_at | 본인만 |
| topic_categories | topic_id, category | 전체 공개 |
| user_categories | user_id, category, score | 본인만 |

### 완료된 마이그레이션

```sql
-- IF NOT EXISTS로 안전하게 실행됨
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS writing_motivation text
    CHECK (writing_motivation IN ('complex','unclear','expression','curious'));

ALTER TABLE user_categories
  ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;

ALTER TABLE writings
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;

ALTER TABLE user_seen_topics
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seen_at timestamptz DEFAULT NOW();

-- 소개 글 자동 생성을 위한 nullable 허용
ALTER TABLE writings
  ALTER COLUMN topic_content DROP NOT NULL;
```

---

## 10. 폴더 구조 (현재)

```
src/
├── app/
│   ├── auth/callback/route.ts      ✅
│   ├── login/page.tsx
│   ├── editor/
│   │   ├── page.tsx                ✅
│   │   └── EditorClient.tsx        ✅ v1.3.0
│   ├── archive/
│   │   ├── page.tsx                ✅
│   │   └── ArchiveClient.tsx       ✅
│   ├── actions/
│   │   ├── main.ts                 ✅
│   │   ├── editor.ts               ✅
│   │   └── archive.ts              ✅
│   ├── api/
│   │   ├── suggest/route.ts        ✅
│   │   └── feedback/route.ts       ✅
│   ├── MainClient.tsx              ✅
│   ├── page.tsx                    ✅
│   └── layout.tsx                  ✅ v1.3.0 (viewport 설정)
└── lib/supabase/
    ├── client.ts                   ✅
    └── server.ts                   ✅

middleware.ts                       ✅
```

---

## 11. 개발 진행 현황

### ✅ v1.3.0 완료 (2026-05-12)

**모바일 UX 완벽 구현**
- iOS Safari visualViewport API로 키보드 높이 감지
- 툴바가 키보드 위로 자동 이동 (0.15s 부드러운 전환)
- Flexbox 레이아웃 (header 고정 + main 독립 스크롤 + toolbar 고정)
- 참고 메모 시스템 (추가/편집/삭제)
- 글자 크기 조절 (14-18px)
- 피드백 모드 UI 완성 (구조/제안 배너)
- 피드백 모드에서 뒤로가기 버튼 숨김
- dvh 유닛 + interactive-widget 설정

**기술 스택**
- visualViewport API (iOS Safari)
- Virtual Keyboard API (Chrome/Firefox via env())
- Dynamic Viewport Units (dvh)
- interactive-widget=resizes-content

### ✅ 이전 완료 항목

**P0 기반**
- DB 마이그레이션 (nickname, score, is_system, expires_at, seen_at, topic_content nullable)
- layout.tsx — 타이틀 "spark", 언어 "ko", Pretendard
- auth/callback — Google 닉네임 자동 저장
- middleware.ts — 온보딩 체크 제거

**P1 핵심**
- 홈 — 글감 좌우 화살표, pulse 입력창, 좋아요/싫어요, 소진 뷰
- 에디터 — 글감 위치, 자동저장, 이어쓰기, ✦ 피드백 버튼, 복귀 분기
- API — 이어쓰기(`/api/suggest`), 피드백(`/api/feedback`)
- 아카이브 — 프로필, 통계, 글 목록, 검색, 삭제, 홈 버튼
- 홈 첫 진입 Spark 소개 글 자동 생성

**P2 보완**
- 글감 소진 UX
- 에디터 자동저장 안내 1.5초

**그룹 A UX 개선**
- 페이지 전환 애니메이션
- 화살표 강조, SVG 좋아요/싫어요 아이콘
- 이어쓰기 타이핑 60ms/char, 툴팁 6초
- 커서 자동 포커스, 글 목록 제목 표시

### v2 예정

| 항목 | 내용 |
|---|---|
| 피드백 이력 저장 | 아카이브에 before/after 기록 |
| 글감 알고리즘 고도화 | 좋아요/싫어요 가중치 적용 |
| 로그인 화면 | Spark 브랜드 정돈 |
| 메인 UI 디자인 시스템 | 레퍼런스 조사 후 보완 |

---

## 12. 기준점 (Standards)

### 서비스 톤앤매너

**한 줄 정의:** 있지만 나서지 않는다

| 항목 | 기준 |
|---|---|
| 경어 | 해요체 |
| 온도 | 차분하고 따뜻함 |
| 거리감 | 옆에 있지만 말 걸지 않는다 |
| 문장 길이 | 짧고 끊어지는 리듬 |
| 느낌표 | 최소 1개 이하 |
| 금지 표현 | "~해보세요!" / AI 챗봇 말투 |

### 버튼·레이블 확정 문구

| 상황 | 문구 |
|---|---|
| 이어쓰기 수락 | ✓ |
| 이어쓰기 거절 | × |
| 피드백 버튼 | ✦ 피드백 |
| 저장 중 | 저장 중... |
| 저장 완료 | ✓ 저장됨 |
| 저장 실패 | 저장 실패 |
| 글감 소진 | 오늘의 글감을 모두 봤어요. 내일 새로운 글감이 기다리고 있어요. |
| 빈 아카이브 | 아직 쓴 글이 없어요. 첫 글을 써볼까요? |
| 소개 글 삭제 모달 | 처음 쓴 글이에요. 지워도 괜찮아요. |
| 소개 글 삭제 버튼 | [삭제할게요] [남겨둘게요] |
| API 실패 (피드백) | 잠깐 문제가 생겼어요. 다시 시도해볼게요. |
| 피드백 스캔 중 | 피드백을 위해 글을 분석하고 있어요 |
| 참고 메모 추가 | 📝 아래에 추가하기 |

---

## 13. 카테고리 (16개 / 4축)

| 축 | 카테고리 |
|---|---|
| 비즈니스 (5개) | 커리어, 창업, 비즈니스 인사이트, 기획, 경험 |
| 감성 (4개) | 감정, 크리에이티브, 예술, 취향 |
| 문화 (2개) | 컬처, 테크&트렌드 |
| 본질 (5개) | 철학, 인간관계, 루틴, 라이프스타일, 웰니스 |

---

## 14. v1.3.0 모바일 키보드 대응 상세

### 문제 정의

모바일 웹에서 키보드가 올라오면:
- iOS Safari: 키보드가 독립 레이어로 뷰포트 변경 없음
- Android (기본): 뷰포트 리사이즈, 하단 버튼이 키보드에 가려짐

### 해결 방법

#### 1. iOS Safari (visualViewport API)

```tsx
useEffect(() => {
  const vv = window.visualViewport
  if (!vv) return

  const handleViewportChange = () => {
    const height = window.innerHeight - vv.height
    setKeyboardHeight(height > 150 ? height : 0)
  }

  vv.addEventListener('resize', handleViewportChange)
  vv.addEventListener('scroll', handleViewportChange)
}, [])
```

#### 2. Android Chrome/Firefox (interactive-widget)

```tsx
// layout.tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content' as const
}
```

#### 3. 레이아웃 구조

```tsx
<div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
  {/* 헤더 - 고정 */}
  <header className="flex-none sticky top-0" />
  
  {/* 본문 - 독립 스크롤 */}
  <div className="flex-1 overflow-y-auto">
    <textarea style={{ paddingBottom: '80px' }} />
  </div>
  
  {/* 툴바 - 키보드 위로 자동 이동 */}
  <div 
    className="flex-none"
    style={{ 
      bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
      transition: 'bottom 0.15s ease-out'
    }}
  >
    {/* B I − 16 + ✦ 피드백 */}
  </div>
</div>
```

### 브라우저 지원

| 브라우저 | visualViewport | dvh | interactive-widget | 지원 |
|---------|----------------|-----|-------------------|------|
| iOS Safari | ✅ | ✅ | ❌ | ✅ 완벽 |
| Android Chrome | ✅ | ✅ | ✅ | ✅ 완벽 |
| Android Firefox | ✅ | ✅ | ✅ (v132+) | ✅ 완벽 |

### 결과

- ✅ 키보드 올라올 때 툴바가 부드럽게 따라 올라감 (0.15s)
- ✅ 본문 영역 독립 스크롤로 textarea가 툴바에 안 가려짐
- ✅ 모든 모바일 브라우저에서 일관된 경험
- ✅ 피드백 모드에서도 동일하게 작동
