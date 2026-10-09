---
title: deckmd 소개
theme: catppuccin
mode: light           # 밝은 모드 (테마가 지원할 때)
---

<!-- tier: core; class: chapter -->

###### deckmd 소개

# 마크다운 한 파일이 발표 덱이 된다

빌드 없이 브라우저에서 보고, 끝나면 HTML 하나로 {.teaser}

소스: [examples/readme/rewrite-ko.md](https://github.com/qgp9/deckmd/blob/main/examples/readme/rewrite-ko.md) {.small .muted}

Note:
deckmd 를 소개합니다. 마크다운 파일 하나로 reveal.js 발표 덱을 만드는 도구입니다.
이 덱은 README.md 를 AI 에게 발표용으로 재구성해 달라고 해서 만든 예제입니다.

---

<!-- tier: core -->

## 덱 하나에 필요한 세 가지

::::: cols three
::: card hl
### 쓰기
마크다운으로
:::
::: card
### 틀
여러 덱이 같이 쓰는 템플릿
:::
::: card cool
### 남기기
HTML 파일 하나로 묶기
:::
:::::

Note:
deckmd 는 세 가지가 합쳐진 것입니다.
마크다운으로 쓰는 문법, 여러 덱이 한 벌로 같이 쓰는 템플릿, 그리고 끝난 덱을 파일 하나로 얼리는 묶기입니다.
차례로 보겠습니다.

---

<!-- tier: core; class: chapter -->

###### 1

# 마크다운으로 쓰기

reveal.js 위에 문법 몇 가지를 더했다 {.teaser}

---

<!-- tier: core -->

## 장 나누기는 `---` 한 줄

```markdown
---
title: 첫 발표
theme: catppuccin
---

# 첫 발표

---

## 오늘 할 이야기

- 마크다운으로 쓴다 {.fragment}
```

Note:
맨 위 머리말에 제목과 테마를 적고, 장 사이에는 줄표 세 개 한 줄을 둡니다.
코드 블록 안의 줄표 세 개는 장 나누기로 치지 않습니다.

---

<!-- tier: core -->

## 속성은 `{…}`, 묶음은 `:::`

::: fragments
- `{.fragment}`: 클릭하면 나타남
- `[글자]{.muted}`: 글자 일부에만 클래스
- `::: cols`: 두 단으로 나란히
- 장 맨 앞 `<!-- class: chapter; tier: core -->`: 장 설정
:::

Note:
요소에 붙일 속성은 문단이나 항목 끝의 중괄호로, 장에 붙일 설정은 장 맨 앞 주석으로 씁니다.
reveal.js 기능(단계별 등장, 배경, 전환, auto-animate, 코드 줄 강조)도 이 방법으로 마크다운에서 그대로 씁니다.

---

<!-- tier: core -->

## 노트, 검토 메모, 짧은 판

| 쓰는 법 | 결과 |
|---|---|
| `Note:` 아래 | 발표자 노트 (`S` 키) |
| `<!-- @@ 메모 -->` | 검토 메모, `?draft` 로 열 때만 |
| `tier: core` | `?core` 로 열면 이 장만 남음 |

Note:
발표 시간이 줄면 주소에 ?core 를 붙여 core 장만으로 짧은 판을 엽니다.
이 덱도 core 장만 이어 봐도 이야기가 통하게 짰습니다.

---

<!-- tier: core -->

## README 도 그대로 덱이 된다

- 장 구분이 없으면 **제목으로 잘라** 장을 만든다
- 길면 "(계속)" 장으로, 그래도 넘치면 글씨를 줄인다
- 마음에 안 들면 AI 에게 다듬어 달라고 하면 된다 🙂

Note:
줄표 장 구분이 하나도 없는 마크다운은 제목으로 잘라 덱을 만듭니다. 머리말의 split, lines 나 주소 옵션으로 조절합니다.
규칙으로 자르는 것이라 완벽하지는 않습니다. 다듬은 덱이 필요하면 AI 에게 부탁하면 됩니다. 이 덱이 그렇게 만든 것입니다.

---

<!-- tier: core -->

## 문법은 플러그인으로 더한다

- 코드 블록 언어 하나로 그림 하나
- 내장: 칸 그림 ```` ```grid ````
- 머리말 `plugins: [이름]` 으로 켠다

Note:
코드 블록 언어 하나로 그림을 그리는 식의 문법은 플러그인이 더합니다.
만드는 법은 docs/plugins.md 에 있습니다.

---

<!-- tier: core; class: chapter -->

###### 2

# 템플릿

여러 덱이 한 벌의 틀을 같이 쓴다 {.teaser}

---

<!-- tier: core -->

## 실행 파일은 `<script>` 한 줄

```html
<script src="deckmd/js/boot.js"></script>
```

- `boot.js` 가 나머지(테마·플러그인·라이브러리)를 찾는다
- 라이브러리(reveal.js, markdown-it, 글꼴)는 CDN

Note:
덱을 여는 index.html 에는 boot.js 를 부르는 태그 한 줄만 있습니다.
boot.js 는 자기 주소를 기준으로 나머지 파일을 찾습니다.

---

<!-- tier: core -->

## 준비하는 법은 세 가지

| 방법 | 이럴 때 |
|---|---|
| **저장소** (권장) | 발표가 계속 쌓이는 내 발표 저장소 |
| **CDN** | 받을 것 없이 바로 |
| **인터넷 없이** | 비행기, 폐쇄망 |

Note:
권장하는 것은 발표 저장소에 deckmd 를 deckmd 폴더로 두는 방법입니다.
CDN 은 boot.js 태그 주소만 CDN 으로 바꾸면 되고, npm 에 올린 뒤부터 됩니다.
인터넷 없이 쓸 때는 localize.mjs 로 라이브러리를 미리 받아 두고 태그에 data-local 을 붙입니다.

---

<!-- tier: core -->

## 테마를 바꿔도 문법은 그대로

- 테마: `ember`(기본), `catppuccin`, `solarized`, reveal.js 내장 테마
- 밝은/어두운 모드
- 레이아웃 클래스(`cols`, `card`, `chapter` …)와 색 변수는 공통

Note:
테마는 머리말의 theme 한 줄로 바꿉니다.
레이아웃 클래스와 색 변수가 테마마다 같아서, 테마를 바꿔도 마크다운은 고치지 않습니다.

---

<!-- tier: core -->

## 공통 설정은 `deck.config.js` 하나

```js
window.DeckConfig = {
  title: '발표 목록',
  scan: ['talks/*'],   // 덱 목록을 만들 폴더
  theme: 'ember',      // 모든 덱의 기본값
};
```

Note:
실행 파일 옆에 두는 설정 파일입니다. 모든 덱의 기본값과 덱 목록을 정합니다.
덱 머리말에 적은 값이 있으면 그것이 설정 값을 바꿉니다.

---

<!-- tier: core; class: chapter -->

###### 3

# 묶기

끝난 덱을 HTML 파일 하나로 얼린다 {.teaser}

---

<!-- tier: core -->

## E 키 하나로 파일 하나

::::: cols
::: card hl
### 오프라인
전부 넣은 파일

인터넷 없이 열림 {.small .muted}
:::
::: card cool
### 공유
라이브러리는 CDN

작은 파일, 인터넷 필요 {.small .muted}
:::
:::::

> 템플릿이 나중에 바뀌어도 그 덱은 그대로 열린다 {.fragment}

Note:
덱을 보다가 E 키를 누르고 오프라인이나 공유를 고르면 파일을 내려받습니다.
오프라인은 4 MB 에 그림을 더한 크기이고, 대부분은 Pretendard 글꼴과 코드 강조입니다. 공유는 수십 KB 에 그림을 더한 크기입니다.
결과 파일을 덱 옆에 커밋해 두면 그것이 얼린 판입니다.

---

<!-- tier: core -->

## 명령줄도 같은 결과

```bash
node deckmd/tools/build.mjs talks/x/talk.md          # 오프라인
node deckmd/tools/build.mjs talks/x/talk.md --share  # 공유
npx deckmd talks/x/talk.md                           # deckmd 폴더 없이
```

Note:
사람 없이 묶을 때, 에이전트나 스크립트로 여러 덱을 한꺼번에 다시 묶을 때 씁니다.
jsdom 에서 실행 파일을 브라우저처럼 열어 같은 코드를 돌리기 때문에 결과는 E 키와 같습니다.
처음 한 번 deckmd 폴더에서 npm install 이 필요하고, Node 22 이상이어야 합니다.

---

<!-- tier: core -->

## 묶은 파일에서 내 파일만 다시 꺼낸다

```bash
node deckmd/tools/build.mjs x.offline.html --unpack
```

- 꺼내는 것: 마크다운, 그림, 덱의 CSS·JS, `deck.config.js`
- 라이브러리와 deckmd 것은 꺼내지 않는다

Note:
풀기입니다. 묶을 때 파일마다 원래 자리를 표시해 두기 때문에, 사용자 파일만 원래 자리로 꺼낼 수 있습니다.

---

<!-- tier: core -->

## 시작은 명령 몇 줄

1. `git submodule add <deckmd 저장소> deckmd`
2. `templates/` 의 `index.html`, `deck.config.js`, `talk.md` 복사
3. `deckmd/tools/serve.sh` → `http://localhost:8000/`
4. 끝나면 **E** → "오프라인"
{.steps-ol}

Note:
발표 저장소에 템플릿을 submodule 로 넣거나 deckmd 폴더에 복사합니다.
templates 의 실행 파일과 설정을 저장소 맨 위로, talk.md 를 talks 아래 새 폴더로 복사합니다.
serve.sh 를 띄우고 localhost 8000 에서 덱을 고릅니다. Windows 는 serve.cmd 입니다. 마크다운을 고치고 새로고침하면 됩니다.

---

<!-- tier: core -->

## 정리

::: fragments
- **쓰기**: 마크다운 한 파일, reveal.js 기능 그대로
- **틀**: `<script>` 한 줄, 테마를 바꿔도 문법은 그대로
- **남기기**: E 키로 HTML 하나, 다시 풀 수도 있다
:::

자세한 것은 `docs/` {.small .muted}

Note:
문서는 docs 폴더에 있습니다. 사용법은 usage.md, 문법은 writing.md, 묶기는 packing.md 입니다.

---

<!-- tier: core; class: chapter -->

# 감사합니다

MIT 라이선스 {.teaser}

---

<!-- tier: backup; fit -->

## 주소 옵션

| 옵션 | 뜻 |
|---|---|
| `?src=경로.md` | 열 덱 |
| `?deck-list` | 덱 목록 |
| `?core` | `tier: core` 장만 (짧은 판) |
| `?draft` | 검토 메모를 노란 쪽지로 |
| `?mode=dark\|light\|auto` | 밝은/어두운 모드 (테마가 지원할 때) |
| `?split=headings&lines=10` | 장 구분이 없는 마크다운을 제목으로 자르는 방식 |
| `?pick` | 서버로 열었어도 파일 고르기 |
| `?print-pdf` | 인쇄용 (⌘/Ctrl+P → PDF 로 저장) |

---

<!-- tier: backup -->

## 단축키

| 키 | 하는 일 |
|---|---|
| `→` `Space` | 다음 |
| `S` | 발표자 화면 (노트·시계) |
| `Esc` `O` | 전체 보기 |
| `F` / `B` | 전체 화면 / 화면 가리기 |
| `E` | deckmd 도우미 (모드, `?draft`·`?core`, PDF, 묶기) |

---

<!-- tier: backup -->

## 서버 없이 열기

- `index.html` 을 바로 열면 처음 한 번 마크다운 파일을 직접 고른다 (버튼 또는 끌어다 놓기)
- Chrome·Edge 는 고른 파일을 기억하고, 저장하면 바로 다시 그린다
- 이렇게 연 덱을 묶으면 덱 옆의 그림·CSS·JS 가 빠진다

Note:
브라우저가 file 주소의 페이지에서 옆 파일 읽기를 막기 때문입니다.
그림이 있는 덱은 index.html?src=talks/x/talk.md 처럼 열고 그 파일을 고릅니다.

---

<!-- tier: backup; fit -->

## 라이선스

| 라이브러리 | 라이선스 |
|---|---|
| reveal.js, markdown-it (+ 플러그인), js-yaml, jsdom | MIT |
| highlight.js | BSD-3-Clause |
| Pretendard, League Gothic, Source Sans Pro 글꼴 | SIL Open Font License 1.1 |
| Catppuccin, Solarized 색 (테마) | MIT |

deckmd 는 MIT. 묶은 파일 맨 위 주석에 들어 있는 라이브러리와 라이선스 주소가 적힌다 {.small .muted}
