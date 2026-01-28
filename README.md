# ここメモ Android (KokoMemo Native)

場所を簡単に登録・ナビゲーションできるネイティブAndroidアプリ。

## 概要

PWA版「ここメモ」をベースに、ネイティブGoogle Mapsを使用したAndroidアプリです。
WebViewのJavaScript問題（KYV47等の古いデバイスで発生）を回避するため、地図はネイティブコンポーネントで描画されます。

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **ネイティブ**: Capacitor + @capacitor/google-maps
- **地図**: Google Maps (ネイティブAndroid)
- **位置情報**: @capacitor/geolocation

## 必要条件

- Node.js 18+
- Android Studio (APKビルド用)
- JDK 17+
- Google Maps API キー

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成:

```bash
cp .env.example .env
```

`.env` を編集して Google Maps API キーを設定:

```
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here  # オプション
```

### 3. Android用 Google Maps API キーの設定

`android/local.properties` を編集:

```properties
GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 4. ビルド

```bash
# Webアセットをビルド
npm run build

# Androidプロジェクトに同期
npx cap sync android
```

### 5. APKのビルド

Android Studioで開く:
```bash
npx cap open android
```

または、コマンドラインでビルド:
```bash
cd android
./gradlew assembleDebug
```

APKは `android/app/build/outputs/apk/debug/` に出力されます。

## スクリプト

```bash
npm run dev        # 開発サーバー起動
npm run build      # プロダクションビルド
npm run cap:sync   # Capacitor同期
npm run cap:copy   # アセットコピー
npm run cap:open   # Android Studioで開く
npm run android:build  # ビルド + Androidにコピー
```

## Google Cloud Console設定

以下のAPIを有効化してください:

1. **Maps SDK for Android** - ネイティブ地図表示
2. **Places API** - 場所検索
3. **Geocoding API** - 住所⇔座標変換

APIキーには以下の制限を設定:
- Android アプリ制限（パッケージ名: `com.kokomemo.app`）

## プロジェクト構成

```
kokomemo-android/
├── src/
│   ├── components/
│   │   └── NativeMap.tsx    # ネイティブ地図コンポーネント
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── SearchPage.tsx   # ネイティブ地図使用
│   │   └── PlacePage.tsx
│   └── lib/
│       ├── storage.ts       # ローカルストレージ
│       └── maps.ts          # 地図ユーティリティ
├── android/                  # Capacitor Android プロジェクト
├── capacitor.config.ts
└── package.json
```

## PWA版との違い

| 機能 | PWA版 | Android版 |
|------|-------|----------|
| 地図レンダリング | WebView (JavaScript) | ネイティブ Android |
| 古いデバイス対応 | △ (フォールバック必要) | ◎ |
| オフライン | PWA キャッシュ | ネイティブ |
| 配布方法 | Web URL | APK / Play Store |

## ライセンス

MIT
