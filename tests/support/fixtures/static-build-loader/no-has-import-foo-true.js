import { exists, add } from '@dojo/has';

function doX() {
	return 'foo';
}

function doY() {
	return 'bar';
}

if (!true) {
	add('foo', true);
}

if(!exists('bar')) {
	add('bar', () => doX() !== doY());
}
