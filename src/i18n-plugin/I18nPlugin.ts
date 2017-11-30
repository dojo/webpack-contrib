/* tslint:disable:interface-name */
import { deepAssign } from '@dojo/core/lang';
import { join } from 'path';
import Compiler = require('webpack/lib/Compiler');
import DefinePlugin = require('webpack/lib/DefinePlugin');
import NormalModule = require('webpack/lib/NormalModule');
import Module = require('webpack/lib/Module');
import InjectedModuleDependency from './dependencies/InjectedModuleDependency';

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

		compiler.apply(new DefinePlugin({
			__defaultLocale__: `'${defaultLocale}'`,
			__supportedLocales__: JSON.stringify(supportedLocales),
			__cldrData__: JSON.stringify(this._loadCldrData())
		}));

		compiler.plugin('compilation', (compilation, params) => {
			compilation.dependencyFactories.set(InjectedModuleDependency as any, params.normalModuleFactory);
			compilation.dependencyTemplates.set(InjectedModuleDependency as any, new InjectedModuleDependency.Template());

			compilation.plugin('succeed-module', (module: Module) => {
				if (this.target.test((module as NormalModule).resource)) {
					const dep = new InjectedModuleDependency(join(__dirname, './templates/setLocaleData.js'));
					module.addDependency(dep);
				}
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
