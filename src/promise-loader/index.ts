import * as path from 'path';
const loaderUtils = require('loader-utils');

export function pitch (this: any, remainingRequest: string) {
	this.cacheable && this.cacheable();
	const query = this.query.substring(1).split(',');
	const promiseLib = query[0];
	const filename = path.basename(remainingRequest);
	const name = path.basename(remainingRequest, path.extname(filename));
	let bundleName = query[1] || '';

	bundleName = bundleName.replace(/\[filename\]/g, filename).replace(/\[name\]/g, name);

	if (!promiseLib) {
		throw new Error('You need to specify your Promise library of choice, e.g. require("promise?bluebird!./file.js")');
	}

	const requirePromise = promiseLib !== 'global' ? 'var Promise = require(' + JSON.stringify(promiseLib) + ');\n' : '';

	const result = `${requirePromise}
module.exports = function () {
	return new Promise(function (resolve) {
	require.ensure([], function (require) {
		resolve(require(${loaderUtils.stringifyRequest(this, '!!' + remainingRequest)}));
	}${bundleName && (', ' + JSON.stringify(bundleName))});
	});
}`;

	return result;
};

export default () => {};
