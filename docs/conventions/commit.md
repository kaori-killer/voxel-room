# 커밋 컨벤션

커밋 시점에 강제한다. 어기면 커밋 자체가 실패한다.

이 저장소는 의존성이 없어서 commitlint 대신 `.githooks/commit-msg` 가 같은 규칙을 본다.
클론한 뒤 한 번만 켜면 된다.

```bash
git config core.hooksPath .githooks
```

## 형식

```
type(scope): subject
```

예: `feat(colo-flamingo): 다산 연동 설정 모달 추가`

## 규칙

- **type 은 아래 9개만** — `feat` `refactor` `fix` `test` `docs` `chore` `style` `revert` `hotfix`
- type 은 소문자
- subject 필수, **끝에 마침표 금지**
- header 100자 이내
- body 는 한 줄당 50자
- **footer 금지 (max 0)** — `Closes #123`, `BREAKING CHANGE`, `Co-Authored-By` 같은 트레일러를 쓸 수 없다

## 팀 관행

- subject 는 한국어로 **무엇을·어디에·어떻게** 까지 적는다.
  - ❌ `fix: 버그 수정`
  - ✅ `fix: 다산 연동 저장 후 고객사 목록 재조회 대기`
- body 없이 한 줄로 끝낸다. 산문은 PR 본문에 쓴다.
- 커밋 전에 type / scope / subject 를 표로 한 번 확인한다.

## 티켓 ID

두 갈래다.

| 어디 | 형태 |
| --- | --- |
| 개인 브랜치 커밋 | 티켓 ID 없음 — `fix: 다산 연동 저장 후 고객사 목록 재조회 대기` |
| PR squash 머지 커밋 (main) | 티켓 ID + PR 번호 — `feat: [CL1-2099] ...마이그레이션 (#561)` |

즉 **티켓 ID 는 PR 단위에서만 드러난다.** 개인 브랜치에서 미리 붙이지 않는다.
