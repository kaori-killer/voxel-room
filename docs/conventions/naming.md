# 네이밍 컨벤션

## 대원칙

- **`interface` 금지 → `type` 만.** `I` 접두사도 쓰지 않는다.
- 역할은 **접미사**로 드러내고, 동사는 성격에 맞춰 고른다.

## ① 타입 접미사

| 역할 | 접미사 | 예 |
| --- | --- | --- |
| 요청 본문 | `~ReqType` | `SaveRoomReqType` |
| 응답 봉투 | `Get~ResType` | `GetRoomResType` |
| 응답 data 부 | `~[Modifier]ResType` | `RoomDetailResType` |
| 배열 원소 | `~ItemType` (Res 안 붙임) | `ChatMessageItemType` |
| 엔티티 | `~Type` | `RoomType`, `PlacedObjectType` |
| 컴포넌트 props | `~Props` | `LampPanelProps` |
| 훅 파라미터 | `~Params` | `UseRoomControllerParams` |

**wire 타입과 UI 타입은 자리를 나눈다.** 서버와 주고받는 모양은 `src/api/types.ts`,
화면이 쓰는 모양은 각 도메인의 `types.ts`. shape 가 다르면 훅이나 `normalize*` 에서 변환한다.

## ② 데이터 훅

- 조회는 명사: `useCustomersList`
- 변경은 `use + 동사 + 명사`: `useUpdateSellerWarehouses`
- `useMutation` / `useQuery` 를 이름 앞에 붙이지 않는다
- 파일명 = 훅 이름
- 응답 봉투는 훅 안에서 destructure 해서 내보낸다

## ③ 헬퍼

| 하는 일 | 동사 | 예 |
| --- | --- | --- |
| 화면에 보일 문자열 | `format*` | `formatDuration` |
| 식별자·키·URL 조립 | `build*` | `buildRoomPath` |
| 외부 입력 정규화·파싱 | `normalize*` / `parse*` | `parseRoom`, `normalizeItemName` |

## ④ 일반

- 파일 `camelCase.ts` — React 컴포넌트 파일만 `PascalCase.tsx`
- 컴포넌트 `PascalCase`, 훅 `use~`
- 이벤트 핸들러 `handle + 동사 + 명사` — `handleToggleLamp`
- atom `atom{PascalCase}`
- 상수 `DEFAULT_~`, `~_MAP`, 그 밖은 `SCREAMING_SNAKE`

## 빠른 판별 순서도

이름을 정할 때 위에서 아래로 답이 나온다.

```
타입인가?
├─ 서버와 주고받는 모양인가?
│  ├─ 보내는 것            → ~ReqType        (src/api/types.ts)
│  ├─ 받는 것 전체(봉투)    → Get~ResType     (src/api/types.ts)
│  └─ 받는 것의 data 부     → ~ResType        (src/api/types.ts)
├─ 배열의 원소인가?         → ~ItemType       (Res 붙이지 않는다)
├─ 컴포넌트 props 인가?     → ~Props
├─ 훅 파라미터인가?         → ~Params
└─ 그 밖의 도메인 값        → ~Type           (도메인 types.ts)

훅인가?
├─ 데이터를 읽기만 하나?    → use + 명사      (useCustomersList)
└─ 무언가를 바꾸나?         → use + 동사 + 명사 (useUpdateSellerWarehouses)

함수인가?
├─ 결과를 화면에 그대로 쓰나? → format*
├─ 식별자·키·URL 을 만드나?  → build*
├─ 외부에서 온 값을 다듬나?   → normalize* / parse*
└─ 이벤트에 붙는가?          → handle + 동사 + 명사
```
