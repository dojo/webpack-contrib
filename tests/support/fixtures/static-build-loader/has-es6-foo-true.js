import checkHas, { exists, arbitrary } from 'dojo/has';


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
