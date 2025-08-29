# AI商品画像ジェネレーター

Vercelでデプロイ可能なAI商品画像生成アプリケーションです。Google Gemini APIを使用して、商品画像から魅力的な紹介画像を生成します。

## デプロイ手順

### 1. 必要な準備
- Vercelアカウント
- Google AI Studio APIキー（[こちら](https://aistudio.google.com/apikey)から取得）
- Node.js 18以上

### 2. ローカルでのセットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定（.env.localファイルを作成）
echo "GEMINI_API_KEY=your-api-key-here" > .env.local

# ローカルで動作確認
npm run dev
```

### 3. Vercelへのデプロイ

#### 方法1: Vercel CLIを使用

```bash
# Vercel CLIをインストール（未インストールの場合）
npm i -g vercel

# デプロイ
vercel

# 本番環境へデプロイ
vercel --prod
```

#### 方法2: GitHubと連携

1. このプロジェクトをGitHubリポジトリにプッシュ
2. [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
3. "Import Project"をクリック
4. GitHubリポジトリを選択
5. 環境変数を設定（後述）
6. "Deploy"をクリック

### 4. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定:

- **変数名**: `GEMINI_API_KEY`
- **値**: Google AI StudioのAPIキー

設定方法:
1. Vercelダッシュボードでプロジェクトを選択
2. "Settings" → "Environment Variables"
3. 上記の変数を追加
4. "Save"をクリック

### 5. 動作確認

デプロイ完了後、提供されたURLにアクセスして動作を確認してください。

## プロジェクト構成

```
.
├── index.html          # フロントエンドのメインファイル
├── api/
│   ├── generate-prompts.js  # プロンプト生成API
│   └── generate-images.js   # 画像生成API
├── package.json        # 依存関係
├── vercel.json        # Vercel設定
└── README.md          # このファイル
```

## セキュリティ

- APIキーはサーバーサイド（Vercel Functions）で管理
- クライアントサイドにAPIキーは露出しません
- CORSヘッダーが適切に設定されています

## トラブルシューティング

### APIキーエラー
- Vercelの環境変数が正しく設定されているか確認
- APIキーが有効か確認

### レート制限エラー
- Google AI Studioの使用制限を確認
- リトライロジックが実装されていますが、頻繁に発生する場合は待機時間を置いてください

### デプロイエラー
- Node.jsバージョンが18以上か確認
- `npm install`を実行して依存関係を更新

## ライセンス

MIT