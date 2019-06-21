import { default as checkHas, exists as doesItExist, add as addIt, arbitrary } from 'dojo/has';

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

if (doesItExist('bar')) {
	doX();
}

if (doesItExist('foo')) {
	doY();
}

addIt('foo', () => 'no', false);
addIt('bar', () => 'yes', true);
