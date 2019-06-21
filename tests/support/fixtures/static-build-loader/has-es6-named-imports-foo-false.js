import { default as checkHas, exists as doesItExist, add as addIt, arbitrary } from 'dojo/has';

function doX() {

}

function doY() {

}
if (false) {
	doX();
}

if (!false) {
	doY();
}

if (checkHas('bar')) {
	doX();
}

if (doesItExist('bar')) {
	doX();
}

if (true) {
	doY();
}

addIt('foo', false);
addIt('bar', () => 'yes', true);
