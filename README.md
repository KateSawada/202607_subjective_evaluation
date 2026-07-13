# 202607 Subjective Evaluation

2026年7月に実施する第2回主観評価実験のGitHub Pagesサイト用リポジトリ。

機能要件とデータ仕様の正本は [SPECIFICATION.md](SPECIFICATION.md) とする。サイト実装、GAS実装、刺激セット生成はこの仕様に従う。

## 実験の概要

- 比較1: Txt AR vs Joint AR
- 比較2: Seq. Flow vs Joint AR
- 1参加者あたり各比較3 trials、合計6 trials
- 各trialで `global_structure` と `local_naturalness` の2問に回答
- 1参加者あたり合計12 responses
- 初期66セットを用意し、必要時は既存セットを変えずに `set_067` 以降を追加可能
- 1セットにつき有効回答は高々1件
- 音声はGitでは管理せず、Google Driveから配信
- 同意後にGASから未使用または期限切れのセットを排他的に割り当てる
- 開始前に想定所要時間15–20分と、中断せず最後まで実施することを案内する

## 現在の実装状況

実装済み:

- 前回準拠の導入、音楽経験、6 trials、2設問、A/B排他再生
- 同意後のGAS set lease取得と6時間失効
- hidden iframe form POSTと `postMessage()`による保存受理確認
- 送信timeout時の同一 `submission_id` による再試行
- GAS `DriveApp`からのDrive manifest生成
- 独立抽出による66セット生成とvalidator
- 既存セットを保持したまま追加セットを末尾へ加える `extend` コマンド

外部作業待ち:

- 第2回SpreadsheetとGAS Web Appのdeploy
- `js/config.js`の本番 `gasEndpoint` への切替
- Drive匿名再生、GAS応答origin、同時lease、期限切れの実機試験

2026-07-13にDrive上の800本（Seq. Flow 200、Joint AR 400、Txt AR 200）から本番792本を選択し、`data/audio_manifest.csv`, `data/selected_audio_manifest.csv`, `data/stimuli.json` を生成・検証済み。`js/config.js`の `stimuliUrl` は本番 `data/stimuli.json` へ切替済みである。

## 音源

ローカルの生成元は次のとおり。これらはGitに追加しない。

- Seq. Flow: `/Volumes/home/litgpt_compose/out/32bars/vanilla1-1_flow/step-00020480/samples200/midis/logic_batch_20260710_141759/mp3`
- Joint AR: `/Volumes/home/litgpt_compose/out/32bars/vanilla1-1_chord_conditioning_random_init_vector_prob_model/step-00006144/400samples/midis/logic_batch_20260712_155431/mp3`
- Txt AR: `/Volumes/home/litgpt_compose/out/default_32_separated_txt_transformer/step-00000256/generated/midis/logic_batch_20260710_185929/mp3`

2026-07-13の確認時点では、Seq. Flow 200本、Txt AR 200本、Joint ARは生成中で243本だった。66セットの本番manifest生成には、Seq. Flow 198本、Txt AR 198本、Joint AR 396本が必要である。

## Google Driveへの音声配置手順

音声ファイルはGoogle Driveへ配置し、サイトの静的ファイルと生成済み `stimuli.json` はGitHub Pagesで配信する。Webサイトの動作はアップロード手段に依存しない。

1. 専用Google Drive内に、実験専用フォルダを作成する。推奨名は `202607_subjective_evaluation_audio`。
2. その配下に `seq_flow/`, `joint_ar/`, `txt_ar/` の3フォルダを作成する。
3. 各手法のmp3を対応するフォルダへアップロードする。アップロード方法は任意であり、rcloneは必要ない。
4. ファイル名は生成元のbasenameから変更せず、そのままDriveへ配置する。同名ファイルが手法間に存在しても、`seq_flow/`, `joint_ar/`, `txt_ar/` の別フォルダに置いて衝突を避ける。
5. 音声フォルダまたは各音声ファイルの共有設定を「リンクを知っている全員が閲覧可」にする。編集権限は付与しない。
6. アップロード完了後、GASの `refreshAudioManifestSheet()` を実行する。各ファイルのDrive file ID、resource key、公開URL、サイズがSpreadsheetの `audio_manifest` シートへ書き出される。
7. `public_url` はブラウザのHTML `<audio>` から取得できるURLにする。候補は `https://drive.google.com/uc?export=download&id=<FILE_ID>` だが、本番採用前にRange request、リダイレクト、匿名ブラウザでの再生を実機確認する。
8. `data/stimuli.json` の `sample_A` / `sample_B` には、Drive file IDから作った公開URLを記録する。生成元の `/Volumes/...` パスはWebへ公開しない。
9. シークレットウィンドウで全URLに認証なしでアクセスできることを確認する。
10. GitHub Pages上で、少なくともChrome、Safari、Firefoxのデスクトップ版を使い、再生開始、最後までの再生、A/B排他制御を確認する。
11. 本番前に全792 URL（198 + 396 + 198）へ軽量な疎通確認を行い、HTTP失敗、HTMLエラーページ、0 byte、重複file IDがないことを検査する。
12. 本番開始後はDrive上のファイルを差し替えない。修正時は新しいfile IDを発行し、manifestと刺激リストを版管理する。

Google Driveは大量アクセス時の制限や音声ストリーミング挙動が変わる可能性がある。公開前試験で安定しない場合は、同じmanifest構造を保ったままGoogle Cloud Storage等の静的配信先へ切り替える。

### Google Cloud Storageへ切り替える場合に実験実施者が行う操作

1. Google Cloud Consoleで課金先を設定したprojectを選ぶか、新規projectを作る。
2. Cloud Storageのbucketを作る。bucket名とregionを記録し、本実験専用にする。
3. 組織ポリシーでPublic Access Preventionが強制されていないことを確認する。強制されているprojectでは匿名公開できないため、管理者へ相談するか別projectを使う。
4. bucketのPermissionsでprincipal `allUsers` に `Storage Object Viewer` を付与し、公開アクセスを許可する。公開対象が実験音声だけであることを確認する。
5. ConsoleのUploadまたは `gcloud storage rsync --recursive <LOCAL_DIRECTORY> gs://<BUCKET_NAME>/<PREFIX>` で、manifestにある音声だけをアップロードする。
6. objectの `Content-Type` が `audio/mpeg` であることを確認する。
7. manifestの公開URLを `https://storage.googleapis.com/<BUCKET_NAME>/<OBJECT_NAME>` 形式へ置換する。
8. シークレットウィンドウとGitHub Pagesから匿名再生を確認する。JavaScriptで追加のcross-origin読取を行う場合だけ、GitHub Pagesのoriginを許可するbucket CORS設定を追加する。通常のHTML `<audio src>`再生だけなら、まずCORSなしで試験する。
9. 全792 URLのHTTP status、`Content-Type`, file size、重複を検査し、`data/audio_manifest.csv` と `data/stimuli.json` のversionを更新する。
10. Google Drive版のURLとGCS版のURLを混在させず、本番採用先をREADMEとhandoffへ記録する。

bucketをpublicにすると、URLを知る第三者が音声を取得できる。個人情報や非公開データを同じbucketへ置かない。費用、egress、削除時期は実験実施者がGoogle Cloud Consoleで確認する。

参考となる公式手順:

- [Cloud Storageへファイルをアップロードする](https://docs.cloud.google.com/storage/docs/uploading-objects)
- [Cloud Storageのデータを公開する](https://docs.cloud.google.com/storage/docs/access-control/making-data-public)
- [公開objectへアクセスするURL形式](https://docs.cloud.google.com/storage/docs/access-public-data)
- [Cloud StorageのCORS設定](https://cloud.google.com/storage/docs/configuring-cors)

## GASの回答受理確認

前回の `fetch(..., mode: "no-cors")` では、ブラウザがGASの応答本文を読めず、Spreadsheetへの保存成功を確認できなかった。第2回は次の方式に変更する。

1. GitHub Pagesがhidden iframeを作り、そのiframeを送信先にしたHTML formで回答payloadをGASへPOSTする。
2. GASはassignment tokenと6時間の期限を検証し、回答保存後に `submission_id` と結果を含む小さなHTMLを返す。
3. GAS応答ページが `window.parent.postMessage()` で結果をGitHub Pagesへ返す。
4. GitHub Pagesはiframe、送信元origin、`submission_id`、送信ごとのnonceを検証する。
5. 成功応答を確認した場合だけ完了画面へ進む。timeout時は同じ `submission_id` で再送するため、GAS側も同IDを冪等に扱う。

この方式は回答本文をGET/JSONPへ載せず、GASの保存結果をブラウザで確認するためのもの。実装後に実際のGAS deployment URLと `script.googleusercontent.com` から届くmessageのoriginをブラウザで確認し、許可originを固定する。

参考となる公式仕様:

- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script Content Serviceとredirect](https://developers.google.com/apps-script/guides/content)
- [Apps Script HTML Serviceのiframe制約](https://developers.google.com/apps-script/guides/html/restrictions)
- [`window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

## アップロード完了後のfile ID取得と刺激生成

Drive file IDを手作業で調べる必要はない。第2回GASをSpreadsheetへ配置して `setupSheets()` を実行した後、Apps Script editorから管理者用関数 `refreshAudioManifestSheet()` を実行する。

この関数は親フォルダID `1a8NatenMw3nw_0_ka1VBep6wKgh3U7yy` から `seq_flow`, `joint_ar`, `txt_ar` を検索し、直下のmp3について次を `audio_manifest` シートへ書き出す。

- `method`
- `source_basename`
- `drive_folder`
- `drive_file_id`
- resource keyを含む `public_url`
- `size_bytes`

Spreadsheetで `audio_manifest` シートを開き、`File` > `Download` > `Comma-separated values (.csv)` からCSVをダウンロードする。CSVを親repoへ置いた後、repo rootで次を実行する。

```bash
python scripts/data/prepare_subjective_evaluation_202607.py manifest \
  /path/to/audio_manifest.csv

python scripts/data/prepare_subjective_evaluation_202607.py generate

python scripts/data/prepare_subjective_evaluation_202607.py validate
```

生成物:

- `data/audio_manifest.csv`: Drive上で確認した全mp3とfile ID
- `data/selected_audio_manifest.csv`: 本番で選択した198/396/198本
- `data/stimuli.json`: 66セットの本番刺激リスト

`manifest`はGAS出力CSVを検査・正規化し、Drive上のファイル名を変更せずにローカル生成元basenameとの対応を記録する。`generate`は固定seed `20260713`で手法ごとに独立抽出する。Joint ARが396本未満、Seq. Flow/Txt ARが198本未満の場合は生成を停止し、不足数をエラー表示する。

### `set_067` 以降を追加する手順

本番開始後は `generate` を再実行しない。`generate` は初期66セットの作成専用であり、再実行すると既存セットの対応が変わる可能性がある。追加には必ず `extend` を使う。

追加1セットあたり、未使用のSeq. Flow 3本、Txt AR 3本、Joint AR 6本が必要である。現在の800本だけでは未使用が2/2/4本のため、1セットも追加できない。追加するセット数をNとすると、現在のmanifestに対して新たに必要な本数はSeq. Flow `max(0, 3N - 2)` 本、Txt AR `max(0, 3N - 2)` 本、Joint AR `max(0, 6N - 4)` 本である。今後さらに追加した後は、各手法の未使用本数を差し引いて計算する。

1. Driveの既存 `seq_flow/`, `joint_ar/`, `txt_ar/` に追加音源を置く。ファイル名は変更しない。同じ手法フォルダ内では既存ファイルと重複しない名前にする。
2. Apps Script editorで `refreshAudioManifestSheet()` を再実行する。
3. Spreadsheetの `audio_manifest` シートをCSVでダウンロードする。
4. 親repoのrootで次を実行する。`N` は追加セット数に置き換える。

```bash
python scripts/data/prepare_subjective_evaluation_202607.py manifest \
  /path/to/audio_manifest.csv

python scripts/data/prepare_subjective_evaluation_202607.py extend --sets N

python scripts/data/prepare_subjective_evaluation_202607.py validate
```

`extend` は `data/audio_manifest.csv` のうち `data/selected_audio_manifest.csv` にないDrive file IDとURLだけから独立抽出し、次の連番セットを追加する。既存の `sets` 配列要素は変更せず、選択済みmanifestにも新規行だけを追記する。seedを明示する場合は `--seed INTEGER` を指定し、未指定時は `20260713 + 追加前のset数` を使用する。実行前に必要数が不足していれば、出力ファイルを変更せず停止する。

実行後はdiffで次を確認してからcommit・pushする。

- `data/stimuli.json` の `set_001`〜追加前の最終setが変更されていない。
- `set_067` 以降が欠番なく追加され、各setが両比較3 trialsずつを持つ。
- `data/selected_audio_manifest.csv` は既存行を保持し、新規音源だけが末尾に増えている。
- GitHub Pagesの公開後にブラウザを再読み込みすると、`cache: "no-store"` で最新のセット一覧が取得される。

GASはサイトから毎回送られる `set_ids` を割当候補とするため、Spreadsheetの初期化や既存割当行の変更は不要である。GASコードを初回だけ上限固定版から更新し、再deployしておけば、追加セットも従来と同じlease規則で割り当てられる。

本番生成後、`js/config.js`の `stimuliUrl` を `data/stimuli.json` に変更する。Driveの親フォルダIDは既に `1a8NatenMw3nw_0_ka1VBep6wKgh3U7yy` として設定済みである。

## GASの配置

親repoの `gas/subjective_evaluation_202607/Code.gs` を第2回実験専用のApps Script projectへ配置する。

1. 第2回実験専用Spreadsheetを作成する。
2. Spreadsheetの `Extensions` > `Apps Script` を開き、`Code.gs`を貼り付ける。
3. 必要なら `CONFIG.spreadsheetId` を設定する。Spreadsheet-bound scriptなら空のままでよい。
4. `CONFIG.parentOrigin` がGitHub Pagesのorigin `https://katesawada.github.io` と一致することを確認する。
5. `setupSheets()`を1回実行して権限を承認し、`assignments`, `responses`, `submissions`, `audio_manifest`を作る。
6. 音声アップロード完了後に `refreshAudioManifestSheet()` を実行し、Drive読取権限を承認する。
7. Web Appを `Execute as: Me`、参加者がアクセス可能な設定でdeployする。
8. deployment URLを `js/config.js` の `gasEndpoint` に設定する。
9. test deploymentで割当、6時間期限、重複送信、iframe応答originを確認する。

### 総セット数の90%回答時のメール通知

有効回答が保存され、`submitted` になった一意なセット数が、その時点で公開されている総セット数の90%（小数点以下切り上げ）に達した時点で、GASは実験実施者へメールを一度だけ送る。初期66セットでは60件が通知基準となる。期限内に回答されず再利用可能になったleaseはカウントしない。通知失敗によって参加者の回答保存を失敗させないため、送信エラーはGASのexecution logへ記録し、次の有効回答時に再試行する。

通知先はコードへ記録せず、Apps Script projectのScript Propertyに設定する。

1. Apps Script editor左側の `Project Settings` を開く。
2. `Script Properties` の `Add script property` を選ぶ。
3. Propertyに `NOTIFICATION_EMAIL`、Valueに通知先メールアドレスを設定して保存する。
4. Apps Script editor上部の関数一覧から `sendNotificationTestEmail` を選択して実行する。
5. メール送信権限の承認画面が表示された場合は内容を確認して承認する。表示されない場合でも、テストメールが届けば既に必要な権限が承認済みである。
6. `NOTIFICATION_EMAIL` にテストメールが届くことを確認する。この関数は90%通知済み状態を変更しない。
7. 更新した `Code.gs` でWeb Appを再deployする。

総セット数は割当要求に含まれる最新の `set_ids` 件数から取得し、Script Property `CURRENT_TOTAL_SET_COUNT` へ自動記録する。古いページからの要求で総数が減らないよう、記録値は増加時だけ更新する。通知成功時は、そのときの総セット数が `LAST_NOTIFIED_TOTAL_SET_COUNT` に記録され、同じ総数について通知を繰り返さない。`set_067` 以降を追加して総数が増えた場合は、新しい総数の90%に達した時点で改めて通知する。これら2つのpropertyを手作業で作る必要はない。

## 想定するリポジトリ構成

```text
.
├── README.md
├── SPECIFICATION.md
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   └── config.js
└── data/
    ├── audio_manifest.csv
    ├── stimuli.example.json
    └── stimuli.json
```

音声ファイル自体はこのリポジトリに置かない。`audio/` を作る場合もローカル確認用とし、`.gitignore` で除外する。

## 公開前の主要チェック

- Joint ARが396本以上あり、選択した全ファイルが正常に再生できる。
- 初期66セット（追加時はそれ以上）、各6 trials、各比較3 trials、各trial 2 questionsである。
- 全セットを通じて同一音声URLが重複していない。
- GASの同時割当試験で同一セットが二重にleaseされない。
- 6時間を過ぎた未回答leaseだけが再利用される。
- 期限切れleaseの古い `assignment_token` による送信が拒否される。
- 6時間経過をブラウザが検知するとalertを表示し、状態を破棄して導入画面へ戻る。
- 有効送信後のセットが再割当されない。
- 有効回答済みセットが総セット数の90%に達した時、設定済みメールアドレスへ通知が一度だけ届く。
- 全セット割当不可時に、参加者へ利用可能なセットがないことと実験実施者への問い合わせを案内する。
- Drive音声を認証なしで最後まで再生できる。
- `gasEndpoint`, `stimuliUrl`, `experimentId` が本番値である。
