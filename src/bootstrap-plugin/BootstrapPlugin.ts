import * as webpack from 'webpack';
import * as path from 'path';
const WrapperPlugin = require('wrapper-webpack-plugin');

export interface ShimModules {
	module: string;
	has: string;
}

export interface BootstrapPluginOptions {
	entryPath: string;
	shimModules: ShimModules[];
}

const bootstrapModuleRegExp = new RegExp(path.normalize('@dojo/webpack-contrib/bootstrap-plugin/bootstrap'));
const staticLoaderRegExp = new RegExp(path.normalize('@dojo/webpack-contrib/static-build-loader'));
const shimModuleRegExp = new RegExp(path.normalize('@dojo/framework/shim'));

export class BootstrapPlugin {
	private _entryPath: string;
	private _hasFlagMap: { [index: string]: boolean };
	private _shimModules: ShimModules[];

	constructor(options: BootstrapPluginOptions) {
		const { shimModules, entryPath } = options;
		this._entryPath = entryPath;
		this._shimModules = shimModules;
		this._hasFlagMap = shimModules.reduce(
			(flags, module) => {
				flags[`bootstrap-${module.has.toLowerCase()}`] = false;
				return flags;
			},
			{} as any
		);
	}

	get hasFlagMap() {
		return this._hasFlagMap;
	}

	apply(compiler: webpack.Compiler) {
		compiler.hooks.compilation.tap(this.constructor.name, (compilation) => {
			compilation.hooks.seal.tap(this.constructor.name, () => {
				compilation.modules.forEach((module) => {
					if (module.issuer && !bootstrapModuleRegExp.test(module.issuer.userRequest)) {
						let matchedModule = -1;
						this._shimModules.some((shimModule, index) => {
							const pattern = new RegExp(path.normalize(shimModule.module));
							if (pattern.test(module.userRequest)) {
								matchedModule = index;
								this._hasFlagMap[`bootstrap-${shimModule.has}`] = true;
								return true;
							}
							return false;
						});

						if (matchedModule !== -1) {
							this._shimModules.splice(matchedModule, 1);
						}
					}
				});
			});
		});

		const definePlugin = new webpack.DefinePlugin({
			__MAIN_ENTRY: JSON.stringify(this._entryPath)
		});
		const wrapper = new WrapperPlugin({
			test: /(bootstrap.*(\.js$))/,
			header: () => {
				return `var shimFeatures = ${JSON.stringify(this._hasFlagMap)};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		shimFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: shimFeatures };`;
			}
		});
		const moduleReplacement = new webpack.NormalModuleReplacementPlugin(shimModuleRegExp, (resource: any) => {
			if (
				resource.resourceResolveData &&
				bootstrapModuleRegExp.test(resource.resourceResolveData.context.issuer)
			) {
				const parts = resource.request.split('!');
				const newRequest = parts.filter((part: string) => !staticLoaderRegExp.test(part)).join('!');
				resource.loaders = resource.loaders.filter((loader: any) => !staticLoaderRegExp.test(loader.loader));
				resource.request = newRequest;
			}
		});

		definePlugin.apply(compiler);
		wrapper.apply(compiler);
		moduleReplacement.apply(compiler);
	}
}

export default BootstrapPlugin;
