# docs

이 폴더가 프로젝트 규칙의 **소스 오브 트루스**다.
코드 리뷰·커밋·네이밍을 판단할 때 기억이나 추론이 아니라 여기와 대조한다.

| 문서 | 무엇을 정하는가 |
| --- | --- |
| [conventions/code.md](conventions/code.md) | 타입·폴더 구조·React·마크업·품질·테스트 |
| [conventions/naming.md](conventions/naming.md) | 타입 접미사, 훅, 헬퍼, 파일·변수 이름 |
| [conventions/commit.md](conventions/commit.md) | 커밋 메시지 형식 (commitlint 로 강제) |
| [conventions/review-checklist.md](conventions/review-checklist.md) | 코드 검수 8축 체크리스트 |
| [conventions/glossary.md](conventions/glossary.md) | 용어 |
| [setup/environment.md](setup/environment.md) | 환경변수, Supabase, GA, 관리자 |

기계가 강제하는 것(`eslint.config.mjs`, `tsconfig.json`, `commitlint.config.mjs`)과
문서가 정하는 것이 어긋나면 **기계 쪽이 맞다**. 문서를 고친다.
