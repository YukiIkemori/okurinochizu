# お名前.comからFirebase Hostingへ接続する

2026-10-08にFirebase HostingのAPIから取得した、このプロジェクトの実際のDNS指示です。

サイトは `https://okurinochizu.web.app/` に本番公開済み。Firebaseに `okurinochizu.jp` と `www.okurinochizu.jp` を登録し、wwwから正式ドメインへの転送を準備しました。現在はDNS追加とSSL証明書発行を待つ状態です。

## ネームサーバー

公開DNSで以下の4件が設定済みです。このネームサーバーを使用して、お名前.comのDNSレコード設定を行います。

```text
01.dnsv.jp
02.dnsv.jp
03.dnsv.jp
04.dnsv.jp
```

## 入力する3レコード

| ホスト名 | TYPE | TTL | VALUE |
| --- | --- | --- | --- |
| 空欄 | A | 3600 | 199.36.158.100 |
| 空欄 | TXT | 3600 | hosting-site=okurinochizu |
| www | CNAME | 3600 | okurinochizu.web.app |

空欄は `okurinochizu.jp` 自体を意味します。ホスト名に `@` や `okurinochizu.jp` を入力せず、空欄で登録します。TXTのVALUEには上表の文字列を引用符なしで入力します。既に存在するGoogle所有権確認のTXTと、今回のHosting用TXTは併存させてください。Firebaseが既存のGoogle TXTを検出したことも確認済みです。

## お名前.com Naviの操作

1. お名前.com Naviへログインします。
2. 「ネームサーバー/DNS」から「ドメインDNS設定」を開きます。
3. `okurinochizu.jp` の「ドメインDNS」→「DNSレコード設定」を開きます。
4. 「レコード追加」で、上表の3件をそれぞれ追加します。状態は「有効」にします。
5. 確認画面で対象ドメインと値を確かめ、設定を完了します。

入力画面の表示が異なる場合は、[お名前.com公式のDNSレコード設定ガイド](https://www.onamae.com/guide/p/70)を参照してください。空欄の指定とネームサーバーの組み合わせは[公式レコード解説](https://help.onamae.com/answer/7883)でも確認しました。

## 設定後

DNSの反映後、Firebaseが所有権と接続先を確認しSSL証明書を発行します。Firebase Consoleの [Hosting](https://console.firebase.google.com/project/okurinochizu/hosting/sites/okurinochizu) で、ドメインが接続済みになることを確認してください。HTTPS証明書が有効になった後、`https://okurinochizu.jp/` と `https://www.okurinochizu.jp/` の転送を確認します。

`node scripts/domain.mjs --status` はDNS要求・所有権・証明書状態を取得し、`node scripts/check-live.mjs https://okurinochizu.jp` は完成したHTTPS配信を検証します。DNSとSSL発行が終わる前に、独自ドメインの公開完了とは記録しません。

Search ConsoleのGoogle認証TXTが既にDNSにあることと、GA4とのプロパティ連携が完了していることは別です。Search Console管理画面で所有権確認と `https://okurinochizu.jp/sitemap.xml` の送信、GA4側のSearch Console関連付けを行います。これらの管理画面操作の権限は今回取得していません。
