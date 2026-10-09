# deckmd

[English](README.md) · 한국어

마크다운 한 파일로 만드는 reveal.js 발표 덱.
빌드 없이 브라우저에서 바로 보고, 끝나면 HTML 파일 하나로 묶는다.

**데모: [qgp9.github.io/deckmd](https://qgp9.github.io/deckmd/)** — 이 페이지도 deckmd 덱입니다. 예제 전체는 [?deck-list](https://qgp9.github.io/deckmd/?deck-list) (영문).

```markdown
---
title: 첫 발표
theme: catppuccin
---

# 첫 발표

---

## 오늘 할 이야기

- 마크다운으로 쓴다 {.fragment}
- 브라우저에서 바로 본다 {.fragment}

Note:
발표자 노트 (S 키)
```

## 무엇인가

deckmd 는 세 가지가 합쳐진 것이다.

### 1. 마크다운으로 쓰기

reveal.js 위에 마크다운 문법 몇 가지를 더했다.

- `---` 로 장을 나누고, 장 맨 앞 `<!-- class: chapter; tier: core -->` 로 장 설정
- `{.fragment}`, `{.class #id key=val}` 로 속성, `[글자]{.muted}` 로 일부만, `::: cols` 로 묶음
- `Note:` 아래는 발표자 노트, `<!-- @@ 메모 -->` 는 검토 메모 (`?draft`), `?core` 로 짧은 판
- reveal.js 기능(단계별 등장, 배경, 전환, auto-animate, 코드 줄 강조)을 마크다운에서 그대로
- 장 구분이 없는 마크다운(README 등)은 제목으로 잘라 덱으로
- 플러그인으로 문법 더하기 (내장: 칸 그림 ```` ```grid ````)

→ [docs/writing.md](docs/writing.md), 덱으로 된 설명서 [`examples/syntax/talk.md`](examples/syntax/talk.md)

### 2. 템플릿

여러 덱이 한 벌의 틀을 같이 쓴다.

- 실행 파일은 `<script src="…/js/boot.js">` 한 줄. 라이브러리(reveal.js, markdown-it, 글꼴)는 CDN, 인터넷 없이 쓸 때는 받아 둔 것으로
- 테마: `ember`(기본), `catppuccin`, `solarized`, reveal.js 내장 테마. 밝은/어두운 모드
- 레이아웃 클래스(`cols`, `card`, `chapter` …)와 색 변수 — 테마를 바꿔도 문법은 그대로
- 설정 `deck.config.js` 로 모든 덱의 기본값, 덱 목록
- 저장소에 `deckmd/` 로 두거나, CDN 한 줄로

→ [docs/usage.md](docs/usage.md), [docs/styling.md](docs/styling.md)

### 3. 묶기

끝난 덱을 HTML 파일 하나로 얼린다. 템플릿이 나중에 바뀌어도 그 덱은 그대로 열린다.

- 덱을 보다가 **E** 키 → "오프라인"(전부 넣은 파일, 인터넷 없이 열림) 또는 "공유"(라이브러리는 CDN, 작음)
- 명령줄도 같은 결과: `node deckmd/tools/build.mjs talk.md`, `npx deckmd talk.md`
- 풀기: 묶은 파일에서 내 파일(마크다운·그림·CSS)만 다시 꺼내기
- 들어 있는 라이브러리의 라이선스를 파일 맨 위에 적는다

→ [docs/packing.md](docs/packing.md)

## 시작하기

```bash
# 내 발표 저장소에 템플릿 넣기 (처음 한 번)
git submodule add <deckmd 저장소> deckmd        # 또는 deckmd/ 에 복사
cp deckmd/templates/index.html deckmd/templates/deck.config.js .
mkdir -p talks/첫발표 && cp deckmd/templates/talk.md talks/첫발표/

# 쓰면서 보기: http://localhost:8000/ → 덱 고르기. 고치고 새로고침
deckmd/tools/serve.sh           # Windows: deckmd\tools\serve.cmd (아직 Windows 에서 시험하지 않음)
```

끝나면 덱을 보다가 **E** → "오프라인". 결과 파일을 덱 옆에 커밋해 두면 그것이 얼린 판이다.

받을 것 없이 써 보려면 `index.html` 에 이 한 줄과 마크다운 파일 하나 (npm 에 올린 뒤부터):

```html
<script src="https://cdn.jsdelivr.net/npm/deckmd@0.1.0/js/boot.js"></script>
```

인터넷 없이 쓰는 법, 서버 없이 여는 법, 주소 옵션, 설정은 [docs/usage.md](docs/usage.md).

## 문서

[docs/](docs/) (자세한 문서는 영문입니다) — 사용법, 슬라이드 쓰기, 모양 바꾸기, 폰트, 묶기·풀기, 플러그인, 버튼과 JS, 저장소 꾸리기, 안쪽 구조.

## 라이선스

MIT ([LICENSE](LICENSE)). 불러 쓰는 라이브러리·글꼴은 각자의 라이선스를 따르며, 묶은 파일 맨 위 주석에 들어 있는 것과 라이선스 주소가 적힌다.

| 라이브러리 | 라이선스 |
|---|---|
| [reveal.js](https://github.com/hakimel/reveal.js) | MIT |
| [markdown-it](https://github.com/markdown-it/markdown-it), markdown-it-attrs, markdown-it-container, markdown-it-bracketed-spans | MIT |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT |
| [highlight.js](https://github.com/highlightjs/highlight.js) (reveal.js 의 highlight 플러그인 안) | BSD-3-Clause |
| [Pretendard](https://github.com/orioncactus/pretendard) 글꼴 | SIL Open Font License 1.1 |
| League Gothic, Source Sans Pro 글꼴 (reveal.js 내장 테마를 쓸 때) | SIL Open Font License 1.1 |
| [Catppuccin](https://github.com/catppuccin/catppuccin), [Solarized](https://github.com/altercation/solarized) 색 (테마) | MIT |
| [jsdom](https://github.com/jsdom/jsdom) (명령줄 묶기에만) | MIT |
