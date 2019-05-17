import checkHas, { exists, arbitrary } from 'dojo/has';


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
