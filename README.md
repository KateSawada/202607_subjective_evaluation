# 202607 Subjective Evaluation

2026年7月に実施する第2回主観評価実験のGitHub Pagesサイト用リポジトリ。

機能要件とデータ仕様の正本は [SPECIFICATION.md](SPECIFICATION.md) とする。サイト実装、GAS実装、刺激セット生成はこの仕様に従う。

## 実験の概要

- 比較1: Txt AR vs Joint AR
- 比較2: Seq. Flow vs Joint AR
- 1参加者あたり各比較3 trials、合計6 trials
- 各trialで `global_structure` と `local_naturalness` の2問に回答
- 1参加者あたり合計12 responses
- 66セットを用意し、1セットにつき有効回答は高々1件
- 音声はGitでは管理せず、Google Driveから配信
- 実験開始時にGASから未使用または期限切れのセットを排他的に割り当てる

## 音源

ローカルの生成元は次のとおり。これらはGitに追加しない。

- Seq. Flow: `/Volumes/home/litgpt_compose/out/32bars/vanilla1-1_flow/step-00020480/samples200/midis/logic_batch_20260710_141759/mp3`
- Joint AR: `/Volumes/home/litgpt_compose/out/32bars/vanilla1-1_chord_conditioning_random_init_vector_prob_model/step-00006144/400samples/midis/logic_batch_20260712_155431/mp3`
- Txt AR: `/Volumes/home/litgpt_compose/out/default_32_separated_txt_transformer/step-00000256/generated/midis/logic_batch_20260710_185929/mp3`

2026-07-13の確認時点では、Seq. Flow 200本、Txt AR 200本、Joint ARは生成中で243本だった。66セットの本番manifest生成には、Seq. Flow 198本、Txt AR 198本、Joint AR 396本が必要である。

## Google Driveへの音声配置手順

以下は本番用manifestを生成する際の標準手順である。大容量コピーと外部アップロードになるため、実行前に対象ファイル一覧を確認する。

1. 専用Google Drive内に、実験専用フォルダを作成する。推奨名は `202607_subjective_evaluation_audio`。
2. その配下に `seq_flow/`, `joint_ar/`, `txt_ar/` の3フォルダを作成する。
3. セット生成スクリプトが選んだファイルだけをアップロードする。必要数はそれぞれ198、396、198本であり、生成元の全ファイルを無条件にアップロードしない。
4. ファイル名は衝突防止と監査のため、manifestで使う一意な公開名へ変換する。推奨形式は `<method>_<source_index>_<source_basename>.mp3`。
5. 音声フォルダまたは各音声ファイルの共有設定を「リンクを知っている全員が閲覧可」にする。編集権限は付与しない。
6. 各ファイルのDrive file IDを取得し、`data/audio_manifest.csv` に `method`, `source_path`, `source_basename`, `drive_file_id`, `public_url`, `size_bytes` を保存する。アクセストークンや個人情報は保存しない。
7. `public_url` はブラウザのHTML `<audio>` から取得できるURLにする。候補は `https://drive.google.com/uc?export=download&id=<FILE_ID>` だが、本番採用前にRange request、リダイレクト、匿名ブラウザでの再生を実機確認する。
8. `data/stimuli.json` の `sample_A` / `sample_B` には、Drive file IDから作った公開URLを記録する。生成元の `/Volumes/...` パスはWebへ公開しない。
9. シークレットウィンドウで全URLに認証なしでアクセスできることを確認する。
10. GitHub Pages上で、少なくともChrome、Safari、Firefoxのデスクトップ版を使い、再生開始、最後までの再生、A/B排他制御を確認する。
11. 本番前に全792 URL（198 + 396 + 198）へ軽量な疎通確認を行い、HTTP失敗、HTMLエラーページ、0 byte、重複file IDがないことを検査する。
12. 本番開始後はDrive上のファイルを差し替えない。修正時は新しいfile IDを発行し、manifestと刺激リストを版管理する。

Google Driveは大量アクセス時の制限や音声ストリーミング挙動が変わる可能性がある。公開前試験で安定しない場合は、同じmanifest構造を保ったままGoogle Cloud Storage等の静的配信先へ切り替える。

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
- 66セット、各6 trials、各比較3 trials、各trial 2 questionsである。
- 全セットを通じて同一音声URLが重複していない。
- GASの同時割当試験で同一セットが二重にleaseされない。
- 6時間を過ぎた未回答leaseだけが再利用される。
- 期限切れleaseの古い `assignment_token` による送信が拒否される。
- 有効送信後のセットが再割当されない。
- Drive音声を認証なしで最後まで再生できる。
- `gasEndpoint`, `stimuliUrl`, `experimentId` が本番値である。
