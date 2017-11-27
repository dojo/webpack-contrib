import Compilation = require('../../support/webpack/Compilation');
import CompilationParams = require('../../support/webpack/CompilationParams');
import Compiler = require('../../support/webpack/Compiler');
import NormalModule = require('../../support/webpack/NormalModule');
import I18nPlugin from '../../../src/i18n-plugin/I18nPlugin';
import InjectedModuleDependency from '../../../src/i18n-plugin/dependencies/InjectedModuleDependency';

import { join } from 'path';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach } = intern.getInterface('bdd');

const entryPath = 'some/entry/point.ts';
let compiler: Compiler;

function applyModule(plugin: I18nPlugin, target = entryPath) {
	const compilation = new Compilation();
	const params = new CompilationParams();
	const module = new NormalModule(target, target, target, [], target, {});

	plugin.apply(compiler);
	compiler.mockApply('compilation', compilation, params);
	compilation.mockApply('succeed-module', module);

	return module;
}

describe('I18nPlugin', () => {

	beforeEach(() => {
		compiler = new Compiler();
	});

	it('should convert its target to a regular expression', () => {
		let plugin = new I18nPlugin({ defaultLocale: 'en' });
		assert.strictEqual(plugin.target.toString(), '/src(\\\\|\\/)main\\.ts/');

		plugin = new I18nPlugin({ defaultLocale: 'en', target: 'src\\main.ts' });
		assert.strictEqual(plugin.target.toString(), '/src(\\\\|\\/)main\\.ts/');

		const expected = [ 'path', 'to', 'some', 'entry', 'point\\.js' ].join('(\\\\|\\/)');
		plugin = new I18nPlugin({ defaultLocale: 'en', target: 'path/to/some/entry/point.js' });
		assert.strictEqual(plugin.target.toString(), `/${expected}/`);
	});

	it('should register the custom dependency with the compilation', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const plugin = new I18nPlugin({ defaultLocale: 'en' });

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation, params);

		assert.strictEqual(compilation.dependencyFactories.get(InjectedModuleDependency), params.normalModuleFactory);
		assert.instanceOf(compilation.dependencyTemplates.get(InjectedModuleDependency), InjectedModuleDependency.Template);
	});

	it(`should inject the module into the application's entry point`, () => {
		const plugin = new I18nPlugin({ defaultLocale: 'en', target: entryPath });
		const entry = applyModule(plugin);
		const dep = entry.dependencies[0];

		assert.lengthOf(entry.dependencies, 1);
		assert.instanceOf(dep, InjectedModuleDependency);
		assert.include(dep.request, join('i18n-plugin', 'templates', 'setLocaleData.js'));
	});

	it('should not inject data into other modules', () => {
		const resource = '/resource';
		const plugin = new I18nPlugin({ defaultLocale: 'en' });
		const module = applyModule(plugin, resource);

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
			supportedLocales: [ 'fr' ],
			cldrPaths: [ '{locale}/main.json', 'supplemental.json' ]
				.map(file => join(process.cwd(), 'tests/support/fixtures/cldr/', file))
		});
		applyModule(plugin);

		const { definitions } = compiler.applied[0];
		assert.deepEqual(definitions, {
			__defaultLocale__: `'en'`,
			__supportedLocales__: JSON.stringify([ 'fr' ]),
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
			cldrPaths: [ '{locale}/main.json', 'supplemental.json' ]
				.map(file => join(process.cwd(), 'tests/support/fixtures/cldr/', file))
		});
		applyModule(plugin);

		const { definitions } = compiler.applied[0];
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
		applyModule(plugin);

		const { definitions } = compiler.applied[0];
		assert.deepEqual(definitions, {
			__defaultLocale__: `'en'`,
			__supportedLocales__: '[]',
			__cldrData__: '{}'
		});
	});
});
