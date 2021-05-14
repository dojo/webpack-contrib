const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import MockModule from '../../support/MockModule';
import { stub } from 'sinon';
import * as path from 'path';

let compiler: any;
let mockModule: MockModule;
let runner: any = {};
const tapStub = (name: string, cb: Function) => {
	runner[name] = cb;
};
let defineStub = stub();
let normalReplacementStub = stub();

describe('bootstrap-plugin', () => {
	beforeEach(() => {
		defineStub.reset();
		normalReplacementStub.reset();

		mockModule = new MockModule('../../../src/bootstrap-plugin/BootstrapPlugin', require);
		mockModule.dependencies(['wrapper-webpack-plugin']);

		mockModule.proxy('webpack', {
			DefinePlugin: defineStub.returns({ apply: () => {} }),
			NormalModuleReplacementPlugin: normalReplacementStub.returns({ apply: () => {} })
		});

		compiler = {
			hooks: {
				compilation: {
					tap: tapStub
				},
				normalModuleFactory: {
					tap: stub()
				},
				optimizeChunkAssets: {
					tapAsync: stub()
				}
			}
		};
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('bootstrap', () => {
		const wrapperStub = mockModule.getMock('wrapper-webpack-plugin');
		wrapperStub.ctor.returns({ apply: () => {} });
		const BootstrapPlugin = mockModule.getModuleUnderTest().default;
		const bootstrapPlugin = new BootstrapPlugin({
			entryPath: 'main',
			cssPath: null,
			shimModules: [
				{
					module: '@dojo/framework/shim/Foo',
					has: 'foo'
				},
				{
					module: '@dojo/framework/shim/Bar',
					has: 'bar'
				},
				{
					module: '@dojo/framework/shim/Baz',
					has: 'baz'
				}
			]
		});
		bootstrapPlugin.apply(compiler);
		runner['BootstrapPlugin']({
			hooks: {
				seal: {
					tap: tapStub
				}
			},
			modules: [
				{
					issuer: {
						userRequest: path.normalize('foo/bar')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/shim/Foo')
				},
				{
					issuer: {
						userRequest: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/async')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/shim/Bar')
				},
				{
					issuer: {
						userRequest: path.normalize('foo/bar')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/core/Bar')
				},
				{
					issuer: {
						userRequest: path.normalize('some/other/module')
					},
					userRequest: path.normalize(`foo/bar?modulePath='foo/bar.block'`)
				}
			]
		});
		runner['BootstrapPlugin']();

		assert.deepEqual(bootstrapPlugin.flagMap, {
			bar: false,
			baz: false,
			foo: true,
			'build-blocks': true,
			'no-bootstrap': true
		});

		assert.isTrue(wrapperStub.ctor.calledOnce);
		const header = wrapperStub.ctor.firstCall.args[0].header;

		assert.strictEqual(
			header(),
			`var shimFeatures = {"no-bootstrap":true,"foo":true,"bar":false,"baz":false,"build-blocks":true};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		shimFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: shimFeatures };`
		);

		assert.isTrue(defineStub.calledOnce);
		assert.deepEqual(defineStub.firstCall.args[0], {
			__MAIN_CSS_ENTRY: 'null',
			__MAIN_ENTRY: '"main"',
			__dojoframeworkshimIntersectionObserver: '"no-bootstrap"',
			__dojoframeworkshimWebAnimations: '"no-bootstrap"',
			__dojoframeworkshimResizeObserver: '"no-bootstrap"',
			__dojoframeworkshimfetch: '"no-bootstrap"',
			__dojoframeworkshiminert: '"no-bootstrap"',
			__dojoframeworkshimFoo: '"foo"',
			__dojoframeworkshimBar: '"bar"',
			__dojoBuildBlocks: '"build-blocks"',
			__dojoframeworkshimBaz: '"baz"'
		});
		const [normalReplacementTest, normalReplaceCallback] = normalReplacementStub.firstCall.args;
		const expectedTest = new RegExp('@dojo(/|\\\\)framework(/|\\\\)shim');
		assert.strictEqual(normalReplacementTest.toString(), expectedTest.toString());
		const bootstrapResource = {
			resourceResolveData: {
				context: {
					issuer: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/async')
				}
			},
			request: path.normalize('foo!bar!@dojo/webpack-contrib/static-build-loader!resource'),
			loaders: [
				{
					loader: 'foo'
				},
				{
					loader: path.normalize('@dojo/webpack-contrib/static-build-loader')
				}
			]
		};
		normalReplaceCallback(bootstrapResource);
		assert.deepEqual(bootstrapResource, {
			resourceResolveData: {
				context: { issuer: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/async') }
			},
			request: 'foo!bar!resource',
			loaders: [{ loader: 'foo' }]
		});
		const nonBootstrapResource = {
			resourceResolveData: {
				context: {
					issuer: path.normalize('foo/bar/other')
				}
			},
			request: path.normalize('foo!bar!@dojo/webpack-contrib/static-build-loader!resource'),
			loaders: [
				{
					loader: 'foo'
				},
				{
					loader: path.normalize('@dojo/webpack-contrib/static-build-loader')
				}
			]
		};
		normalReplaceCallback(nonBootstrapResource);
		assert.deepEqual(nonBootstrapResource, {
			resourceResolveData: {
				context: {
					issuer: path.normalize('foo/bar/other')
				}
			},
			request: path.normalize('foo!bar!@dojo/webpack-contrib/static-build-loader!resource'),
			loaders: [
				{
					loader: 'foo'
				},
				{
					loader: path.normalize('@dojo/webpack-contrib/static-build-loader')
				}
			]
		});
	});

	it('bootstrap with css', () => {
		const wrapperStub = mockModule.getMock('wrapper-webpack-plugin');
		wrapperStub.ctor.returns({ apply: () => {} });
		const BootstrapPlugin = mockModule.getModuleUnderTest().default;
		const bootstrapPlugin = new BootstrapPlugin({
			entryPath: 'main',
			cssPath: 'main.css',
			shimModules: [
				{
					module: '@dojo/framework/shim/Foo',
					has: 'foo'
				},
				{
					module: '@dojo/framework/shim/Bar',
					has: 'bar'
				},
				{
					module: '@dojo/framework/shim/Baz',
					has: 'baz'
				}
			]
		});
		bootstrapPlugin.apply(compiler);
		runner['BootstrapPlugin']({
			hooks: {
				seal: {
					tap: tapStub
				}
			},
			modules: [
				{
					issuer: {
						userRequest: path.normalize('foo/bar')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/shim/Foo')
				},
				{
					issuer: {
						userRequest: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/async')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/shim/Bar')
				},
				{
					issuer: {
						userRequest: path.normalize('foo/bar')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/core/Bar')
				},
				{
					issuer: {
						userRequest: path.normalize('some/other/module')
					},
					userRequest: path.normalize(`foo/bar?modulePath='foo/bar.block'`)
				}
			]
		});
		runner['BootstrapPlugin']();

		assert.deepEqual(bootstrapPlugin.flagMap, {
			bar: false,
			baz: false,
			foo: true,
			'build-blocks': true,
			'no-bootstrap': true
		});

		assert.isTrue(wrapperStub.ctor.calledOnce);
		const header = wrapperStub.ctor.firstCall.args[0].header;

		assert.strictEqual(
			header(),
			`var shimFeatures = {"no-bootstrap":true,"foo":true,"bar":false,"baz":false,"build-blocks":true};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		shimFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: shimFeatures };`
		);

		assert.isTrue(defineStub.calledOnce);
		assert.deepEqual(defineStub.firstCall.args[0], {
			__MAIN_CSS_ENTRY: '"main.css"',
			__MAIN_ENTRY: '"main"',
			__dojoframeworkshimIntersectionObserver: '"no-bootstrap"',
			__dojoframeworkshimWebAnimations: '"no-bootstrap"',
			__dojoframeworkshimResizeObserver: '"no-bootstrap"',
			__dojoframeworkshimfetch: '"no-bootstrap"',
			__dojoframeworkshiminert: '"no-bootstrap"',
			__dojoframeworkshimFoo: '"foo"',
			__dojoframeworkshimBar: '"bar"',
			__dojoBuildBlocks: '"build-blocks"',
			__dojoframeworkshimBaz: '"baz"'
		});
		const [normalReplacementTest, normalReplaceCallback] = normalReplacementStub.firstCall.args;
		const expectedTest = new RegExp('@dojo(/|\\\\)framework(/|\\\\)shim');
		assert.strictEqual(normalReplacementTest.toString(), expectedTest.toString());
		const bootstrapResource = {
			resourceResolveData: {
				context: {
					issuer: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/async')
				}
			},
			request: path.normalize('foo!bar!@dojo/webpack-contrib/static-build-loader!resource'),
			loaders: [
				{
					loader: 'foo'
				},
				{
					loader: path.normalize('@dojo/webpack-contrib/static-build-loader')
				}
			]
		};
		normalReplaceCallback(bootstrapResource);
		assert.deepEqual(bootstrapResource, {
			resourceResolveData: {
				context: { issuer: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/async') }
			},
			request: 'foo!bar!resource',
			loaders: [{ loader: 'foo' }]
		});
		const nonBootstrapResource = {
			resourceResolveData: {
				context: {
					issuer: path.normalize('foo/bar/other')
				}
			},
			request: path.normalize('foo!bar!@dojo/webpack-contrib/static-build-loader!resource'),
			loaders: [
				{
					loader: 'foo'
				},
				{
					loader: path.normalize('@dojo/webpack-contrib/static-build-loader')
				}
			]
		};
		normalReplaceCallback(nonBootstrapResource);
		assert.deepEqual(nonBootstrapResource, {
			resourceResolveData: {
				context: {
					issuer: path.normalize('foo/bar/other')
				}
			},
			request: path.normalize('foo!bar!@dojo/webpack-contrib/static-build-loader!resource'),
			loaders: [
				{
					loader: 'foo'
				},
				{
					loader: path.normalize('@dojo/webpack-contrib/static-build-loader')
				}
			]
		});
	});
});
