const { destructured } = { destructured: 1 };
const tslib = require('tslib');
const someOtherVariable = require('something/someothermodule');
const number = 3;
const value = notRequire('something/has');
const somename = tslib.__importDefault(require('something/has')),
	chainedDeclarations = true;
const afterHasRequire = true;
'!has("foo")';
"use strict";
exports.__esModule = true;
tslib.__importDefault(require("foo"));
'has("bar")';
require("bar");
require("baz");
"!has('qat')";
tslib.__importStar(require("qat"));
"!has('qat')";
const foo = 'bar';
require(foo);
'has("foo")';
tslib.__importDefault(require("foo"));
"!has('baz')";
require("qat");
"has('bar')";
var importedValue = require('bar');
`has('bar')`;
import another, { namedExport } from 'default-import';
"has('bar')";
import 'no-var-import';

var newVar = '';
somename.default.add('foo');

var dynamicHas = somename.default(foo);

function doX() {

}

function doY() {

}
if (somename.default('foo')) {
	doX();
}
else {
	doY();
}

if (somename.exists('foo')) {
	doX();
}

if (!somename.exists('foo')) {
	doY();
} else if (somename.exists('bar')) {
	doX();
}

if (!somename.default('foo')) {
	doX();
}

if ((somename.default('foo') || somename.default('bar')) && true) {

}

function returnArg(arg) {
	return arg;
}

if (returnArg(!somename.default('foo')) && (somename.default('baz') || returnArg(somename.default('qat')) || somename.default('foo'))) {
	doX();
	doY();
}

if (somename.default('foo'))
	doX();

somename.add('foo', function () {
	return true;
});

somename.add('bar', true, true);

somename.add('qat', function addqat() {
	if (true) {
		return false;
	}
}, true);

var variable = somename.default('bar') || returnArg(somename.default('foo'));

'!has("foo")';
require('elided');
