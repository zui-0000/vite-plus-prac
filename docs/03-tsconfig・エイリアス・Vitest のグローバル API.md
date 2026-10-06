# tsconfig・エイリアス・Vitest のグローバル API

記録日: 2026-10-07 / 対象: TypeScript 7.0.2、`vite-plus@1.0.0`（Vite 8.3.1、Vitest 5.0.1）

`frontend/` に対して行った次の 3 つの変更について、調べたことと判断の理由をまとめる。

1. tsconfig を TypeScript 7 の推奨設定に合わせる
2. `src/` 配下を `~/...` で参照できるようにする
3. Vitest の `describe` / `test` / `expect` を import せずに使えるようにする

## 1. tsconfig を TypeScript 7 の推奨設定に合わせる

### 変更前の状態

create-vite の `react-ts` テンプレート（GitHub の main ブランチ）と完全に一致していた。ただし、テンプレート自体は `typescript: ~6.0.2` を前提にしている。

### TypeScript 6 / 7 で変わったこと

TypeScript 6.0 で非推奨になった設定は、TypeScript 7.0 ですべて削除された（指定するとエラーになる）。あわせて、既定値も変わっている。

| 区分               | 内容                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 新しい既定値       | `strict: true`、`module: esnext`、`noUncheckedSideEffectImports: true`、`types: []`、`rootDir: ./`、`libReplacement: false` |
| 削除された設定     | `baseUrl`、`target: es5`、`moduleResolution: node`（node10）/ `classic`、`module: amd` / `umd` / `systemjs`、`downlevelIteration` など |
| `false` にできない | `esModuleInterop`、`allowSyntheticDefaultImports`、`alwaysStrict`                                                             |

- `types` の既定値が `[]` になったので、`@types/*` は自動では読み込まれない。テンプレートが `"types": ["vite/client"]` のように明示しているのはこのため
- `baseUrl` が削除されたので、`paths` はプロジェクトのルート（tsconfig のあるディレクトリ）からの相対パスで書く

### TS チームが推奨する設定（`tsc --init`）

TypeScript 7 の `tsc --init` を空のディレクトリで実行すると、次の設定が生成される（コメント行は省略）。これは TS チームが新規プロジェクト向けに推奨している設定と言える。

```jsonc
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "types": [],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}
```

テンプレートと比べると、`strict`・`noUncheckedIndexedAccess`・`exactOptionalPropertyTypes`・`isolatedModules` の 4 つが含まれていなかったので、追加した。`sourceMap` / `declaration` は出力を伴う設定で、Vite でバンドルするこのプロジェクト（`noEmit: true`）には関係ないので入れていない。

| 追加した設定                  | 効果                                                     | 理由                                                         |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `strict: true`                | 厳格な型チェック                                         | TS 7 では既定値だが、明示しておけば古いエディタとも挙動が揃う    |
| `noUncheckedIndexedAccess`    | `arr[0]` や `obj[key]` の型が `T \| undefined` になる     | 範囲外アクセスによる実行時エラーを型で防げる                    |
| `exactOptionalPropertyTypes`  | `foo?: T` に `undefined` を明示的に代入できなくなる        | 「省略」と「`undefined` を代入」を区別できる                    |
| `isolatedModules`             | ファイル単位でトランスパイルできないコードをエラーにする | Vite はファイル単位で変換するため。Vite の公式ドキュメントでも推奨 |

### `exactOptionalPropertyTypes` は `vite.config.ts` 用の設定には入れない

`tsconfig.node.json`（`vite.config.ts` の型チェック用）にも `exactOptionalPropertyTypes` を入れたところ、`vite.config.ts` が次のエラーになった。

```text
Types of property 'plugins' are incompatible.
  Type 'PluginOption[] | undefined' is not assignable to type 'PluginOption[]'.
```

テンプレートにある `plugins: lazyPlugins(() => [react()])` の戻り値の型が `PluginOption[] | undefined` なのに対し、Vite の `UserConfig` は `plugins?: PluginOption[]` と定義されている。`exactOptionalPropertyTypes` は省略可能なプロパティに明示的に `undefined` を入れることを禁止するため、ここで衝突する。**Vite+ 側の型定義の問題で、こちらのコードでは直せない**ので、`tsconfig.node.json` には入れていない。

`exactOptionalPropertyTypes` は、このようにライブラリの型定義が対応していないと衝突することがある。アプリのコードで同様の問題が起きた場合は、外すことも検討する。

### 動作確認

わざと次のコードを入れて、検出されることを確認した。

```ts
const a: number[] = [1];
export const n: number = a[0];
// → TS2322: Type 'number | undefined' is not assignable to type 'number'.
```

## 2. `src/` 配下を `~/...` で参照する

```ts
// 変更前
import App from "./App.tsx";
// 変更後
import App from "~/App.tsx";
```

設定は 2 か所に書く。

`tsconfig.app.json`（TypeScript に対応関係を教える）:

```json
"paths": {
  "~/*": ["./src/*"]
}
```

`vite.config.ts`（実際にパスを解決する）:

```ts
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
    },
  },
});
```

- TypeScript 7 では `baseUrl` が削除されたので、`baseUrl` は書かずに `paths` だけを書く
- `import.meta.dirname` は Node.js 20.11 以降で使える、ESM で現在のファイルのディレクトリを得る方法（`fileURLToPath(new URL(".", import.meta.url))` の代わり）
- Vitest は Vite の `resolve.alias` をそのまま使うので、テストでも `~` が使える

### なぜ `resolve.tsconfigPaths: true` を使わないのか

Vite 8 には `resolve.tsconfigPaths` というオプションがあり、`true` にすると tsconfig の `paths` を Vite が読んでくれる。これなら `vite.config.ts` に同じ対応を書かなくて済む。

しかし Vite の公式ドキュメント（Features の `paths` の節）には、次のように書かれている。

- この機能にはパフォーマンスのコストがある
- TypeScript チームは、`paths` で外部ツールの動作を変えることを推奨していない

TypeScript の公式ドキュメントでも、`paths` は「`tsc` の出力は変えないので、実行時やバンドル時に別のツールがこの対応を行うことを TypeScript に教えるためだけに使うべき」とされている。つまり、**実際の解決はバンドラーの `resolve.alias` で行い、`paths` はそれを TypeScript に伝えるためのもの**という役割分担が公式の考え方。同じ対応を 2 か所に書くことになるが、この形を採用した。

### 動作確認

dev サーバーで `/src/main.tsx` を取得すると、`~` が `/src/` に変換されて配信されていた。

```text
import "/src/index.css";     ← "~/index.css"
import App from "/src/App.tsx";  ← "~/App.tsx"
```

`vp check`（型チェック）・`tsc -b`・`vp build`・`vp test` もすべて成功した。

## 3. Vitest の API を import せずに使う

```ts
// 変更前
import { describe, expect, test } from "vite-plus/test";

describe("App", () => { ... });

// 変更後（import 不要）
describe("App", () => { ... });
```

### 設定

`vite.config.ts`:

```ts
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/__vitest__/setup.ts"],
},
```

型は `vite-plus/test/globals`（Vitest の `vitest/globals` に当たるもの）で読み込む。ただし、**テストファイルだけ**に読み込ませるため、tsconfig を分けた。

```text
tsconfig.json          … 下の 3 つを参照するだけ（files: []）
├── tsconfig.app.json  … アプリのコード（src/ からテストを除いたもの）
├── tsconfig.test.json … テストファイルと src/__vitest__/（グローバル API の型あり）
└── tsconfig.node.json … vite.config.ts
```

`tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.test.tsbuildinfo",
    "types": ["vite/client", "vite-plus/test/globals"]
  },
  "include": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/__vitest__"],
  "exclude": []
}
```

`tsconfig.app.json` 側では、テストファイルを `exclude` で除外している。

### なぜ tsconfig を分けるのか

`tsconfig.app.json` に `vite-plus/test/globals` を入れると、アプリのコードでも `expect` や `test` が「存在する」ことになる。その場合、アプリのコードで間違えて使っても型エラーにならず、本番で `expect is not defined` になってしまう。

分けておけば、アプリのコードで使ったときにちゃんと型エラーになる。

```text
src/leak.ts: export const x = () => expect(1);
→ TS2304: Cannot find name 'expect'.
```

### 手動の `cleanup` が不要になった

`globals: false`（既定）のときは、Testing Library の自動クリーンアップが働かないため、setup ファイルで `afterEach(cleanup)` を手動で登録していた（`01-vite-plus-1.0でできること.md` を参照）。

`globals: true` にすると `afterEach` がグローバルに存在するようになり、Testing Library が自動で片付けを登録する。そのため手動の `cleanup` は削除した。「1 つ目のテストで描画 → 2 つ目のテストの開始時に `document.body` が空か確認する」テストで、自動で片付けられることを確認した。

### 動作確認

| 確認したこと                                  | 結果                                              |
| --------------------------------------------- | ------------------------------------------------- |
| テストファイルで import せずに API を使う      | `vp test` が成功                                  |
| アプリのコードで `expect` を使う               | `vp check` と `tsc -b` の両方で `TS2304` エラー     |
| テストファイルに型エラーを入れる               | `vp check` が `TS2322` を検出（`tsconfig.test.json` が読まれている） |
| 手動の `cleanup` を消して DOM の残りを確認する  | 自動で片付けられていた                             |

## 参考

- [Announcing TypeScript 7.0（Microsoft DevBlogs）](https://devblogs.microsoft.com/typescript/?p=5246)
- [TypeScript 6.0 ships as final JavaScript-based release（Visual Studio Magazine）](https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx)
- [TSConfig Reference: paths](https://www.typescriptlang.org/tsconfig/#paths)
- [Vite: resolve.tsconfigPaths](https://vite.dev/config/shared-options#resolve-tsconfigpaths)
- [Vite: Features — paths](https://vite.dev/guide/features#paths)
