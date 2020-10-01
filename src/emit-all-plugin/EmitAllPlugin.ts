import * as cssnano from 'cssnano';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as webpack from 'webpack';
import NormalModule = require('webpack/lib/NormalModule');

export interface EmitAllPluginOptions {
	additionalAssets?: string[];
	assetFilter?: (key: string, asset: any) => boolean;
	basePath?: string;
	inlineSourceMaps?: boolean;
	legacy?: boolean;
}

const createSource = (content: string) => ({
	source: () => content,
	size: () => Buffer.byteLength(content)
});

/**
 * @private
 * A custom TS transformer that adds d.ts files to a shared set.
 *
 * Since webpack is a bundler and not normally used to emit individual files, the common TS loaders/plugins do not
 * consider imported `.d.ts` files assets to be emitted. As a result, when building a TypeScript library project,
 * any declaration files imported by the project must be manually injected into the build pipeline to avoid downstream
 * type errors.
 */
function createTransformer<T extends ts.Node>(basePath: string, sharedDeclarationFiles: string[]) {
	return (context: ts.TransformationContext) => {
		const visit: any = (node: any) => {
			if (node.resolvedModules) {
				node.resolvedModules.forEach((value: any) => {
					if (value && value.extension === '.d.ts' && value.resolvedFileName.startsWith(basePath)) {
						sharedDeclarationFiles.push(value.resolvedFileName);
					}
				});
			}
			return ts.visitEachChild(node, (child) => visit(child), context);
		};
		return (node: any) => ts.visitNode(node, visit);
	};
}

/**
 * Generate a plugin instance and TypeScript transformer factory that can be used together to ensure
 * that all desired files are correctly emitted.
 *
 * @param options The plugin options
 */
export function emitAllFactory(options: EmitAllPluginOptions = {}) {
	const basePath = options.basePath || path.join(process.cwd(), 'src');
	const sharedDeclarationFiles = options.additionalAssets ? [...options.additionalAssets] : [];

	return {
		plugin: new EmitAllPlugin({
			...options,
			basePath,
			additionalAssets: sharedDeclarationFiles
		}),
		transformer: createTransformer(basePath, sharedDeclarationFiles)
	};
}

export default class EmitAllPlugin {
	private additionalAssets: string[];
	private assetFilter: (key: string, asset: any) => boolean;
	private basePath: string;
	private inlineSourceMaps: boolean;
	private legacy: boolean;

	constructor(options: EmitAllPluginOptions = {}) {
		this.additionalAssets = options.additionalAssets || [];
		this.assetFilter = options.assetFilter || (() => true);
		this.basePath = options.basePath || path.join(process.cwd(), 'src');
		this.inlineSourceMaps = Boolean(options.inlineSourceMaps);
		this.legacy = Boolean(options.legacy);
	}

	apply(compiler: webpack.Compiler) {
		const { basePath, inlineSourceMaps, legacy } = this;
		compiler.hooks.emit.tapAsync(
			this.constructor.name,
			async (compilation: webpack.Compilation, callback: () => void) => {
				new Set(this.additionalAssets).forEach((file) => {
					if (fs.existsSync(file)) {
						const assetName = file.replace(this.basePath, '').replace(/^(\/|\\)/, '');
						const source = fs.readFileSync(file, 'utf-8').toString();
						compilation.assets[assetName] = createSource(source);
					}
				});

				compilation.chunks = [];
				Object.keys(compilation.assets).forEach((key) => {
					if (!this.assetFilter(key, compilation.assets[key])) {
						delete compilation.assets[key];
					}
				});
				await Promise.all(
					Array.from<NormalModule>(compilation.modules).map(async (module: NormalModule) => {
						const { resource } = module;
						if ((resource || '').includes(basePath)) {
							const extension = legacy ? '.js' : '.mjs';
							const source = module.originalSource().source();
							const assetName = resource.replace(basePath, '').replace(/\.ts(x)?$/, extension);

							if (assetName.includes('.css')) {
								await Promise.all(
									module.dependencies.map(async ({ identifier, content, sourceMap }: any) => {
										if (identifier.includes(resource)) {
											const { css, map } = await this.processCssAsset(
												assetName,
												content,
												sourceMap
											);

											if (sourceMap && !inlineSourceMaps) {
												compilation.assets[assetName + '.map'] = createSource(
													JSON.stringify(map)
												);
											}

											compilation.assets[assetName] = createSource(css);

											const cssjs = source.replace(/\s*\/\/[^\n]*\n/, '');
											compilation.assets[assetName + '.js'] = createSource(cssjs);
										}
									})
								);
							} else {
								const sourceMap = (module.originalSource() as any)._sourceMap;
								let js = source;

								if (sourceMap) {
									const { map, url } = this.normalizeSourceMap(
										assetName,
										sourceMap,
										inlineSourceMaps
									);
									js += url;

									if (!inlineSourceMaps) {
										compilation.assets[assetName + '.map'] = createSource(JSON.stringify(map));
									}
								}

								compilation.assets[assetName] = createSource(js);
							}
						}
					})
				);

				callback();
			}
		);
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
			: `\n/*# sourceMappingURL=${assetName.split(path.sep).pop()}.map*/`;

		return { map: fixedSourceMap, url };
	}

	private async processCssAsset(
		assetName: string,
		content: string,
		sourceMap: any
	): Promise<{ css: string; map?: any }> {
		let { css } = await (cssnano as any).process(
			content,
			{
				from: assetName,
				to: assetName
			},
			{
				preset: ['default', { calc: false }]
			}
		);

		if (sourceMap) {
			const { inlineSourceMaps } = this;
			const { map, url } = this.normalizeSourceMap(assetName, sourceMap, inlineSourceMaps);
			css += url;

			return { css, map };
		}

		return { css };
	}
}
