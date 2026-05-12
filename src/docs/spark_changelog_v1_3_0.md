# Spark Changelog v1.3.0

## 2026-05-12 - v1.3.0: 모바일 UX 완벽 구현

### 🎯 주요 기능

#### 모바일 키보드 완벽 대응
- **iOS Safari**: visualViewport API로 키보드 높이 실시간 감지
- **Android Chrome/Firefox**: interactive-widget + dvh 유닛 자동 대응
- **툴바 자동 이동**: 키보드 올라오면 0.15s 부드럽게 따라 올라감
- **독립 스크롤**: 본문 영역 독립 스크롤로 textarea가 툴바에 안 가려짐

#### 참고 메모 시스템
- **추가**: 피드백 제안 박스에서 "📝 아래에 추가하기" 버튼
- **자동 종료**: 추가 시 피드백 모드 자동 종료 → 본문에서 메모 확인
- **편집**: contentEditable로 메모 내용 직접 수정 가능
- **삭제**: 우측 상단 × 버튼 (44x44px) 한 번 탭으로 삭제

#### 글자 크기 조절
- **범위**: 14px / 16px / 18px
- **적용**: 본문, 제목, 형광펜 등 모든 텍스트
- **위치**: 툴바 중앙 [−] 16 [+] 버튼

#### 피드백 모드 UX 개선
- **뒤로가기 숨김**: 피드백 모드에서는 뒤로가기 버튼 숨김, 닫기만 표시
- **구조 배너**: 💡 글 흐름 파악 (amber 배경)
- **제안 배너**: ✍️ 이렇게 써보면 어떨까요? (blue 배경)
- **스캔 애니메이션**: 중앙 상단 "피드백을 위해 글을 분석하고 있어요" 배지

### 🔧 기술 개선

#### 레이아웃 구조 변경
```
Before: min-h-screen + sticky toolbar
After: height: 100dvh + flexbox 3단 구조
  ├─ header (flex-none, sticky)
  ├─ main (flex-1, overflow-y-auto)
  └─ toolbar (flex-none, bottom: keyboardHeight)
```

#### visualViewport API 구현
```tsx
const vv = window.visualViewport
vv.addEventListener('resize', () => {
  const keyboardHeight = window.innerHeight - vv.height
  setKeyboardHeight(keyboardHeight > 150 ? keyboardHeight : 0)
})
```

#### viewport 설정
```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // iOS 자동 줌 방지
  interactiveWidget: 'resizes-content' // Chrome/Firefox 키보드 대응
}
```

### 🐛 버그 수정

#### 참고 메모 추가 안 되는 문제
- **원인**: 피드백 모드에서는 본문이 읽기 전용
- **해결**: 추가 시 피드백 모드 자동 종료 → 본문에서 메모 확인 가능

#### 키보드 올릴 때 스크롤 어색함
- **원인**: 전체 페이지 스크롤 + 툴바 position: sticky
- **해결**: 본문 영역 독립 스크롤 + 툴바 bottom 동적 조정

#### 피드백 모드에서 뒤로가기 무의미
- **원인**: 뒤로가기가 홈/아카이브로 이동
- **해결**: 피드백 모드에서는 뒤로가기 숨김, 닫기만 표시

### 📱 브라우저 지원

| 브라우저 | visualViewport | dvh | interactive-widget | 상태 |
|---------|----------------|-----|-------------------|------|
| iOS Safari 13+ | ✅ | ✅ | ❌ | ✅ 완벽 작동 |
| Android Chrome 108+ | ✅ | ✅ | ✅ | ✅ 완벽 작동 |
| Android Firefox 132+ | ✅ | ✅ | ✅ | ✅ 완벽 작동 |

### 📂 수정된 파일

- `src/app/editor/EditorClient.tsx` - v1.3.0 완전 재작성
- `src/app/layout.tsx` - viewport 설정 추가

### 🎨 UX 개선

#### 하단 툴바
```
[B] [I] | [−] 16 [+] | [✦ 피드백]
```
- 항상 화면 하단 (키보드 위로 자동 이동)
- 모든 버튼 44x44px 터치 영역

#### 참고 메모 박스
```
┌─────────────────────────┐
│ 📝 참고 메모         [×]│
│ 주제 문장을 첫 줄에     │
│ 배치하고...             │
└─────────────────────────┘
```
- 파란색 배경 (blue-50)
- 점선 테두리 (blue-200)
- 편집 가능 (contentEditable)
- 쉬운 삭제 (× 버튼)

### ⚙️ 성능 최적화

- 키보드 전환 애니메이션: 0.15s ease-out
- 독립 스크롤로 textarea 자동 높이 조정 부드러움
- visualViewport 이벤트 리스너 정리 (cleanup)

### 📝 다음 버전 예정 (v2.0)

- 피드백 이력 저장 (before/after 비교)
- 글감 알고리즘 고도화 (가중치 적용)
- UI 디자인 시스템 보완
- 글 공유 기능

---

## 이전 버전

### 2026-05-11 - v1.1.0 ~ v1.1.5
- 피드백 플로우 완성
- 형광펜 크기 수정
- 자유 주제 버그 수정
- 모바일 최적화 (44x44px 터치 영역)
- 제목/본문 구분선
- 스캔 설명 위치 변경
