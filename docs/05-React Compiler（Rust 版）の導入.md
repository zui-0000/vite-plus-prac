# React Compiler（Rust 版）の導入

記録日: 2026-10-12 / 対象: `@vitejs/plugin-react@6.1.2`、`oxc-transform-react@0.152.0`、React 19.3.0、`vite-plus@1.0.0`

`frontend/` で React Compiler を有効にした。有効にする方法は 2 つあり、このリポジトリは検証用なので、実験的な Rust 版を選んだ。方法の違いと、有効になっていることの確かめ方をまとめる。

## まとめ

```bash
vp add -D "oxc-transform-react@^0.152.0"
```

```ts
// vite.config.ts
plugins: lazyPlugins(() => [react({ compiler: true })]),
```

- 有効になったかどうかは、開発サーバーが変換した後のコードに `_c(...)` が入っているかで確かめる
- `oxc-transform-react` だけを単独で上げない。plugin-react が受け付けるバージョンの範囲に縛られている
- Compiler は、ルールに違反したコンポーネントを**エラーを出さずにスキップする**。`vp check` / `vp lint` の warning で気づける

## React Compiler とは

ビルド時にコンポーネントを書き換えて、**メモ化を自動で入れる**仕組み。`useMemo` / `useCallback` / `React.memo` を手で書かなくても、値が変わっていない部分の再計算や再レンダリングを省いてくれる。

実行時には `react/compiler-runtime` を使う。これは React 19 に同梱されているので、追加のパッケージは要らない。React 17 / 18 の場合は、別に `react-compiler-runtime` が必要になる。

## 有効にする方法は 2 つある

`@vitejs/plugin-react` 6.1.2 の README には、次の 2 つが書かれている。

|                    | A. Babel 版                                                            | B. Rust 版（今回採用）                                          |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| 中身               | React チーム公式の `babel-plugin-react-compiler`（1.0.0）              | React Compiler を Rust に移植した `oxc-transform-react`         |
| 安定度             | 安定版                                                                 | README に「experimental（実験的）」と書かれている               |
| 追加するパッケージ | `babel-plugin-react-compiler`、`@rolldown/plugin-babel`、`@babel/core` | `oxc-transform-react` だけ                                      |
| 設定               | `babel({ presets: [reactCompilerPreset()] })` を追加する               | `react({ compiler: true })` にする                              |
| 速さ               | Babel を通すぶん遅い                                                   | 速い（Rust 製）                                                 |
| バージョン         | 自由に選べる                                                           | plugin-react が受け付ける範囲（`^0.152.0`）に合わせる必要がある |

TS/npm で言えば、A は本家の Babel プラグイン、B は SWC 向けのプラグインのようなもの。「本家の JS 実装と、Rust への移植版」という、よくある組み合わせ。

### なぜ 2 つあるのか

plugin-react 6.1.2 の `dependencies` は `@rolldown/pluginutils` だけで、Babel を含んでいない。JSX の変換などは Vite（Rolldown / Oxc）に任せている。

一方、React Compiler の本家は Babel プラグインとして提供されている。そのため、本家を使うなら `@rolldown/plugin-babel` で Babel を後から足す（A）。Babel を使わないなら、Rust に移植された版を使う（B）。どちらのパッケージも plugin-react の optional な peerDependencies になっていて、使う方だけをインストールする。

### なぜ Rust 版にしたのか

- このリポジトリは Vite+ を検証するためのものなので、Vite+ が使っている Oxc 系の実験的な機能も試す
- 追加するパッケージが 1 つで、設定も 1 か所で済む
- 本番のプロジェクトに入れるなら、安定版の Babel 版を選ぶ。React Compiler はメモ化を自動で入れるので、変換にバグがあると「再レンダリングされない」「古い値が表示される」のような気づきにくい不具合になる

### Babel 版にする場合のメモ（未実施）

- `@babel/core` の最新は 8.0.7（Babel 8）で、型定義が同梱されている。README にある `@types/babel__core` は Babel 7 の場合だけ必要
- `babel-plugin-react-compiler` 1.0.0 は、内部で `@babel/types` の 7 系（`^7.26.0`）に依存している。Babel 8 と組み合わせて動くかは確かめていない

## 導入手順

### 1. `oxc-transform-react` をインストールする

```bash
vp add -D "oxc-transform-react@^0.152.0"
```

最新は 0.153.0 だが、0.152 系を指定している。plugin-react 6.1.2 の `peerDependencies` が `^0.152.0` になっているため。

```bash
$ vp info @vitejs/plugin-react peerDependencies
{
  "vite": "^8.0.0",
  "oxc-transform-react": "^0.152.0",
  ...
}
```

**なぜ `^0.152.0` だと 0.153.0 が入らないのか**: `^` は「一番左にある 0 以外の数字を固定する」という意味。`0.x` のバージョンではマイナーバージョン（0.**152**）が固定されるので、`^0.152.0` は「0.152.0 以上、0.153.0 未満」になる。npm の `^` と全く同じ仕組み。

lockfile には、OS・CPU ごとのネイティブバイナリ（`@oxc-transform-react/binding-darwin-arm64` など）が optional な依存として追加される。実際にダウンロードされるのは、使っているマシンに合うものだけ。esbuild や SWC と同じ配り方。

### 2. `vite.config.ts` で有効にする

```ts
plugins: lazyPlugins(() => [react({ compiler: true })]),
```

`compiler` には、[React Compiler の設定](https://react.dev/reference/react-compiler/configuration)も渡せる。

```ts
react({ compiler: { compilationMode: "annotation" } }); // "use memo" と書いたコンポーネントだけを変換する
react({ compiler: { logDiagnostics: true } }); // スキップした理由をログに出す（後述）
```

## 有効になっているかの確かめ方

開発サーバーを起動し、ブラウザで <http://localhost:5173/src/App.tsx> を開くと、変換後のコードが表示される。`App.tsx` は次のように変換されていた。

```js
const _c = __vite__cjsImport0_react_compilerRuntime["c"];
// ...
const $ = _c(24);
if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
  // 初回だけ JSX を作り、$[0] に保存する
```

- `_c(24)` は、メモ化した値を入れておく 24 個分のキャッシュを用意する処理
- `$[n]` にはコンポーネント内で作った JSX やコールバックが保存され、依存する値が変わっていなければ前回のものを使い回す
- `Symbol.for("react.memo_cache_sentinel")` は「まだ何も保存していない」を表す目印

小さなコンポーネントで見ると、`useMemo` を自動で書いているのが分かりやすい。

```tsx
// 変換前
export function Good({ name }: { name: string }) {
  return <p>{name}</p>;
}
```

```js
// 変換後（JSX の部分は簡略化）
export function Good(t0) {
  const $ = _c(2);
  const { name } = t0;
  let t1;
  if ($[0] !== name) {
    t1 = <p>{name}</p>; // name が変わったときだけ作り直す
    $[0] = name;
    $[1] = t1;
  } else {
    t1 = $[1]; // 前回の JSX を使い回す
  }
  return t1;
}
```

`vp check`、`vp test`、`vp run build` はすべて成功した。ビルドサイズは少し増える。

| React Compiler | JS のサイズ | gzip 後  |
| -------------- | ----------- | -------- |
| オフ           | 222.52 kB   | 69.27 kB |
| オン           | 223.97 kB   | 69.84 kB |

## Compiler がスキップするコンポーネント

React Compiler は、React のルールに違反しているコンポーネントを見つけると、**エラーにせず、そのコンポーネントだけ変換をやめる**。アプリは動くが、最適化はされない。

一時的に次のファイルを作って確かめた（確認後に削除済み）。

```tsx
import { useRef } from "react";

// レンダリング中に ref.current を読み書きしている（ルール違反）
export function Bad() {
  const ref = useRef(0);
  ref.current += 1;
  return <p>{ref.current}</p>;
}

export function Good({ name }: { name: string }) {
  return <p>{name}</p>;
}
```

| 設定                                 | `Bad`                    | `Good`               | 開発サーバーのログ                                 |
| ------------------------------------ | ------------------------ | -------------------- | -------------------------------------------------- |
| `compiler: true`                     | 変換されない（元のまま） | `_c(2)` で変換される | 何も出ない                                         |
| `compiler: { logDiagnostics: true }` | 変換されない             | `_c(2)` で変換される | `warning: Cannot access refs during render` が出る |

README によると、`logDiagnostics` が出すのは「回復できる」問題（スキップで済むもの）で、既定は `false`。変換そのものができない致命的な問題は、設定に関係なく常にログに出て、変換が失敗する。

### `vp check` / `vp lint` でも気づける

同じファイルに `vp check` を実行すると、Oxlint の `react/refs` ルールが warning を出す。

```text
warning react(refs): Cannot access refs during render
  note: React Compiler skipped optimizing this component or hook.
```

- `react/refs` は、React 公式の `eslint-plugin-react-hooks` にある [`react-hooks/refs`](https://react.dev/reference/eslint-plugin-react-hooks/lints/refs) を Oxlint に移植したルール。中で React Compiler を使って解析している
- warning なので、`vp check` は成功扱い（終了コード 0）になる。つまり、**コミット時の `vp staged` ではコミットは止まらない**
- 開発中に `vp check` の warning を見るか、`logDiagnostics: true` にしておけば、スキップに気づける

## バージョンを上げるとき

`vp outdated` には `oxc-transform-react` の 0.153.0 が表示されるが、**単独では上げない**。plugin-react 6.1.2 は `^0.152.0` しか受け付けないので、上げると peer の範囲から外れる。

plugin-react の新しいバージョンが出たら、次の手順で一緒に上げる。

1. `vp info @vitejs/plugin-react peerDependencies` で、新しい版が受け付ける `oxc-transform-react` の範囲を確認する
2. `@vitejs/plugin-react` を上げる
3. 確認した範囲に合わせて、`vp add -D "oxc-transform-react@^<範囲>"` で上げる
4. `vp check` / `vp test` / `vp run build` と、上の「有効になっているかの確かめ方」で確認する

## 参考

- [@vitejs/plugin-react の README（React Compiler）](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#react-compiler)
- [React Compiler](https://react.dev/learn/react-compiler)
- [React Compiler の設定](https://react.dev/reference/react-compiler/configuration)
- [Oxlint の react/refs ルール](https://oxc.rs/docs/guide/usage/linter/rules/react/refs.html)
