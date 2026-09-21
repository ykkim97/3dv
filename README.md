# Lumatrix

Lumatrix는 React + BabylonJS 프런트엔드와 Tauri 2 / Rust 백엔드로 구성된 3D 씬·메시 편집기입니다. 웹 모드도 그대로 실행할 수 있으며, 데스크톱 모드에서는 Rust IPC가 씬 JSON 저장·열기와 모델 파일 읽기를 담당합니다.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run desktop:dev` — Tauri 개발 창 실행
- `npm run desktop:build` — 데스크톱 실행 파일 빌드

## Desktop prerequisites

Tauri 빌드 전에 Rust와 운영체제별 Tauri 시스템 의존성을 설치해야 합니다. Windows에서는 Rust(MSVC toolchain), Microsoft C++ Build Tools, WebView2가 필요합니다.
