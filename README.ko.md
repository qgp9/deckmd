# deckmd

[English](README.md) · 한국어

마크다운 한 파일로 만드는 reveal.js 발표 덱.
빌드 없이 브라우저에서 바로 보고, 끝나면 HTML 파일 하나로 묶는다.

**데모: [qgp9.github.io/deckmd](https://qgp9.github.io/deckmd/)** — 이 페이지도 deckmd 덱입니다. 예제 전체는 [?deck-list](https://qgp9.github.io/deckmd/?deck-list) (영문).

## TL;DR

```bash
cat > mydeck.md <<'EOF'
# Hello deckmd

---

## A slide

- Markdown in
- slides out
EOF
npx deckmd mydeck.md --share      # → dist/mydeck.share.html: 작은 파일 하나, 브라우저로 열면 됩니다
```

쓰는 동안 바로 미리보기: `npx deckmd serve mydeck.md`. Node 가 없다면 [아래](#node-가-있어도-없어도)를 보세요. (`npx` 첫 실행은 설치 때문에 몇 초 걸립니다.)

## 덱은 이렇게 생겼습니다

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

## node 가 있어도 없어도

reveal.js 가 원래 그렇듯, deckmd 도 쓰고 발표하는 데 빌드도, 웹 서버도, node 도 필요 없다. 마크다운·테마·플러그인은 그 위에 얹은 것이라 이 장점을 해치지 않는다. node 는 선택이고, 있으면 더 편하다.

- **마크다운은 별도 파일로 둘 수 있다.** `index.html` 은 한 줄짜리 런처(`<script src="…/js/boot.js">`)이고, 슬라이드는 옆의 `slides.md` 에 쓴다. 파일 하나가 좋으면 슬라이드를 `index.html` 안에 써도 된다. node 가 있으면 `index.html` 도 필요 없다: `npx deckmd serve my-deck.md` 로 마크다운 파일만 보여 준다.
- **node 도 웹 서버도 없이.** `index.html` 을 브라우저로 열고 마크다운 파일을 고르면(버튼 또는 끌어놓기) 된다. Chrome/Edge 는 고른 파일을 기억해서 저장하면 다시 그리고, 다른 브라우저는 새로고침 전까지만 기억한다. 발표, 발표자 보기, PDF 인쇄, E 키 도우미가 모두 이 상태로 된다([docs/usage.md](docs/usage.md#without-a-server)).
- **오프라인 패킹도 브라우저에서 한다.** **E** → "오프라인" 을 누르면 페이지가 스스로 인터넷 없이 열리는 HTML 파일 하나로 묶는다. node 도 빌드 도구도 필요 없다. (`file://` 로 열었으면 브라우저가 마크다운 옆 파일을 읽지 못하게 하므로, 경로로 참조한 이미지, CSS, 스크립트는 빠진다. 웹 서버로 열면 들어간다. 자세히: [docs/packing.md](docs/packing.md).)
- **node 가 있으면 제일 편하다.** `npx deckmd init` 으로 프로젝트를 만들고, `npx deckmd serve` 로 띄워 다시 불러오며(덱이 여럿이면 목록도), `npx deckmd add` 로 덱을 더하고, `npx deckmd talk.md` 로 명령줄에서 패킹한다(E 키와 같은 파일이 나온다).

| | 필요한 것 | 얻는 것 |
|---|---|---|
| 쓰기, 발표 | 브라우저 | 덱 자체 (Chrome/Edge 가 아니면 새로고침 때마다 마크다운 파일을 다시 고름) |
| 오프라인 패킹 | 브라우저 | HTML 파일 하나 (`file://` 면 덱 옆 파일은 빠짐) |
| `npx deckmd …` | node 22 이상 | `index.html` 없이 보기, 서버, 덱 목록, 명령줄 패킹 |

## 무엇인가

deckmd 는 세 가지가 합쳐진 것이다.

### 1. 마크다운으로 쓰기

reveal.js 위에 마크다운 문법 몇 가지를 더했다.

- `---` 로 장을 나누고, 장 맨 앞 `<!-- class: chapter; tier: core -->` 로 장 설정
- `{.fragment}`, `{.class #id key=val}` 로 속성, `[글자]{.muted}` 로 일부만, `::: cols` 로 묶음
- `Note:` 아래는 발표자 노트, `<!-- @@ 메모 -->` 는 검토 메모 (`?draft`), `?core` 로 짧은 판
- reveal.js 기능(단계별 등장, 배경, 전환, auto-animate, 코드 줄 강조)을 마크다운에서 그대로
- 장 구분이 없는 마크다운(README 등)은 제목으로 잘라 덱으로
- 플러그인으로 문법 더하기 (내장: 칸 그림과 표 ```` ```grid ````, 슬라이드 아래 소스 보기, KaTeX 수식)

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
npx deckmd init                  # index.html + slides.md (deckmd 는 CDN 에서)
npx deckmd serve                 # 작은 웹 서버. http://localhost:8000/ 을 열고 slides.md 를 고친다
```

프로젝트 없이 마크다운 파일만 보려면 `npx deckmd serve my-deck.md` (그 덱 하나), `npx deckmd serve a.md b.md` (덱 목록). 프로젝트 안에서 쓰면 그 프로젝트의 `index.html` 과 `deck.config.js` 를 따르고 보여 줄 덱만 바꾸므로 테마도 그대로 적용된다. 폴더를 주면(`npx deckmd serve some/folder`) 그 안의 모든 덱을 보여 준다. 프로젝트는 git 이 저장소를 찾듯 현재 폴더와 그 위 폴더에서 찾고, `npx deckmd -C 경로 …` 로 다른 폴더에서 시작할 수 있다. `--port`, `--open`, `--host 0.0.0.0` (같은 네트워크의 폰에서 열기)도 있다.

끝나면 덱을 보다가 **E** → "오프라인", 또는 `npx deckmd slides.md`. 결과 파일을 덱 옆에 커밋해 두면 그것이 얼린 판이다.

`init` 에는 선택이 둘 있고, 각각 기본값이 있다.

| 옵션 | |
|---|---|
| `--cdn` (기본) / `--repo` | deckmd 를 어디서 가져오나: 버전을 고정한 CDN / 내 저장소의 `deckmd/` 에 복사 (오프라인 가능, 버전은 내 것) |
| `--single` (기본) / `--multi` | 덱 하나: `index.html` + `slides.md` / 폴더마다 덱 하나인 발표 저장소: `index.html`, `deck.config.js`, `slides/first-deck/deck.md`, 첫 화면은 덱 목록 |

`init` 은 덮어쓰지 않는다. 파일이 하나라도 있으면 (`--repo` 는 `deckmd/` 도) 아무것도 바꾸지 않고 멈춘다. 손으로 하거나 git submodule 로 하려면 [docs/usage.md](docs/usage.md) (영문).

프로젝트 안에서는(어느 폴더에서든) `npx deckmd add my-talk "발표 제목"` 으로 덱을 더한다: 견본에서 `slides/my-talk/deck.md` 를 만들고 제목과 날짜를 채우며, 덱 목록에 바로 뜬다. 프로젝트 밖에서는 `./my-talk.md` 를 만든다.

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
