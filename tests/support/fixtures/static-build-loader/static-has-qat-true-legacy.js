const { destructured } = { destructured: 1 };
const tslib = require('tslib');
const someOtherVariable = require('something/someothermodule');
const number = 3;
const value = notRequire('something/has');
const somename = tslib.__importDefault(require('something/has')),
	chainedDeclarations = true;
const afterHasRequire = true;
// !has('foo')
"use strict";
exports.__esModule = true;
tslib.__importDefault(require("foo"));
// has('bar')
require("bar");
require("baz");
// !has('qat')
// elided: import 'qat'
// !has('qat')
const foo = 'bar';
require(foo);
// has('foo')
// elided: import 'foo'
// !has('baz')
require("qat");
// has('bar')
var importedValue = require('bar');
// has('bar')
import another, { namedExport } from 'default-import';
// has('bar')
import 'no-var-import';

var newVar = '';
somename.default.add('foo');

var dynamicHas = somename.default(foo);

function doX() {

}

function doY() {

}
if (false) {
	doX();
}
else {
	doY();
}

if (true) {
	doX();
}

if (!true) {
	doY();
} else if (somename.exists('bar')) {
	doX();
}

if (!false) {
	doX();
}

if ((false || somename.default('bar')) && true) {

}

function returnArg(arg) {
	return arg;
}

if (returnArg(!false) && (somename.default('baz') || returnArg(true) || false)) {
	doX();
	doY();
}

if (false)
	doX();

somename.add('foo', false);

somename.add('bar', true, true);

somename.add('qat', true);

var variable = somename.default('bar') || returnArg(false);

// !has('foo')
require('elided');
