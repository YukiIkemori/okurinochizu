# おくりの地図

長野県東信・群馬県西毛の8自治体を対象にした、葬儀・お墓・終活の情報メディア。24記事と8地域案内を静的HTMLで配信し、つばさ公益社の関連する公式ページへ案内します。

- 正式ドメイン：`https://okurinochizu.jp/`
- Firebase：`okurinochizu` / Hosting
- GA4：`G-YH2YL4ZMCH`
- 構成：Astro 7、TypeScript、Firebase Hosting、Playwright
- 必要環境：Node.js 22.12以降（検証は24.19）、npm 9.6.5以降

## 開発

```sh
cd /workspace/okurinochizu
npm ci --cache /workspace/.cache/npm
npm run dev
```

Astroは4321番で起動。記事と地域の本文は `src/data/content.json`、出典は `src/data/sources.json`。画像は `public/`、画面は `src/pages/`。秘密情報はソースへ保存しません。

## 検証と公開

```sh
npm run check
npm run build
npm run validate:links
npm test
npm run deploy
```

ビルド時に全HTMLのリンク・構造化データ・サイトマップを確認します。外部リンクは別コマンドで実際に取得します。ブラウザテストは検索、8地域、モバイル、アクセシビリティ、解析同意と送客計測を検証します。実行環境にChromiumが必要です。公開ゲートは同じビルドで完了した検証記録を照合します。

Firebase認証は環境設定のsecret `FIREBASE_TOKEN` を使用。独自ドメイン・Search Console・GA4管理画面で必要な操作と、公開後の確認は [公開手順](docs/deployment.md) に記載しています。コードの完成・GitHub保存と、本番公開の成功は別の状態です。

## 編集・調査

[調査と制作判断](docs/strategy/research-and-content.md)、[キーワード対応表](docs/strategy/keyword-map.csv)、[確認した一次資料](docs/research/verified-sources.json) を参照してください。取得できていない検索ボリュームは実測値として表示していません。

葬儀場への送客はつばさ公益社に限定します。自治体・行政・法令は制度の出典としてリンクします。紹介報酬・広告収入はありません。公開記事には出典と確認日を設け、最低価格を地域相場や総額として扱いません。不要な運営者名・連絡先・特商法ページは設けていません。
