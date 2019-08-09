export function add(feature, value, overwrite = false ) {
	// Add
}

export default function has(feature, strict = false) {
	// Has
}

function doTheThing() {

}

if (has('foo')) {
	doTheThing();
}

if (!has('bar')) {
	doTheThing();
}

add('foo', () => {
	return 1 + 1 > 2;
});

add('bar', () => {
	return 1 + 1 < 2;
});

add('baz', () => has('foo'));

add('foo', false, true);
