# @dojo/static-optimize-plugin

[![Build Status](https://travis-ci.org/dojo/static-optimize-plugin.svg?branch=master)](https://travis-ci.org/dojo/static-optimize-plugin)
[![codecov](https://codecov.io/gh/dojo/static-optimize-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/dojo/static-optimize-plugin)
[![npm version](https://badge.fury.io/js/%40dojo%2Fstatic-optimize-plugin.svg)](http://badge.fury.io/js/%40dojo%2Fstatic-optimize-plugin)

A webpack plugin which allows code to be statically optimized for a particular context at bundling time.

## Features

For each module in a webpack build, the plugin will access the compilation, looking for code to _optimize_.  It does this by walking
the AST structure offered by webpack, making changes to the compilation.

The plugin takes a map of _static_ features, where the key is the name of the feature and the value is either `true` if the feature
is present in that context, otherwise `false`.

For example in a webpack configuration, the map of features would look like this:

```js
{
    plguins: [
        new StaticOptimizePlugin({
            'foo': true,
            'bar': false
        });
    ]
};
```

This asserts feature `foo` is `true` and feature `bar` is `false`.  This map is then used in the features below.

### Dead Code Removal

The plugin assumes that the [`@dojo/has`](https://github.com/dojo/has) API is being used in modules that are being compiled
into a webpack bundle and attempts to rewrite calls to the `has()` API when it can see it has a statically asserted flag for
that feature.

The plugin detects structures like the following in transpiled TypeScript modules:

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
