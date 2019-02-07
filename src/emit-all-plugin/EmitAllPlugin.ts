import * as path from 'path';
import * as webpack from 'webpack';
import NormalModule = require('webpack/lib/NormalModule');

export interface EmitAllPluginOptions {
	assetFilter?: (key: string, asset: any) => boolean;
	basePath?: string;
	inlineSourceMaps?: boolean;
	legacy?: boolean;
}

const createSource = (content: string) => ({
	source: () => content,
	size: () => Buffer.byteLength(content)
});

export default class EmitAllPlugin {
	private assetFilter: (key: string, asset: any) => boolean;
	private basePath: string;
	private inlineSourceMaps: boolean;
	private legacy: boolean;

	constructor(options: EmitAllPluginOptions = {}) {
		this.basePath = options.basePath || path.join(process.cwd(), 'src');
		this.inlineSourceMaps = Boolean(options.inlineSourceMaps);
		this.legacy = Boolean(options.legacy);
		this.assetFilter = options.assetFilter || (() => true);
	}

	apply(compiler: webpack.Compiler) {
		const { basePath, inlineSourceMaps, legacy } = this;
		compiler.hooks.emit.tap(this.constructor.name, (compilation) => {
			compilation.chunks = [];
			Object.keys(compilation.assets).forEach((key) => {
				if (!this.assetFilter(key, compilation.assets[key])) {
					delete compilation.assets[key];
				}
			});
			compilation.modules.forEach((module: NormalModule) => {
				const { resource } = module;
				if ((resource || '').includes(basePath)) {
					const extension = legacy ? '.js' : '.mjs';
					const source = module.originalSource().source();
					const assetName = resource.replace(basePath, '').replace(/\.ts$/, extension);

					if (assetName.includes('.css')) {
						module.dependencies.forEach(({ identifier, content, sourceMap }: any) => {
							if (identifier.includes(resource)) {
								let css = content;
								if (sourceMap) {
									const { map, url } = this.normalizeSourceMap(
										assetName,
										sourceMap,
										inlineSourceMaps
									);
									css += url;
									if (!inlineSourceMaps) {
										compilation.assets[assetName + '.map'] = createSource(JSON.stringify(map));
									}
								}

								compilation.assets[assetName] = createSource(css);

								const cssjs = source.replace(/\s*\/\/[^\n]*\n/, '');
								compilation.assets[assetName + '.js'] = createSource(cssjs);
							}
						});
					} else {
						const sourceMap = (module.originalSource() as any)._sourceMap;
						let js = source;

						if (sourceMap) {
							const { map, url } = this.normalizeSourceMap(assetName, sourceMap, inlineSourceMaps);
							js += url;

							if (!inlineSourceMaps) {
								compilation.assets[assetName + '.map'] = createSource(JSON.stringify(map));
							}
						}

						compilation.assets[assetName] = createSource(js);
					}
				}
			});
		});
	}

	private normalizeSourceMap(assetName: string, sourceMap: any, inline: boolean) {
		// The source map's `sources` will be absolute paths, leaking details about the system that
		// generated it. Force the `sources` array to contain paths relative to the base path.
		const fixedSourceMap = {
			...sourceMap,
			sources: Array.isArray(sourceMap.sources)
				? sourceMap.sources.map((file: string) => path.relative(this.basePath, file))
				: []
		};
		const url = inline
			? `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
					JSON.stringify(fixedSourceMap)
			  ).toString('base64')}*/`
			: `\n/*# sourceMappingURL=${assetName.split('/').pop()}.map*/`;

		return { map: fixedSourceMap, url };
	}
}
