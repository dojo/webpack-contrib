import * as webpack from 'webpack';
const WrapperPlugin = require('wrapper-webpack-plugin');

export interface ShimModules {
	module: string;
	has: string;
}

export interface BootstrapPluginOptions {
	entryPath: string;
	shimModules: ShimModules[];
}

const asyncModuleRegExp = /@dojo(\/|\\)webpack-contrib(\/|\\)bootstrap-plugin(\/|\\)async/;
const staticLoaderRegExp = /@dojo(\/|\\)webpack-contrib(\/|\\)static-build-loader/;
const shimModuleRegExp = /@dojo(\/|\\)framework(\/|\\)shim/;

export class BootstrapPlugin {
	public flagMap: { [index: string]: boolean };
	private _entryPath: string;
	private _shimModules: ShimModules[];
	private _defineConfiguration: { [index: string]: string } = {
		__dojoframeworkshimIntersectionObserver: JSON.stringify('no-bootstrap'),
		__dojoframeworkshimWebAnimations: JSON.stringify('no-bootstrap'),
		__dojoframeworkshimResizeObserver: JSON.stringify('no-bootstrap'),
		__dojoframeworkshimfetch: JSON.stringify('no-bootstrap'),
		__dojoframeworkshiminert: JSON.stringify('no-bootstrap'),
		__dojoBuildBlocks: JSON.stringify('build-blocks')
	};

	constructor(options: BootstrapPluginOptions) {
		const { shimModules, entryPath } = options;
		this._entryPath = entryPath;
		this._shimModules = shimModules;
		this.flagMap = shimModules.reduce(
			(flags, module) => {
				flags[module.has.toLowerCase()] = false;
				return flags;
			},
			{
				'no-bootstrap': true
			} as any
		);
		this._defineConfiguration.__MAIN_ENTRY = JSON.stringify(this._entryPath);
		shimModules.forEach((shimModule) => {
			this._defineConfiguration[`__${shimModule.module.replace(/(\/|@)/g, '')}`] = JSON.stringify(
				shimModule.has.toLowerCase()
			);
		});
	}

	apply(compiler: webpack.Compiler) {
		compiler.hooks.compilation.tap(this.constructor.name, (compilation: webpack.Compilation) => {
			compilation.hooks.seal.tap(this.constructor.name, () => {
				compilation.modules.forEach((module: webpack.Module) => {
					const issuer = compilation.moduleGraph.getIssuer(module);
					if (issuer && !asyncModuleRegExp.test(issuer.userRequest)) {
						let matchedModule = -1;
						this._shimModules.some((shimModule, index) => {
							const pattern = new RegExp(shimModule.module.replace(/\//g, '(/|\\\\)'));
							if (pattern.test(module.userRequest)) {
								matchedModule = index;
								this.flagMap[shimModule.has.toLowerCase()] = true;
								return true;
							}
							return false;
						});

						if (/modulePath='.*\.block'/.test(module.userRequest)) {
							this.flagMap['build-blocks'] = true;
						}

						if (matchedModule !== -1) {
							this._shimModules.splice(matchedModule, 1);
						}
					}
				});
			});
		});

		const definePlugin = new webpack.DefinePlugin(this._defineConfiguration);
		const wrapper = new WrapperPlugin({
			test: /(bootstrap.*(\.js$))/,
			header: () => {
				return `var shimFeatures = ${JSON.stringify(this.flagMap)};
if (window.DojoHasEnvironment && window.DojoHasEnvironment.staticFeatures) {
	Object.keys(window.DojoHasEnvironment.staticFeatures).forEach(function (key) {
		shimFeatures[key] = window.DojoHasEnvironment.staticFeatures[key];
	});
}
window.DojoHasEnvironment = { staticFeatures: shimFeatures };`;
			}
		});
		const moduleReplacement = new webpack.NormalModuleReplacementPlugin(shimModuleRegExp, (resource: any) => {
			if (resource.resourceResolveData && asyncModuleRegExp.test(resource.resourceResolveData.context.issuer)) {
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
