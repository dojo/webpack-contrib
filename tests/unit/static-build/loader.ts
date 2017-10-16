import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import * as sinon from 'sinon';
import { readFileSync } from 'fs';
import MockModule from '../../support/MockModule';
const recast = require('recast');

let loader: (content: string, sourceMap?: { file: string }) => undefined | string;
let sandbox: sinon.SinonSandbox;
let logStub: sinon.SinonStub;
let mockModule: MockModule;
let mockLoaderUtils: { getOptions: sinon.SinonStub };
let mockGetFeatures: { default: sinon.SinonStub };
let mockRecastUtil: { composeSourceMaps: sinon.SinonStub};
let mockRecast: { types: any, print: sinon.SinonStub, parse: sinon.SinonStub };

function loadCode(name: string) {
	return readFileSync((require as any).toUrl(`../../support/fixtures/${name}.js`), 'utf8').replace(/\r\n/g, '\n');
}

registerSuite({
	name: 'StaticOptimizePlugin',

	before() {
		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../src/static-build/loader');
		mockModule.dependencies([
			'./getFeatures',
			'loader-utils',
			'recast/lib/util',
			'recast'
		]);
		mockGetFeatures = mockModule.getMock('./getFeatures');
		mockLoaderUtils = mockModule.getMock('loader-utils');
		mockRecastUtil = mockModule.getMock('recast/lib/util');
		mockRecast = mockModule.getMock('recast');
		mockRecast.types = recast.types;
		loader = mockModule.getModuleUnderTest().default;
		logStub = sandbox.stub(console, 'log');
	},

	beforeEach() {
		mockGetFeatures.default = sandbox.stub().returns({ foo: true, bar: false });
		mockRecast.parse.callsFake((...args: any[]) => recast.parse(...args));
		mockRecast.print.callsFake((...args: any[]) => recast.print(...args));
	},

	afterEach() {
		sandbox.reset();
	},

	after() {
		sandbox.restore();
	},

	'no static flags'() {
		const code = loadCode('static-has-no-flags');
		mockLoaderUtils.getOptions.returns({
			features: {}
		});
		assert.deepEqual(loader(code)!.replace(/\r\n/g, '\n'), code);
	},

	'static features'() {
		const code = loadCode('static-has-base');
		mockLoaderUtils.getOptions.returns({
			features: { qat: true }
		});

		const context = {
			callback: sandbox.stub()
		};
		const resultCode = loader.call(context, code).replace(/\r\n/g, '\n');
		assert.deepEqual(resultCode, loadCode('static-has-qat-true'));
		assert.isFalse(mockGetFeatures.default.called, 'Should not have called getFeatures');
		assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
		assert.strictEqual(logStub.secondCall.args[ 0 ], 'Dynamic features: foo, bar, baz', 'should have logged properly');
	},

	'should pass to callback if a sourcemap was provided'() {
		const map = 'map';
		const returnedCode = 'code';
		mockRecast.print.reset();
		mockRecast.print.returns({
			map, code: returnedCode
		});
		mockRecastUtil.composeSourceMaps.returns('map');
		const code = loadCode('static-has-base');
		mockLoaderUtils.getOptions.returns({
			features: { qat: true }
		});

		const context = {
			callback: sandbox.stub()
		};
		const file = 'sourceMapFile';
		const resultCode = loader.call(context, code, { file });

		assert.isUndefined(resultCode, 'Should not have returned code');
		assert.equal(mockRecast.print.callCount, 1, 'Should have called print once');

		const modifiedAst = mockRecast.print.firstCall.args[0];
		const modifiedCode = recast.print(modifiedAst).code.replace(/\r\n/g, '\n');
		const sourceMapOptions = mockRecast.print.firstCall.args[1];

		assert.deepEqual(modifiedCode, loadCode('static-has-qat-true'), 'Should have passed modified ast to print');
		assert.deepEqual(sourceMapOptions, { sourceMapName: file }, 'Should have passed source map file to print');

		assert.isTrue(mockRecastUtil.composeSourceMaps.calledOnce, 'Should have called composeSourceMaps');
		assert.deepEqual(
			mockRecastUtil.composeSourceMaps.firstCall.args, [ { file }, map ],
			'Should have passed the sourcemap file and the updated map returned from print to composeSourceMaps'
		);

		assert.isTrue(context.callback.calledOnce, 'Should have called provided callback');
		assert.deepEqual(
			context.callback.firstCall.args,
			[ null, returnedCode, map, modifiedAst ],
			'Should have called callback with the final code, the modified sourcemap, and the modified AST'
		);
		assert.isFalse(mockGetFeatures.default.called, 'Should not have called getFeatures');
		assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
		assert.strictEqual(logStub.secondCall.args[ 0 ], 'Dynamic features: foo, bar, baz', 'should have logged properly');
	},

	'should delegate to getFeatures if features are passed'() {
		const code = loadCode('static-has-base');
		mockLoaderUtils.getOptions.returns({
			features: [ 'static' ]
		});

		const context = {
			callback: sandbox.stub()
		};
		const resultCode = loader.call(context, code).replace(/\r\n/g, '\n');
		assert.deepEqual(resultCode, loadCode('static-has-foo-true-bar-false'));
		assert.strictEqual(mockGetFeatures.default.callCount, 1, 'should have called getFeatures');
		assert.deepEqual(mockGetFeatures.default.firstCall.args, [ [ 'static' ], undefined ]);
		assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
		assert.strictEqual(logStub.secondCall.args[ 0 ], 'Dynamic features: baz, qat', 'should have logged properly');
	},

	'does not import has'() {
		const code = loadCode('no-import');
		mockLoaderUtils.getOptions.returns({
			features: { foo: true }
		});
		assert.deepEqual(
			loader(code)!.replace(/\r\n/g, '\n'),
			loadCode('no-import-foo-true'),
			'Should not replace has calls, but should still support has pragma if has was not imported'
		);
	}
});
