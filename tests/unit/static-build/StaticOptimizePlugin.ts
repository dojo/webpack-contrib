import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { Program } from 'estree';
import * as sinon from 'sinon';
import MockModule from '../../support/MockModule';
import Compilation = require('../../support/webpack/Compilation');
import Compiler = require('../../support/webpack/Compiler');
import ConstDependency = require('webpack/lib/dependencies/ConstDependency');
import NormalModule = require('webpack/lib/NormalModule');
import _StaticOptimizePlugin from '../../../src/static-build/StaticOptimizePlugin';

function getAst(name: string): Program {
	return (require as any).nodeRequire((require as any).toUrl(`../../support/fixtures/${name}.json`));
}

interface CallbackArgs {
	addDependencyStub: sinon.SinonStub;
	compiler: Compiler;
	compilation: Compilation;
	logStub: sinon.SinonStub;
}

let StaticOptimizePlugin: any;
let sandbox: sinon.SinonSandbox;
let mockModule: MockModule;
let mockGetFeatures: any;

function runPluginTest(features: any | string | string[], name: string, assertions: (args: CallbackArgs) => void) {
	return function () {
		const compiler = new Compiler();
		const compilation = new Compilation();
		const plugin = new StaticOptimizePlugin(features);

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation);
		const { normalModuleFactory, parser } = compilation.params;
		normalModuleFactory.mockApply('parser', parser);
		parser.state.current = new NormalModule('', 'path/to/source/module/something.js', '', [], '', parser as any) as any;
		const addDependencyStub = sandbox.stub<NormalModule>(parser.state.current as any, 'addDependency');
		parser.mockApply('program', getAst(name));

		let wasCalled = false;
		const logStub = sandbox.stub(console, 'log');
		compiler.mockApply('emit', compilation, () => {
			wasCalled = true;
		});
		assert.isTrue(wasCalled, 'should have called the callback');
		assertions({
			addDependencyStub,
			compiler,
			compilation,
			logStub
		});
	};
}

registerSuite({
	name: 'StaticOptimizePlugin',

	before() {
		StaticOptimizePlugin = _StaticOptimizePlugin;
	},

	beforeEach()  {
		sandbox = sinon.sandbox.create();
	},

	afterEach() {
		sandbox.restore();
	},

	'no static flags': runPluginTest({}, 'ast-has', ({ addDependencyStub, compiler, compilation, logStub }) => {
		assert.strictEqual(compiler.plugins['compilation'].length, 2, 'injects two compilation plugins');
		assert.strictEqual(compiler.plugins['emit'].length, 1, 'injects one emit plugin');
		assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
		assert.strictEqual(logStub.secondCall.args[0], 'Dynamic features: foo, bar, baz, qat', 'should have logged properly');
		assert.strictEqual(addDependencyStub.callCount, 0, 'Should not have added a dependency');
	}),

	'getFeatures': {
		before() {
			mockModule = new MockModule('../../src/static-build/StaticOptimizePlugin');
			mockModule.dependencies([ './getFeatures' ]);
			mockGetFeatures = mockModule.getMock('./getFeatures');
			mockGetFeatures.default = sandbox.stub().returns({ foo: true, bar: false });
			StaticOptimizePlugin = mockModule.getModuleUnderTest().default;
		},

		after() {
			mockModule.destroy();
			StaticOptimizePlugin = _StaticOptimizePlugin;
		},

		'should delegate to getFeatures if features are passed': runPluginTest([ 'static' ], 'ast-has', ({ addDependencyStub, logStub }) => {
			assert.strictEqual(mockGetFeatures.default.callCount, 1, 'should have called getFeatures');
			assert.deepEqual(mockGetFeatures.default.firstCall.args, [ [ 'static' ], true ]);
			assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
			assert.strictEqual(logStub.secondCall.args[ 0 ], 'Dynamic features: baz, qat', 'should have logged properly');
			assert.strictEqual(addDependencyStub.callCount, 3, 'Should have replaced 3 expressions');
			assert.strictEqual((addDependencyStub.firstCall.args[ 0 ] as ConstDependency).expression, 'true', 'should be a const "true"');
			assert.deepEqual<any>((addDependencyStub.firstCall.args[ 0 ] as ConstDependency).range, [ 129, 152 ], 'should have proper range');
			assert.strictEqual((addDependencyStub.secondCall.args[ 0 ] as ConstDependency).expression, 'true', 'should be a const "true"');
			assert.deepEqual<any>((addDependencyStub.secondCall.args[ 0 ] as ConstDependency).range, [ 175, 198 ], 'should have proper range');
			assert.strictEqual((addDependencyStub.thirdCall.args[ 0 ] as ConstDependency).expression, 'false', 'should be a const "false"');
			assert.deepEqual<any>((addDependencyStub.thirdCall.args[ 0 ] as ConstDependency).range, [ 286, 309 ], 'should have proper range');
		})
	},

	'static features': runPluginTest({ foo: true, bar: false }, 'ast-has', ({ addDependencyStub, logStub }) => {
		assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
		assert.strictEqual(logStub.secondCall.args[0], 'Dynamic features: baz, qat', 'should have logged properly');
		assert.strictEqual(addDependencyStub.callCount, 3, 'Should have replaced 3 expressions');
		assert.instanceOf(addDependencyStub.firstCall.args[0], ConstDependency);
		assert.strictEqual((addDependencyStub.firstCall.args[0] as ConstDependency).expression, 'true', 'should be a const "true"');
		assert.deepEqual<any>((addDependencyStub.firstCall.args[0] as ConstDependency).range, [ 129, 152 ], 'should have proper range');
		assert.instanceOf(addDependencyStub.secondCall.args[0], ConstDependency);
		assert.strictEqual((addDependencyStub.secondCall.args[0] as ConstDependency).expression, 'true', 'should be a const "true"');
		assert.deepEqual<any>((addDependencyStub.secondCall.args[0] as ConstDependency).range, [ 175, 198 ], 'should have proper range');
		assert.instanceOf(addDependencyStub.thirdCall.args[0], ConstDependency);
		assert.strictEqual((addDependencyStub.thirdCall.args[0] as ConstDependency).expression, 'false', 'should be a const "false"');
		assert.deepEqual<any>((addDependencyStub.thirdCall.args[0] as ConstDependency).range, [ 286, 309 ], 'should have proper range');
	}),

	'imports has - no default expressions': runPluginTest({ foo: true }, 'ast-has-no-default', ({ addDependencyStub, logStub }) => {
		assert.isFalse(logStub.called, 'should not have been called');
		assert.isFalse(addDependencyStub.called, 'should not have been called');
	}),

	'imports has - uses a variable for flag': runPluginTest({ foo: true }, 'ast-has-call-var', ({ addDependencyStub, logStub }) => {
		assert.isFalse(logStub.called, 'should not have been called');
		assert.isFalse(addDependencyStub.called, 'should not have been called');
	}),

	'does not import has': runPluginTest({ foo: true }, 'ast-has-no-import', ({ addDependencyStub, logStub }) => {
		assert.isFalse(logStub.called, 'should not have been called');
		assert.isFalse(addDependencyStub.called, 'should not have been called');
	}),

	'call in call expression': runPluginTest({ foo: true }, 'ast-has-call-in-call', ({ addDependencyStub, logStub }) => {
		assert.isFalse(logStub.called, 'should not have been called');
		assert.strictEqual(addDependencyStub.callCount, 1, 'should have been called once');
		assert.instanceOf(addDependencyStub.firstCall.args[0], ConstDependency);
		assert.strictEqual((addDependencyStub.firstCall.args[0] as ConstDependency).expression, 'true', 'should be a const "true"');
		assert.deepEqual<any>((addDependencyStub.firstCall.args[0] as ConstDependency).range, [ 127, 147 ], 'should have proper range');
	}),

	'no module compilation'() {
		const compiler = new Compiler();
		const compilation = new Compilation();
		const plugin = new StaticOptimizePlugin({});

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation);
		const { normalModuleFactory, parser } = compilation.params;
		normalModuleFactory.mockApply('parser', parser);
		parser.mockApply('program', getAst('ast-has'));
	}
});
