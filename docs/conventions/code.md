# 코드 컨벤션

타입·네이밍 세부는 [naming.md](naming.md) 가 정한다. 이 문서는 구조와 품질을 정한다.
여기에 없는 규칙은 `eslint.config.mjs` 와 `tsconfig.json` 이 판정한다.

## 1. 타입

- **`interface` 금지. `type` 만 쓴다.** `I` 접두사도 쓰지 않는다.
- `any` 금지. 모르는 값은 `unknown` 으로 받고 좁힌다.
- 열거는 `enum` 대신 `as const` 객체 + `(typeof X)[keyof typeof X]`.
- 접미사 표와 판별 순서도는 [naming.md](naming.md).

## 3. 폴더 구조와 공개 API 경계

```
app/                Next.js App Router (라우팅·서버 컴포넌트·route handler 전용)
src/
  engine/           three.js 렌더링. React 를 import 하지 않는다.
  audio/            Web Audio. React 를 import 하지 않는다.
  domain/           순수 로직·타입·스키마. 브라우저 API 를 직접 만지지 않는다.
  store/            방 저장소 어댑터 (supabase / local)
  api/              wire 타입과 fetch 래퍼
  features/<도메인>/ 화면. 폴더 밖으로는 index.ts 가 내보내는 것만 쓴다.
  hooks/            여러 feature 가 공유하는 훅
  lib/              프레임워크 무관 유틸
```

- **의존 방향은 한쪽이다**: `app` → `features` → (`hooks`, `store`, `api`) →
  (`domain`, `engine`, `audio`, `lib`). 역방향 import 금지.
- `engine` 과 `audio` 는 React·Next 를 모르며, 테스트에서 단독으로 돌아간다.

## 4. React

- 서버 컴포넌트가 기본. 브라우저 API·상태가 필요할 때만 `'use client'`.
- props 는 최소로. 무시되는 기본값·의미 없는 메모이제이션·override 되어
  사라지는 스프레드는 넣지 않는다.
- 리스트 `key` 는 배열 인덱스가 아니라 도메인 id.

## 5. 마크업과 접근성

- 의미 태그를 쓴다: `main`(페이지당 1개)·`header`·`nav`·`section`·`ul`/`ol`·`dl`.
  의미 없는 `div` 래퍼를 만들지 않는다.
- 헤딩은 `h1 → h2 → h3` 순서로, 건너뛰지 않는다.
- 클릭되는 것은 `button` 이나 `a`. `div + onClick` 금지.
- 텍스트 없는 컨트롤에는 `aria-label`. 라벨과 `placeholder` 에 같은 문구를 쓰지 않는다.
- 상태를 색으로만 전달하지 않는다 (글자나 아이콘을 함께 둔다).
- 모달·팝오버는 `Esc` 로 닫힌다. 포커스 가시성은 전역 `:focus-visible` 로 보장한다.
- 본문 대비 4.5:1, 큰 글자 3:1 (WCAG AA).

## 6. 코드 품질

- 동작을 설명하는 주석은 쓰지 않는다. **왜** 그렇게 했는지나 외부 계약만 남긴다.
- `console.*`·`debugger`·`TODO`·`FIXME` 를 커밋하지 않는다.
  진짜 필요한 로깅은 `src/lib/logger.ts` 를 쓴다.
- 매직 넘버·문자열은 상수로 뺀다.
- 빈 값·로딩·실패 세 상태를 항상 그린다.

## 7. 테스트

- 순수 로직(`domain`, `engine`, `audio`, `lib`)은 단위 테스트를 붙인다.
- 화면은 Testing Library 로 통합 테스트 — 구현이 아니라 사용자가 보는 것으로 찾는다
  (`getByRole` 우선, `data-testid` 는 최후수단).
- 사용자 흐름은 Playwright E2E.
- `npm run verify` (lint + typecheck + unit/integration) 가 초록이어야 커밋한다.

## 8. 커밋

- 형식과 규칙은 [commit.md](commit.md) 가 정한다 (commitlint 로 강제).
- 생성물(빌드 산출물)은 커밋하지 않는다.
