# 모담 수업자료실 — Firebase + Google 관리자 로그인 (완성본)

교육생 `https://class.young2026.com/` · 관리자 `https://class.young2026.com/admin`

기존 디자인 유지, 구글 계정 관리자 인증, 여러 원데이 수업 등록/비활성화, 수업별 비밀번호 확인 후 자료실로 이동합니다. 이 압축파일은 **배포용 소스코드**이며 도메인과 Firebase 서비스 계정은 자동 연결되지 않습니다.

## 1. Firebase에서 이미 완료한 작업
- Firebase 프로젝트 `modam-classroom` 생성, Firestore `(default)` 생성(프로덕션 모드), Authentication에서 Google 제공업체 사용 설정, 웹앱 등록.
- Firebase Authentication → 사용자에 처음에는 계정이 없어도 정상입니다. 실제 관리자 웹페이지에서 첫 구글 로그인을 하면 사용자로 등록됩니다. **콘솔에서 '사용자 추가' 버튼을 누르지 마세요.**
- Firestore → 규칙에서 `firestore.rules` 내용을 적용하고 게시하세요. **다른 웹앱이 같은 데이터베이스를 사용한다면 규칙 전체를 덮어쓰지 마세요.** 이 프로젝트 전용 데이터베이스라는 점을 확인하세요.

## 2. Firebase 서버 연결 정보 준비 (절대 공개하지 않기)
Firebase 프로젝트 설정(톱니바퀴) → 서비스 계정 → 새 비공개 키 생성 → JSON 파일을 안전하게 내려받습니다. 이 파일은 **GitHub/채팅/웹페이지에 업로드하지 마세요.** JSON 전체 문자열을 나중에 Vercel 서버 전용 환경변수에만 입력합니다. `FIREBASE_SERVICE_ACCOUNT_JSON`을 설정하는 것이며 파일을 `api/` 폴더에 넣지 않습니다.

프로젝트 설정 → 일반 → 내 앱의 웹앱 설정에서 `firebaseConfig`의 apiKey, authDomain, projectId, appId를 확인합니다. 웹 설정은 서버 전용 개인 키가 아니지만 비밀키와 혼동하지 마세요.

## 3. GitHub + Vercel 배포
1. 기존 GitHub `modam-homepage` 저장소 최상위에 `02-classroom-webapp/` 폴더를 추가합니다. 폴더 안에 `api/`, `public/`, `package.json`, `vercel.json`, `firestore.rules`, `README.md`가 있도록 폴더 구조를 유지하세요. 기존 홈페이지 파일은 삭제하거나 이동하지 않습니다.
2. Vercel → Add New → Project → **기존 `modam-homepage` GitHub 저장소** 선택 → Root Directory를 **`02-classroom-webapp`**으로 지정 → Framework Preset **Other**로 배포합니다. 기존 홈페이지용 Vercel 프로젝트와 별도로 만드세요.
3. Vercel → 해당 프로젝트 → Settings → Environment Variables에서 아래 **네 가지 변수**를 추가합니다. Production 환경에 적용하고 재배포하세요.

| 환경변수 | 값 |
|---|---|
| `ADMIN_EMAIL` | Firebase 콘솔 로그인에 쓰는 본인의 구글 계정 이메일 (채팅으로 전송하지 마세요) |
| `FIREBASE_WEB_CONFIG` | Firebase 웹앱의 `firebaseConfig` JSON 전체, `apiKey`, `authDomain`, `projectId`, `appId` 포함 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase에서 다운받은 서버용 서비스 계정 JSON 전체 (GitHub에 올리지 않기) |
| `ADMIN_UID` | **선택 사항**. 첫 구글 로그인 후 Authentication → 사용자에서 본인 UID 확인하고 추가로 고정하려면 설정 |

예: `FIREBASE_WEB_CONFIG={"apiKey":"...","authDomain":"modam-classroom.firebaseapp.com","projectId":"modam-classroom","appId":"..."}`. `FIREBASE_SERVICE_ACCOUNT_JSON`은 서비스 계정 파일의 JSON 내용을 그대로 Vercel에 붙여넣으세요. 환경변수를 변경하면 다시 배포(Redeploy)해야 적용됩니다.

4. Vercel에서 발급된 임시 도메인(예: `...vercel.app`)의 `/admin`에 접속합니다. 팝업을 허용하고 본인 구글 계정으로 로그인하세요. **처음 로그인할 때 Firebase Authentication → 사용자 목록에 해당 계정이 자동으로 등록됩니다.** 다른 구글 계정으로 로그인하면 서버가 관리자 데이터 접근을 거부합니다.
5. `auth/unauthorized-domain` 오류가 나오면 Firebase → Authentication → 설정 → 승인된 도메인에 Vercel 임시 도메인(`https://` 없이)을 추가합니다. 이후 커스텀 도메인 `class.young2026.com`도 추가하세요. 승인된 도메인을 추가하는 것만으로 관리자 권한이 생기는 것은 아닙니다.
6. `/admin`에서 수업명, 수업 비밀번호(8자 이상), `https://` 자료실 주소를 입력해 저장합니다. `/`에서 수업 비밀번호로 이동하는지 확인합니다.
7. Vercel → Settings → Domains에 `class.young2026.com` 추가 후 호스트의 DNS를 **Vercel이 안내하는 DNS 레코드**로 변경합니다. 기존 구글 사이트에 사용 중이던 동일한 주소는 더 이상 그대로 연결할 수 없습니다. 실제 수업자료실로 이동할 구글 사이트의 원래 주소를 관리자 화면에 입력하세요.
8. 기존 `classroom.html`의 수업자료실 버튼은 `https://class.young2026.com`으로 이동하게 유지하면 됩니다. 기존 비밀번호 팝업이 제거된 수정 홈페이지 파일을 사용하세요.

## 4. 운영과 주의사항
- 원데이 수업별로 서로 다른 비밀번호를 지정하세요. 지난 수업은 입장 중지로 변경할 수 있습니다. 관리자 화면에서 변경하면 코드를 수정할 필요가 없습니다.
- 교육생에게는 구글 로그인이 필요 없습니다. 수업 비밀번호는 서버에서 검사합니다. Firestore 직접 조회는 차단됩니다.
- **비밀번호 화면은 외부 구글 사이트/드라이브 자체에 대한 접근제어가 아닙니다.** 외부 자료실 주소를 직접 아는 사람이 접속하지 못하게 하려면 해당 사이트의 공유 설정을 별도로 제한해야 합니다.
- API에는 단일 서버 인스턴스 수준의 기본 시도 횟수 제한만 있습니다. 대규모 공개 운영 시 영속적인 속도 제한 등 추가 보안이 필요합니다.
- Firebase Cloud Functions는 사용하지 않습니다. Firebase Spark 및 Vercel 무료 범위로 시작할 수 있으나 정책과 실제 사용량을 확인하세요.
- Google 로그인은 팝업 방식이며 브라우저의 팝업 차단이나 인증 도메인 설정에 따라 로그인이 실패할 수 있습니다.
