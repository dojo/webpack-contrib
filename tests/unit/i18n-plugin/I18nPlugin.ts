import { join } from 'path';
import * as sinon from 'sinon';
import { Compiler } from 'webpack';
import NormalModule = require('webpack/lib/NormalModule');
import _I18nPlugin, { default as I18nPlugin } from '../../../src/i18n-plugin/I18nPlugin';
import MockModule from '../../support/MockModule';
import { createCompilation, createCompiler } from '../../support/util';

const { assert } = intern.getPlugin('chai');
const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');

const entryPath = 'some/entry/point.ts';

function applyModule(compiler: Compiler, plugin: I18nPlugin, target = entryPath) {
	plugin.apply(compiler);

	const compilation = createCompilation(compiler);
	const module = new NormalModule({
		type: 'javascript',
		request: target,
		userRequest: target,
		rawRequest: target,
		loaders: [],
		resource: target,
		parser: { parse: () => {} }
	});
	compilation.hooks.succeedModule.call(module);

	return module;
}

describe('I18nPlugin', () => {
	let compiler: Compiler;
	let I18nPlugin: typeof _I18nPlugin;
	let InjectedModuleDependency: any;
	let mockModule: MockModule;
	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../../src/i18n-plugin/I18nPlugin', require);
		mockModule.dependencies(['./dependencies/InjectedModuleDependency']);
		mockModule.proxy('webpack', {
			DefinePlugin: sinon.stub().returns({ apply: () => {} })
		});
		I18nPlugin = mockModule.getModuleUnderTest().default;
		InjectedModuleDependency = mockModule.getMock('./dependencies/InjectedModuleDependency').default;
		InjectedModuleDependency.callsFake((request: string) => ({ request }));
		InjectedModuleDependency.Template = class {};
		compiler = createCompiler();
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should convert its target to a regular expression', () => {
		let plugin = new I18nPlugin({ defaultLocale: 'en' });
		assert.strictEqual(plugin.target.toString(), '/src(\\\\|\\/)main\\.ts/');

		plugin = new I18nPlugin({ defaultLocale: 'en', target: 'src\\main.ts' });
		assert.strictEqual(plugin.target.toString(), '/src(\\\\|\\/)main\\.ts/');

		const expected = ['path', 'to', 'some', 'entry', 'point\\.js'].join('(\\\\|\\/)');
		plugin = new I18nPlugin({ defaultLocale: 'en', target: 'path/to/some/entry/point.js' });
		assert.strictEqual(plugin.target.toString(), `/${expected}/`);
	});

	it('should register the custom dependency with the compilation', () => {
		const plugin = new I18nPlugin({ defaultLocale: 'en' });

		plugin.apply(compiler);
		compiler.hooks.compilation.tap('I18nPluginTest', (compilation: any, params: any) => {
			const { dependencyFactories, dependencyTemplates } = compilation;
			const { normalModuleFactory } = params;
			assert.strictEqual(dependencyFactories.get(InjectedModuleDependency), normalModuleFactory);
			assert.instanceOf(dependencyTemplates.get(InjectedModuleDependency), InjectedModuleDependency.Template);
		});
		createCompilation(compiler);
	});

	it(`should inject the module into the application's entry point`, () => {
		const plugin = new I18nPlugin({ defaultLocale: 'en', target: entryPath });
		const entry = applyModule(compiler, plugin);
		const dep: any = entry.dependencies[0];

		assert.lengthOf(entry.dependencies, 1);
		assert.include(dep.request, join('i18n-plugin', 'templates', 'setLocaleData.js'));
	});

	it('should not inject data into other modules', () => {
		const resource = '/resource';
		const plugin = new I18nPlugin({ defaultLocale: 'en' });
		const module = applyModule(compiler, plugin, resource);

		assert.lengthOf(module.dependencies, 0);
	});

	it('should add locale data to the injected module', () => {
		const cldrData = {
			en: { main: {} },
			fr: { main: {} },
			supplemental: {}
		};
		const plugin = new I18nPlugin({
			defaultLocale: 'en',
			supportedLocales: ['fr'],
			cldrPaths: ['{locale}/main.json', 'supplemental.json'].map((file) =>
				join(process.cwd(), 'tests/support/fixtures/cldr/', file)
			)
		});
		applyModule(compiler, plugin);

		const [definitions] = mockModule.getMock('webpack').DefinePlugin.firstCall.args;
		assert.deepEqual(definitions, {
			__defaultLocale__: `'en'`,
			__supportedLocales__: JSON.stringify(['fr']),
			__cldrData__: JSON.stringify(cldrData)
		});
	});

	it('should include CLDR data for the default locale even without supported locales', () => {
		const cldrData = {
			en: { main: {} },
			supplemental: {}
		};
		const plugin = new I18nPlugin({
			defaultLocale: 'en',
			cldrPaths: ['{locale}/main.json', 'supplemental.json'].map((file) => {
				return `./tests/support/fixtures/cldr/${file}`;
			})
		});
		applyModule(compiler, plugin);

		const [definitions] = mockModule.getMock('webpack').DefinePlugin.firstCall.args;
		assert.deepEqual(definitions, {
			__defaultLocale__: `'en'`,
			__supportedLocales__: '[]',
			__cldrData__: JSON.stringify(cldrData)
		});
	});

	it('should allow empty CLDR data', () => {
		const plugin = new I18nPlugin({
			defaultLocale: 'en',
			cldrPaths: []
		});
		applyModule(compiler, plugin);

		const [definitions] = mockModule.getMock('webpack').DefinePlugin.firstCall.args;
		assert.deepEqual(definitions, {
			__defaultLocale__: `'en'`,
			__supportedLocales__: '[]',
			__cldrData__: '{}'
		});
	});
});
