# Lumatrix

Lumatrix City Studio는 React + BabylonJS와 Tauri 2 / Rust로 구성된 도시 장면 편집기입니다. 시설·부지·도로·교량·지형·흐름선과 낮·밤 연출을 편집하고 도시 JSON을 저장합니다. 웹과 데스크톱에서 실행하며, 데스크톱 파일 저장은 Rust IPC를 사용합니다. 파일 불러오기는 화면의 파일 선택 기능을 사용합니다.

상단 **매뉴얼**에서 프리셋 사전·단축키·사용법·튜토리얼을 확인할 수 있습니다. 개발 순서는 [작업 기록](docs/implementation-roadmap.md)에 보관하며 다음 단계는 연결망 기반 공급 계산입니다.

UI와 매뉴얼은 Pretendard Variable 1.3.9를 로컬 번들로 사용합니다. 외부 CDN 요청 없이 오프라인에서 표시되며, [폰트 라이선스](public/licenses/Pretendard-OFL.txt)를 배포물에 포함합니다. 코드용 서체는 JetBrains Mono입니다.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run desktop:dev` — Tauri 개발 창 실행
- `npm run desktop:build` — 데스크톱 실행 파일 빌드
- `npm run test:city` — 도시 기능 회귀 테스트
- `npm run lint` — 전체 JavaScript/React 검사
- `npm run audit:unused` — 앱·테스트·유지보수 스크립트의 파일 참조 및 누락 검사

## Desktop prerequisites

Tauri 빌드 전에 Rust와 운영체제별 Tauri 시스템 의존성을 설치해야 합니다. Windows에서는 Rust(MSVC toolchain), Microsoft C++ Build Tools, WebView2가 필요합니다.
