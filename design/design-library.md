# Design Library — Account/Profile Screen Reference

> 출처: 첨부 이미지 (Uber 앱 Account 탭 스크린샷)
> 목적: co-work-app 신규 디자인의 기준이 되는 다크 테마 컴포넌트 라이브러리 정리
> 상태: **분석 완료, 적용 대기** — 앱 코드는 아직 작성하지 않음

---

## 1. 컬러 팔레트 (Color Tokens)

| 토큰명 | 값 (추정) | 용도 |
|---|---|---|
| `color/bg/base` | `#0B0B0B` | 화면 최상위 배경 (거의 순흑) |
| `color/surface/card` | `#1E1E1E` | 카드, 리스트 영역 배경 |
| `color/surface/pill` | `#2A2A2A` | 평점 배지 등 알약형 배경 |
| `color/avatar/bg` | `#FFFFFF` | 프로필 아바타 placeholder 배경 |
| `color/avatar/icon` | `#9B9B9B` | 아바타 내부 사람 아이콘 |
| `color/text/primary` | `#FFFFFF` | 이름, 리스트 타이틀 등 1차 텍스트 |
| `color/text/secondary` | `#9B9B9B` | 설명/서브타이틀 텍스트 |
| `color/text/disabled` | `#6B6B6B` | 비활성 탭 라벨/아이콘 |
| `color/border/divider` | `#2C2C2E` | 섹션 구분선 |
| `color/accent/star` | `#FFFFFF` | 별점 아이콘 (흰색, 채워짐) |
| `color/nav/active` | `#FFFFFF` | 하단 탭 활성 상태 |
| `color/nav/inactive` | `#8E8E93` | 하단 탭 비활성 상태 |

---

## 2. 타이포그래피 (Typography Scale)

| 토큰명 | size/weight | 예시 |
|---|---|---|
| `type/display` | 28px / Bold | "David Saito" 이름 |
| `type/title` | 16px / Semibold | "Settings", "Privacy checkup" |
| `type/body` | 14px / Regular | "Help", "Wallet", "Activity" 카드 라벨 |
| `type/caption` | 13px / Regular, secondary 컬러 | "Take an interactive tour..." 설명 |
| `type/badge` | 13px / Semibold | "5.00" 평점 텍스트 |
| `type/tabbar` | 11px / Medium | 하단 탭 라벨 |

---

## 3. 레이아웃 / 스페이싱 (8pt 그리드 기반)

- 화면 좌우 패딩: `20px`
- 섹션 간 수직 간격: `16~24px`
- 카드 내부 패딩: `16px`
- 퀵 액션 카드 간 gap: `12px`
- 리스트 아이템 높이: `56~60px` (아이콘 24px + 좌우 패딩 16px)
- 하단 탭바 높이: `~80px` (safe-area 포함)

---

## 4. 컴포넌트 목록

### 4.1 Header (프로필 헤더)
- 좌: 이름(Display) + 별점 배지(Pill: ★ + 평점 숫자)
- 우: 원형 아바타 (44~48px, fallback 시 흰 배경 + 회색 사람 아이콘)

### 4.2 Quick Action Grid (3열 카드)
- 동일 너비 3개 카드, `surface/card` 배경, radius `16px`
- 아이콘(상단, 24px, outline 스타일) + 라벨(하단, body) 수직 정렬, 중앙 정렬
- 예: Help / Wallet / Activity

### 4.3 Promo Card (배너형 카드)
- 전체 너비, `surface/card` 배경, radius `16~20px`
- 좌: 타이틀(title) + 설명(caption, 2줄까지)
- 우: 일러스트/아이콘 (장식용, 단색이 아닌 포인트 컬러 허용 — 유일하게 컬러풀한 요소)
- 예: "Privacy checkup"

### 4.4 List Item (메뉴 리스트)
- 좌: 아이콘 (outline, 24px, secondary 컬러)
- 중: 타이틀(title) + 옵션 서브타이틀(caption)
- 행 전체 클릭 가능, 구분선 없이 충분한 vertical spacing으로 구분 (또는 옅은 divider)
- 예: Settings / Messages / Setup business profile / Manage account / Legal

### 4.5 Bottom Tab Bar
- 4개 탭, 아이콘(상단) + 라벨(하단) 구성
- 활성 탭: `nav/active` 컬러, 굵게
- 비활성 탭: `nav/inactive` 컬러
- 예: Home / Services / Activity / Account

---

## 5. 디자인 원칙 요약

1. **다크 모드 단일 기준** — 거의 순흑 배경 + 짙은 회색 카드의 2단 계층 구조
2. **컬러는 최소, 일러스트로 포인트** — UI 자체는 흑백/회색조, 강조는 카드 내 일러스트 아이콘에만 사용
3. **둥근 모서리(16px+) 일관 적용** — 카드/배지/아바타 전반에 부드러운 radius
4. **아이콘은 outline 스타일 통일** — 굵기 일정한 라인 아이콘, 채움 없음 (별 아이콘 제외)
5. **정보 위계는 굵기+컬러로 구분** — 별도 폰트 패밀리 변경 없이 weight(semibold/regular)와 컬러(primary/secondary)만으로 위계 표현

---

## 6. 다음 단계 (대기 중)

- [ ] 사용자가 co-work-app의 신규 앱 구성(화면 목록, 정보구조)을 설명할 예정
- [ ] 위 디자인 토큰/컴포넌트를 기준으로 실제 컴포넌트 라이브러리(코드) 구현은 그 이후 진행
