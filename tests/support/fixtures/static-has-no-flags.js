const { destructured } = { destructured: 1 };
const someOtherVariable = require('something/someothermodule');
const number = 3;
const value = notRequire('something/has');
const somename = require('something/has'),
	chainedDeclarations = true;
const afterHasRequire = true;
// has('foo')
"use strict";
exports.__esModule = true;
require("foo");
// !has('bar')
require("bar");
require("baz");
// has('qat')
require("qat");
// has('qat')
const foo = 'bar';
require(foo);
require('foo');
// !has('baz')
require("qat");

somename.default.add('foo');

var foo = 'foo';
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

var variable = somename.default('bar') || returnArg(somename.default('foo'));

// has('foo')
require('elided');
