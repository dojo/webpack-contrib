export function add(feature, value, overwrite = false ) {
	// Add
}

export default function has(feature, strict = false) {
	// Has
}

function doTheThing() {

}

if (true) {
	doTheThing();
}

if (!has('bar')) {
	doTheThing();
}

add('foo', true);

add('bar', () => {
	return 1 + 1 < 2;
});

add('baz', () => true);

add('foo', true);
