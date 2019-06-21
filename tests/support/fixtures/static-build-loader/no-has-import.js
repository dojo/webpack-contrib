import { exists, add } from '@dojo/has';

function doX() {
	return 'foo';
}

function doY() {
	return 'bar';
}

if (!exists('foo')) {
	add('foo', () => doX() === doY());
}

if(!exists('bar')) {
	add('bar', () => doX() !== doY());
}
