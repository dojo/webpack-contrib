import checkHas, { exists } from 'dojo/has';


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
