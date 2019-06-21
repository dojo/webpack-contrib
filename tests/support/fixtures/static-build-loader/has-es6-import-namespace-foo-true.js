import * as has from '/has';

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

if (has.default('bar')) {
	doX();
}

if (has.exists('bar')) {
	doX();
}

if (true) {
	doY();
}
