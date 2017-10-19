# @dojo/webpack-contrib

[![Build Status](https://travis-ci.org/dojo/webpack-contrib.svg?branch=master)](https://travis-ci.org/dojo/webpack-contrib)
[![codecov](https://codecov.io/gh/dojo/webpack-contrib/branch/master/graph/badge.svg)](https://codecov.io/gh/dojo/webpack-contrib)
[![npm version](https://badge.fury.io/js/%40dojo%2Fwebpack-contrib.svg)](http://badge.fury.io/js/%40dojo%2Fwebpack-contrib)

This is the home for custom Webpack plugins and loaders used in the Dojo 2 build process

# static-build-loader


A webpack loader which allows code to be statically optimized for a particular context at bundling time.
This loader acts on JavaScript. Some examples show the TypeScript source, but the loader will only
work if acting on the compiled output.

## Features

The loader examines code, looking for usages of `@dojo/has` or _has pragmas_ to _optimize_. It does this by parsing the AST structure of the code, and modifying it when appropriate.

The loader takes two options: 

* features: A map of _static_ features or a feature or list of features that resolve to a similar static map 
based on the functionality provided by the specified targets. Each key in the map is the name of the feature 
and the value is `true` if the feature is present in that context, otherwise `false`.
* isRunningInNode: An optional boolean parameter. If set to false this indicates that the loader will not be
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

### Available features

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

### Dead Code Removal

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

### Elided Imports

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

# external-loader-plugin

External libraries that cannot be loaded normally via webpack can be included in a webpack build using this plugin.

The plugin takes an options object with the following properties:

| Property | Type | Optional | Description |
| -------- | ---- | -------- | ----------- |
| dependencies | ExternalDep[] | No | External dependencies to load. Described in more detail below |
| hash | boolean | Yes | Whether to use the build's hash to cache bust injected dependencies |
| outputPath | string | Yes | Where to copy dependencies to; defaults to "externals" |
| pathPrefix | string | Yes | Used to change the directory where files are placed(e.g. placing files in `_build` for testing) |

All external dependencies specified in the `dependencies` options will be placed in `${pathPrefix}/${outputPath}`.
Each `ExternalDep` in the `dependencies` array specifies one external dependency. Each can be a `string`, indicating a path that should be delegated to the configured loader, or an object with the following
properties:

 | Property | Type | optional | Description |
 | -------- | ---- | -------- | ----------- |
 | `from` | `string` | `false`  | A path relative to `node_modules` specifying the dependency location to copy into the build application. |
 | `to` | `string` | `true` | A path that replaces `from` as the location to copy this dependency to. By default, dependencies will be copied to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` if `to` is not specified. |
 | `name` | `string` | `true` | Indicates that this path, and any children of this path, should be loaded via the external loader |
 | `inject` | `string, string[], or boolean` | `true` | This property indicates that this dependency defines, or includes, scripts or stylesheets that should be loaded on the page. If `inject` is set to `true`, then the file at the location specified by `to` or `from` will be loaded on the page. If this dependency is a folder, then `inject` can be set to a string or array of strings to define one or more files to inject. Each path in `inject` should be relative to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` depending on whether `to` was provided. |

## How do I use this package?

TODO: Add appropriate usage and instruction guidelines

## How do I contribute?

We appreciate your interest!  Please see the [Dojo 2 Meta Repository](https://github.com/dojo/meta#readme) for the
Contributing Guidelines and Style Guide.

## Testing

To test this package, after ensuring all dependencies are installed, run the following command:

```sh
$ grunt test
```

## Licensing information

TODO: If third-party code was used to write this library, make a list of project names and licenses here

* [Third-party lib one](https//github.com/foo/bar) ([New BSD](http://opensource.org/licenses/BSD-3-Clause))

© [JS Foundation](https://js.foundation/) & contributors. [New BSD](http://opensource.org/licenses/BSD-3-Clause) and [Apache 2.0](https://opensource.org/licenses/Apache-2.0) licenses.
