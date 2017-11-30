import * as loader from '../../../src/promise-loader/index';

const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

describe('promise-loader', () => {
	it('loader', () => {
		const context = {
			query: '?global,Foo',
			context: '/absolute/path/to'
		};
		const expectedResult = `
module.exports = function () {
	return new Promise(function (resolve) {
	require.ensure([], function (require) {
		resolve(require("!!./node_modules/umd-compat-loader/index.js??ref--3-0!./node_modules/ts-loader/index.js??ref--3-1!./node_modules/@dojo/webpack-contrib/css-module-dts-loader/index.js?type=ts&instanceName=0_dojo!./src/Foo.ts"));
	}, "Foo");
	});
}`;
		const result = loader.pitch.call(
			context,
			'/absolute/path/to/node_modules/umd-compat-loader/index.js??ref--3-0!/absolute/path/to/node_modules/ts-loader/index.js??ref--3-1!/absolute/path/to/node_modules/@dojo/webpack-contrib/css-module-dts-loader/index.js?type=ts&instanceName=0_dojo!/absolute/path/to/src/Foo.ts'
		);
		assert.strictEqual(result, expectedResult);
	});
});
