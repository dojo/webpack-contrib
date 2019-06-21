import checkHas, { exists, add, arbitrary } from 'dojo/has';


function doX() {

}

function doY() {

}
if (checkHas('foo')) {
	doX();
}

if (!checkHas('foo')) {
	doY();
}

if (checkHas('bar')) {
	doX();
}

if (exists('bar')) {
	doX();
}

if (exists('foo')) {
	doY();
}

add('foo', false, true);
add('foo', false);
add('foo', function () { return true; });
add('foo', function addFoo() { return true; });
add('foo', () => true, false);
add('bar', true);
add('bar', false, true);
add('bar', function () { return true }, true);

// Should not parse
if (checkHas.exists('foo')) {
	doY();
}

// Should not parse
checkHas.add('foo', true);
