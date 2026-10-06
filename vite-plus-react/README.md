# vite-plus-react

[Vite+](https://viteplus.dev/)（`vp`）1.0 で構築した React + TypeScript のフロントエンド。

## セットアップ（初回のみ）

Node.js と pnpm は `vp` が自動で用意するので、事前にインストールしておく必要はない。必要なのは Git と `vp` だけ。

### 1. `vp` をインストールする

macOS / Linux:

```bash
curl -fsSL https://vite.plus | bash
```

Windows（PowerShell）:

```powershell
irm https://vite.plus/ps1 | iex
```

インストールが終わったら**新しいターミナルを開き**、次のコマンドでバージョンを確認する。1.0.0 以上になっていれば OK。

```bash
vp --version
```

すでに古い `vp` を入れている場合は、`vp upgrade` で更新する。

### 2. リポジトリをクローンする

```bash
git clone git@github.com:zui-0000/vite-plus-research.git
cd vite-plus-research
```

### 3. Git フックを有効にする（リポジトリのルートで実行）

```bash
vp hooks enable
vp hooks status   # 「Project hooks: pre-commit」と表示されれば OK
```

Git フックの有効・無効は各 PC のローカル設定（`git config core.hooksPath`）なので、クローンしただけでは引き継がれない。そのため最初に 1 回だけ実行する。フックの本体（`.vite-hooks/pre-commit`）はリポジトリのルートにある。

> [!WARNING]
> 必ず**リポジトリのルート**で実行すること。`vite-plus-react/` の中で `vp hooks enable` や `vp config` を実行すると、フックの置き場所が `vite-plus-react/.vite-hooks/` という誤った場所で設定され、コミット時に何も実行されなくなる。
>
> 間違えて実行してしまった場合は、ルートで次のコマンドを実行すれば直る。
>
> ```bash
> vp hooks disable
> vp hooks enable --hooks-dir .vite-hooks
> ```

### 4. Node.js・pnpm・依存関係をインストールする

```bash
cd vite-plus-react
vp env install   # Node.js 24.21.0 と pnpm 12.9.1 を入れる
vp install       # 依存関係をインストールする
```

`.node-version` はリポジトリのルートにあるが、`vp` はカレントディレクトリから親ディレクトリへさかのぼって探すので、`vite-plus-react/` の中で実行してもルートの `.node-version` が使われる。一方、pnpm のバージョンはこのフォルダの `package.json` に書かれているので、`vite-plus-react/` の中でないと解決されない。

> [!WARNING]
> `vp install` を**リポジトリのルートで実行しない**こと。ルートには `package.json` が無いため、中身が空の `package.json`・`pnpm-lock.yaml`・`node_modules/` がルートに作られてしまう（エラーにはならない）。作られてしまった場合は、その 3 つを削除する。

### 5. 開発サーバーを起動する

```bash
vp dev
```

ブラウザで <http://localhost:5173/> を開く。

## よく使うコマンド

以下はすべてこのフォルダ（`vite-plus-react/`）で実行する。

| やりたいこと                     | コマンド                             | 補足                                                                       |
| -------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| 開発サーバーを起動する           | `vp dev`                             | <http://localhost:5173/>                                                   |
| 本番用にビルドする               | `vp run build`                       | 型チェック（`tsc -b`）をしてからビルドする。出力先は `dist/`               |
| ビルド結果を確認する             | `vp preview`                         | <http://localhost:4173/>。先に `vp run build` が必要                       |
| lint を実行する                  | `vp lint`                            | Oxlint による lint と型チェック                                            |
| lint の自動修正                  | `vp lint --fix`                      |                                                                            |
| フォーマットする                 | `vp fmt`                             | Oxfmt でファイルを書き換える                                               |
| フォーマットの確認だけする       | `vp fmt --check`                     | ファイルは書き換えない                                                     |
| lint + フォーマット + 型チェック | `vp check`                           | 確認だけ。ファイルは書き換えない                                           |
| 上記をまとめて自動修正           | `vp check --fix`                     | フォーマットと lint の自動修正をしてから型チェックする                     |
| テストを実行する                 | `vp test`                            | 1 回実行して終了する                                                       |
| テストを監視モードで実行する     | `vp test watch`                      | ファイルを保存するたびに再実行する                                         |
| 特定のテストファイルだけ実行する | `vp test src/App.test.tsx`           |                                                                            |
| テスト名で絞り込んで実行する     | `vp test -t "テスト名の一部"`        |                                                                            |
| パッケージを追加する             | `vp add <名前>` / `vp add -D <名前>` | `-D` は devDependencies に追加する                                         |
| 更新できるパッケージを確認する   | `vp outdated`                        | 更新の方針は [docs/02](../docs/02-依存関係の更新（vp%20update）.md) を参照 |
| パッケージを更新する             | `vp update`                          | `package.json` の範囲内で更新する                                          |
| 環境の状態を診断する             | `vp env doctor`                      | Node.js や pnpm が想定どおりに選ばれているかを確認する                     |

リポジトリのルートから実行したい場合は、`-C` でこのフォルダを指定できる。

```bash
vp -C vite-plus-react check
```

### `vp build` と `vp run build` の違い

- `vp <名前>` は **Vite+ の組み込みコマンド**を実行する
- `vp run <名前>` は **`package.json` の scripts** を実行する

このプロジェクトの `build` スクリプトは `tsc -b && vp build` なので、`vp run build` は型チェックをしてからビルドする。一方、`vp build` は Vite のビルドだけを行い、型チェックはしない。本番用のビルドには `vp run build` を使う。

### テストの書き方

テストの API は `vitest` ではなく `vite-plus/test` から import する（`vitest` から import すると lint でエラーになる）。

```ts
import { describe, expect, test } from "vite-plus/test";
```

React コンポーネントのテストには Testing Library と jsdom を使っている。設定は `vite.config.ts` の `test` ブロックと `src/__vitest__/setup.ts` にある。

## コミット時に自動で実行されること

コミットすると、リポジトリのルートにある pre-commit フック（`.vite-hooks/pre-commit`）が、このフォルダで `vp staged` を実行する。`vp staged` は、ステージされたファイルに対して `vp check --fix` を実行する（設定は `vite.config.ts` の `staged` ブロック）。

- フォーマットや lint で自動修正できるものは、修正された内容がそのままコミットされる
- 型エラーなど自動で直せない問題があると、コミットが中止される
- `docs/` など、`vite-plus-react/` の外のファイルだけをコミットする場合は何もしない

一時的にフックを飛ばしたいときは、環境変数を付けてコミットする。

```bash
VP_GIT_HOOKS=0 git commit -m "..."
```

## エディタ（VS Code）

VS Code では、リポジトリのルートではなく**このフォルダ（`vite-plus-react/`）を開く**。

- `.vscode/settings.json` に、保存時に Oxfmt でフォーマットする設定が入っている。VS Code はワークスペースとして開いたフォルダ直下の `.vscode/` しか読まないため、リポジトリのルートを開くとこの設定が効かない
- 推奨拡張機能（`VoidZero.vite-plus-extension-pack`）のインストールを促されたら、インストールする

## トラブルシューティング

| 症状                                             | 対処                                                                                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js や pnpm のバージョンが想定と違う         | `vp env doctor` で、どのバージョンがどこから選ばれているかを確認する。mise などのバージョン管理ツールと併用している場合は [docs/01](../docs/01-vite-plus-1.0でできること.md) の「mise と PATH が競合している」を参照 |
| `npm` を実行すると `EBADDEVENGINES` エラーになる | このプロジェクトは pnpm 用なので npm は使えない。`vp install` や `vp add` など `vp` のコマンドを使う                                                                                                                 |
| コミットしてもフックが動かない                   | リポジトリのルートで `vp hooks status` を実行し、`core.hooksPath: .vite-hooks/_` と `Project hooks: pre-commit` が表示されるか確認する。違う場合は「3. Git フックを有効にする」の手順をやり直す                      |
| `git pull` した後に動かなくなった                | このフォルダで `vp install` を実行する（依存関係が変わっている可能性がある）                                                                                                                                         |

## 関連ドキュメント

- [docs/01 Vite+ 1.0 でできること](../docs/01-vite-plus-1.0でできること.md): Vite+ 1.0 の調査メモ。Node.js / pnpm の管理、lint・format・test、TypeScript 7、Git フックについて
- [docs/02 依存関係の更新（vp update）](../docs/02-依存関係の更新（vp%20update）.md): `vp update` / `vp outdated` の使い分けと、catalog の仕組み
