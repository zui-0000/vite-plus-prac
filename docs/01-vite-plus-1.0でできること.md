# Vite+ 1.0 でできること（調査メモ）

調査日: 2026-10-07 / 対象: `vite-plus@1.0.0`（2026-09-28 リリース）

0.1 系で試していた構成（mise + ESLint）を 1.0 で作り直すにあたり、次の 4 点が Vite+ だけで実現できるかを、ドキュメントを読んだうえで実際にプロジェクトを生成して確認した。

1. mise を使わずに Node.js / pnpm のバージョンを管理できるか
2. React + Vite / Vitest / Oxfmt / Oxlint の構成で作れるか
3. 最新の TypeScript で作れるか
4. lefthook のような Git フックを Vite+ だけで扱えるか

結論としては、**4 つともできる**。ただし、テンプレートのデフォルトのままでは足りない部分がいくつかある（後述）。

## 前提: 調査時点の最新バージョン

| 対象                  | バージョン   | 備考                                       |
| --------------------- | ------------ | ------------------------------------------ |
| `vp`（グローバル CLI）  | 1.0.0        | `vp upgrade` で 0.1.16 から更新            |
| Node.js LTS           | 24.21.0      | 26 系はまだ LTS に入っていない（Current）    |
| pnpm                  | 12.9.1       | npm の `latest` タグ                        |
| TypeScript            | 7.0.2        | Go 製のネイティブ版。`latest` タグ          |
| React                 | 19.3.0       |                                            |

Vite+ 1.0 に同梱されているツールのバージョン（`vp toolchain` で確認）:

| ツール            | バージョン |
| ----------------- | ---------- |
| vite              | 8.3.1      |
| rolldown          | 1.2.11     |
| vitest            | 5.0.1      |
| oxlint            | 1.85.0     |
| oxlint-tsgolint   | 7.0.2003   |
| oxfmt             | 0.70.0     |
| tsdown            | 0.23.0     |

`vp` 1.0 自体は Node.js `^22.18.0 || ^24.11.0 || >=26.0.0` を必要とする。

## 1. mise なしで Node.js / pnpm を管理できるか → できる

`vp env` がこの役割を担う。mise と同じように shim を使う方式。

- `~/.vite-plus/bin/` に `node`、`pnpm` などの小さなランチャー（shim）が置かれる
- shim が実行時にカレントディレクトリからプロジェクトのバージョン指定を探し、該当バージョンの本体を起動する
- 本体は `~/.vite-plus/js_runtime/node/<version>/` などにバージョンごとに保存される

TS/npm 側で言えば、mise・Volta と同じ「shim で切り替える」方式で、corepack の役割（パッケージマネージャーのバージョン固定）も一緒に持っている。

### プロジェクトへの固定方法

```bash
vp env pin lts            # 最新 LTS を解決して固定（今回は 24.21.0）
vp env pin pnpm@12.9.1    # pnpm を固定
```

**実行する場所と順番に注意**: 書き込み先は、カレントディレクトリに `package.json` があるかどうかで変わる。

| 固定するもの | `package.json` がある場合        | `package.json` が無い場合                                   |
| ------------ | -------------------------------- | ----------------------------------------------------------- |
| Node.js      | `devEngines.runtime`             | `.node-version` ファイル                                     |
| pnpm         | `devEngines.packageManager`      | **エラー**（`cannot pin a package manager without package.json`） |

パッケージマネージャーには `.node-version` のような専用ファイルが無く、`package.json` にしか書けない（corepack の `packageManager` と同じ）。そのため、pnpm を固定するのは `vp create` でプロジェクトを作った**後**、プロジェクトのディレクトリで行う。ただし `vp create` は作成に使った pnpm のバージョンを `devEngines.packageManager` に自動で書くので、通常は手動で固定しなくてよい。

`package.json` があるディレクトリで固定した場合の書き込み先は、`package.json` の `devEngines`（npm 公式のフィールド）。

```json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "12.9.1", "onFail": "download" },
  "runtime": { "name": "node", "version": "24.21.0", "onFail": "download" }
}
```

`lts` のような別名のまま保存されるのではなく、**具体的なバージョンに解決して保存される**。そのため、時間が経っても同じバージョンが再現される。

**なぜ `mise.toml` ではなく `devEngines` なのか**: `devEngines` は npm 公式のフィールドなので、Vite+ を入れていない人や pnpm 自身も読める。特定のツールに縛られず、`package.json` 1 ファイルで環境の要件が完結する。

### Node.js のバージョンの探し方（優先順）

カレントディレクトリから親ディレクトリへさかのぼり、最初に見つかった指定を使う。同じディレクトリ内では次の順で優先される。

1. `.node-version`
2. `package.json` の `devEngines.runtime`
3. `package.json` の `engines.node`
4. `.nvmrc`

どこにも指定がなければ、`vp env default` で決めたグローバルのデフォルトを使い、それも無ければ最新 LTS を使う。

### このマシン固有の注意点: mise と PATH が競合している

`~/.zshrc` で `mise activate` が `~/.vite-plus/env` より先に効いているため、mise の node が PATH の先頭に来る。

| 実行方法                          | 解決された Node.js     |
| --------------------------------- | ---------------------- |
| `vp` 経由（`vp dev`、`vp test` など） | 24.21.0（`devEngines` どおり） |
| シェルで直接 `node -v`              | 24.14.0（mise のもの）  |

また `vp env doctor` によると、pnpm は `system-first`（システムにあるものを優先する）モードになっている。

### 対応内容（2026-10-07 実施）

mise は他のプロジェクトで使っているので残す。そのうえで、**プロジェクトに設定が無い場所の Node.js / pnpm だけを Vite+ に任せる**ようにした。

1. mise のグローバル設定（`~/.config/mise/config.toml`）から `node = "lts"` の 1 行だけを外した（direnv、terraform はそのまま）
2. `vp env on pnpm` で、pnpm も Vite+ の管理下（managed モード）にした

**なぜ 1 だけで他のプロジェクトに影響しないのか**: mise は、カレントディレクトリから親へさかのぼって見つかった設定をすべて重ねる。グローバル設定は一番下の土台にすぎない。そのため、プロジェクトの `mise.toml` に `node` が書いてあれば、そちらが必ず優先される。

**なぜ 2 が必要だったのか**: `mise activate` は mise の shims ディレクトリを PATH の先頭近くに追加する。mise の shim は、自分の設定にバージョンが無いとき、PATH の次にある実体へ処理を渡す。ところが pnpm は system-first モードで、vp の pnpm shim が PATH に入っていない `~/.vite-plus/fallback-bin` に置かれていた。その結果、渡し先が見つからずに `mise ERROR No version is set for shim: pnpm` で止まっていた。managed モードにすると、vp の shim が `~/.vite-plus/bin` に移るので、mise から処理を渡せるようになる。

新しいシェルで確認した結果:

| ディレクトリ                              | node                | pnpm                 |
| ----------------------------------------- | ------------------- | -------------------- |
| `vite-plus-research`（mise 設定なし）       | 24.21.0（vp の LTS）  | 12.9.1（vp の最新）    |
| `hono-cqrs-prac`（mise.toml で node/pnpm 指定） | 24.18.0（mise）       | 11.21.0（mise）        |
| `park-ui-prac`（mise.toml で pnpm のみ指定）  | 24.21.0（vp の LTS）  | 10.27.0（mise）        |

`command -v node` は mise の shim を指すが、実際に動いているのは vp の Node.js（mise の shim が vp に処理を渡している）。

### pnpm の `runtimeOnFail` はプロジェクト単位で設定する

pnpm 11 以降は、pnpm 自身も `devEngines.runtime` を読む。そして Node.js を `node@runtime:<version>` という devDependency としてダウンロードし、`node_modules/.bin/node` にリンクする（検証済み）。バージョンは vp と同じなので動作は揃うが、同じ Node.js を vp と pnpm が別々に持つ二重管理になる。

Vite+ のドキュメントには `pnpm config set --global runtimeOnFail ignore` とある。しかし **pnpm 12 では `runtimeOnFail` はプロジェクト専用の設定**なので、グローバルでは次のエラーで拒否される。

```text
ERR_PNPM_CONFIG_SET_UNSUPPORTED_YAML_CONFIG_KEY
The key "runtimeOnFail" isn't supported by the global config.yaml file
```

そのため、プロジェクトの `pnpm-workspace.yaml` に書く。

```yaml
runtimeOnFail: ignore
```

#### 別の方法: Node.js を `.node-version` で固定する

pnpm が読むのは `package.json` の `devEngines.runtime`（と `engines.runtime`）だけで、`.node-version` は読まない。そのため、Node.js を `.node-version` で固定すれば、`runtimeOnFail` を設定しなくても pnpm は Node.js をダウンロードしない（検証済み。lockfile に `node@runtime` が入らず、スクリプト内の `node` も vp の Node.js になった）。

| 固定方法                         | 固定される範囲                                      | pnpm の二重ダウンロード               |
| -------------------------------- | --------------------------------------------------- | ------------------------------------ |
| リポジトリのルートに `.node-version` | リポジトリ全体（親へさかのぼって探すので、サブディレクトリにも効く） | 起きない                             |
| プロジェクトの `devEngines.runtime` | そのプロジェクトだけ                                | 起きる → `runtimeOnFail: ignore` が必要 |

このリポジトリは研究用で、実験用のプロジェクトをサブディレクトリに並べる構成なので、ルートの `.node-version` で固定する方法が向いている。

lockfile と node_modules を消してから入れ直すと、`node@runtime` が lockfile から消え、スクリプト内の `node` も vp の Node.js（`~/.vite-plus/js_runtime/node/24.21.0`）になることを確認した。既存の lockfile があると「Already up to date」で反映されないので注意。

## 2. React + Vite / Vitest / Oxfmt / Oxlint → できる

```bash
vp create vite --no-interactive --package-manager pnpm --editor vscode -- <dir> --template react-ts
```

- `vp create vite` は内部で create-vite を呼び、生成後に Vite+ 向けの設定（lint・fmt・staged の統合、VS Code の設定、依存関係のインストール、フォーマット）を自動で行う
- `--directory` は組み込みテンプレート（`vite:*`）専用。`vite`（create-vite）を使う場合は、`--` の後ろにディレクトリ名を渡す

生成される `vite.config.ts` には、lint・fmt・staged の設定がまとめて入る。

```ts
export default defineConfig({
  staged: { "*": "vp check --fix" },
  fmt: {},
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": ["warn", { allowConstantExport: true }],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
  },
  plugins: lazyPlugins(() => [react()]),
});
```

0.1 系のテンプレートとの違い:

- **ESLint 一式が無くなった**。0.1 系では `eslint`、`typescript-eslint`、`eslint-plugin-react-hooks` などが入っていたが、1.0 ではすべて oxlint に置き換わっている
- `vite` の別名指定（`npm:@voidzero-dev/vite-plus-core`）は、`package.json` の `pnpm.overrides` ではなく、`pnpm-workspace.yaml` の `catalog` と `overrides` で管理される（npm で言えば `overrides` を 1 か所に集約したイメージ）
- `lazyPlugins()` で Vite プラグインを遅延読み込みする。`vp lint` や `vp fmt` を実行するときに、React プラグインを無駄に読み込まないためのもの

### Vitest について

- `vp test` に組み込まれている（Vitest 5.0.1）。`vitest` を直接インストールする必要はない
- テスト API を import する場合は、`vitest` ではなく `vite-plus/test` から import する（`vitest` から import すると、lint の `vite-plus/prefer-vite-plus-imports` でエラーになる）

  ```ts
  import { describe, expect, test } from "vite-plus/test";
  ```

- `vite-plus-react/` では `test.globals: true` にして、import せずに使う構成にした（詳細は `03-tsconfig・エイリアス・Vitest のグローバル API.md`）
- テンプレートにテストの雛形は含まれていない
- `vp test` はデフォルトでは watch モードにならない（Vitest 単体とは逆）。watch したいときは `vp test watch` を使う

### React コンポーネントのテスト環境（`vite-plus-react/` で構築済み）

```bash
vp add -D @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
```

- `@testing-library/react` 16 系から、`@testing-library/dom` は peer 依存になった。公式の案内に従って明示的にインストールする

`vite.config.ts`:

```ts
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/__vitest__/setup.ts"],
},
```

`src/__vitest__/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- `jest-dom/vitest` を setup ファイルで 1 回だけ import すると、全テストで `toBeInTheDocument()` などが使える
- setup ファイルとテストファイルは `tsconfig.test.json` で型チェックされる。こうすると jest-dom の型拡張が型チェックで認識される

#### `globals: false`（既定）のときは `cleanup` を手動で登録する必要がある

最初は `globals: false`（既定）で構築したため、setup ファイルに次の処理を入れていた。

```ts
import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

afterEach(() => {
  cleanup();
});
```

**理由**: Testing Library は、グローバルに `afterEach` があるときだけ、テストごとに DOM を自動で片付ける。`globals: false` では `afterEach` がグローバルに存在しないので、自動の片付けが働かない。

検証として、cleanup を外した状態で「1 つ目のテストで描画 → 2 つ目のテストの開始時に `document.body` を確認」というテストを実行した。結果、`globalThis.afterEach` は `undefined` で、1 つ目の DOM（`<div><p>first</p></div>`）が残っていた。cleanup を登録すると空になった。

DOM が残っていても、テストの書き方によっては通ってしまう（例: `name: "Count is 0"` で探すと、新しく描画した要素だけが見つかる）。そのため、テストが通っていても気づきにくい点に注意する。

その後 `globals: true` に切り替えたので、手動の `cleanup` は削除した。`afterEach` がグローバルに存在するようになり、Testing Library が自動で片付けを登録する（同じ検証テストで、DOM が空になることを確認済み）。

### 動作確認の結果

`vp check`（フォーマット・lint・型チェック）、`vp test`、`vp run build` がすべて成功した。

## 3. 最新の TypeScript → できる（ただしテンプレートからは手動で上げる）

- create-vite の `react-ts` テンプレートでは `typescript: ~6.0.2` が入る
- 7 系に上げても、`tsc -b`（`build` スクリプト）と `vp check` の両方が成功した。わざと型エラーを入れると、どちらでも検出された
- `vite-plus-react/` では `vp update -L typescript` で上げた（`~7.0.2` になる）。`^` ではなく `~` のまま上げる理由は `02-依存関係の更新（vp update）.md` を参照
- 生成される tsconfig（`moduleResolution: bundler`、`erasableSyntaxOnly` など）は、もともと TS 6/7 で非推奨になった設定を使っていないので、変更なしで通った
- その後、TS 7 の推奨設定に合わせて tsconfig を調整した（詳細は `03-tsconfig・エイリアス・Vitest のグローバル API.md`）

**なぜ型チェックは TS のバージョンとあまり関係ないのか**: `vp check` の型チェックは、Vite+ に同梱されている tsgolint（TypeScript 7 = TypeScript Go がベース）で動く。そのため、プロジェクトに入れた `typescript` パッケージのバージョンとは独立している。プロジェクト側の `typescript` が実際に使われるのは、`build` スクリプトの `tsc -b` とエディタくらい。

## 4. lefthook 的な機能 → できる

`vp hooks`（Git フックの仕組み）と `vp staged`（lint-staged 17 を同梱）の 2 つで実現する。

| 役割                          | husky + lint-staged     | lefthook           | Vite+                            |
| ----------------------------- | ----------------------- | ------------------ | -------------------------------- |
| フックのインストール            | `husky`（`prepare`）     | `lefthook install` | `vp config` / `vp hooks enable`  |
| フックスクリプトの置き場所      | `.husky/pre-commit`     | `lefthook.yml`     | `.vite-hooks/pre-commit`         |
| ステージ済みファイルへの処理    | `lint-staged` の設定      | `lefthook.yml`     | `vite.config.ts` の `staged`      |
| 一時的にスキップ               | `HUSKY=0`               | `LEFTHOOK=0`       | `VP_GIT_HOOKS=0`（`HUSKY=0` も可） |

仕組み:

- `git config core.hooksPath .vite-hooks/_` で、Git が `.vite-hooks/_/` の下にある振り分け用スクリプト（dispatcher）を呼ぶようにする
- dispatcher から、プロジェクトでコミット管理する `.vite-hooks/pre-commit`（中身は `vp staged`）が呼ばれる
- `.vite-hooks/_/` は自動生成されるので gitignore されている。clone した人の環境には、`package.json` の `"prepare": "vp config"` で再生成される

### 注意: サブディレクトリに作るとフックの設定がスキップされる

既存の Git リポジトリのサブディレクトリで `vp create` を実行すると、次のメッセージが出て、フックと `staged` の設定がどちらも生成されない。

```
Subdirectory project detected — skipping git hooks setup. Configure hooks at the repository root.
```

`core.hooksPath` はリポジトリ単位の設定なので、サブディレクトリのプロジェクトが勝手に書き換えないようにしていると考えられる。この場合は、手動で次の 3 つを行えば動く（検証済み）。

1. リポジトリのルートで `vp hooks enable` を実行する
2. ルートの `.vite-hooks/pre-commit` に `cd <サブディレクトリ> && vp staged` と書く
3. サブディレクトリの `vite.config.ts` に `staged: { "*": "vp check --fix" }` を追加する

検証結果:

- フォーマットが崩れたファイルは、コミット時に自動で整形され、整形後の内容がコミットされた
- 型エラーのあるファイルは、コミットが止まった

## その他、1.0 でできること（概要のみ）

- `vp run`（`vpr`）: キャッシュ付きのタスクランナー（Turborepo / Nx の `run` に近いもの）
- `vp pack`: tsdown を使ったライブラリビルド
- `vp migrate`: 既存の Vite / ESLint / Prettier などのプロジェクトを Vite+ に移行する。Vite+ のバージョンアップ時の依存関係の整合にも使う
- `vp create vite:monorepo` / `vite:generator`: モノレポの作成と、社内向けコード生成テンプレート（Bingo ベース）
- `vp create --agent <name>`: AGENTS.md / CLAUDE.md などのエージェント向けの説明ファイルを生成する
- Docker イメージ（`ghcr.io/voidzero-dev/vite-plus:1.0.0`）: `vp` をインストールせずに CI などで実行できる

## 参考

- [Vite+ 1.0 リリースノート](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.0.0)
- [Environment（vp env）](https://viteplus.dev/guide/env)
- [Commit Hooks（vp hooks / vp staged）](https://viteplus.dev/guide/commit-hooks)
- [Creating a Project（vp create）](https://viteplus.dev/guide/create)
- [Check（vp check）](https://viteplus.dev/guide/check)
