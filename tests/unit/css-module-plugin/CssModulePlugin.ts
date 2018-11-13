import * as path from 'path';
import * as sinon from 'sinon';
import _CssModulePlugin, { default as CssModulePlugin } from '../../../src/css-module-plugin/CssModulePlugin';
import MockModule from '../../support/MockModule';
import { createCompilation, createCompiler } from '../../support/util';

const { assert } = intern.getPlugin('chai');
const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');

interface ModuleInfo {
	context?: string;
	request: string;
	issuer?: string;
}

function runCompilation(plugin: CssModulePlugin, moduleInfo: ModuleInfo) {
	const compiler = createCompiler();
	plugin.apply(compiler);

	compiler.hooks.compilation.tap('CssModulePluginTest', (compilation: any, params: any) => {
		const { normalModuleFactory } = params;
		normalModuleFactory.hooks.beforeResolve.callAsync(moduleInfo, () => undefined);
	});
	createCompilation(compiler);
}

describe('css-module-plugin', () => {
	let mockModule: MockModule;
	let sandbox: sinon.SinonSandbox;
	let mockFs: any;
	let mockPath: any;
	let webpackProxy: any;
	let CssModulePlugin: typeof _CssModulePlugin;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../../src/css-module-plugin/CssModulePlugin', require);
		mockModule.dependencies(['fs', 'path']);
		webpackProxy = {};
		mockModule.proxy('webpack', webpackProxy);
		mockFs = mockModule.getMock('fs');
		mockPath = mockModule.getMock('path');
		CssModulePlugin = mockModule.getModuleUnderTest().default;
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should target .m.css modules and use a function to update requests', () => {
		const nmrPluginStub = (webpackProxy.NormalModuleReplacementPlugin = sandbox
			.stub()
			.returns({ apply: () => {} }));
		const compiler = createCompiler();
		const plugin = new CssModulePlugin('.');
		plugin.apply(compiler);

		const [resourceRegExp, newResource] = nmrPluginStub.firstCall.args;
		assert.strictEqual(resourceRegExp.toString(), '/\\.m\\.css$/', 'Regex does not match css module files');
		assert.equal(typeof newResource, 'function', 'Not using a function for module replacement');
	});

	it('should not modify the request if it does not end with the css module extension', () => {
		const plugin = new CssModulePlugin('base/path');
		const moduleInfo: ModuleInfo[] = [
			{
				request: 'somefile.m.css.js'
			},
			{
				request: 'somefile.css'
			},
			{
				request: 'somefile.m'
			}
		];

		moduleInfo.forEach((moduleInfo) => {
			runCompilation(plugin, moduleInfo);
			assert.isFalse(mockPath.isAbsolute.called, 'Should not have checked for non-css-module request');
		});
	});

	it('should not modify requests if the paths are absolute', () => {
		const plugin = new CssModulePlugin('base/path');
		const createModuleInfo = () => [
			{
				request: 'somefile.m.css'
			},
			{
				request: 'somefile1.m.css'
			},
			{
				request: 'somefile2.m.css'
			}
		];
		const moduleInfo: ModuleInfo[] = createModuleInfo();

		mockPath.isAbsolute.returns(true);
		moduleInfo.forEach((moduleInfo) => {
			runCompilation(plugin, moduleInfo);
		});

		assert.equal(mockPath.isAbsolute.callCount, 3, 'Should have called isAbsolute for each matching module');
		assert.deepEqual(
			mockPath.isAbsolute.args,
			[[moduleInfo[0].request], [moduleInfo[1].request], [moduleInfo[2].request]],
			'Did not pass requests to isAbsolute'
		);

		assert.isFalse(mockPath.resolve.called, 'Should not have resolved any paths for absolute modules');
		assert.deepEqual(moduleInfo, createModuleInfo(), 'Should not have modified requests');
	});

	it('should resolve the request filename against the context or node modules depending on whether it is relative', () => {
		const plugin = new CssModulePlugin('base/path');
		mockPath.isAbsolute.returns(false);
		mockPath.normalize.callsFake((arg: any) => path.normalize(arg));
		mockPath.resolve.callsFake((...args: any[]) => path.resolve(...args));
		const createModuleInfo = () => [
			{
				context: 'different/base',
				request: './relative.m.css'
			},
			{
				request: '/absolute.m.css'
			},
			{
				context: 'different/base',
				request: '@dojo/file.m.css'
			}
		];
		const moduleInfo: ModuleInfo[] = createModuleInfo();
		mockFs.existsSync.returns(false);

		moduleInfo.forEach((moduleInfo) => {
			runCompilation(plugin, moduleInfo);
		});

		const expectedResolveArgs = [
			['different/base', './relative.m.css'],
			['base/path', 'node_modules', '/absolute.m.css'],
			['base/path', 'node_modules', '@dojo/file.m.css']
		];

		assert.equal(mockPath.isAbsolute.callCount, 3, 'Should have called isAbsolute for each matching module');
		assert.equal(mockPath.resolve.callCount, 3, 'Should have called resolve for each non-absolute-path');
		assert.deepEqual(
			mockPath.resolve.firstCall.args,
			expectedResolveArgs[0],
			'Should have resolved relative path according to request context'
		);
		assert.deepEqual(
			mockPath.resolve.secondCall.args,
			expectedResolveArgs[1],
			'Should have resolved absolute path relative to configured base path and node_modules'
		);
		assert.deepEqual(
			mockPath.resolve.thirdCall.args,
			expectedResolveArgs[2],
			'Should have resolved relative path according to request context'
		);
		assert.equal(mockFs.existsSync.callCount, 3, 'Should have called existsSync for the files since ');
		expectedResolveArgs.forEach((pathSegments, i) => {
			assert.deepEqual(
				mockFs.existsSync.args[i],
				[path.resolve(...pathSegments) + '.js'],
				'Should have checked for existence of the corresponding JS file for the css module file'
			);
		});
		assert.deepEqual(moduleInfo, createModuleInfo(), 'Should not alter module info if files do not exist');
	});

	it('should update the request if the corresponding JS file exists', () => {
		const plugin = new CssModulePlugin('base/path');
		mockPath.isAbsolute.returns(false);
		mockPath.normalize.callsFake((arg: any) => path.normalize(arg));
		mockPath.resolve.callsFake((...args: any[]) => path.resolve(...args));
		const createModuleInfo = () => [
			{
				context: 'different/base',
				request: './relative.m.css'
			},
			{
				request: '/absolute.m.css'
			},
			{
				request: '@dojo/file.m.css'
			}
		];
		const moduleInfo: ModuleInfo[] = createModuleInfo();
		mockFs.existsSync.returns(true);

		moduleInfo.forEach((moduleInfo) => {
			runCompilation(plugin, moduleInfo);
		});

		assert.equal(mockPath.isAbsolute.callCount, 3, 'Should have called isAbsolute for each matching module');
		assert.equal(mockPath.resolve.callCount, 3, 'Should have called resolve for each non-absolute-path');
		assert.equal(mockFs.existsSync.callCount, 3, 'Should have called existsSync for the files since ');
		assert.deepEqual(
			moduleInfo,
			createModuleInfo().map((moduleInfo) => {
				moduleInfo.request = moduleInfo.request.replace(/\.m\.css$/, '.m.css.js');
				return moduleInfo;
			}),
			'Should alter module info if files exist'
		);
	});
});
