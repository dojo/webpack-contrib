# @dojo/webpack-contrib

[![Build Status](https://travis-ci.org/dojo/webpack-contrib.svg?branch=master)](https://travis-ci.org/dojo/webpack-contrib)
[![codecov](https://codecov.io/gh/dojo/webpack-contrib/branch/master/graph/badge.svg)](https://codecov.io/gh/dojo/webpack-contrib)
[![npm version](https://badge.fury.io/js/%40dojo%2Fwebpack-contrib.svg)](http://badge.fury.io/js/%40dojo%2Fwebpack-contrib)

This repository contains all of the custom Webpack [plugins](https://webpack.js.org/concepts/plugins/) and [loaders](https://webpack.js.org/concepts/loaders/) used by [`@dojo/cli-build-app`](https://github.com/dojo/cli-build-app) and [`@dojo/cli-build-widget`](https://github.com/dojo/cli-build-widget) to facilitate building Dojo 2 applications and widgets, respectively.

-----

- [Usage](#usage)
- [Loaders](#loaders)
	- [css-module-decorator-loader](#css-module-decorator-loader)
	- [css-module-dts-loader](#css-module-dts-loader)
	- [promise-loader](#promise-loader)
	- [static-build-loader](#static-build-loader)
- [Plugins](#plugins)
	- [build-time-render](#build-time-render)
	- [css-module-plugin](#css-module-plugin)
	- [external-loader-plugin](#external-loader-plugin)
	- [i18n-plugin](#i18n-plugin)
- [Transformers](#transformers)
	- [registry-transformer](#registry-transformer)
- [How do I contribute?](#how-do-i-contribute)
  - [Code Style](#code-style)
  - [Testing](#testing)
- [Licensing information](#licensing-information)

## Usage

To use `@dojo/webpack-contrib` in a single project, install the package:

```bash
npm install @dojo/webpack-contrib
```

# Loaders

## css-module-decorator-loader

A webpack loader that injects CSS module path info into the generated modules, making it easier for `@dojo/widget-core` to resolve theme styles. This loader takes no options.

## css-module-dts-loader

A webpack loader that generates `.d.ts` files for CSS modules. This is used by both `@dojo/cli-build-app` and `@dojo/cli-build-widget` to provide in-widget type checks for CSS classes.

The loader expects the following options:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| type | `'ts'` or `'css'` | No | The type of file being processed. If `ts`, the loader assumes the resource is a TypeScript file and will parse it for CSS module imports. If any CSS modules are found, then the loader generates a `d.ts` file for each. If `css` is specified, then the loader assumes the resource is a CSS module and generates the `.d.ts` file for it. |
| instanceName | `string` | Yes | An optional instance name for the TypeScript compiler created by the [`ts-loader`](https://github.com/TypeStrong/ts-loader). This option is valid only when the `type` is `ts`, and ensures the same compiler instance is used across all files. |

Example:

```typescript
const webpackConfig = {
	loaders: [
		// Generate `.d.ts` files for all CSS modules imported in TypeScript files beneath
		// the `src/` directory
		{
			include: './src/',
			test: /\.ts$/,
			enforce: 'pre',
			loader: '@dojo/webpack-contrib/css-module-dts-loader?type=ts&instanceName=APP_NAME'
		},
		// Generate `.d.ts` files for all CSS modules beneath the `src/` directory
		{
			include: './src/',
			test: /\.m\.css$/,
			enforce: 'pre',
			loader: '@dojo/webpack-contrib/css-module-dts-loader?type=css'
		}
	]
};
```

## promise-loader

A webpack loader that returns a promise from `require()` calls that resolves to the requested resource. It also removes absolute paths from source maps, ensuring consistent builds across environments. It is used by `@dojo/cli-build-app` for lazily loading bundles.

This loader expects two parameters, one required and one optional:

1. The required promise implementation (e.g., `bluebird`). If there already exists a global `Promise` constructor, then `global` should be specified.
2. An optional chunk name.

Example:

```typescript
const resourcePromise = require('@dojo/webpack-contrib/promise-loader?global,resource-chunk-name!./path/to/resource');
resourcePromise.then((resource) => {
	// resource is available
})
```

## static-build-loader

A webpack loader which allows code to be statically optimized for a particular context at bundling time.
This loader acts on JavaScript. Some examples show the TypeScript source, but the loader will only
work if acting on the compiled output.

### Features

The loader examines code, looking for usages of `@dojo/has` or _has pragmas_ to _optimize_. It does this by parsing the [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) structure of the code, and modifying it when appropriate.

The loader takes two options:

* `features`: A map of _static_ features or a feature or list of features that resolve to a similar static map
based on the functionality provided by the specified targets. Each key in the map is the name of the feature
and the value is `true` if the feature is present in that context, otherwise `false`.
* `isRunningInNode`: An optional boolean parameter. If set to `false` this indicates that the loader will not be
running in an environment with a Node-like require.

For example in a webpack configuration, the map of features would look like this:

```js
{
    use: [
        {
            loader: '@dojo/webpack-contrib/static-build-loader',
            options: {
                features: {
                    'foo': true,
                    'bar': false
                }
            }
        }
    ]
};
```
This asserts feature `foo` is `true` and feature `bar` is `false`.
Alternatively a list of features can be provided that will be resolved to the appropriate map

```js
{
	use: [
		{
			loader: '@dojo/webpack-contrib/static-build-loader',
			options: {
				features: [ 'firefox', 'chrome' ]
			}
		}
	]
}
```

#### Available features

When specifying a static map, any values can be used. When passing a string or list of strings, the following
values are supported. Each value corresponds to the set of known features that the environment supports. If
multiple features are specified, the intersection of available features will be returned.

* android
* chrome
* edge
* firefox
* ie11
* ios
* node
* node8
* safari

In either case, the resulting map is then used in the features below.

#### Dead Code Removal

The loader assumes that the [`@dojo/has`](https://github.com/dojo/has) API is being used in modules that are being compiled
into a webpack bundle and attempts to rewrite calls to the `has()` API when it can see it has a statically asserted flag for
that feature.

The loader detects structures like the following in transpiled TypeScript modules:

```ts
import has from './has';

if (has('foo')) {
    console.log('has foo');
}
else {
    console.log('doesn\'t have foo');
}

const bar = has('bar') ? 'has bar' : 'doesn\'t have bar';
```

And will rewrite the code (given the static feature set above), like:

```ts
import has from './has';

if (true) {
    console.log('has foo');
}
else {
    console.log('doesn\'t have foo');
}

const bar = false ? 'has bar' : 'doesn\'t have bar';
```

When this is minified via Uglify via webpack, Uglify looks for structures that can be optimised and would re-write it further to
something like:

```ts
import has from './has';

console.log('has foo');

const bar = 'doesn\'t have bar';
```

Any features which are not statically asserted, are not re-written.  This allows the code to determine at run-time if the feature
is present.

#### Elided Imports

The loader looks for _has pragmas_, which are strings that contain a call to has for a specific feature, and
removes the next import found in the code. For example, given the above feature set, which has `foo = true` and
`bar = false`, the imports of `'a'` and `'b'` would be removed but `'c'` and `'d'` would remain.

```ts
"has('foo')";
const statementBeforeImport = 3;
// This is the next import so it will be removed despite
// the conetnet between it and the pragma
import 'a';
// The pragma can be negated to remove the import if the condition
// is known to be false
'!has("bar")';
import 'b';
'!has("foo")';
// This import will not be removed because `foo` is not false
import 'c';

'has("baz")';
// This import will not be removed because the value of `has('baz')`
// is now known statically
import 'd';
```

# Plugins

## build-time-render

A webpack plugin that generates a bundle's HTML and inlines critical CSS at build time. This is similar to server-side rendering, but does not require a dedicated server to manage it.

The plugin takes an options object with the following properties:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| entries | `string[]` | No | The entry scripts to include in the generated HTML file |
| paths | `string[]` or `{ path: string; match: string[] }` | Yes | An array of paths that will be matched against the URL hash, rendering the HTML associated with any matched path. If the path is a string, then it will be compared directly to `window.location.hash`. If the path is an object, then it should include a `path` string that will be used to resolve the HTML, and `match` string array that represents multiple paths that should trigger the `path` to be rendered. Defaults to an empty array ('[]'). |
| root | `string` | Yes | The ID for the root HTML element. If falsy, then no HTML will be generated. Defaults to an emtpy string (`''`). |
| useManifest | `boolean` | Yes | Determines whether a manifest file should be used to resolve the entries. Defaults to `false`. |

### Usage

Beyond the plugin itself, it is also beneficial to include the `@dojo/webpack-contrib/build-time-render/hasBuildTimeRender` module in the `entry` config option. This file adds the `has('build-item-render')` flag that applications can use to determine whether the app has been pre-rendered.

The following example will generate an HTML file containing `<script>` tags for the specified `entries`, along with the critical CSS and HTML for the root, `#account`, and `#help` paths. Both the `#faq` and `#contact` hashes will display the `#help` HTML.

```typescript
import BuildTimeRender from '@dojo/webpack-contrib/build-time-render/BuildTimeRender';

const entry = {
	main: {
		'@dojo/webpack-contrib/build-time-render/hasBuildTimeRender',
		'./src/main.ts',
		'./src/main.css'
	}
};

const webpackConfig = {
	entry,
	plugins: [
		new BuildTimeRender({
			entries: Object.keys(entry),
			paths: [
				'#account',
				{ path: '#help', match: [ 'faq', 'contact' ] }
			],
			root: 'app',
			useManifest: true
		})
	]
};
```

## css-module-plugin

A webpack plugin that converts `.m.css` import paths to `.m.css.js`. This is used in conjunction with the [css-module-dts-loader](#css-module-dts-loader) loader to ensure that webpack can probably resolve CSS module paths.

If the requested resource uses a relative path, then its path will be resolved relative to the requesting module. Otherwise, the resource will be loaded from `${basePath}node_modules` (see below for the definition of `basePath`):

```typescript
// Path is relative to the current module
import * as localCss from './path/to/local-styles.m.css';

// Imported from node_modules
import * as externalCss from 'some-mid/styles.m.css';
```

The plugin constructor accepts a single argument:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| basePath | `string` | No | The root path from which to resolve CSS modules |

## external-loader-plugin

External libraries that cannot be loaded normally via webpack can be included in a webpack build using this plugin.

The plugin takes an options object with the following properties:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| dependencies | `ExternalDep[]` | No | External dependencies to load. Described in more detail below |
| hash | `boolean` | Yes | Whether to use the build's hash to cache bust injected dependencies |
| outputPath | `string` | Yes | Where to copy dependencies to; defaults to "externals" |
| pathPrefix | `string` | Yes | Used to change the directory where files are placed(e.g. placing files in `_build` for testing) |

All external dependencies specified in the `dependencies` options will be placed in `${pathPrefix}/${outputPath}`.
Each `ExternalDep` in the `dependencies` array specifies one external dependency. Each can be a `string`, indicating a path that should be delegated to the configured loader, or an object with the following
properties:

 | Property | Type | optional | Description |
 | -------- | ---- | -------- | ----------- |
 | `from` | `string` | `false`  | A path relative to `node_modules` specifying the dependency location to copy into the build application. |
 | `to` | `string` | `true` | A path that replaces `from` as the location to copy this dependency to. By default, dependencies will be copied to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` if `to` is not specified. |
 | `name` | `string` | `true` | Indicates that this path, and any children of this path, should be loaded via the external loader |
 | `inject` | `string, string[], or boolean` | `true` | This property indicates that this dependency defines, or includes, scripts or stylesheets that should be loaded on the page. If `inject` is set to `true`, then the file at the location specified by `to` or `from` will be loaded on the page. If this dependency is a folder, then `inject` can be set to a string or array of strings to define one or more files to inject. Each path in `inject` should be relative to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` depending on whether `to` was provided. |

## i18n-plugin

Rather than manually set locale data within an application's entry point, that data can instead be read from a config and injected in at build time.

The plugin accepts an options object with the following properties:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| cldrPaths | `string[]` | Yes | An array of paths to CLDR JSON modules that should be included in the build and registered with the i18n ecosystem. If a path begins with a ".", then it is treated as relative to the current working directory. Otherwise, it is treated as a valid mid. |
| defaultLocale | `string` | No | The default locale. |
| supportedLocales | `string[]` | Yes | An array of supported locales beyond the default. |
| target | `string` | Yes | The entry point into which the i18n module should be injected. Defaults to `src/main.ts`. |

A custom module is generated from the locale data, injected into the bundle, and then imported into the specified entry point. The user's locale is compared against the default locale and supported locales, and if it is supported is set as the root locale for the application. If the user's locale is not supported, then the default locale is used. For example, the user's locale will be used in the following scenarios:

The user's locale can be represented by the default locale:

* Default Locale: 'en'
* Supported Locales: none
* User's locale: 'en-US'

The user's locale can be represented by one of the supported locales:

* Default Locale: 'en'
* Supported Locales: [ 'fr' ]
* User's locale: 'fr-CA'

However, in the following scenario the default locale will be used, although it still will be possible to switch between any of the supported locales at run time, since their required data will also be included in the build:

* Default Locale: 'en'
* Supported Locales: [ 'de', 'ja', 'ar' ]
* User's locale: 'cz'

# Transformers

## registry-transformer

A custom [TypeScript transformer](https://github.com/TypeStrong/ts-loader#getcustomtransformers-----before-transformerfactory-after-transformerfactory--) that generates [registry](https://github.com/dojo/widget-core/#registry) keys for [widgets](https://github.com/dojo/widget-core) included in lazily-loaded bundles. This allows widget authors to use the same pattern for authoring widgets regardless of whether they are loaded from a registry or imported directly.

For example, if `LazyWidget` needs to be split into a separate bundle and this transformer is not applied, then `LazyWidget` would need to be added to the registry (`registry.define('lazy-widget', LazyWidget)`), and all calls to `w(LazyWidget)` would need to be updated to reference its registry key (`w<LazyWidget>('lazy-widget')`). By using this transformer, `LazyWidget` would instead be added to the registry at build time, allowing existing code to remain unchanged.

## How do I contribute?

We appreciate your interest!  Please see the [Dojo 2 Meta Repository](https://github.com/dojo/meta#readme) for the
Contributing Guidelines.

### Code Style

This repository uses [`prettier`](https://prettier.io/) for code styling rules and formatting. A pre-commit hook is installed automatically and configured to run `prettier` against all staged files as per the configuration in the projects `package.json`.

An additional npm script to run `prettier` (with write set to `true`) against all `src` and `test` project files is available by running:

```bash
npm run prettier
```

### Testing

To test this package, after ensuring all dependencies are installed, run the following command:

```sh
$ grunt test
```

## Licensing information

© 2018 [JS Foundation](https://js.foundation/). [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
