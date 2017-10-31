/* tslint:disable:interface-name */
import { deepAssign } from '@dojo/core/lang';
import Compiler = require('webpack/lib/Compiler');
import NormalModule = require('webpack/lib/NormalModule');
import ConcatSource = require('webpack-sources/lib/ConcatSource');
import InjectedModuleDependency from './dependencies/InjectedModuleDependency';
import MemorySourcePlugin from '../memory-source-plugin/MemorySourcePlugin';

export interface I18nPluginOptions {
	/**
	 * An optional list of CLDR JSON paths used to inject CLDR data into the application.
	 */
	cldrPaths?: string[];

	/**
	 * The default locale for the application or custom element.
	 */
	defaultLocale: string;

	/**
	 * An optional list of supported locales beyond the default. When the application starts, this list
	 * is checked for the user's locale. If found, then the locale is set to the user's locale. Otherwise,
	 * the default locale is used.
	 */
	supportedLocales?: string[];

	/**
	 * An optional entry point into which the i18n module should be injected. Defaults to 'src/main.ts'.
	 * Since this is compared to the fully-resolved resource path, an extension should be used whenever
	 * possible.
	 */
	target?: string;
}

/**
 * The template string for the i18n module injected into the build and executed on app startup.
 *
 * Note that CLDR data and locales are injected in at build time. `@dojo/i18n/i18n` and `@dojo/i18n/cldr/load`
 * are also injected in at build time in order to mitigate complications with path resolution.
 */
export const i18nModuleSource = `loadCldrData.default(__cldrData__);

var systemLocale = i18n.systemLocale;
var userLocale = systemLocale.replace(/^([a-z]{2}).*/i, '$1');
var isUserLocaleSupported = (userLocale === __defaultLocale__) ||
	__supportedLocales__.some(function (locale) {
		return locale === systemLocale || locale === userLocale;
	});

i18n.switchLocale(isUserLocaleSupported ? systemLocale : __defaultLocale__);`;

/**
 * @private
 * Create a regular expression from a string that can match a file path regardless of the path separator.
 *
 * @param path A file path
 *
 * @return A regular expression that matches a file path pattern
 */
function createFilePathRegExp(path: string): RegExp {
	const pattern = path.replace(/(\/|\\)/g, '(\\\\|\/)').replace(/\./g, '\\.');
	return new RegExp(pattern);
}

/**
 * A custom Webpack plugin that injects into the specified entry point a module responsible to setting the locale
 * and registering CLDR data.
 */
export default class I18nPlugin {
	readonly cldrPaths?: string[];
	readonly defaultLocale: string;
	readonly supportedLocales?: string[];
	readonly target: RegExp;

	constructor({ cldrPaths, defaultLocale, supportedLocales, target = 'src/main.ts' }: I18nPluginOptions) {
		this.cldrPaths = cldrPaths;
		this.defaultLocale = defaultLocale;
		this.supportedLocales = supportedLocales;
		this.target = createFilePathRegExp(target);
	}

	/**
	 * Inject a module that sets the locale and CLDR data for the bundled application or custom element.
	 *
	 * @param compiler The Webpack compiler
	 */
	apply(compiler: Compiler) {
		const { defaultLocale, supportedLocales = [] } = this;
		const i18nModule = new MemorySourcePlugin(i18nModuleSource);
		const cldrData = this._loadCldrData();
		compiler.apply(i18nModule);

		compiler.plugin('compilation', (compilation, params) => {
			compilation.dependencyFactories.set(InjectedModuleDependency as any, params.normalModuleFactory);
			compilation.dependencyTemplates.set(InjectedModuleDependency as any, new InjectedModuleDependency.Template());

			compilation.plugin('succeed-module', (module: NormalModule) => {
				if (this.target.test(module.resource)) {
					const dep = new InjectedModuleDependency(i18nModule.resource);
					module.addDependency(dep);
				}
				else if (module.resource === i18nModule.resource) {
					const i18n = new InjectedModuleDependency('@dojo/i18n/i18n');
					const loadCldrData = new InjectedModuleDependency('@dojo/i18n/cldr/load');
					i18n.variable = 'i18n';
					loadCldrData.variable = 'loadCldrData';
					module.addDependency(i18n);
					module.addDependency(loadCldrData);
				}
			});

			compilation.moduleTemplate.plugin('module', (source, module: NormalModule) => {
				if (module.resource === i18nModule.resource) {
					return new ConcatSource([
						`var __defaultLocale__ = '${defaultLocale}';`,
						`var __supportedLocales__ = ${JSON.stringify(supportedLocales)};`,
						`var __cldrData__ = ${JSON.stringify(cldrData)};`
					].join('\n'), '\n', source);
				}

				return source;
			});
		});
	}

	/**
	 * @private
	 * Load CLDR data from the provided mids and merge the data into a single object.
	 *
	 * @return The CLDR data object
	 */
	private _loadCldrData() {
		if (!Array.isArray(this.cldrPaths) || !this.cldrPaths.length) {
			return {};
		}

		const { defaultLocale, supportedLocales = [] } = this;
		const locales = [ defaultLocale, ...supportedLocales ];

		return this.cldrPaths
			.map(url => {
				return locales.map(locale => url.replace('{locale}', locale));
			})
			.reduce((left, right) => left.concat(right), [])
			.map(mid => require(mid))
			.reduce((cldrData, source) => deepAssign(cldrData, source), Object.create(null));
	}
}
