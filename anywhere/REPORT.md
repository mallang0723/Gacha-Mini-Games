# 구현 보고서 — 가챠 미니게임 · 어디서나

작성일: 2026-10-28 (한국 시간)

`anywhere-BRIEF.md`에 따른 구현, 빌드, 자동 테스트와 설치 ZIP 생성을 완료했습니다. 모든 추가 파일은 `anywhere/` 아래에 있습니다. 실제 마리나라 UI에서의 설치·실기기 검증은 수행하지 못했으며 아래에 분리해 기록했습니다.

## 구현한 내용

1. **원본 보존과 파생 빌드**
   - 루트 `extension.js`, `manifest.json`, `README.md`, `site/`, `tools/`는 수정하지 않았습니다.
   - `ORIGINAL.sha256`에 원본 `extension.js` 해시를 고정하고 빌드·테스트마다 대조합니다.
   - `/* Mounting: the games sit inside` 앵커가 정확히 한 번인지 검사한 뒤 앞부분의 게임/UI/CSS에 자체 마운트를 IIFE 안에서 접합합니다.
   - 리소스 정리·키 가드·이미지 제한·게임 재개 등 파생본 패치 10개도 각각 1회 적용을 검사합니다. 내역: [qa/patches.json](qa/patches.json).
   - 기존 개인 확장 선례의 `src/`, Node 빌드/테스트, 결정적 ZIP 구조를 따랐습니다.

2. **어디서나 열기와 기존 가챠포지 표시**
   - 오른쪽 가장자리 🎮 버튼, 오버레이 게임 패널, 닫기/Escape, 한국어 설정을 구현했습니다.
   - 세로 드래그와 화면 높이 클램프, 0.7초 길게 누르기 초기화, 키보드 위치 조절, localStorage 저장 실패 방어를 구현했습니다.
   - 원본 12개 게임을 재사용합니다. 상태는 현재 인스턴스 안에서 유지하고 최고 기록은 원본 저장 방식을 유지합니다.
   - 원본 없이도 `.forge-center`에 표시하며, 실제 생성 2.5초 지연·부팅/기존 챕터 제외·센터 교체 시 게임 이동·완료 시 제거 조건을 유지했습니다.
   - 원본과 양쪽 설치 순서를 테스트했습니다. `window.__GF_MINIGAMES_EXTENSION`으로 가챠포지 담당을 하나로 유지하고, 원본이 뒤늦게 실행되어도 어디서나 UI는 남깁니다.

3. **RP 생성 대기 감지**
   - `__MARINARA_HOST__.stores.chat`의 `isStreaming`/`streamingChatId` 구독이 우선입니다.
   - 구독할 수 없으면 활성 스토어/명시적 URL의 채팅 ID를 사용해 `marinara.fetch`로 동일 출처 `GET /api/generate/status/:chatId`만 1초마다 확인합니다.
   - 스토어 지연 등장 시 전환, 중첩 요청 방지, 요청 제한시간/취소, 채팅 이동 시 오래된 응답 무시, 오류를 완료로 오인하지 않는 처리를 포함합니다.
   - 자동 열기 기본 켬, 2.5초 지연, 자동 열기 시 채팅 포커스 유지, 종료 시 “응답 도착” 토스트와 닫기/계속하기 선택을 구현했습니다. 자동 닫기 기본값은 끔입니다.
   - 대기 중 사용자가 직접 닫으면 같은 생성에서 다시 자동으로 열지 않습니다.
   - 근거 파일·줄 번호를 `src/mount.js`에 주석으로 남겼습니다: `chat.store.ts:199-201,505-517`, `marinara-host.ts:52-55,87-103`, `PersonalExtensionInjector.tsx:317,339-342`, 서버 `generate.routes.ts:14860-14867`.

4. **입력·테마·수명 관리**
   - 게임 키는 해당 게임 패널 내부에 실제 포커스가 있을 때만 처리합니다. textarea/input/contenteditable 등 편집 요소를 보호합니다.
   - 말랑 프리셋과 색 변수 추종, 기본 크림 테마, 시스템 폰트, 360px용 스크롤 레이아웃과 최소 44px 게임 버튼 CSS를 추가했습니다.
   - 칸이 많은 보드는 터치 크기를 유지하기 위해 보드 내부 가로 스크롤을 사용합니다.
   - `crypto.randomUUID` 같은 보안 컨텍스트 전용 기능에 의존하지 않습니다. DOM 테스트는 HTTP URL 및 crypto 없는 환경에서 실행했습니다.
   - 원격 SD 이미지 URL은 사용하지 않습니다. 이미 메모리에 있는 같은 출처 blob과 제한된 raster data 이미지 이외에는 원본 과일 그림으로 대체합니다.
   - 타이머/애니메이션 프레임/리스너/스토어 구독/요청/UI를 `onCleanup`에서 정리합니다. 반복 정리도 안전합니다.
   - 닫고 재개할 때 짝 맞추기가 잠기지 않도록 미완성 카드를 접고, 레시피는 현재 순서를 재생하며, 쿠키 가게의 일시정지 시각을 보존합니다.

## 산출물

- 설치 ZIP: [gacha_minigames_me.personal-extension.zip](gacha_minigames_me.personal-extension.zip)
- 배포 매니페스트: [dist/manifest.json](dist/manifest.json)
- 배포 스크립트: [dist/extension.js](dist/extension.js)
- 한국어 설치·설정·개발 안내: [README.md](README.md)
- 원작자/원본 링크/허락 문구/변경 고지: [NOTICE](NOTICE)
- 원본 해시: [ORIGINAL.sha256](ORIGINAL.sha256)
- 빌드/테스트 명령: [package.json](package.json)

ZIP은 59,877바이트이며 루트에 `manifest.json`, `extension.js`, `README.md`, `NOTICE` 네 파일만 포함합니다. 매니페스트는 `marinara.personal-extension`, 런타임 `client`, 권한 `full_page_access`이고 내부 키는 `gacha_minigames_me`입니다.

ZIP SHA-256:

```text
65ccf5a8d578fa1ff048fb954c36e0d265309b63bb14329d888f935c619404a3
```

파일별 해시: [qa/package.json](qa/package.json).

## 확인한 결과

**Node + jsdom 자동 테스트 36개 모두 통과, 실패 0개, 건너뜀 0개.**

| 구분 | 수 | 확인 범위 |
| --- | ---: | --- |
| 빌드 | 4 | 원본 고정 해시, 앵커 누락/중복 거절, 패치 횟수, 재현 가능한 JS와 매니페스트 |
| 기능/수명 | 21 | 버튼·드래그·초기화·설정, 2.5초 자동 열기/완료, 키 보호, 12게임 선택, 테마, 외부 이미지 제외, 중복 주입·동시 설치, 가챠포지, 재개·cleanup |
| 상태 폴백 | 9 | GET 1초 폴링, 지연 스토어 전환, 스토어/URL ID, ID 없음, 이동·오류·시간초과·cleanup 후 응답 |
| 원본/패키지 | 2 | 루트 파일 6개 해시, ZIP 4개 파일 내용·해시·동일 재빌드 |

실행 환경은 Node 26.7.0입니다. 의존성을 내려받지 않고 이미 설치된 `marinara-sojaefactory/node_modules`를 읽기 전용으로 재사용했습니다.

```sh
ANYWHERE_NODE_MODULES=/path/to/node_modules \
  npm --prefix anywhere test
node --check anywhere/dist/extension.js
sha256sum -c anywhere/qa/root-files.sha256
git diff --exit-code
git diff --cached --exit-code
```

전체 테스트 출력: [qa/tests.txt](qa/tests.txt). ZIP은 Python 표준 `zipfile`로 CRC·파일 목록도 별도 검사했습니다. 원본 5개 파일과 BRIEF 1개의 해시가 모두 일치합니다. Git의 추적 파일 변경과 staged 변경은 없으며, 추가 항목은 `anywhere/`뿐입니다.

## 확인하지 못한 항목

- **실제 브라우저 레이아웃·터치 검사: 실행 차단.** 기본 Playwright 브라우저 버전이 설치되지 않아 기존 Chromium 실행 파일을 명시했으나, 실행 환경의 샌드박스가 `sandbox_host_linux.cc:41 … Operation not permitted (1)`로 시작을 거부했습니다. 권한 우회나 브라우저 다운로드는 하지 않았습니다.
- 따라서 360×640, 360×460, 1280×800의 실제 렌더링, 모든 게임의 44px 실측, 터치 조작, 캔버스 화면 품질, 실제 HTTP 브라우저 환경은 통과했다고 주장하지 않습니다. 검사용 [scripts/browser-qa.mjs](scripts/browser-qa.mjs)를 남겼고 결과는 [qa/browser.json](qa/browser.json)의 `blocked`, 실행 사례 0개입니다. jsdom은 실제 배치나 캔버스 그리기를 검증하지 않습니다.
- 실제 마리나라 개인 확장 관리에서 ZIP 가져오기/활성화, 실제 말랑·가챠포지와의 통합 사용, 실제 생성 스트림과 서버 상태 API는 실행하지 않았습니다. 대신 읽기 전용 참조 소스의 계약과 가짜 스토어/응답으로 검증했습니다.
- 실제 모델 호출은 하지 않았습니다. 원작자 게시글의 허락 문구는 BRIEF 제공 내용으로 표기했으며, 별도 게시글 URL은 제공되지 않아 검증하지 않았습니다.

## 작업 범위와 준수 사항

루트 원본과 참조 프로젝트는 수정하지 않았습니다. 생성 코드에는 외부 네트워크 요청, Google Fonts, fetch 몽키패치가 없습니다. 허용된 참조 소스만 구현 근거로 사용했고 지정된 금지 서비스·포트에는 접근하지 않았습니다. Git commit/push, 저장소 생성은 하지 않았습니다. 공개 게시와 커밋은 사용자 검수 후 진행할 수 있도록 로컬 산출물만 준비했습니다.
