import * as webpack from 'webpack';
const WrapperPlugin = require('wrapper-webpack-plugin');

const i18nNumberRegExp = /@dojo(\/|\\)framework(\/|\\)i18n(\/|\\)number/;
const i18nDateRegExp = /@dojo(\/|\\)framework(\/|\\)i18n(\/|\\)date/;
const i18nUnitRegExp = /@dojo(\/|\\)framework(\/|\\)i18n(\/|\\)unit/;
const i18nRegExp = /@dojo(\/|\\)framework(\/|\\)i18n/;

export class CldrPlugin {
	private _defineConfiguration = {
		__i18n_date_time__: false,
		__i18n_currency__: false,
		__i18n_unit__: false,
		__i18n__: false
	};

	apply(compiler: webpack.Compiler) {
		compiler.hooks.compilation.tap(this.constructor.name, (compilation) => {
			compilation.hooks.seal.tap(this.constructor.name, () => {
				compilation.modules.forEach((module) => {
					if (module && module.userRequest) {
						if (i18nRegExp.test(module.userRequest)) {
							this._defineConfiguration.__i18n__ = true;
						}
						if (i18nNumberRegExp.test(module.userRequest)) {
							this._defineConfiguration.__i18n_currency__ = true;
						}
						if (i18nDateRegExp.test(module.userRequest)) {
							this._defineConfiguration.__i18n_date_time__ = true;
						}
						if (i18nUnitRegExp.test(module.userRequest)) {
							this._defineConfiguration.__i18n_unit__ = true;
						}
					}
				});
			});
		});
		const wrapper = new WrapperPlugin({
			test: /(bootstrap.*(\.js$))/,
			header: () => {
				return `var i18nFeatures = ${JSON.stringify(this._defineConfiguration)};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		i18nFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: i18nFeatures };`;
			}
		});
		wrapper.apply(compiler);
	}
}

export default CldrPlugin;