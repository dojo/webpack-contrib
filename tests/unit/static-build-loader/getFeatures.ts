import { stub } from 'sinon';
import getFeatures from '../../../src/static-build-loader/getFeatures';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('getFeatures', {
	'no features'() {
		assert.deepEqual(getFeatures(undefined), {});
	},

	'single feature set'() {
		assert.deepEqual(getFeatures('modern'), {
			arraybuffer: true,
			blob: true,
			'dom-mutationobserver': true,
			'es-observable': false,
			'es2017-object': true,
			'es2017-string': true,
			'es6-array': true,
			'es6-array-fill': true,
			'es6-map': true,
			'es6-math': true,
			'es6-math-imul': true,
			'es6-object': true,
			'es6-promise': true,
			'es6-set': true,
			'es6-string': true,
			'es6-string-raw': true,
			'es6-symbol': true,
			'es6-weakmap': true,
			'es7-array': true,
			fetch: true,
			filereader: true,
			float32array: true,
			formdata: true,
			'host-node': false,
			'host-browser': true,
			microtasks: true,
			'node-buffer': false,
			'object-assign': true,
			postmessage: true,
			raf: true,
			setimmediate: false,
			xhr: true,
			xhr2: true
		});
	},

	'not found feature set'() {
		const logStub = stub(console, 'log');
		const features = getFeatures(['foo']);
		logStub.restore();
		assert.deepEqual(features, {});
		assert.isTrue(logStub.calledOnce, 'log should have been called');
		assert.strictEqual(logStub.lastCall.args[0], 'Cannot resolve feature set:');
		assert.strictEqual(logStub.lastCall.args[1], 'foo');
	}
});
