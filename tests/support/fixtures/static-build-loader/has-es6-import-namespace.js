import * as has from '/has';

function doX() {

}

function doY() {

}
if (has.default('foo')) {
	doX();
}

if (!has.default('foo')) {
	doY();
}

if (has.default('bar')) {
	doX();
}

if (has.exists('bar')) {
	doX();
}

if (has.exists('foo')) {
	doY();
}
