// tslint:disable-next-line
var has = require('@dojo/framework/has/has');

if (!has.exists('build-time-render')) {
	console.log(has('public-path'));
	has.add('build-time-render', false, false);
}

if (has.has('btr')) {
	const publicPath = has.has('public-path') || `${window.location.origin}/`;
	// @ts-ignore
	__webpack_public_path__ = publicPath;
}
