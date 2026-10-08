# 本番公開と認証

公開先は Firebase プロジェクト `okurinochizu` の Hosting、正式 URL は `https://okurinochizu.jp/`。静的ファイルを `dist/` に生成し、実在するページと独立した 404 ページを配信する。SPA の全 URL 書き換えは行わない。

## Firebase token

指定された Firebase token 方式を使用する。トークンは環境設定の secret `FIREBASE_TOKEN` として登録し、保存・公開後、この実行環境へ適用する。ソースコード、`.env.example`、Git、チャット、CLI 引数に値を書かない。

2026 年 10 月 8 日、環境設定の `FIREBASE_TOKEN` の保存済み binding と実行環境への反映を確認し、Hosting の対象確認・本番デプロイに成功した。`https://okurinochizu.web.app/` の18応答を取得し、検証済みローカルビルドと一致する本文・サイトマップ・robots、独立した404、セキュリティヘッダーを確認した。以前の `GOOGLE_APPLICATION_CREDENTIALS` は指定された認証方式に使わない。検証結果は `docs/validation.json` に記録した。

依存関係導入後、認証と Hosting の対象を読み取りで確認する。

```sh
node scripts/deploy.mjs --check-auth
node scripts/deploy.mjs --check-hosting
```

`scripts/deploy.mjs` は token を環境変数で Firebase CLI に渡し、認証・公開先を固定する。設定保存先を Git 対象外の `.local/firebase-config/` に切り替え、読み取り専用 HOME を使わない。旧サービスアカウント変数を子プロセスから除き、認証方式が切り替わるのを防ぐ。診断の `--debug` は使わない。Firebase CLI 15.33.0 は `FIREBASE_TOKEN` 方式に対応している。CLI が表示する廃止予定の案内は認証失敗ではない。

## 公開手順

```sh
npm ci --cache /workspace/.cache/npm
npm run check
npm run build
npm test
npm run validate:links
npm run deploy
```

`npm run deploy` は型・生成 HTML・公開条件のチェックを通した後に Hosting のみを公開する。Firestore、Functions、Authentication などは変更しない。外部リンクの実測はネットワーク制限による未確認と URL 自体の失敗を区別する。

公開後、Firebase CLI の成功結果だけで終えず、実際の HTTPS 配信で次を確認する。

- トップページ、代表記事、8 自治体ページが 200 で表示される。
- 存在しない URL は 404 になり、トップページへ書き換わらない。
- `robots.txt` と `sitemap.xml` が取得でき、canonical は正式ドメインを指す。
- GA 同意前にタグが読み込まれず、同意後につばさ公益社へのクリックが `provider_referral_click` になる。
- レスポンシブ表示、セキュリティヘッダー、HTML 再検証と静的アセットのキャッシュが有効になる。

## 独自ドメイン

独自ドメインの DNS 設定権限は、このリポジトリの GitHub 権限や Firebase token とは別になる。Firebase Hosting APIで `okurinochizu.jp` と `www.okurinochizu.jp` のカスタムドメインを登録済み。`www` は正式ドメインへの301転送とした。DNS入力値とお名前.comの手順は [DNS接続手順](onamae-dns.md) を参照する。

`node scripts/domain.mjs --status` でFirebaseのDNS指示・所有権・証明書の状態を取得できる。`--prepare` は未登録の上記2ドメインだけを追加する。DNS設定後は `node scripts/check-live.mjs https://okurinochizu.jp` で本番HTTPS・本文・404・ヘッダーを検証する。

`okurinochizu.web.app` と `okurinochizu.firebaseapp.com` は Firebase の確認用ホスト。正式ドメインの開通前に、確認用ホストへ公開できたことを `okurinochizu.jp` の公開完了として扱わない。

## GA4 と Search Console

GA4 測定 ID は `G-YH2YL4ZMCH`。同意後にページ閲覧と `provider_referral_click` を送信する。クリックには `provider`、`destination_url`、`content_slug`、`region`、`intent`、`placement` を付ける。クリックは問い合わせ・契約の成立とは区別する。GA4 側でこのイベントをキーイベントに設定し、必要なパラメータをイベントスコープのカスタムディメンションとして登録すると、記事・地域・配置別に評価できる。GA4 管理画面へログインする認証情報はリポジトリにはない。

Search Console は `okurinochizu.jp` のドメインプロパティを作成し、発行された TXT で DNS 所有権確認する方法が推奨。URL プレフィックスによる HTML メタ確認の場合は、発行された値を `PUBLIC_GOOGLE_SITE_VERIFICATION` に設定して再ビルド・再公開する。未設定でもページ構造に影響しない。所有権確認後、`https://okurinochizu.jp/sitemap.xml` を送信する。GA4 管理画面のプロダクトリンクから、確認済み Search Console プロパティを関連付ける。この関連付けには各管理画面の権限が必要になる。

## 再公開

記事と出典を更新したら、確認日と変更内容を照合し、同じ検証手順で公開する。最低価格を総額や地域相場として扱わない。つばさ公益社以外の葬儀場への紹介・送客リンクを追加しない。自治体・行政・法令のリンクは制度確認の出典として使用できる。
