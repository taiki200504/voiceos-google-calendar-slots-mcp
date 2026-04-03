# VoiceOS Calendar Free-Slot MCP（events入力）

既存の **GoogleカレンダーMCP（VoiceOS側で認証済み）** が返す予定一覧（events）を受け取り、  
「今週の空き時間」を **前後予定の移動時間**と**場所**（location）を加味して算出し、候補日時を返す **計算専用** MCPサーバーです。

## できること（MVP）
- 予定と予定の間の空き枠を計算（events入力）
- location がある場合は移動時間を推定（なければ固定バッファ）
- 指定の所要時間を満たす候補枠を返す

## セットアップ

### 1) 依存関係
```bash
npm i
```

### 2) Google OAuthは不要
Googleカレンダーの認証・予定取得は **既存のGoogleカレンダーMCP** 側で行います。  
このリポジトリは events を入力として受け取り、空き枠候補を計算するだけです。

## 実行
```bash
npm run dev
```

## VoiceOS の MCPサーバーとして接続する（手順）
VoiceOS（または Claude Desktop / Claude Code のMCP設定）に、このサーバーを **stdio MCP** として登録します。

### A) VoiceOS UI の “Build your own integration” から追加する場合
スクリーンショットの “command” 欄に、以下を貼り付けます:

```bash
npx tsx /absolute/path/to/src/server.ts
```

このリポジトリをそのまま使うなら:

```bash
npx tsx /Users/taikimishima/Developer/voiceos-hackathon/src/server.ts
```

推奨で環境変数（env）を設定:
- `DEFAULT_TIMEZONE`: `Asia/Tokyo`
- `DEFAULT_TRAVEL_BUFFER_MINUTES`: `15`

### B) Claude Desktop 設定ファイルで追加する場合（macOS）
`~/Library/Application Support/Claude/claude_desktop_config.json` の `mcpServers` に以下を追加します（例）:

```json
{
  "mcpServers": {
    "voiceos-google-calendar-slots": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/server.ts"],
      "env": {
        "DEFAULT_TIMEZONE": "Asia/Tokyo",
        "DEFAULT_TRAVEL_BUFFER_MINUTES": "15"
      }
    }
  }
}
```

編集後に VoiceOS / Claude Desktop を再起動すると反映されます。

## 公開ツール
このMCPサーバーが提供するツールは以下です。

- `suggest_weekly_free_slots_from_events`: 既存のGoogleカレンダーMCPなどで取得した `events` を入力として候補を返す

## ローカル起動（単体デバッグ用）
```bash
npm run dev
```

### 既存のGoogleカレンダーMCPと“同時に”使う（最重要）
VoiceOS（クライアント）が以下の順にツールを呼び、結果を受け渡すことで実現します:

1. 既存のGoogleカレンダーMCPで「今週の予定一覧（events）」を取得
2. このMCPの `suggest_weekly_free_slots_from_events` に events を渡して空き枠候補を計算

`suggest_weekly_free_slots_from_events` の入力例:
```json
{
  "durationMinutes": 30,
  "maxSuggestions": 10,
  "timezone": "Asia/Tokyo",
  "workingHours": { "startHour": 9, "endHour": 18 },
  "events": [
    {
      "id": "abc",
      "summary": "Meeting",
      "location": "Shibuya",
      "start": "2026-04-03T10:00:00+09:00",
      "end": "2026-04-03T10:30:00+09:00"
    }
  ]
}
```

## 設計メモ
このリポジトリはハッカソン向けに **まず動く最小構成**を優先しています。
