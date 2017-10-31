import Compilation = require('../../support/webpack/Compilation');
import CompilationParams = require('../../support/webpack/CompilationParams');
import Compiler = require('../../support/webpack/Compiler');
import NormalModule = require('../../support/webpack/NormalModule');
import Source = require('../../support/webpack/Source');
import I18nPlugin, { i18nModuleSource } from '../../../src/i18n-plugin/I18nPlugin';
import InjectedModuleDependency from '../../../src/i18n-plugin/dependencies/InjectedModuleDependency';
import MemorySourcePlugin from '../../../src/memory-source-plugin/MemorySourcePlugin';

import { join } from 'path';
import { stub } from 'sinon';
import { createContext, runInContext } from 'vm';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

let compiler: Compiler;

function applySource(plugin: I18nPlugin) {
	const compilation = new Compilation();
	const params = new CompilationParams();

	plugin.apply(compiler);
	compiler.mockApply('compilation', compilation, params);

	const { resource } = compiler.applied[0];
	const injected = new NormalModule(resource, resource, resource, [], resource, {});
	const [ source ] = compilation.moduleTemplate.mockApply('module', new Source(''), injected);

	return source;
}

describe('I18nPlugin', () => {

	beforeEach(() => {
		compiler = new Compiler();
		compiler.inputFileSystem = {
			stat: stub(),
			statSync: stub(),
			readFile: stub(),
			readFileSync: stub()
		};
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

	it('should add a new MemorySourcePlugin for the injected data', () => {
		const plugin = new I18nPlugin({ defaultLocale: 'en' });
		plugin.apply(compiler);
		assert.instanceOf(compiler.applied[0], MemorySourcePlugin);
		assert.strictEqual(compiler.applied[0].source.toString(), i18nModuleSource);
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
		const target = 'some/entry/point.ts';
		const compilation = new Compilation();
		const params = new CompilationParams();
		const plugin = new I18nPlugin({ defaultLocale: 'en', target });
		const entry = new NormalModule(target, target, target, [], target, {});

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation, params);
		compilation.mockApply('succeed-module', entry);

		const { resource } = compiler.applied[0];
		const dep = entry.dependencies[0];
		assert.lengthOf(entry.dependencies, 1);
		assert.instanceOf(dep, InjectedModuleDependency);
		assert.strictEqual(dep.request, resource);
	});

	it('should import @dojo/i18n/i18n and @dojo/i18n/cldr/load into the injected module', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const plugin = new I18nPlugin({ defaultLocale: 'en' });

		plugin.apply(compiler);

		const { resource } = compiler.applied[0];
		const injected = new NormalModule(resource, resource, resource, [], resource, {});
		compiler.mockApply('compilation', compilation, params);
		compilation.mockApply('succeed-module', injected);

		assert.lengthOf(injected.dependencies, 2);

		const [ i18n, loadCldrData ] = injected.dependencies;
		assert.instanceOf(i18n, InjectedModuleDependency);
		assert.instanceOf(loadCldrData, InjectedModuleDependency);
		assert.strictEqual(i18n.request, '@dojo/i18n/i18n', 'i18n should be imported.');
		assert.strictEqual(loadCldrData.request, '@dojo/i18n/cldr/load', 'The CLDR loader should be imported.');
		assert.strictEqual(i18n.variable, 'i18n', 'i18n should be assigned the `i18n` variable.');
		assert.strictEqual(loadCldrData.variable, 'loadCldrData',
			'The CLDR loader should be assigned the `loadCldrData` variable.');
	});

	it('should not inject data into other modules', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const plugin = new I18nPlugin({ defaultLocale: 'en' });

		plugin.apply(compiler);

		const resource = '/resource';
		const module = new NormalModule(resource, resource, resource, [], resource, {});
		compiler.mockApply('compilation', compilation, params);
		compilation.mockApply('succeed-module', module);

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
		const source = applySource(plugin);

		assert.strictEqual(source.source(), [
			`var __defaultLocale__ = 'en';`,
			`var __supportedLocales__ = ${JSON.stringify([ 'fr' ])};`,
			`var __cldrData__ = ${JSON.stringify(cldrData)};`
		].join('\n') + '\n');
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
		const source = applySource(plugin);

		assert.strictEqual(source.source(), [
			`var __defaultLocale__ = 'en';`,
			`var __supportedLocales__ = [];`,
			`var __cldrData__ = ${JSON.stringify(cldrData)};`
		].join('\n') + '\n');
	});

	it('should allow empty CLDR data', () => {
		const plugin = new I18nPlugin({
			defaultLocale: 'en',
			cldrPaths: []
		});
		const source = applySource(plugin);

		assert.strictEqual(source.source(), [
			`var __defaultLocale__ = 'en';`,
			`var __supportedLocales__ = [];`,
			`var __cldrData__ = {};`
		].join('\n') + '\n');
	});

	it('should not modify the source for other modules', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const plugin = new I18nPlugin({
			defaultLocale: 'en',
			cldrPaths: []
		});

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation, params);

		const resource = '/resource';
		const injected = new NormalModule(resource, resource, resource, [], resource, {});
		const [ source ] = compilation.moduleTemplate.mockApply('module', new Source(''), injected);

		assert.strictEqual(source.source(), '');
	});

	describe('the injected module', () => {
		const loadCldrData = stub();
		const systemLocale = 'xk-CD';
		const switchLocale = stub();
		const modules: any = {
			'@dojo/i18n/i18n': { switchLocale, systemLocale },
			'@dojo/i18n/cldr/load': { 'default': loadCldrData }
		};

		function getTemplate({
			locale = 'en',
			supportedLocales = [],
			cldrData = {}
		}: {
			locale?: string;
			supportedLocales?: string[];
			cldrData?: {}
		} = {}) {
			return [
				`var __defaultLocale__ = '${locale}';`,
				`var __supportedLocales__ = ${JSON.stringify(supportedLocales)};`,
				`var __cldrData__ = ${JSON.stringify(cldrData)};`,
				`var i18n = require('@dojo/i18n/i18n');`,
				`var loadCldrData = require('@dojo/i18n/cldr/load');`,
				i18nModuleSource
			].join('\n');
		}

		afterEach(() => {
			loadCldrData.reset();
			switchLocale.reset();
		});

		it('should use the default locale when the system locale is unsupported', () => {
			const context = createContext({
				require: (mid: string) => modules[mid]
			});

			runInContext(getTemplate(), context);
			assert.isTrue(switchLocale.calledWith('en'));
		});

		it('should use the system locale when it is supported', () => {
			const context = createContext({
				require: (mid: string) => modules[mid]
			});

			runInContext(getTemplate({ supportedLocales: [ 'xk' ] }), context);
			assert.isTrue(switchLocale.calledWith('xk-CD'));
		});

		it('should register CLDR data', () => {
			const cldrData = {};
			const context = createContext({
				require: (mid: string) => modules[mid]
			});

			runInContext(getTemplate({ cldrData }), context);
			assert.isTrue(loadCldrData.calledWith(cldrData));
		});
	});
});
