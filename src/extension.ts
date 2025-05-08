import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import SftpClient from 'ssh2-sftp-client';

interface SftpConfigEntry {
  name?: string;
  context?: string;
  host: string;
  port: number;
  username: string;
  remotePath: string;
}

const passwordCache = new Map<string, string>();

let lastComparedFilePath: string | null = null;
let lastRemotePath: string | null = null;
let lastSftpConfig: SftpConfigEntry | null = null;
let lastTempRemotePath: string | null = null;

function getHash(data: Buffer | string) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function findMatchingSftpConfig(
  filePath: string,
  entries: SftpConfigEntry[],
  workspacePath: string
): { config: SftpConfigEntry; relative: string } | null {
  for (const config of entries) {
    const fullContextPath = config.context
      ? path.resolve(workspacePath, config.context)
      : workspacePath;

    if (filePath.startsWith(fullContextPath)) {
      const relativePath = path.relative(fullContextPath, filePath);
      return { config, relative: relativePath };
    }
  }
  return null;
}

export function activate(context: vscode.ExtensionContext) {
  const uploadCommand = vscode.commands.registerCommand('safeSftp.upload', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;

    const localPath = activeEditor.document.fileName;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const sftpJsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'sftp.json');
    if (!fs.existsSync(sftpJsonPath)) return;

    let configs: SftpConfigEntry[];
    try {
      const parsed = JSON.parse(fs.readFileSync(sftpJsonPath, 'utf8'));
      configs = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      vscode.window.showErrorMessage('[Safe SFTP] sftp.json 파싱 오류');
      return;
    }

    const match = findMatchingSftpConfig(localPath, configs, workspaceFolder.uri.fsPath);
    if (!match) {
      vscode.window.showWarningMessage('[Safe SFTP] 해당 파일에 일치하는 SFTP context 설정을 찾을 수 없습니다.');
      return;
    }

    const { config, relative } = match;
    const remoteFilePath = path.posix.join(config.remotePath, relative.replace(/\\/g, '/'));
    const sftp = new SftpClient();
    const hostKey = `${config.host}:${config.port || 22}`;
    let password = passwordCache.get(hostKey);

    if (!password) {
      password = await vscode.window.showInputBox({
        prompt: `[${config.name || config.host}] SFTP 비밀번호를 입력하세요`,
        password: true,
        ignoreFocusOut: true
      });

      if (!password) {
        vscode.window.showWarningMessage('[Safe SFTP] 비밀번호가 입력되지 않아 업로드를 취소했습니다.');
        return;
      }

      passwordCache.set(hostKey, password);
    }

    try {
      await sftp.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password
      });

      const remoteData = await sftp.get(remoteFilePath) as Buffer;
      const localData = fs.readFileSync(localPath);
      const remoteHash = getHash(remoteData);
      const localHash = getHash(localData);

      if (remoteHash !== localHash) {
        const tempRemote = path.join(context.extensionPath, `temp-remote-${path.basename(localPath)}`);
        fs.writeFileSync(tempRemote, remoteData);

        lastComparedFilePath = localPath;
        lastRemotePath = remoteFilePath;
        lastSftpConfig = config;
        lastTempRemotePath = tempRemote;

        await vscode.commands.executeCommand(
          'vscode.diff',
          vscode.Uri.file(tempRemote),
          vscode.Uri.file(localPath),
          `Remote ↔ Local: ${path.basename(localPath)}`
        );
      } else {
        vscode.window.showInformationMessage('[Safe SFTP] 서버와 동일. 업로드 생략됨');
      }
    } catch (err) {
      vscode.window.showErrorMessage(`[Safe SFTP] 서버 연결 실패: ${(err as Error).message}`);
    } finally {
      sftp.end();
    }
  });

  const promptUploadOnSave = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (!lastComparedFilePath || !lastRemotePath || !lastSftpConfig) return;
    if (doc.fileName !== lastComparedFilePath) return;

    const hostKey = `${lastSftpConfig.host}:${lastSftpConfig.port || 22}`;
    let password = passwordCache.get(hostKey);

    if (!password) {
      password = await vscode.window.showInputBox({
        prompt: `[${lastSftpConfig.name || lastSftpConfig.host}] SFTP 비밀번호를 입력하세요`,
        password: true,
        ignoreFocusOut: true
      });

      if (!password) {
        vscode.window.showWarningMessage('[Safe SFTP] 비밀번호가 입력되지 않아 업로드를 취소했습니다.');
        return;
      }
      passwordCache.set(hostKey, password);
    }

    const confirm = await vscode.window.showInformationMessage(
      '[Safe SFTP] 저장되었습니다. 서버에 업로드하시겠습니까?',
      '업로드', '취소'
    );
    if (confirm !== '업로드') return;

    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: lastSftpConfig.host,
        port: lastSftpConfig.port || 22,
        username: lastSftpConfig.username,
        password
      });

      await sftp.put(doc.fileName, lastRemotePath);
      vscode.window.showInformationMessage('[Safe SFTP] 업로드 완료');
    } catch (err) {
      vscode.window.showErrorMessage(`[Safe SFTP] 업로드 실패: ${(err as Error).message}`);
    } finally {
      sftp.end();
    }
  });

  const cancelOnDiffClose = vscode.workspace.onDidCloseTextDocument((doc) => {
    if (doc.fileName === lastTempRemotePath) {
      lastComparedFilePath = null;
      lastRemotePath = null;
      lastSftpConfig = null;
      lastTempRemotePath = null;
      vscode.window.showInformationMessage('[Safe SFTP] diff 창이 닫혀 확장 상태를 종료했습니다.');
    }
  });

  context.subscriptions.push(uploadCommand, promptUploadOnSave, cancelOnDiffClose);
}

export function deactivate() {
  passwordCache.clear();
}