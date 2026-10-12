# Vite+ 1.1.0・pnpm 12.11.2 へのアップグレード

記録日: 2026-10-12 / 対象: `vite-plus` 1.0.0 → 1.1.0、pnpm 12.9.1 → 12.11.2

`vp outdated` に `vite-plus` 1.1.0 が表示されたので、Vite+ と pnpm を最新にした。手順と、その途中で出た警告への対応をまとめる。

## まとめ

```bash
# Vite+
vp upgrade                  # 1. グローバルの vp を更新する（どこで実行してもよい）
cd frontend
vp migrate                  # 2. プロジェクトの vite-plus を、グローバルの vp と同じバージョンに揃える（install まで行う）

# pnpm（frontend/ で実行）
vp env pin pnpm@12.11.2     # 3. devEngines.packageManager を書き換える
vp install                  # 4. 新しい pnpm でインストールし、lockfile の pnpm の記録も更新する
```

- `vp migrate` の `ui-token` の警告は誤検知だった。原因になったフォルダ名 `src/__vitest__/` を `src/__setup__/` に変えた
- 更新後に `vp check` / `vp test` / `vp run build` がすべて成功し、Git フックの設定も壊れていないことを確かめた

## Vite+ 1.1.0

2026-10-07 11:28（日本時間）のリリース。このリポジトリを 1.0.0 で作った数時間後に出ていた。

主な変更（[リリースノート](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.1.0)より）:

- `vp dev` がローカルの URL を表示するまでの時間が約 24% 短くなり、親プロセスのメモリが約 30% 減った
- `vp migrate` が、同梱の Oxlint にないルールを警告つきで削除するようになった
- パッケージマネージャーが対応していないオプションを渡すと、黙って無視せずにエラーで止まるようになった
- `vp run` が `npm_execpath` を設定するようになった。npm-run-all2 などのツールが、npm ではなくプロジェクトのパッケージマネージャーを使う

同梱ツールのバージョン:

| ツール   | 1.0.0  | 1.1.0  |
| -------- | ------ | ------ |
| vite     | 8.3.1  | 8.3.3  |
| rolldown | 1.2.11 | 1.2.12 |
| vitest   | 5.0.1  | 5.0.3  |
| oxlint   | 1.85.0 | 1.87.0 |
| oxfmt    | 0.70.0 | 0.72.0 |

リリースノートには「新しい lint・format のバージョンで、今まで通っていたコードが引っかかることがある」と書かれている。このリポジトリでは、更新後も `vp check` で新しい指摘は出なかった。

### なぜグローバルの `vp` を先に上げるのか

`vp` は 2 つの層でできている。`vp --version` の出力が 2 段に分かれているのはこのため。

| 層                                           | 場所                                      |
| -------------------------------------------- | ----------------------------------------- |
| グローバルの `vp`（CLI 本体）                | `~/.vite-plus/`                           |
| プロジェクトの `vite-plus`（中身のツール群） | `frontend/pnpm-workspace.yaml` の catalog |

`vp migrate` は「プロジェクトを、グローバルの `vp` と同じバージョンに揃える」コマンド。そのため、グローバルが古いまま `vp migrate` を実行しても何も変わらない。先にグローバルを上げてから、プロジェクトを追いつかせる。

TS/npm で言えば、Angular の `npm i -g @angular/cli` → `ng update` の流れに近い。グローバルの CLI を上げてから、その CLI にプロジェクトの依存を書き換えさせる。

`vp upgrade --check` を使うと、インストールせずに新しいバージョンがあるかだけを確認できる。上げた後に問題があれば、`vp upgrade --rollback` で前のバージョンに戻せる。

### `vp migrate` が変更したもの

| ファイル              | 変更                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `pnpm-workspace.yaml` | catalog の `vite-plus` と `vite`（vite-plus-core の別名）を 1.1.0 にした |
| `pnpm-lock.yaml`      | 上の変更を反映した                                                       |
| `.gitignore`          | `.vitest/` を追加した                                                    |

- `vp migrate` は依存関係のインストールまで行う（出力に `Dependencies installed` と出る）。そのため、後から `vp install` を実行する必要はなかった
- `.vitest/` は、Vitest 5 がレポートや添付ファイルを出力するディレクトリ。Vitest 5 から出力先が `.vitest/` に 1 つにまとめられたので、`.gitignore` にはこの 1 行を書けば足りる（[Vitest の移行ガイド](https://vitest.dev/guide/migration/)）
- `frontend/` で `vp migrate` を実行しても、Git フックの設定（`core.hooksPath: .vite-hooks/_`）は変わらなかった（`vp hooks status` で確認）

### `ui-token` の警告は誤検知だった

`vp migrate` の最後に、次の警告が出た。

```text
! Warnings:
  - Vitest v5: 1 review item

vite.config.ts
  58:18 REVIEW [ui-token] Use the authenticated UI URL printed by Vitest, including its token.
```

本来は、Vitest 5 で Vitest UI がトークン認証を必須にしたことへの注意。`http://localhost:51204/__vitest__/` を直接開くとエラーになるので、Vitest が起動時に表示する `?token=...` 付きの URL を開く必要がある。このリポジトリは Vitest UI を使っていないので、関係がない。

`vp migrate` の判定（`node_modules/vite-plus/dist/migration/bin.js`）を読むと、条件は次のとおりだった。

```js
Literal(node) {
  if (/\/__vitest__\//.test(value) && !/[?&]token=/.test(value))
    editor.report(node, "ui-token", "Use the authenticated UI URL printed by Vitest, including its token.");
}
```

つまり、**`/__vitest__/` を含む文字列があり、`token=` が付いていなければ警告する**だけの判定。`vite.config.ts` の 58 行目は次の行で、テストの setup ファイルを置いたフォルダ名が、Vitest UI の URL のパスとたまたま同じ形になっていた。

```ts
setupFiles: ["./src/__vitest__/setup.ts"],
```

このままでも害はないが、`vp migrate` を実行するたびに同じ警告が出るので、フォルダ名を `src/__setup__/` に変えた。あわせて、`vite.config.ts` の `setupFiles`、`tsconfig.app.json` の `exclude`、`tsconfig.test.json` の `include` を書き換えた。

**`src/__setup__/` にはテスト用のファイルだけを置く**: このフォルダは `tsconfig.app.json` で除外され、`tsconfig.test.json` で Vitest のグローバル API の型が付く（`03-tsconfig・エイリアス・Vitest のグローバル API.md` を参照）。アプリの初期化コードを置くと、アプリの型チェックから外れてしまう。

## pnpm 12.11.2

2026-10-10 02:35（日本時間）のリリース。

| dist-tag  | バージョン | 意味                                      |
| --------- | ---------- | ----------------------------------------- |
| `latest`  | 12.11.2    | 安定版。`pnpm@latest` で入るのはこれ      |
| `next-12` | 12.12.1    | 先行リリース。npm で言う `@next` に当たる |

12.12 系も出ているが、`next` 扱いなので `latest` の 12.11.2 にした。

12.9.1 からの主な変更（リリースノートより）:

- **セキュリティ修正（12.10.0）**: パストラバーサルを含む依存が、グローバルな仮想ストアの外にファイルを書き込めないようにした、など
- **メタデータのキャッシュの置き場所が変わった（12.10.0）**: 更新後の最初の install は、レジストリのメタデータを取り直すので少し遅くなる
- **エージェント用スキルのリンク（12.11.0）**: 直接の依存が `skills/<名前>/SKILL.md` を同梱していると、`pnpm approve` で承認した後に `.claude/skills` などへリンクする。今の直接の依存には、スキルを同梱しているものは無かった
- Rust ツールチェーンの管理、実験的な `loaded` リンカーなども追加されたが、このリポジトリには関係しない

### 手順

```bash
vp env pin pnpm@12.11.2
vp install
```

**なぜ `vp install` まで必要なのか**: pnpm 12 は、`pnpm-lock.yaml` の先頭に pnpm 自身のバージョンとハッシュ値を記録している（`04-vp install と pnpm の関係.md` を参照）。`vp env pin` が書き換えるのは `package.json` の `devEngines.packageManager` だけなので、lockfile の記録を揃えるには install し直す必要がある。

更新後の状態:

- `pnpm --version` が 12.11.2 になった
- `package.json` の `devEngines.packageManager.version` と、lockfile の `packageManagerDependencies` が、どちらも 12.11.2 になった（12.9.1 はどこにも残っていない）

## 更新後に確かめたこと

| 確認                     | 結果                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp check`               | 成功（Oxlint 1.87・Oxfmt 0.72 で新しい指摘なし）                                                                                                      |
| `vp test`                | 成功。`toBeInTheDocument()` が使えるので、`src/__setup__/setup.ts` が読み込まれている                                                                 |
| `vp run build`           | 成功                                                                                                                                                  |
| `vp hooks status`        | `core.hooksPath: .vite-hooks/_`、`Project hooks: pre-commit` のまま                                                                                   |
| React Compiler 系の lint | Oxlint 1.87 で確かめ直した。`new Date()` が `react/purity` で検出されるようになった以外は変わらない（`05-React Compiler（Rust 版）の導入.md` を参照） |

## 参考

- [Vite+ 1.1.0 リリースノート](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.1.0)
- [Upgrade（vp upgrade）](https://viteplus.dev/guide/upgrade)
- [Vitest の移行ガイド（v5）](https://vitest.dev/guide/migration/)
- [pnpm のリリース](https://github.com/pnpm/pnpm/releases)
