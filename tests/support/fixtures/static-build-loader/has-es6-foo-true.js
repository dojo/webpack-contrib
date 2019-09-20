import checkHas, { exists, add, arbitrary } from 'dojo/has';


function doX() {

}

function doY() {

}
if (true) {
	doX();
}

if (!true) {
	doY();
}

if (checkHas('bar')) {
	doX();
}

if (exists('bar')) {
	doX();
}

if (true) {
	doY();
}

add('foo', true);
add('foo', true);
add('foo', true);
add('foo', true);
add('foo', true);
add('bar', true);
add('bar', false, true);
add('bar', function () { return true }, true);
add('do-not-touch', function () { return true });

if (true) {
	doY();
}

// Should not parse
if (checkHas.exists('foo')) {
	doY();
}

// Should not parse
checkHas.add('foo', true);
