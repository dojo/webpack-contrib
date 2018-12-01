const { beforeEach, describe, it } = intern.getInterface('bdd');
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

	it('bootstrap', () => {
		const wrapperStub = mockModule.getMock('wrapper-webpack-plugin');
		wrapperStub.ctor.returns({ apply: () => {} });
		const BootstrapPlugin = mockModule.getModuleUnderTest().default;
		const bootstrapPlugin = new BootstrapPlugin({
			entryPath: 'main',
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
						userRequest: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/bootstrap')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/shim/Bar')
				},
				{
					issuer: {
						userRequest: path.normalize('foo/bar')
					},
					userRequest: path.normalize('foo/bar/@dojo/framework/core/Bar')
				}
			]
		});
		runner['BootstrapPlugin']();

		assert.deepEqual(bootstrapPlugin.hasFlagMap, {
			'bootstrap-foo': true,
			'bootstrap-bar': false,
			'bootstrap-baz': false
		});

		assert.isTrue(wrapperStub.ctor.calledOnce);
		const header = wrapperStub.ctor.firstCall.args[0].header;

		assert.strictEqual(
			header(),
			`var shimFeatures = {"bootstrap-foo":true,"bootstrap-bar":false,"bootstrap-baz":false};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		shimFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: shimFeatures };`
		);

		assert.isTrue(defineStub.calledOnce);
		assert.deepEqual(defineStub.firstCall.args[0], { __MAIN_ENTRY: '"main"' });
		const [normalReplacementTest, normalReplaceCallback] = normalReplacementStub.firstCall.args;
		const expectedTest = new RegExp(path.normalize('@dojo/framework/shim'));
		assert.strictEqual(normalReplacementTest.toString(), expectedTest.toString());
		const bootstrapResource = {
			resourceResolveData: {
				context: {
					issuer: path.normalize('foo/bar/@dojo/webpack-contrib/bootstrap-plugin/bootstrap')
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
				context: { issuer: 'foo/bar/@dojo/webpack-contrib/bootstrap-plugin/bootstrap' }
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
