# 환경 설정

환경변수가 하나도 없어도 앱은 뜬다. 방이 브라우저 안에만 남고 공유와 채팅이 꺼질 뿐이다.

## 변수

| 이름 | 없으면 | 어디에 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 방이 서버에 저장되지 않는다 | Vercel · 로컬 `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | 위와 같음 | **서버 전용.** 절대 `NEXT_PUBLIC_` 로 두지 않는다 |
| `NEXT_PUBLIC_SITE_URL` | 공유 카드 URL 이 상대경로가 된다 | 배포 주소 (`https://…`) |
| `NEXT_PUBLIC_GA_ID` | GA 스크립트를 아예 넣지 않는다 | `G-9P42657YHZ` |
| `ADMIN_PASSCODE` | 관리자 채팅이 꺼진다 | **서버 전용.** 대화·저장소에 남기지 않는다 |

## Supabase

1. 프로젝트를 만든다.
2. SQL Editor 에 `supabase/schema.sql` 을 붙여 넣고 실행한다.
   `rooms`·`chat_messages` 테이블과 RLS 가 생긴다.
3. Settings → API 에서 URL·service role key 만 가져와 Vercel 환경변수에 넣는다.
   **anon key 는 쓰지 않는다** — 브라우저에 DB 키를 노출하지 않기 위해서다.

RLS 는 **전부 거부**로 걸려 있다. 브라우저에서 직접 테이블을 건드릴 수 없고,
route handler 만 service role 로 접근한다. 명명·변경 규칙은
[conventions/database.md](../conventions/database.md) 를 따른다.

## 관리자

`ADMIN_PASSCODE` 를 정하면 `/admin` 에서 로그인해 방마다 남은 대화에 답할 수 있다.
비밀번호는 httpOnly 쿠키로만 오간다.

한 번 어딘가에 노출된 값은 그대로 쓰지 않는다. 새 값으로 바꾼다.
