# 데이터베이스 컨벤션 (Supabase / PostgreSQL)

Supabase 에 무엇을 어떤 이름으로 저장할지 정하는 **소스 오브 트루스**다.
스키마를 바꿀 때는 기억이 아니라 여기와 대조한다. 실제 정의는 `supabase/schema.sql` 한 곳에만 둔다.

바탕은 널리 쓰는 관례다 — PostgreSQL 기본 스타일(snake_case), Supabase 공식 예제,
그리고 Rails·Django 가 굳혀 온 테이블 명명(복수형 테이블, `id` PK, `<단수>_id` FK).

## 대원칙

- **snake_case 만.** 테이블·컬럼·인덱스·정책 이름 전부. camelCase·대문자 금지.
  (코드의 camelCase 필드는 route handler 에서 변환한다. DB 는 DB 관례를 따른다.)
- **테이블은 복수형 명사.** `rooms`, `chat_messages`. 한 행은 그 명사 하나를 뜻한다.
- **스키마는 `public` 고정**, 정의는 idempotent 하게. `create table if not exists`,
  `create index if not exists`, 정책은 `drop policy if exists` → `create policy`.
  같은 파일을 몇 번 돌려도 안전해야 한다.
- **원본 비밀은 저장하지 않는다.** 키·비밀번호는 해시로만 (`*_key_hash`).

## 컬럼 명명

| 역할 | 규칙 | 예 |
| --- | --- | --- |
| 기본 키 | `id` — 텍스트 slug 또는 `uuid` | `rooms.id` (slug), `chat_messages.id` (uuid) |
| 외래 키 | `<참조테이블 단수>_id` | `chat_messages.room_id` → `rooms.id` |
| 생성 시각 | `created_at` `timestamptz not null default now()` | 모든 테이블 |
| 수정 시각 | `updated_at` `timestamptz not null default now()` | 바뀌는 행이 있는 테이블 |
| 불리언 | `is_*` / `has_*` | `is_archived` |
| 해시값 | `<무엇>_key_hash` | `owner_key_hash`, `visitor_key_hash` |
| 자유 JSON | `data` (jsonb) | `rooms.data` — 복셀 씬 전체 |
| 열거값 | `text` + `check (col in (...))` | `role in ('visitor','admin')` |

- 시각은 **항상 `timestamptz`** (`timestamp` 아님). 기본값 `now()`.
- 길이·범위 제약은 DB 에서도 건다. `body text check (char_length(body) between 1 and 800)`.
- 참조는 명시적으로. `references public.rooms (id) on delete cascade`.

## 인덱스 · 정책 이름

- 인덱스: `<테이블>_<컬럼들>_idx` — `rooms_updated_at_idx`, `chat_messages_room_created_idx`.
- RLS 정책: 사람이 읽는 문장으로 큰따옴표. `"rooms are service-role only"`.

## 보안 규칙 (바꾸지 않는다)

이 프로젝트의 저장 모델은 **서버만 DB 를 만진다**를 전제로 선다.

- 모든 테이블에 **`enable row level security`**.
- 기본 정책은 **전부 거부** — `for all using (false) with check (false)`.
  service role 키는 RLS 를 우회하므로 route handler 는 정상 동작하고,
  anon/publishable 키로 오는 브라우저 요청은 한 행도 못 읽는다.
- 브라우저에 **DB 키를 절대 노출하지 않는다.** 클라이언트가 아는 것은
  `NEXT_PUBLIC_SUPABASE_URL`(주소) 뿐이다. anon key 조차 번들에 넣지 않는다 —
  넣는 순간 "URL + 키" 만으로 누구나 조회를 시도할 수 있고, RLS 실수 하나가 곧 유출이 된다.
- DB 접근은 **`src/store/supabaseRoomStore.ts` 한 파일**로만 나간다.
  이 파일과 그 소비자(`src/store/*`)는 route handler·서버 컴포넌트에서만 import 한다.
  `'use client'` 파일에서 Supabase 를 직접 부르지 않는다.

## 테이블을 새로 추가할 때 (체크리스트)

1. 이름은 **복수형 snake_case**인가?
2. `id` PK, 필요한 FK 는 `<단수>_id` + `references … on delete …` 인가?
3. `created_at`(+ 바뀌면 `updated_at`) `timestamptz default now()` 를 넣었나?
4. 원본 비밀을 그대로 담고 있지는 않은가? (해시로 바꾼다)
5. 자주 거는 조회 조건에 `<테이블>_<컬럼>_idx` 인덱스를 만들었나?
6. **`enable row level security` + 전부 거부 정책**을 걸었나?
7. `supabase/schema.sql` 에 idempotent 하게 반영하고, 이 문서의 표와 어긋나지 않는가?
8. route handler 에서만 접근하는가? (브라우저 직접 접근 경로가 생기지 않았는가)

## 현재 스키마 (요약)

| 테이블 | 저장하는 것 | 핵심 컬럼 |
| --- | --- | --- |
| `rooms` | 공유되는 방 하나 | `id`(slug), `title`, `data`(jsonb 복셀 씬), `owner_key_hash`, `thumbnail`, `created_at`, `updated_at` |
| `chat_messages` | 방마다 남는 대화 | `id`(uuid), `room_id`(FK), `role`(visitor/admin), `author_name`, `body`, `visitor_key_hash`, `created_at` |

전체 DDL 은 `supabase/schema.sql`. 이 표와 파일이 어긋나면 **파일이 맞다** — 문서를 고친다.
