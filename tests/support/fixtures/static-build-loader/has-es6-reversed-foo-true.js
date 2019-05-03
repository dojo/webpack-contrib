import { default as checkHas, exists } from 'dojo/has';

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
