# bracket-view

> 자체 완결형, 의존성 없는 `<bracket-view>` 웹 컴포넌트 — 단일 토너먼트 시각화.
> Google Search 토너먼트 카드의 paper-fold UX에서 착안.

[![라이브 데모](https://img.shields.io/badge/%EB%9D%BC%EC%9D%B4%EB%B8%8C%20%EB%8D%B0%EB%AA%A8-sigco3111.github.io%2Fbracket--view-blue?logo=githubpages&logoColor=white)](https://sigco3111.github.io/bracket-view/)
[![MIT](https://img.shields.io/badge/%EC%9D%B5%EC%8A%A4%ED%8B%B0%ED%82%A4%EC%A6%9D-MIT-green.svg)](LICENSE)
[![의존성 0](https://img.shields.io/badge/%EC%9D%98%EC%A1%B4%EC%84%B1-0-yellow.svg)]()
[![ESM](https://img.shields.io/badge/script%20type-module-blueviolet.svg)]()
[![~46KB](https://img.shields.io/badge/%ED%81%AC%EA%B8%B0-~46KB-orange.svg)]()

---

## ✨ 무엇을 하는가

```html
<script type="module" src="./bracket-view.js"></script>
<bracket-view teams="Brazil,Croatia,Argentina,Netherlands,France,Poland,England,Senegal"
              title="FIFA World Cup 2026"
              layout="paper-fold">
</bracket-view>
```

→ React / Vue / 빌드 도구 없이 단일 ES 모듈 한 줄로 **탭 + 스와이프 + 클릭-승자 + 자동 승자 전파** 가 모두 동작하는 토너먼트 카드가 만들어집니다.

---

## 📸 스크린샷

데모 페이지 (`https://sigco3111.github.io/bracket-view/`) 의 첫 카드는 한글로 표시되며, 깃발 이모지 / 날짜 / 진행 상태 배지 / 브래킷 연결선이 모두 포함된 8팀 월드컵 브래킷입니다.

```
┌─ FIFA World Cup 2026 ─────────────────────────────────────┐
│ [16강] [8강] [4강] [결승]         ↺ 초기화  ⚄ 랜덤  ⤢ 펼치기│
│ 16강 승자는 8강으로 진출                                   │
│                                                           │
│  ┌─Brazil vs Croatia─┐  1    ┌─Brazil vs Netherlands─┐ ←   │
│  │ 🇧🇷  Brazil     1  │   \ /  │ 🇧🇷  Brazil       1  │    │
│  │ 🇭🇷  Croatia   ─ 0  │    X   │ 🇳🇱  Netherlands  ─ 0 │    │
│  └────────────────────┘   / \  └────────────────────────┘  │
│                          /   \                              │
│  …                                                          │
└───────────────────────────────────────────────────────────┘
```

---

## 🚀 빠른 시작 (어떤 프레임워크든)

```bash
# 가장 간단한 사용 — ES 모듈 하나만 포함시키면 됩니다.
curl -L https://github.com/sigco3111/bracket-view/raw/main/bracket-view.js > bracket-view.js
```

```html
<script type="module" src="./bracket-view.js"></script>

<bracket-view teams="A,B,C,D,E,F,G,H"
              title="Esports Cup"
              layout="paper-fold">
</bracket-view>
```

```jsx
// React
<bracket-view ref={ref} teams={csv} title="League" />

// Vue
<bracket-view :teams="csv" title="League" />

// Svelte
<bracket-view {teams} {title} />

// Solid / Angular / Lit / 일반 HTML
<bracket-view teams={csv} title="League" />
```

커스텀 엘리먼트이라서 어떤 프레임워크에서도 동일하게 동작합니다. 팀 수가 2^N 아니어도 BYE 가 자동으로 다음 라운드로 진출합니다.

---

## 🎯 기능

| 기능 | 설명 |
|---|---|
| **paper-fold 레이아웃** *(기본값)* | 탭 + 스와이프 페이지 — 한 페이지 = 한 라운드 쌍 |
| **flat 레이아웃** | 한 줄 가로 SVG 트랙 (v1 방식) |
| **탭 + active underline** | 클릭한 라운드 페이지로 smooth-scroll |
| **스와이프 / 드래그** | 네이티브 scroll-snap, 한 페이지씩 이동 |
| **focus 모드** | 빈 카드 바디 클릭 → 다른 카드 흐려지고 포커 카드 확대 |
| **승자 자동 전파** | 팀 클릭 → 결정 → 다음 라운드 슬롯에 자동 배치 |
| **브래킷 연결선 (M-curve)** | from과 to 컬럼을 잇는 회색/푸른 곡선 |
| **staggered 미리보기 카드** | from 컬럼의 두 매치 사이 정중앙에 preview 카드 정렬 |
| **풍부한 콘텐츠 fit** | 깃발 + 이름 + 점수 + ◀ + 메타 행 (날짜, 상태 배지) 96px 안에 깔끔하게 |
| **랜덤 채우기** | "⚄ 랜덤" — 즉시 모든 승자 무작위 결정 |
| **초기화** | "↺ 초기화" — 모든 결정 취소 |
| **한국어 라운드 라벨** | 32강 / 16강 / 8강 / 준결승 / 결승 자동 (5 라운드 기준) |
| **자연스러운 한국어 조사** | 받침 유무에 따라 "을 / 를", "으로 / 로" 자동 처리 |
| **테마 가능** | `--bv-*` CSS 변수 12개 모두 재정의 가능 |
| **의존성 0, 빌드 0** | ES 모듈 한 파일 (~46KB). CDN에서도 로드 가능 |

---

## 🎛 프로그래밍 API

```js
import './bracket-view.js';              // <bracket-view> 자동 등록

const b = document.querySelector('bracket-view');

// 1. 선언적 — 팀 이름 목록만 전달 (CSV)
b.setData(b._generateFromTeams(['Brazil', 'Croatia', '… 8 명']));
// 또는 더 짧게: 위 teams= 어트리뷰트가 연결되면 자동으로 채워짐

// 2. 선언적 — 점수 / 상태까지 포함
b.setData({
  title: 'World Cup 2026',
  rounds: [
    [
      { a: { name: 'Brazil', flag: '🇧🇷' },
        b: { name: 'Croatia', flag: '🇭🇷' },
        winner: 'a',
        status: 'fulltime',
        date: '7.11 (금) 오전 4:00',
        scores: { a: 1, b: 0 } },
      // … 나머지 3 매치 …
    ],
    // …8강, 준결승, 결승, 3 / 4위 결정전…
  ],
});

// 3. 유틸
b.randomFill();             // 즉시 모든 매치에 무작위 승자 배치 (토너먼트 시뮬레이터)
b.reset();                  // 처음 라운드로 돌아감, 결정 모두 취소
b.setLayout('flat');        // v1 스타일 SVG 레이아웃으로 전환
b.getState();               // 현재 상태 깊은 복사 (JSON-friendly)
```

### `setData` 입력 모양

| 필드 | 필수 | 설명 |
|---|---|---|
| `title` | - | 탭 위에 표시되는 헤더 |
| `rounds` | **필수** | 배열, 각 원소는 매치 객체 배열. 인덱스 0 = 첫 라운드 (가장 많은 매치) |
| `match.id` | - | 안정 id. 이벤트 연결할 때 유용 |
| `match.a` / `match.b` | **필수** (단, 아래 `prev`로 자동 채워질 경우 예외) | `{ name, flag, displayName? }`. 다음 라운드에서 채워지면 `null` 사용 |
| `match.winner` | - | `'a'` / `'b'` / `null`. 승자 결정 시 자동으로 다음 라운드에 전파 |
| `match.scores.{a,b}` | - | 숫자. `status !== 'scheduled'` 일 때 표시 |
| `match.status` | - | `'scheduled'` / `'live'` / `'fulltime'` / `'completed'`. 배지 스타일 결정 |
| `match.date` | - | 메타 행에 표시 (예: `'7.11 (금) 오전 4:00'`) |
| `match.kickoff` | - | `status === 'scheduled'` 일 때 점수 대신 표시 |

---

## 🖱 인터랙션

| 동작 | 결과 |
|---|---|
| 카드 안의 팀 행 클릭 | 그 팀을 승자로 결정, 다음 라운드로 전파 |
| 빈 매치 카드 바디 클릭 | 그 카드에 focus — 다른 카드 흐려지고 확대 |
| focus된 카드 다시 클릭 (또는 *✕ 포커스 해제*) | focus 해제 |
| 탭 클릭 | 그 라운드 페이지로 smooth-scroll |
| 트랙 스와이프 / 드래그 | 한 페이지 좌 / 우 이동 |
| **↺ 초기화** | 모든 결정 취소, 처음 라운드로 |
| **⚄ 랜덤** | 즉시 모든 매치에 무작위 승자 |
| **⤢ 펼치기** / **⤡ 접기** | flat 레이아웃과 paper-fold 사이 토글 |

---

## 🇰🇷 라운드 라벨

5-라운드 토너먼트는 탭이 자동으로 `32강 / 16강 / 8강 / 준결승 / 결승` 로 표시됩니다. 다른 깊이에서는 `${total - idx}강` (예: `4강`, `2강`) 형식 또는 영문 (`Quarterfinals`, `Semifinals`, `Final`) 으로 폴백.

페이지 부제 (탭 부제) 에도 자연스러운 한국어 조사가 자동 적용됩니다:

```
16강 승자는 8강으로 진출
8강  승자는 4강으로 진출
4강  승자는 결승으로 진출
결승 — 우승자 결정
```

`을 / 를`, `으로 / 로` 와 같은 한국어 받침에 따른 조사 처리가 코드에 포함되어 있습니다.

---

## 🎨 테마

호스트 CSS에서 12개 변수를 재정의:

```css
bracket-view {
  --bv-bg:         #0f1115;  /* 페이지 배경                    */
  --bv-card:       #1a1d24;  /* 카드 채우기                    */
  --bv-card-hover: #252932;
  --bv-text:       #e5e7eb;  /* 팀 이름                        */
  --bv-text-dim:   #9ca3af;
  --bv-accent:     #4f9eff;  /* 탭 underline / focus 강조      */
  --bv-winner:     #22c55e;  /* 승자 색상                      */
  --bv-loser:      #6b7280;  /* 패자 색상                      */
  --bv-line:       #2a2f3a;  /* 카드 테두리 / 연결선           */
  --bv-trophy:     #facc15;  /* 우승 트로피                    */
  --bv-danger:     #ef4444;  /* 'live' 배지 색상               */
}
```

라이트 테마 프리셋:

```css
bracket-view {
  --bv-bg: #fff; --bv-card: #f8fafc; --bv-card-hover: #e0e7ff;
  --bv-text: #0f172a; --bv-text-dim: #64748b;
  --bv-accent: #2563eb; --bv-winner: #16a34a;
  --bv-line: #e2e8f0; --bv-trophy: #ca8a04; --bv-danger: #dc2626;
}
```

---

## 🌐 쇼케이스: 8개 라이브러리 옆에 나열

데모 페이지 (`https://sigco3111.github.io/bracket-view/`) 는 단순한 컴포넌트 사용 예가 아니라 **라이브러리 비교 쇼케이스** 입니다. 동일한 8팀 단일 토너먼트를 8가지 다른 오픈소스 프로젝트로 렌더링해 시각 패턴을 한눈에 비교할 수 있습니다:

| # | 라이브러리 | 데모 페이지에서의 렌더링 방식 |
|---|---|---|
| 1 | **sigco3111/bracket-view (자체 빌드)** | `./bracket-view.js` 에서 실제 import |
| 2 | Drarig29/brackets-viewer.js | 순수 JS 재구현 |
| 3 | kamilwylegala/vue-tournament-bracket | 순수 JS 재구현 |
| 4 | teijo/jquery-bracket | 순수 JS 재구현 |
| 5 | moodysalem/react-tournament-bracket | 순수 JS 재구현 (SVG) |
| 6 | CSS-only 베이스라인 (Google 검색 스타일) | CSS 만 사용 |
| 7 | @amirhossein-shk/tournament-bracket-js | 라이브 import (UMD, 현재 라이브러리 자체 결함으로 실패 → fallback 메시지 표시) |
| 8 | Zettersten/gracket | 라이브 import (WebComponent) |

페이지 헤더의 **한국어 / English** 토글 (`localStorage` 에 저장) 로 모든 페이지 텍스트가 한영 토글됩니다. 컴포넌트 자체는 자체 한글 인터페이스를 갖고 있으므로 컴포넌트 내부 콘텐츠는 항상 한글로 표시됩니다.

---

## 🧪 로컬에서 실행

```bash
git clone https://github.com/sigco3111/bracket-view
cd bracket-view
python3 -m http.server 8000
# http://localhost:8000 열기
```

`python3 -m http.server` 외 어떤 정적-파일 서버 (예: `npx serve` , `php -S localhost:8000` , Caddy, Nginx) 모두 동작합니다. 백엔드, npm 설치 단계 모두 필요 없습니다.

---

## 📦 프레임워크 내장

커스텀 엘리먼트이라서 프레임워크에 무관합니다:

```jsx
// React
<bracket-view ref={ref} teams={csv} title="League" />

// Vue
<bracket-view :teams="csv" title="League" />

// Svelte
<bracket-view {teams} {title} />

// Solid / Angular / Lit / 일반 HTML
<bracket-view teams={csv} title="League" />
```

---

## 🛠 버전 진화

| 버전 | 추가된 것 |
|---|---|
| v1 (flat)   | 한 줄 가로 SVG, 스와이프 / 스크롤 |
| v2          | paper-fold UX + 탭 + 탭 트랙 underline |
| v3          | 라운드 쌍 사이 연결선 (M-curve) |
| v4          | sticky 탭 + focus 격리 + 흐림 처리 |
| v6          | 카드 텍스트 오버플로우 처리 |
| v8          | from / preview 컬럼 동등 폭 (`minmax(0, 1fr)`) |
| v9          | 5 개 다른 라이브러리 비교 쇼케이스 페이지 |
| v10         | bracketry (사용자 거부) 제거 후 5 개 더 나은 라이브러리 추가 |
| v11         | 쇼케이스에 우리 `<bracket-view>` 카드 #1 추가 |
| v17         | 전체 한글화: 탭, 페이지 부제, 버튼 라벨, 상태 배지, 자연스러운 한국어 조사 |
| v18-v19     | 카드 콘텐츠 fit + 반응형 폰트 사이즈 |
| v20         | 콘텐츠 풍부한 preview 슬롯 (`flag + name + score + ◀ 화살표`) |
| v21         | preview 카드를 브래킷 교차선에 정확하게 `grid-template-rows` 수학으로 정렬 |
| v22         | 데모 페이지에 한 / 영 토글 (`localStorage` 저장) |

---

## 📄 라이선스

MIT. 자유롭게 사용 / 수정 / 배포.

```text
Copyright (c) 2026 Hyelyn (sigco3111)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```
