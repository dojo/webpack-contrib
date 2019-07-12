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
	- [emit-all-plugin](#emit-all-plugin)
	- [external-loader-plugin](#external-loader-plugin)
	- [i18n-plugin](#i18n-plugin)
	- [service-worker-plugin](#service-worker-plugin)
	- [webpack-bundle-analyzer](#webpack-bundle-analyzer)
	- [bootstrap-plugin](#bootstrap-plugin)
- [Transformers](#transformers)
	- [registry-transformer](#registry-transformer)
	- [element-transformer](#element-transformer)
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

A webpack loader that injects CSS module path information into the generated modules, making it easier for `@dojo/widget-core` to resolve theme styles. This loader takes no options.

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
| static | `boolean` | Yes | Removes js and css scripts tags from generated `index.html` files for truly static sites. Not compatible with hash routing. Defaults to `false`. |

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

## emit-all-plugin

Webpack is a bundler, which does not work well when build libraries. Rather than create separate toolchains for building libraries and applications/custom elements, the existing build tooling can be used to emit library files by way of the `emitAllFactory` that produces both a plugin instance and a custom TypeScript transformer. The transformer is needed to ensure that any `.d.ts` dependencies are correctly emitted, while the plugin ensures assets are emitted as individual files instead of as a generated bundle:

```ts
import { emitAllFactory } from '@dojo/webpack-contrib/emit-all-plugin/EmitAllPlugin';

// See list of available options below
const emitAll = emitAllFactory(options);

const config = {
	// ...
	plugins: [
		...,
		emitAll.plugin
	],
	module: {
		rules: [
			// ...
			{
				test: /.*\.ts(x)?$/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							// ...
							getCustomTransformers(program) {
								return {
									before: [
										emitAll.transformer()
									]
								};
							}
						}
					}
				]
			}
		]
	}
}
```

At the very least CSS and transpiled TS files will be emitted, but additional assets can be included with a filter.

The factory takes an options object with the following properties:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| basePath | `string` | Yes | The base path for the project's source files. Only files within this directory are emitted. Defaults to the project's `src/` directory. |
| inlineSourceMaps | `boolean` | Yes | Specifies whether sources maps should be inlined with the output source files or emitted separately. Defaults to `false`. |
| legacy | `boolean` | Yes | Specifies whether TypeScript files should be transpiled to ES modules or to legacy JavaScript. Defaults to `false`. |
| assetFilter | `Function` | Yes | Used to filter assets to only those that should be included in the output. Accepts the asset file path and the asset object. If the function returns `true`, the asset will be emitted; otherwise it will be excluded. |

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
 | `from` | `string` | `false`  | A path relative to the root of the project specifying the dependency location to copy into the build application. |
 | `to` | `string` | `true` | A path that replaces `from` as the location to copy this dependency to. By default, dependencies will be copied to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` if `to` is not specified. If the path includes `.` characters, it must end in a forward slash to be treated as a directory |
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

## service-worker-plugin

A custom webpack plugin that generates a service worker from configuration options, or simply ensures a custom service worker is copied to the output directory. Generated service workers support both precaching and runtime caching and allow you specify additional resources that should be loaded by the service worker.

The plugin accepts either a string path for an existing service worker to copy to the output directory, or an options object with the following properties:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| bundles | `string[]` | Yes | An array of bundles to include in the precache. Defaults to all bundles. |
| cachePrefix | `string` | Yes | The prefix to use for the runtime precache cache. |
| clientsClaim | `boolean` | Yes | Whether the service worker should start controlling clients on activation. Defaults to `false`. |
| excludeBundles | `string[]` | Yes | An array of bundles to include in the precache. Defaults to `[]`. |
| importScripts | `string[]` | Yes | An array of script paths that should be loaded within the service worker |
| precache | `object` | Yes | An object of precache configuration options (see below) |
| routes | `object[]` | Yes | An array of runtime caching config objects (see below) |
| skipWaiting | `boolean` | Yes | Whether the service worker should skip the waiting lifecycle |

### Precaching

The `precache` option can take the following options to control precaching behavior:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| baseDir | `string` | Yes | The base directory to match `include` against. |
| ignore | `string[]` | Yes | An array of glob pattern string matching files that should be ignored when generating the precache. Defaults to `[ 'node_modules/**/*' ]`. |
| include | `string` or `string[]` | Yes | A glob pattern string or an array of glob pattern strings matching files that should be included in the precache. Defaults to all files in the build pipeline. |
| index | `string` | Yes | The index filename that should be checked if a request fails for a URL ending in `/`. Defaults to `'index.html'`. |
| maxCacheSize | `number` | Yes | The maximum size in bytes a file must not exceed to be added to the precache. Defaults to `2097152` (2 MB). |
| strict | `boolean` | Yes | If `true`, then the build will fail if an `include` pattern matches a non-existent directory. Defaults to `true`. |
| symlinks | `boolean` | Yes | Whether to follow symlinks when generating the precache. Defaults to `true`. |

### Runtime Caching

In addition to precaching, strategies can be provided for specific routes to determine whether and how they can be cached. This `routes` option is an array of objects with the following properties:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| urlPattern | `string` | No | A pattern string (which will be converted a regular expression) that matches a specific route. |
| strategy | `string` | No | The caching strategy (see below). |
| options | `object` | Yes | An object of additional options, each detailed below. |
| cacheName | `string` | Yes | The name of the cache to use for the route. Note that the `cachePrefix` is _not_ prepended to the cache name. Defaults to the main runtime cache (`${cachePrefix}-runtime-${domain}`). |
| cacheableResponse | `object` | Yes | Uses HTTP status codes and or headers to determine whether a response can be cached. This object has two optional properties: `statuses` and `headers`. `statuses` is an array of HTTP status codes that should be considered valid for the cache. `headers` is an object of HTTP header and value pairs; at least one header must match for the response to be considered valid. Defaults to `{ statuses: [ 200 ] }` when the `strategy` is `'cacheFirst'`, and `{ statuses: [0, 200] }` when the `strategy` is either `networkFirst` or `staleWhileRevalidate`. |
| expiration | `object` | Yes | Controls how the cache is invalidated. This object has two optional properties. `maxEntries` is the number of responses that can be cached at any given time. Once this max is exceeded, the oldest entry is removed. `maxAgeSeconds` is the oldest a cached response can be in seconds before it gets removed. |
| networkTimeoutSeconds | `number` | Yes | Used with the `networkFirst` strategy to specify how long in seconds to wait for a resource to load before falling back on the cache. |


#### Strategies

Four routing strategies are currently supported:

- `networkFirst` attempts to load a resource over the network, falling back on the cache if the request fails or times out. This is a useful strategy for assets that either change frequently or may change frequently (i.e., are not versioned).
- `cacheFirst` loads a resource from the cache unless it does not exist, in which case it is fetched over the network. This is best for resources that change infrequently or can be cached for a long time (e.g., versioned assets).
- `networkOnly` forces the resource to always be retrieved over the network, and is useful for requests that have no offline equivalent.
- `staleWhileRevalidate` requests resources from both the cache and the network simulaneously. The cache is updated with each successful network response. This strategy is best for resources that do not need to be continuously up-to-date, like user avatars. However, when fetching third-party resources that do not send CORS headers, it is not possible to read the contents of the response or verify the status code. As such, it is possible that a bad response could be cached. In such cases, the `networkFirst` strategy may be a better fit.

### Example

```typescript
import ServiceWorkerPlugin from '@dojo/webpack-contrib/service-worker-plugin/ServiceWorkerPlugin';

new ServiceWorkerPlugin({
	cachePrefix: 'my-app',

	// exclude the "admin" bundle from caching
	excludeBundles: [ 'admin' ],

	routes: [
		// Use the cache-first strategy for loading images, adding them to the "my-app-images" cache.
		// Only the first ten images should be cached, and for one week.
		{
			urlPattern: '.*\\.(png|jpg|gif|svg)',
			strategy: 'cacheFirst',
			cacheName: 'my-app-images',
			expiration: { maxEntries: 10, maxAgeSeconds: 604800 }
		},

		// Use the cache-first strategy to cache up to 25 articles that expire after one day.
		{
			urlPattern: 'http://my-app-url.com/api/articles',
			strategy: 'cacheFirst',
			expiration: { maxEntries: 25, maxAgeSeconds: 86400 }
		}
	]
});
```

## webpack-bundle-analyzer

A webpack plugin that provides a visualization of the size of webpack output with an interactive sunburst graphic.
Functionally this is a copy of [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) with a custom visualization.

The plugin accepts an options object with the following optional properties.

| Property | Type | Description | Default |
| -------- | ---- | ----------- | ------- |
| analyzerMode | `'server' or 'static' or 'disabled'` | Whether to serve bundle analysis in a live server, render the report in a static HTML file or files, or to disable visual report generation entirely. | `'server' |
| analyzerPort | `number` |  The port to use in `server` mode | `8888` |
| reportFilename | `string` | Path to the report bundle file. Multiple report will be created with `-<bundleName>` appended to this value if there is more than one output bundle. | `'report.html'` |
| openAnalyzer | `boolean` | Whether the report should be opened in a browser automatically | `true` |
| generateStatsFile | `boolean` | Whether a JSON Webpack Stats file should be generated | `false` |
| statsFilename | `string` | Name to use for the stats file if one is generated | `'stats.json'` |
| statsOptons | `any` | Options to pass to `stats.toJson()`. More documentation can be found [here](https://github.com/webpack/webpack/blob/webpack-1/lib/Stats.js#L21) | `null` |
| logLevel | `'info' or 'warn' or 'error' or 'silent'` | The level of logs from this plugin | `'info`'

### Example

```typescript
import BundleAnalyzerPlugin from '@dojo/webpack-contrib/webpack-bundle-analyzer/BundleAnalyzerPlugin';

new BundleAnalyzerPlugin({
	analyzerMode: 'static',
	reportFilename: '../info/report.html',
	openAnalyzer: false
});
```

## bootstrap-plugin

A custom webpack plugin that conditionally loads supported dojo shims based on usage and browser capabilities.

### Supported Shims

* @dojo/framework/shim/IntersectionObserver
* @dojo/framework/shim/ResizeObserver
* @dojo/framework/shim/WebAnimations

To use the plugin, use the provided `bootstrap.js` from `@dojo/webpack-contrib/bootstrap-plugin` as the application entry and add the plugin to the webpack configuration.

The `BootstrapPlugin` accepts requires the path to application entry point and an array of `shimModules` to process.

```ts
new BootstrapPlugin({
	entryPath: mainEntryPath,
	shimModules: [
		{
			module: '@dojo/framework/shim/IntersectionObserver',
			has: 'intersection-observer'
		},
		{
			module: '@dojo/framework/shim/ResizeObserver',
			has: 'resize-observer'
		},
		{
			module: '@dojo/framework/shim/WebAnimations',
			has: 'web-animations'
		}
	]
})
```

# Transformers

## registry-transformer

A custom [TypeScript transformer](https://github.com/TypeStrong/ts-loader#getcustomtransformers-----before-transformerfactory-after-transformerfactory--) that generates [registry](https://github.com/dojo/widget-core/#registry) keys for [widgets](https://github.com/dojo/widget-core) included in lazily-loaded bundles. This allows widget authors to use the same pattern for authoring widgets regardless of whether they are loaded from a registry or imported directly.

For example, if `LazyWidget` needs to be split into a separate bundle and this transformer is not applied, then `LazyWidget` would need to be added to the registry (`registry.define('lazy-widget', LazyWidget)`), and all calls to `w(LazyWidget)` would need to be updated to reference its registry key (`w<LazyWidget>('lazy-widget')`). By using this transformer, `LazyWidget` would instead be added to the registry at build time, allowing existing code to remain unchanged.

## element-transformer

A custom [TypeScript transformer](https://github.com/TypeStrong/ts-loader#getcustomtransformers-----before-transformerfactory-after-transformerfactory--) that generates a custom element definition for specified widgets.

For example given a widget `Hello`,

```typescript
import { v } from '@dojo/framework/widget-core/d';
import { WidgetBase } from '@dojo/framework/widget-core/WidgetBase';

interface HelloProperties {
	name: string;
	flag: boolean;
	onClick(): void;
	onChange(value: string): void;
}

export class Hello extends WidgetBase<HelloProperties> {
	protected render() {
		const { name } = this.properties;
		return v('h1', { }, [
			'Hello ${name}!'
		]);
	}
}

export default Hello;
```

The generated output would be ,

```typescript
import { v } from '@dojo/framework/widget-core/d';
import { WidgetBase } from '@dojo/framework/widget-core/WidgetBase';

interface HelloProperties {
	name: string;
	flag: boolean;
	onClick(): void;
	onChange(value: string): void;
}

export class Hello extends WidgetBase<HelloProperties> {
	protected render() {
		const { name } = this.properties;
		return v('h1', { }, [
			'Hello ${name}!'
		]);
	}
}
Hello.__customElementDescriptor = { ...{ tagName: 'widget-hello', attributes: ['name'], properties: ['flag'], events: ['onClick', onChange'] }, ...Hello.prototype.__customElementDescriptor || {} };

export default Hello;
```

## How do I contribute?

We appreciate your interest!  Please see the [Dojo 2 Meta Repository](https://github.com/dojo/meta#readme) for the
Contributing Guidelines.

### Code Style

This repository uses [`prettier`](https://prettier.io/) for code styling rules and formatting. A pre-commit hook is installed automatically and configured to run `prettier` against all staged files as per the configuration in the projects `package.json`.

An additional npm script to run `prettier` (with write set to `true`) against all `src` and `test` project files is available by running:

```shell
npm run prettier
```

### Testing

To test this package, after ensuring all dependencies are installed (`npm install`), run the following command:

```shell
npm run test
```

## Licensing information

© 2018 [JS Foundation](https://js.foundation/). [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
