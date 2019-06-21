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

add('bar', false, true);
add('bar', function addBar() { return true; });
has.add('foo', false, true);
has.add('foo', function addFoo() { return true; });
