import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { Program } from 'estree';
import { SinonStub, stub } from 'sinon';
import StaticOptimizePlugin, { StaticHasFeatures } from '../../src/StaticOptimizePlugin';
import Compilation = require('../support/webpack/Compilation');
import Compiler = require('../support/webpack/Compiler');
import ConstDependency = require('webpack/lib/dependencies/ConstDependency');
import NormalModule = require('webpack/lib/NormalModule');

function getAst(name: string): Program {
	return (require as any).nodeRequire((require as any).toUrl(`../support/fixtures/${name}.json`));
}

interface CallbackArgs {
	addDependencyStub: SinonStub;
	compiler: Compiler;
	compilation: Compilation;
	logStub: SinonStub;
}

function runPluginTest(features: StaticHasFeatures, name: string, assertions: (args: CallbackArgs) => void) {
	return function () {
		const compiler = new Compiler();
		const compilation = new Compilation();
		const plugin = new StaticOptimizePlugin(features);

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation);
		const { normalModuleFactory, parser } = compilation.params;
		normalModuleFactory.mockApply('parser', parser);
		parser.state.current = new NormalModule('', 'path/to/source/module/something.js', '', [], '', parser as any) as any;
		const addDependencyStub = stub<NormalModule>(parser.state.current as any, 'addDependency');
		parser.mockApply('program', getAst(name));

		let wasCalled = false;
		const logStub = stub(console, 'log');
		compiler.mockApply('emit', compilation, () => {
			wasCalled = true;
		});
		assert.isTrue(wasCalled, 'should have called the callback');
		logStub.restore();
		addDependencyStub.restore();
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

	'no static flags': runPluginTest({}, 'ast-has', ({ addDependencyStub, compiler, compilation, logStub }) => {
		assert.strictEqual(compiler.plugins['compilation'].length, 2, 'injects two compilation plugins');
		assert.strictEqual(compiler.plugins['emit'].length, 1, 'injects one emit plugin');
		assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
		assert.strictEqual(logStub.secondCall.args[0], 'Dynamic features: foo, bar, baz', 'should have logged properly');
		assert.strictEqual(addDependencyStub.callCount, 0, 'Should not have added a dependency');
	}),

	'static features': runPluginTest({ foo: true, bar: false }, 'ast-has', ({ addDependencyStub, logStub }) => {
		assert.strictEqual(logStub.callCount, 3, 'should have logged to console three time');
		assert.strictEqual(logStub.secondCall.args[0], 'Dynamic features: baz', 'should have logged properly');
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
