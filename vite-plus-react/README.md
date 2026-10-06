# vite-plus-react

[Vite+](https://viteplus.dev/)（`vp`）1.0 で構築した React + TypeScript のフロントエンド。

## セットアップ（初回のみ）

Node.js と pnpm は `vp` が自動で用意するので、事前にインストールしておく必要はない。必要なのは Git と `vp` だけ。

### 1. `vp` をインストールする

```bash
curl -fsSL https://vite.plus | bash
```

インストールが終わったら**新しいターミナルを開き**、次のコマンドでバージョンを確認する。1.0.0 以上になっていれば OK。

```bash
vp --version
```

すでに古い `vp` を入れている場合は、`vp upgrade` で更新する。

### 2. Git フックを有効にする（リポジトリのルートで実行）

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

### 3. Node.js・pnpm・依存関係をインストールする

```bash
cd vite-plus-react
vp env install   # Node.js 24.21.0 と pnpm 12.9.1 を入れる
vp install       # 依存関係をインストールする
```

`.node-version` はリポジトリのルートにあるが、`vp` はカレントディレクトリから親ディレクトリへさかのぼって探すので、`vite-plus-react/` の中で実行してもルートの `.node-version` が使われる。一方、pnpm のバージョンはこのフォルダの `package.json` に書かれているので、`vite-plus-react/` の中でないと解決されない。

> [!WARNING]
> `vp install` を**リポジトリのルートで実行しない**こと。ルートには `package.json` が無いため、中身が空の `package.json`・`pnpm-lock.yaml`・`node_modules/` がルートに作られてしまう（エラーにはならない）。作られてしまった場合は、その 3 つを削除する。

### 4. 開発サーバーを起動する

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
| パッケージを追加する             | `vp add <名前>` / `vp add -D <名前>` | `-D` は devDependencies に追加する                                         |
| 更新できるパッケージを確認する   | `vp outdated`                        | 更新の方針は [docs/02](../docs/02-依存関係の更新（vp%20update）.md) を参照 |
| パッケージを更新する             | `vp update`                          | `package.json` の範囲内で更新する                                          |
| 環境の状態を診断する             | `vp env doctor`                      | Node.js や pnpm が想定どおりに選ばれているかを確認する                     |

### `vp build` と `vp run build` の違い

- `vp <名前>` は **Vite+ の組み込みコマンド**を実行する
- `vp run <名前>` は **`package.json` の scripts** を実行する

このプロジェクトの `build` スクリプトは `tsc -b && vp build` なので、`vp run build` は型チェックをしてからビルドする。一方、`vp build` は Vite のビルドだけを行い、型チェックはしない。本番用のビルドには `vp run build` を使う。

## コミット時に自動で実行されること

コミットすると、リポジトリのルートにある pre-commit フック（`.vite-hooks/pre-commit`）が、このフォルダで `vp staged` を実行する。`vp staged` は、ステージされたファイルに対して `vp check --fix` を実行する（設定は `vite.config.ts` の `staged` ブロック）。

- フォーマットや lint で自動修正できるものは、修正された内容がそのままコミットされる
- 型エラーなど自動で直せない問題があると、コミットが中止される
- `docs/` など、`vite-plus-react/` の外のファイルだけをコミットする場合は何もしない

一時的にフックを飛ばしたいときは、環境変数を付けてコミットする。

```bash
VP_GIT_HOOKS=0 git commit -m "..."
```

## 関連ドキュメント

- [docs/01 Vite+ 1.0 でできること](../docs/01-vite-plus-1.0でできること.md): Vite+ 1.0 の調査メモ。Node.js / pnpm の管理、lint・format・test、TypeScript 7、Git フックについて
- [docs/02 依存関係の更新（vp update）](../docs/02-依存関係の更新（vp%20update）.md): `vp update` / `vp outdated` の使い分けと、catalog の仕組み
- [docs/03 tsconfig・エイリアス・Vitest のグローバル API](../docs/03-tsconfig・エイリアス・Vitest%20のグローバル%20API.md): TypeScript 7 向けの tsconfig、`~` エイリアス、テスト API を import せずに使う設定について
