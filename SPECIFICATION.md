# 第2回主観評価Web実験仕様

## 1. 目的と範囲

本仕様は、2026年7月に実施する第2回主観評価実験の静的Webサイト、刺激リスト、GAS API、Google Spreadsheet保存形式を定義する。第1回実験の画面、設問、A/B提示、回答記録を継承し、刺激セットの一意割当と外部音声配信を追加する。

## 2. 実験条件

### 2.1 手法と比較

扱う手法IDと表示用名称は次のとおり。手法名は参加者画面には表示しない。

| method_id | 内部表示名 | 比較 |
|---|---|---|
| `txt_ar` | Txt AR | `txt_ar_vs_joint_ar` |
| `seq_flow` | Seq. Flow | `seq_flow_vs_joint_ar` |
| `joint_ar` | Joint AR | 両方 |

各参加者は次の6 trialsを評価する。

- Txt AR vs Joint AR: 3 trials
- Seq. Flow vs Joint AR: 3 trials

trialの提示順はセット内でランダム化する。ただし、前半・後半への比較条件の偏りを避けるため、3 trialsずつの比較条件を均衡化できる固定seed付きshuffleを使う。

### 2.2 セット数とサンプル使用数

- 初期セット数: 66 (`set_001` から `set_066`)
- 1セット: 6 trials
- 初期全trial数: 396
- 初期の各比較: 198 trials
- 初期Seq. Flow使用数: 198本（200本中2本を未使用）
- 初期Txt AR使用数: 198本（200本中2本を未使用）
- 初期Joint AR使用数: 396本（400本中4本を未使用）
- 同一音声ファイルは、比較条件・セット・trialをまたいで再利用しない。
- 1セットの有効回答は高々1参加者分とする。

セット生成時は固定seedを記録する。入力ディレクトリ、全候補ファイル、選択されたファイル、除外ファイル、セット、trial、ペア対応をmanifestへ保存し、再生成可能にする。

初期66セットの回答枠が不足する場合は、未使用または新規追加した音源を用いて `set_067` 以降を連番で追加できる。追加1セットあたりSeq. Flow 3本、Txt AR 3本、Joint AR 6本を新たに使用する。追加処理はappend-onlyとし、既存setのtrial、音源、ID、順序を変更しない。追加seed、開始・終了set ID、追加set数を `stimuli.json` の `extensions` に記録する。

### 2.3 ペアリング

各手法の候補200本または400本から、固定seedを使って独立にサンプルを抽出する。ファイル名の `songNNNN_barNNNN`、コード条件、生成順序は手法間で揃えない。したがって、`sample_pair_id` は提示・解析管理用IDであり、同一入力条件への対応を意味しない。

Joint ARの400本は、独立にshuffleした後、198本をTxt AR比較、別の198本をSeq. Flow比較に割り当てる。Joint AR音源を両比較で再利用しない。Seq. FlowとTxt ARもそれぞれ198本を独立に選ぶ。抽出seed、抽出前後の順序、未使用ファイルをmanifestへ記録する。

## 3. 画面遷移

- 起動直後に `participant_id` を生成し、刺激リストを取得して導入画面を表示する。この時点ではセットを割り当てない。
- 導入画面には実験概要、想定所要時間15–20分、参加環境、匿名化、公表可能性、同意、再読み込み禁止、連絡先を表示する。
- 参加者に、開始後は中断せず一度に最後まで実施するよう明示的に依頼する。
- 同意後に中央へ「読み込み中・・・」を表示し、GASへセット割当を要求する。
- 割当成功後に音楽経験アンケートへ進む。
- アンケート完了後、割当済みセットの最初のtrialへ進む。
- 最終trial後、回答を送信し、サーバーが受理した場合だけ完了画面を表示する。
- 画面上部に進捗ラベルと進捗バーを表示する。
- 「前へ」、途中保存、回答変更のためのtrial逆行は提供しない。

## 4. 参加環境と参加者属性

- デスクトップPCまたはノートPCを必須とし、画面幅959px以下では開始不可にする。
- イヤホンまたはヘッドフォンと静かな環境を案内する。
- `participant_id` はサイト起動ごとに `p_` prefix付きの十分長いランダム値として生成する。
- 次の3問を必須とし、個別に保存する。
  - `music_major`: 音楽関連分野の専攻経験
  - `piano_experience`: 3年以上のピアノ経験
  - `composition_experience`: 3年以上の作曲または編曲経験
- 3問の論理和である `music_experience` は新規に保存しない。
- 個人を直接特定する氏名、メールアドレス等は収集しない。

## 5. セット割当lease

### 5.1 基本動作

GASは `assignments` シートを割当台帳として使用する。参加者ごとに「カラム」を作るのではなく、1回の割当を1行として記録し、参加者・セット・状態を列で保持する。

サイトは参加者の同意後にGASへ `action=assign_set`, `experiment_id`, `participant_id`, `set_ids` を送る。GASは `LockService.getScriptLock()` の保持中に次を実行する。

1. 同じ `participant_id` に未完了かつ有効なleaseがあれば、同じ割当を冪等に返す。
2. `submitted` 状態のセットを候補から除く。
3. 現在時刻より `expires_at` が後の `assigned` 状態のセットを候補から除く。
4. 未割当セットと、回答なしで6時間以上経過した期限切れセットを候補にする。
5. 候補から1セットを選び、推測困難な `assignment_token` を生成する。
6. `assigned_at` と `expires_at = assigned_at + 6 hours` を記録して返す。

候補がない場合は `no_set_available` を返し、サイトは実験を開始させない。割当APIの失敗時にブラウザ側でランダム選択へフォールバックしてはならない。

### 5.2 再利用と遅延送信

- leaseから6時間以内に有効回答が送信されれば、状態を `submitted` にする。
- 6時間以内に回答がなければ、そのセットは次の割当要求で再利用可能になる。
- 期限切れleaseが別参加者へ再割当された後、古い `assignment_token` から届いた回答は保存しない。
- `participant_id`, `set_id`, `assignment_token` が現在の有効leaseと一致する場合だけ回答を受理する。
- 同じtokenの再送は冪等に扱い、`responses` や `submissions` を重複追加しない。
- 受理判定と回答保存とlease更新は同じscript lock内で行う。
- ブラウザはGASが返した `expires_at` を保持し、アンケート開始前、各trial表示時、「次へ」押下時、最終送信前に期限を確認する。
- 6時間を経過していた場合は `alert()` で「割り当ての有効期限が切れました。最初からやり直してください」と通知する。
- alertを閉じた後、回答、音楽経験、割当token等の実験状態を破棄し、導入画面へ戻す。再開する場合は同意と新しいセット割当からやり直す。
- 期限判定の正はGASの `expires_at` とする。ブラウザ側の判定をすり抜けた場合も、GAS側で期限切れ送信を拒否する。

### 5.3 assignments列

最低限、次の列を持つ。

| 列 | 内容 |
|---|---|
| `assignment_id` | 割当イベントID |
| `experiment_id` | 実験ID |
| `participant_id` | 匿名参加者ID |
| `set_id` | 割当セット |
| `assignment_token_hash` | tokenのハッシュ。raw tokenは保存しないことを推奨 |
| `assigned_at` | GAS側の割当時刻 |
| `expires_at` | 6時間後の期限 |
| `status` | `assigned`, `expired`, `submitted`, `rejected` |
| `submitted_at` | 有効回答受理時刻 |
| `submission_id` | 対応する送信ID |

期限切れ行は履歴として残し、新しい割当は新しい行に記録する。行の上書きによって割当履歴を失わない。

## 6. trial提示

- 各trialで曲Aと曲BをHTML `audio` 要素により提示する。
- 各trialで50%の確率で手法と曲A/Bの対応を交換する。
- `ab_order_seed`, `swapped`, `method_A`, `method_B`, `sample_A`, `sample_B` を記録する。
- 参加者画面に手法名、元ファイル名、生成条件を表示しない。
- 一方の曲を再生中は他方を再生不可にし、他方の領域に「曲Aを再生中」または「曲Bを再生中」と表示する。
- 両方の曲を最後まで再生するまで回答確定操作を有効化しない。
- 音源URLの取得または再生に失敗した場合は再試行を案内し、`playback_issue` を記録できるようにする。

## 7. 設問と回答

各trialで次の2問を同じ音源対に対して回答する。

- `global_structure`: 32小節全体として、反復・展開・セクションのまとまりがより自然な曲
- `local_naturalness`: 短い範囲で、音高・リズム・和音の流れがより自然な曲

両設問とも4択の強制選好とする。

| 値 | 表示 |
|---:|---|
| `-2` | Aの方が明らかによい |
| `-1` | Aの方がややよい |
| `1` | Bの方がややよい |
| `2` | Bの方が明らかによい |

`差がない / 判断できない` は設けない。両曲を完聴し、2問すべてに回答するまで「次へ」を有効化しない。

## 8. 刺激リスト

`data/stimuli.json` は少なくとも次を持つ。

- `experiment_id`
- `generation_seed`
- `audio_manifest_version`
- `sets`: 初期66件。追加時は `set_067` 以降を含む
- 各setの `set_id` と6件の `trials`
- 各trialの `trial_id`, `comparison_id`, `sample_pair_id`, `length`, `method_1`, `method_2`, `sample_1`, `sample_2`, `questions`

公開前validatorは次を検査する。

- set IDが `set_001` から欠番なく連続し、各setのtrial数が6
- 各setで両比較が3 trialsずつ
- 全体で各比較が `3 × set数` trialsずつ
- 全trialに2設問がある
- Seq. Flow/Txt AR URLが各 `3 × set数` 個、Joint AR URLが `6 × set数` 個で重複しない
- `set_id`, `trial_id`, `sample_pair_id` が一意
- URLがaudio manifestに存在し、手法IDと一致する
- 固定seedと生成元ファイル対応が記録されている

## 9. 回答データ

1設問を1 responseとして保存し、1参加者あたり12 responseとする。前回の列に加えて `assignment_id`, `submission_id`, `comparison_id`, `assignment_token` の照合結果を記録する。raw tokenはresponsesへ保存しない。

各responseには少なくとも次を含める。

- `experiment_id`, `participant_id`, `set_id`, `assignment_id`, `submission_id`
- `trial_id`, `trial_order`, `comparison_id`, `sample_pair_id`, `length`
- `question_type`, `response_value`, `preference`, `preferred_method`
- `method_A`, `method_B`, `sample_A`, `sample_B`, `swapped`, `ab_order_seed`
- `playback_issue`
- `music_major`, `piano_experience`, `composition_experience`
- `started_at`, `finished_at`, `submitted_at`
- `trial_page_started_at`, `trial_page_duration_ms`, `user_agent`

`submissions` は1参加者1行とし、上記識別子、profile、response count、GAS受信時刻、raw payloadを保存する。

## 10. 回答送信

- payloadには `experiment_id`, `participant_id`, `set_id`, `assignment_id`, `assignment_token`, `submission_id`, `submitted_at`, `profile`, `responses` を含める。
- GASはtokenを検証してから保存する。
- `submission_id` はブラウザ側で1回生成し、再試行時も同じ値を使う。
- 通信失敗時は同じpayloadを再送できるよう、送信完了までメモリ内に保持する。
- GASが保存を受理したことをブラウザが確認できた場合だけ完了表示にする。
- 前回の `fetch(..., mode: "no-cors")` はレスポンス本文を確認できず、この要件を満たさないため使用しない。

### 10.1 受理確認方式

GitHub PagesとGASは異なるoriginであり、Apps Script Content Serviceの応答は `script.googleusercontent.com` の一時URLへリダイレクトされる。このため、通常のCORS `fetch()`に依存せず、hidden iframe、HTML form POST、`window.postMessage()`を使う。

1. ブラウザは送信ごとに推測困難な `response_nonce` を生成する。
2. `target` をhidden iframe名にした一時formを作り、`payload`をGAS Web AppへPOSTする。
3. GASはtoken、期限、`submission_id`を検証し、同じscript lock内で回答を保存する。
4. GASの `doPost(e)` は、`ok`, `submission_id`, `response_nonce`, `error_code` を持つ結果を埋め込んだ最小の `HtmlOutput` を返す。
5. 応答HTMLは `window.parent.postMessage(result, configuredParentOrigin)` を1回実行する。`targetOrigin` に `*` を使わない。
6. 親ページは `message` イベントについて、`event.source === iframe.contentWindow`、許可されたGAS応答origin、`submission_id`、`response_nonce`、データ形式を検証する。
7. `ok: true` のときだけ完了画面を表示する。timeoutまたは `ok: false` では完了扱いにせず、同じ `submission_id` で再試行する。
8. GASは同じ `submission_id` の再送に対して既存の成功結果を返し、行を重複追加しない。

`response_nonce` は応答対応付け専用であり、認証情報として扱わない。回答受理の認可は `assignment_token` で行う。

## 11. GASとSpreadsheet

GASは少なくとも次の処理を提供する。

- 疎通確認
- `assign_set`: 排他的leaseの取得
- `submit`: token検証、冪等性確認、responses/submission保存、lease完了
- `setupSheets`: `assignments`, `responses`, `submissions` の作成

全ての時刻判定はブラウザ時刻ではなくGAS側の時刻を正とする。Spreadsheetには少なくとも `assignments`, `responses`, `submissions` の3シートを作る。

## 12. 音声配信

- 音声ファイルはGitにcommitしない。
- Google Drive上の実験専用フォルダに配置し、匿名閲覧可能なURLだけを刺激リストへ記載する。
- Drive file IDとローカル生成元の対応を `data/audio_manifest.csv` で管理する。
- GitHub Pages、GAS、Driveの各URLを混同せず、`config.js` に `stimuliUrl` と `gasEndpoint` を設定する。
- 公開後の音声差し替えは禁止し、変更時はmanifest versionを更新する。
- Google Driveの配信制限により再生が不安定な場合、実験開始前に別の静的配信基盤へ移す。

## 13. エラー時の動作

- 刺激リスト取得失敗: 開始不可、再試行を表示
- GAS割当失敗: 開始不可、再試行を表示。ローカルランダム割当は禁止
- 利用可能セットなし: 募集終了または一時的に空きがない旨を表示
- 音声取得失敗: trialを進めず再試行と問題報告を提供
- 回答送信失敗: 完了扱いにせず、同一 `submission_id` で再送
- lease期限切れ: 回答を保存せず、alert後に状態を破棄して導入画面へ戻す
- token不一致: 回答を保存せず、参加者には実験実施者への連絡を案内
- ブラウザでlease期限切れを検知: alert後に状態を破棄し、導入画面へ戻す

## 14. 公開前検証

- 刺激validatorが全件成功する。
- 3手法のファイル数と重複が仕様どおりである。
- Drive URL全件が匿名ブラウザから音声として取得できる。
- 2ブラウザ以上から同時に割当要求し、同じセットが返らない。
- 同一participantの割当再試行で同じleaseが返る。
- 6時間未満のleaseは再利用されず、6時間超の未回答leaseだけ再利用される。
- submittedセットは再利用されない。
- 期限切れtoken、異なるparticipant/setのtoken、同一submissionの再送を試験する。
- 各setで6 trials・12 responsesが保存される。
- A/B交換後も `preferred_method` が正しく復元される。
- Chrome、Safari、Firefoxのデスクトップ版で完聴判定と排他再生を確認する。

## 15. 確定済みの設計判断

- 手法間のサンプルは独立に抽出し、入力条件を揃えない。
- セットleaseは参加者の同意後に取得する。
- 6時間経過後の古い回答は破棄し、ブラウザではalert後に導入画面へ戻す。
- Google Driveが不安定な場合は、手順を提示したうえでGoogle Cloud Storage等へ変更できる。
- 回答送信は `no-cors`を使わず、hidden iframeへのform POSTと `postMessage()`でGASの受理結果を確認する。
