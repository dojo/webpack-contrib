import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { stub } from 'sinon';
import getFeatures from '../../../src/static-build/getFeatures';

registerSuite({
	name: 'getFeatures',
	'no features'() {
		assert.deepEqual(getFeatures(undefined, false), {});
	},

	'single feature set'() {
		assert.deepEqual(getFeatures('ie11', false), {
			'arraybuffer': true,
			'blob': true,
			'dom-mutationobserver': false,
			'es-observable': false,
			'es2017-object': false,
			'es2017-string': false,
			'es6-array': false,
			'es6-array-fill': false,
			'es6-map': false,
			'es6-math': false,
			'es6-math-imul': false,
			'es6-object': false,
			'es6-promise': false,
			'es6-set': false,
			'es6-string': false,
			'es6-string-raw': false,
			'es6-symbol': false,
			'es6-weakmap': false,
			'es7-array': false,
			'fetch': false,
			'filereader': true,
			'float32array': true,
			'formdata': false,
			'host-node': false,
			'host-browser': true,
			'microtasks': true,
			'node-buffer': false,
			'object-assign': false,
			'postmessage': true,
			'raf': true,
			'setimmediate': true,
			'xhr': true,
			'xhr2': true
		});
	},

	'two feature sets'() {
		assert.deepEqual(getFeatures([ 'ie11', 'node' ], false), {
			arraybuffer: true,
			blob: true,
			'dom-mutationobserver': false,
			'es2017-object': false,
			'es2017-string': false,
			'es-observable': false,
			fetch: false,
			float32array: true,
			formdata: false,
			microtasks: true,
			setimmediate: true
		});
	},

	'not found feature set'() {
		const logStub = stub(console, 'log');
		const features = getFeatures([ 'ie11', 'foo' ], false);
		logStub.restore();
		assert.deepEqual(features, { });
		assert.isTrue(logStub.calledOnce, 'log should have been called');
		assert.strictEqual(logStub.lastCall.args[0], 'Cannot resolve feature set:');
		assert.strictEqual(logStub.lastCall.args[1], 'foo');
	},

	'should use require if running in node (returns empty set in browser)'() {
		const logStub = stub(console, 'log');
		const features = getFeatures('ie11');
		logStub.restore();
		assert.deepEqual(features, {});
		assert.isTrue(logStub.calledOnce, 'log should have been called');
		assert.strictEqual(logStub.lastCall.args[0], 'Cannot resolve feature set:');
		assert.strictEqual(logStub.lastCall.args[1], 'ie11');
	}
});
