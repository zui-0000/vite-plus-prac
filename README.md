# vite-plus-prac

[Vite+](https://viteplus.dev/)（`vp`）1.0 を検証するためのリポジトリ。Vite+ で構築したフロントエンドと、調査の過程で分かったことをまとめたドキュメントを置いている。

## フォルダ構成

```text
.
├── .node-version            # Node.js のバージョン（リポジトリ全体に効く）
├── .vite-hooks/
│   └── pre-commit           # コミット前に実行する Git フック
├── docs/                    # 調査メモ
└── frontend/                # フロントエンド（React + TypeScript + Vite+）
```

| パス                     | 内容                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `frontend/`              | フロントエンドのソース。**セットアップ手順と操作方法は [frontend/README.md](frontend/README.md) を参照** |
| `docs/`                  | Vite+ を調査したときのメモ（下記「ドキュメント」を参照）                                                 |
| `.node-version`          | Node.js のバージョン（24.21.0）。`vp` は親ディレクトリへさかのぼって探すので、サブフォルダにも効く       |
| `.vite-hooks/pre-commit` | コミット時に `frontend/` で `vp staged`（フォーマット・lint・型チェック）を実行する                      |

## ドキュメント

- [docs/01 Vite+ 1.0 でできること](docs/01-vite-plus-1.0でできること.md): Vite+ 1.0 の調査メモ。Node.js / pnpm の管理、lint・format・test、TypeScript 7、Git フックについて
- [docs/02 依存関係の更新（vp update）](docs/02-依存関係の更新（vp%20update）.md): `vp update` / `vp outdated` の使い分けと、catalog の仕組み
- [docs/03 tsconfig・エイリアス・Vitest のグローバル API](docs/03-tsconfig・エイリアス・Vitest%20のグローバル%20API.md): TypeScript 7 向けの tsconfig、`~` エイリアス、テスト API を import せずに使う設定について
