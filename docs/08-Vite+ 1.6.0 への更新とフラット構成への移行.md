# Vite+ 1.6.0 への更新とフラット構成への移行

記録日: 2026-11-12 / 対象: `vite-plus` 1.4.0 → 1.6.0、Node.js 26.13.0 → 26.13.1、pnpm 12.16.1 → 12.18.0、`frontend/` → ルート、`.node-version` → `devEngines.runtime`、`minimumReleaseAge` 2 日 → 1 日

次の 5 つの変更をまとめて行った。手順と、それぞれの理由を残す。

## まとめ

```bash
# Vite+（手順は 06 と同じ）
vp upgrade        # グローバルの vp: 1.5.1 → 1.6.0
vp migrate        # プロジェクトの vite-plus: 1.4.0 → 1.6.0（このときはまだ frontend/ で実行した）

# フラット構成
git mv frontend/<各ファイル> .   # node_modules と dist は消して、移動後に vp install で作り直した

# Node.js・pnpm（ルートで実行）
vp env pin 26.13.1         # devEngines.runtime を書き換える（onFail: "error" は残る）
vp env pin pnpm@12.18.0    # devEngines.packageManager を書き換える
vp install                 # lockfile の pnpm の記録も 12.18.0 になる
vp update -L @types/node   # Node.js 26 に合わせて ^24 → ^26
```

- `frontend/` の中身をルートに移し、`frontend/` をなくした
- Node.js のバージョンを、ルートの `.node-version` から `package.json` の `devEngines.runtime`（`onFail: "error"`）に移した
- `pnpm-workspace.yaml` の `minimumReleaseAge` を 2880 分（2 日）から 1440 分（1 日）にした
- Node.js を 26 系 LTS の最新（26.13.1）に、pnpm を `latest` の 12.18.0 にした
- `@types/node` を `^24.19.2` から `^26.6.6` にして、Node.js 本体とメジャーバージョンを揃えた
- 更新後に `vp check` / `vp test` / `vp run build` が成功し、Git フックも動くことを確かめた

**docs/01〜07 を読むときの注意**: 01〜07 に出てくる `frontend/` のパスは、今はルートにある（例: `frontend/vite.config.ts` → `vite.config.ts`）。01〜07 は書いた時点の記録として残し、パスは書き換えていない。

## Vite+ 1.6.0

| バージョン | リリース（UTC） | 主な変更                                                                                                                          |
| ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1.5.0      | 2026-11-04      | 公式の Homebrew tap。`node --import vite-plus/register` で TypeScript を実行できる。`vp migrate` が `ts-node` などを `vpx` に移す |
| 1.5.1      | 2026-11-09      | **パッケージマネージャーのダウンロードと `vp env use` の高深刻度のセキュリティ修正（2 件）**。`vp run` のタスクで対話入力が戻った |
| 1.6.0      | 2026-11-11      | ファイルを書き換えるタスクも `vp run` でキャッシュできる。`vp run --dry-run`。`vp check --continue-on-error`                      |

1.5.1 のセキュリティ修正が入っているので、上げる理由は十分ある。

同梱ツールのバージョン:

| ツール   | 1.4.0  | 1.6.0  |
| -------- | ------ | ------ |
| vite     | 8.3.5  | 8.3.7  |
| rolldown | 1.2.15 | 1.2.18 |
| vitest   | 5.0.5  | 5.1.0  |
| oxlint   | 1.89.0 | 1.93.0 |
| oxfmt    | 0.74.0 | 0.78.0 |

`vp migrate` が変更したのは、`pnpm-workspace.yaml` の catalog（`vite-plus` と `vite`）と `pnpm-lock.yaml` だけだった。警告は出なかった。

## `frontend/` をなくしてフラット構成にした

### なぜなくしたか

`frontend/` は「研究用のリポジトリに、実験用のプロジェクトをサブディレクトリで並べる」つもりで作った（`01-vite-plus-1.0でできること.md` を参照）。しかし実際にはプロジェクトは `frontend/` の 1 つだけで、モノレポの検証（docs/07）もスクラッチ環境で行った。

1 つしかないのにサブディレクトリにしていたせいで、次のような回り道が必要になっていた。

| 回り道                                                                                                           | フラット構成にした後               |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `vp install` などは `frontend/` で、`vp hooks enable` はルートで実行する、という使い分けを README で注意していた | どれもルートで実行するだけ         |
| pre-commit フックが `cd frontend && vp staged` だった                                                            | `vp staged`                        |
| Oxc 拡張機能が `frontend/node_modules` を見つけられるよう、VS Code のマルチルートワークスペースを使っていた      | ルートを開くだけでよい（削除した） |
| Node.js はルート、pnpm は `frontend/` と、バージョンの指定が 2 か所に分かれていた                                | `package.json` 1 つにまとまった    |

TS/npm で言えば、パッケージが 1 つしかないのに `packages/app/` に入れていたのを、普通の単一パッケージのリポジトリに戻したのと同じ。

### 移動で変えたもの

| もの                            | 変更                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `frontend/` の中身              | `git mv` でルートへ（履歴が追えるように）                                               |
| `frontend/README.md`            | ルートの `README.md` にまとめた。サブディレクトリ特有の注意書きは不要になったので消した |
| `.vite-hooks/pre-commit`        | `cd frontend && vp staged` → `vp staged`                                                |
| `vite-plus-prac.code-workspace` | 削除した。`frontend` をワークスペースのフォルダにするためだけのファイルだった           |
| `node_modules/`・`dist/`        | 消して、ルートで `vp install` し直した（どちらも Git の管理外）                         |

`vite.config.ts` や `tsconfig*.json` のパスはすべて自分のファイルからの相対パスなので、書き換えずにそのまま動いた。

### `docs/` を Oxfmt の対象から外した

フラット構成にすると、`vp fmt` / `vp check` / pre-commit の `vp staged` の対象に `docs/` と `README.md` も入る（`frontend/` にいた頃は、その外にあるファイルは対象外だった）。そのまま `vp check` を実行すると、docs/01〜03 が「整形されていない」と判定されて失敗した。

`vp fmt` で整形すると、表の桁が揃え直されるうえに、コード例の JSON に末尾カンマが足された（docs/03 の tsconfig の例など）。docs は書いた時点の記録で、コード例は書いたとおりに残したいので、`vite.config.ts` で対象から外した。

```ts
fmt: {
  ignorePatterns: ["docs/**"],
},
```

`ignorePatterns` は Oxfmt の設定（`.gitignore` と同じ書き方で、設定ファイルのあるディレクトリが基準）。ルートの `README.md` は今までどおり整形される。

## `.node-version` をやめて `devEngines.runtime` に移した

```json
// package.json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "12.16.1", "onFail": "download" },
  "runtime": { "name": "node", "version": "26.13.0", "onFail": "error" }
}
```

`.node-version` を使っていたのは、ルートに `package.json` が無かったから（`07-Vite+ のモノレポ構成（React + Hono + Bun）.md` の「このリポジトリが `.node-version` のままでよい理由」を参照）。フラット構成にしてルートに `package.json` ができたので、この理由がなくなった。

**なぜ `onFail: "error"` なのか**: `"download"` にすると、pnpm が `vp` とは別に Node.js をダウンロードし、同じ版の Node.js を 2 か所に持つことになる。`"error"` なら pnpm はダウンロードせず、`vp` を通さずに違う版の Node.js で `pnpm install` したときだけ止めてくれる（docs/07 の「`onFail` を `"download"` 以外にする理由」で検証済み）。

移行後に確かめたこと:

- `vp env current` で `Source: devEngines.runtime`、`Version: 26.13.0` になった
- `pnpm-lock.yaml` に `node@runtime` が入っていない（pnpm が Node.js をダウンロードしていない）

## `minimumReleaseAge` を 1 日にした

```yaml
# pnpm-workspace.yaml
minimumReleaseAge: 1440
```

`minimumReleaseAge` は、公開されてから指定した分数がたっていない版を入れない設定。乗っ取られたパッケージの悪意ある版は、公開されてから数時間〜1 日ほどで見つかって取り下げられることが多いので、その間は入れないようにする。

| 値              | 守りの強さ                 | 新しい版（セキュリティ修正を含む）を入れられるまで |
| --------------- | -------------------------- | -------------------------------------------------- |
| 2880 分（2 日） | 強い                       | 2 日待つ                                           |
| 1440 分（1 日） | pnpm 11 以降の既定値と同じ | 1 日待つ                                           |

1 日にしたのは、多くの攻撃は 1 日以内に見つかるので守りとしては十分で、待ち時間を半分にできるから。

**既定値と同じなのに、消さずに書いている理由**: 自分で `minimumReleaseAge` を書くと、厳格モード（`minimumReleaseAgeStrict`）が有効になる。書かずに既定値に任せると厳格モードはオフで、条件を満たす版が無いときは新しい版を黙って入れ、その例外を `minimumReleaseAgeExclude` に書き足してしまう（docs/07 の「その他気づいたこと」を参照）。書いておけば、条件を満たさないときにエラーで止まる。

なお、`minimumReleaseAgeExclude` に入っている `vite-plus` などの Vite+ 関連のパッケージは、この待ち時間の対象外。

## Node.js 26.13.1・pnpm 12.18.0

### Node.js 26.13.1

2026-11-10 のリリース。26 系は 2026-10-28 の 26.13.0 から LTS（コードネーム Lithium）になっていて、26.13.1 はその最新。

**セキュリティリリース**で、http2・TLS まわりの深刻度 High の脆弱性がいくつも直っている（[リリースノート](https://nodejs.org/en/blog/release/v26.13.1)）。開発サーバー（`vp dev`）も Node.js の http で動くので、上げておく。

### pnpm 12.18.0

| dist-tag  | バージョン | 意味                                      |
| --------- | ---------- | ----------------------------------------- |
| `latest`  | 12.18.0    | 安定版。`pnpm@latest` で入るのはこれ      |
| `next-12` | 12.20.0    | 先行リリース。npm で言う `@next` に当たる |

06 と同じく、`next` ではなく `latest` の 12.18.0 にした。12.16.1 からの主な変更（[リリースノート](https://github.com/pnpm/pnpm/releases)より）:

- **12.17.0**: `pnpm outdated` / `pnpm update` が、`devEngines.packageManager` と `devEngines.runtime` に書いた pnpm・Node.js の版も確認・更新するようになった。pnpm が作るファイルの権限が umask どおり（`0644` など）になった
- **12.18.0**: エージェント用スキルのリンク名が `.claude/skills/<スキル名>` だけになった。`publishConfig.variants`（プラットフォームごとの配布物）への対応など。このリポジトリの直接の依存には、スキルを同梱しているものは無い

### `vp install` が「Already up to date」でも lockfile は更新される

`vp install` の出力は「Already up to date」だったが、`pnpm-lock.yaml` の先頭にある pnpm の記録（`packageManagerDependencies`）は 12.18.0 に書き換わっていた。依存パッケージは変わっていない、という意味の表示で、pnpm 自身の記録は更新される。12.16.1 は lockfile のどこにも残っていない。

### `@types/node` を 26 に揃えた

Node.js 本体は 26.13.0 にした時点（2026-11-01）で 26 系になっていたが、`@types/node` は `^24.19.2` のままだった。docs/02 の「`@types/node` は Node.js 本体のメジャーバージョンに合わせる」に従い、`vp update -L @types/node` で `^26.6.6`（`latest` タグ）にした。

型と本体がずれていると、困ることがある。型が古いと、26 で増えた API を使ったときに型エラーになる。型が新しすぎると、本体に無い API でも型チェックを通ってしまう。

## 更新後に確かめたこと

| 確認              | 結果                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `vp --version`    | グローバル・プロジェクトとも 1.6.0                                  |
| `vp check`        | 成功（Oxlint 1.93・Oxfmt 0.78 で新しい指摘なし）                    |
| `vp test`         | 成功（2 件）                                                        |
| `vp run build`    | 成功                                                                |
| `vp hooks status` | `core.hooksPath: .vite-hooks/_`、`Project hooks: pre-commit` のまま |
| `vp env current`  | Node.js 26.13.1（`devEngines.runtime`）、pnpm 12.18.0（`devEngines.packageManager`） |

## 参考

- [Vite+ 1.5.0 リリースノート](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.5.0)
- [Vite+ 1.5.1 リリースノート](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.5.1)
- [Vite+ 1.6.0 リリースノート](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.6.0)
- [pnpm の設定（minimumReleaseAge）](https://pnpm.io/settings/dependency-resolution#minimumreleaseage)
