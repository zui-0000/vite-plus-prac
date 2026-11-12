# vite-plus-prac

[Vite+](https://viteplus.dev/)（`vp`）を検証するためのリポジトリ。React + TypeScript のフロントエンドと、調査メモ（`docs/`）を置いている。

## セットアップ

```bash
curl -fsSL https://vite.plus | bash   # vp を入れる（入れたら新しいターミナルを開く）
vp hooks enable                        # Git フックを有効にする
vp env install                         # devEngines の版の Node.js と pnpm を入れる
vp install                             # 依存関係を入れる
vp dev                                 # http://localhost:5173/
```

## よく使うコマンド

| コマンド                      | 内容                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `vp dev`                      | 開発サーバーを起動する                                                           |
| `vp run build`                | 型チェック（`tsc -b`）をしてからビルドする                                       |
| `vp preview`                  | ビルド結果を確認する（<http://localhost:4173/>）                                 |
| `vp check` / `vp check --fix` | lint・フォーマット・型チェック / 自動修正                                        |
| `vp test` / `vp test watch`   | テストを実行する / 監視モードで実行する                                          |
| `vp add <名前>`               | パッケージを追加する（`-D` で devDependencies）                                  |
| `vp outdated` / `vp update`   | 更新を確認する / 更新する（[docs/02](docs/02-依存関係の更新（vp%20update）.md)） |

コミット時は pre-commit フックが `vp staged`（ステージしたファイルに `vp check --fix`）を実行する。飛ばすときは `VP_GIT_HOOKS=0 git commit`。

## ドキュメント

- [01 Vite+ 1.0 でできること](docs/01-vite-plus-1.0でできること.md)
- [02 依存関係の更新（vp update）](docs/02-依存関係の更新（vp%20update）.md)
- [03 tsconfig・エイリアス・Vitest のグローバル API](docs/03-tsconfig・エイリアス・Vitest%20のグローバル%20API.md)
- [04 vp install と pnpm の関係](docs/04-vp%20install%20と%20pnpm%20の関係.md)
- [05 React Compiler（Rust 版）の導入](docs/05-React%20Compiler（Rust%20版）の導入.md)
- [06 Vite+ 1.1.0・pnpm 12.11.2 へのアップグレード](docs/06-Vite+%201.1.0・pnpm%2012.11.2%20へのアップグレード.md)
- [07 Vite+ のモノレポ構成（React + Hono + Bun）](docs/07-Vite+%20のモノレポ構成（React%20+%20Hono%20+%20Bun）.md)
- [08 Vite+ 1.6.0 への更新とフラット構成への移行](docs/08-Vite+%201.6.0%20への更新とフラット構成への移行.md)
