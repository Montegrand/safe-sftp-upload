# Safe SFTP Upload

> VS Code에서 파일을 안전하게 SFTP 서버에 업로드하기 위한 확장 기능
> 업로드 전에 서버 파일과 로컬 파일을 자동 비교하여 실수로 덮어쓰는 것을 방지합니다.

---

## ✨ 주요 기능

- SFTP 업로드 전 서버 파일과 로컬 파일을 SHA256 해시로 비교
- 차이가 있으면 `diff` 창으로 시각적으로 비교
- diff 창 종료 시 상태 자동 초기화
- 저장 후 업로드 여부를 사용자에게 확인받고 실행
- `.vscode/sftp.json` 설정 기반으로 작동

---

## 📦 설치

[GitHub Releases](https://github.com/Montegrand/safe-sftp-upload/safe-sftp-upload-0.0.1.vsix) 페이지에서 최신 `.vsix` 파일 다운로드

1. safe-sftp-upload-0.0.1.vsix 다운로드
2. vscode 확장 프로그램 > … > 'VSIX에서 설치' 에서 다운받은 파일 선택

## 🚀 사용 방법

1. 명령어 실행
 - 명령 팔레트(Ctrl+Shift+P) → Safe SFTP Upload: Upload Current File 실행
   - 단축키 설정하여 사용하셔도 좋습니다.
 - 서버 파일과 로컬 파일을 비교하여 다르면 diff 창을 띄움
 - 동일하면 자동 생략

2. 저장 후 업로드
 - diff 창으로 비교한 후 파일을 저장하면
 - "업로드하시겠습니까?" 메시지 표시 → '업로드' 클릭 시 서버에 업로드됨

3. 상태 초기화
 - diff 창을 닫으면 자동으로 비교 상태 초기화

## 💡 비밀번호 관리

 - 최초 연결 시 비밀번호 입력 요청
 - sftp.json 내에 패스워드 입력시 생략
 - 한 세션 내에서는 캐시에 저장되어 재입력 불필요
 - 세션 종료 시 자동 삭제됨