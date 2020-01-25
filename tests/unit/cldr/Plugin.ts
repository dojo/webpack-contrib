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

describe('cldr plugin', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/cldr/Plugin', require);
		mockModule.dependencies(['wrapper-webpack-plugin']);

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

	it('should not set i18n feature flags when no i18n formatter modules are used', () => {
		const wrapperStub = mockModule.getMock('wrapper-webpack-plugin');
		wrapperStub.ctor.returns({ apply: () => {} });
		const CldrPlugin = mockModule.getModuleUnderTest().default;
		const cldr = new CldrPlugin();
		cldr.apply(compiler);
		runner['CldrPlugin']({
			hooks: {
				seal: {
					tap: tapStub
				}
			},
			modules: [
				undefined,
				{},
				{
					userRequest: path.normalize('@dojo/framework/core/vdom')
				},
				{
					userRequest: path.normalize('@dojo/framework/core/middleware/i18n')
				},
				{
					userRequest: path.normalize('@dojo/framework/routing/Router')
				}
			]
		});
		runner['CldrPlugin']();
		assert.isTrue(wrapperStub.ctor.calledOnce);
		const header = wrapperStub.ctor.firstCall.args[0].header;

		assert.strictEqual(
			header(),
			`var i18nFeatures = {"__i18n_date__":false,"__i18n_number__":false,"__i18n_unit__":false};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		i18nFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: i18nFeatures };`
		);
	});

	it('should set i18n unit feature flags when the unit formatter is used', () => {
		const wrapperStub = mockModule.getMock('wrapper-webpack-plugin');
		wrapperStub.ctor.returns({ apply: () => {} });
		const CldrPlugin = mockModule.getModuleUnderTest().default;
		const cldr = new CldrPlugin();
		cldr.apply(compiler);
		runner['CldrPlugin']({
			hooks: {
				seal: {
					tap: tapStub
				}
			},
			modules: [
				undefined,
				{},
				{
					userRequest: path.normalize('@dojo/framework/core/vdom')
				},
				{
					userRequest: path.normalize('@dojo/framework/core/middleware/i18n')
				},
				{
					userRequest: path.normalize('@dojo/framework/i18n/unit')
				},
				{
					userRequest: path.normalize('@dojo/framework/routing/Router')
				}
			]
		});
		runner['CldrPlugin']();
		assert.isTrue(wrapperStub.ctor.calledOnce);
		const header = wrapperStub.ctor.firstCall.args[0].header;

		assert.strictEqual(
			header(),
			`var i18nFeatures = {"__i18n_date__":false,"__i18n_number__":false,"__i18n_unit__":true};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		i18nFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: i18nFeatures };`
		);
	});

	it('should set i18n date feature flags when the date formatter is used', () => {
		const wrapperStub = mockModule.getMock('wrapper-webpack-plugin');
		wrapperStub.ctor.returns({ apply: () => {} });
		const CldrPlugin = mockModule.getModuleUnderTest().default;
		const cldr = new CldrPlugin();
		cldr.apply(compiler);
		runner['CldrPlugin']({
			hooks: {
				seal: {
					tap: tapStub
				}
			},
			modules: [
				undefined,
				{},
				{
					userRequest: path.normalize('@dojo/framework/core/vdom')
				},
				{
					userRequest: path.normalize('@dojo/framework/core/middleware/i18n')
				},
				{
					userRequest: path.normalize('@dojo/framework/i18n/date')
				},
				{
					userRequest: path.normalize('@dojo/framework/routing/Router')
				}
			]
		});
		runner['CldrPlugin']();
		assert.isTrue(wrapperStub.ctor.calledOnce);
		const header = wrapperStub.ctor.firstCall.args[0].header;

		assert.strictEqual(
			header(),
			`var i18nFeatures = {"__i18n_date__":true,"__i18n_number__":false,"__i18n_unit__":false};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		i18nFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: i18nFeatures };`
		);
	});

	it('should set i18n number feature flags when the number formatter is used', () => {
		const wrapperStub = mockModule.getMock('wrapper-webpack-plugin');
		wrapperStub.ctor.returns({ apply: () => {} });
		const CldrPlugin = mockModule.getModuleUnderTest().default;
		const cldr = new CldrPlugin();
		cldr.apply(compiler);
		runner['CldrPlugin']({
			hooks: {
				seal: {
					tap: tapStub
				}
			},
			modules: [
				undefined,
				{},
				{
					userRequest: path.normalize('@dojo/framework/core/vdom')
				},
				{
					userRequest: path.normalize('@dojo/framework/core/middleware/i18n')
				},
				{
					userRequest: path.normalize('@dojo/framework/i18n/number')
				},
				{
					userRequest: path.normalize('@dojo/framework/routing/Router')
				}
			]
		});
		runner['CldrPlugin']();
		assert.isTrue(wrapperStub.ctor.calledOnce);
		const header = wrapperStub.ctor.firstCall.args[0].header;

		assert.strictEqual(
			header(),
			`var i18nFeatures = {"__i18n_date__":false,"__i18n_number__":true,"__i18n_unit__":false};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		i18nFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: i18nFeatures };`
		);
	});
});
