import { Compiler, compilation } from 'webpack';
import { outputFileSync, removeSync, readFileSync, existsSync, writeFileSync } from 'fs-extra';
// import { StaticPool } from 'node-worker-threads-pool';
import { join } from 'path';
import { createError, generateRouteInjectionScript } from './helpers';

import * as cssnano from 'cssnano';
const webpack = require('webpack');
const postcss = require('postcss');
const createHash = require('webpack/lib/util/createHash');
import { parse, HTMLElement } from 'node-html-parser';
import {
	Renderer,
	BuildTimeRenderPath,
	BuildTimeRenderArguments,
	// RenderWorkerOptions,
	// RenderWorkerData,
	RenderWorkerResult,
	BlockOutput,
	PageResult
} from './interfaces';

const pool = require('node-worker-threads-pool');

function genHash(content: string): string {
	return createHash('md4')
		.update(content)
		.digest('hex')
		.substr(0, 20);
}

function normalizePath(path: string, lowercase = true) {
	path = path
		.replace(/#.*/, '')
		.replace(/\/$/, '')
		.replace(/^\//, '');

	return lowercase ? path.toLowerCase() : path;
}

class MockAsset {
	private _assetPath: string;
	constructor(assetPath: string) {
		this._assetPath = assetPath;
	}

	source() {
		try {
			return readFileSync(this._assetPath, 'utf8');
		} catch {
			return '';
		}
	}
}

class MockCompilation {
	private _manifest: { [index: string]: string };
	public assets: { [index: string]: MockAsset };
	public errors: any[] = [];
	public warnings: any[] = [];
	constructor(output: string) {
		this._manifest = JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8'));
		this.assets = Object.keys(this._manifest).reduce(
			(assets, key) => {
				const asset = new MockAsset(join(output, this._manifest[key]));
				assets[this._manifest[key]] = asset;
				return assets;
			},
			{} as { [index: string]: MockAsset }
		);
		this.assets['manifest.json'] = new MockAsset(join(output, 'manifest.json'));
		this.assets['index.html'] = new MockAsset(join(output, 'btr-index.html'));
	}
}

const dynamicLinkRegExp = /rel\=(\"|\')(preconnect|prefetch|preload|prerender|dns-prefetch|stylesheet)(\"|\')/;

export default class BuildTimeRender {
	private _cssFiles: string[] = [];
	private _entries: string[];
	private _manifest: any;
	private _manifestContent: { [index: string]: string } = {};
	private _blockEntries: string[] = [];
	private _output?: string;
	private _jsonpName?: string;
	private _paths: (BuildTimeRenderPath | string)[] = [''];
	private _static = false;
	private _puppeteerOptions: any;
	private _root: string;
	private _useHistory = false;
	private _basePath = '';
	private _baseUrl: string;
	private _filesToWrite = new Set();
	private _filesToRemove = new Set();
	private _originalRoot!: string;
	private _hasBuildBridgeCache = false;
	private _scope: string;
	private _renderer: Renderer;
	private _discoverPaths: boolean;
	private _sync: boolean;
	private _writeHtml: boolean;
	private _writeCss: boolean;
	private _writtenHtmlFiles: string[] = [];
	private _initialBtr = true;
	private _onDemand = false;
	private _headNodes: string[] = [];
	private _excludedPaths: string[] = [];

	constructor(args: BuildTimeRenderArguments) {
		const {
			paths = [],
			scope,
			root = '',
			entries,
			useHistory,
			puppeteerOptions,
			basePath,
			baseUrl = '/',
			renderer = 'puppeteer',
			discoverPaths = true,
			sync = false,
			writeHtml = true,
			writeCss = true,
			onDemand = false
		} = args;
		const path = paths[0];
		const initialPath = typeof path === 'object' ? path.path : path;

		this._basePath = basePath;
		this._baseUrl = normalizePath(baseUrl, false);
		this._baseUrl = this._baseUrl ? `/${this._baseUrl}/` : '/';

		this._renderer = renderer;
		this._discoverPaths = discoverPaths;
		this._puppeteerOptions = puppeteerOptions;
		for (let i = 0; i < paths.length; i++) {
			const path = paths[i];
			if (typeof path === 'object' && path.exclude) {
				this._excludedPaths.push(normalizePath(path.path, false));
			} else {
				this._paths.push(path);
			}
		}
		this._root = root;
		this._sync = sync;
		this._scope = scope;
		this._onDemand = onDemand;
		this._writeHtml = writeHtml;
		this._writeCss = writeCss;
		this._entries = entries.map((entry) => `${entry.replace('.js', '')}.js`);
		this._useHistory = useHistory !== undefined ? useHistory : paths.length > 0 && !/^#.*/.test(initialPath);
		if (this._useHistory || paths.length === 0) {
			this._static = !!args.static;
		}
	}

	private async _writeIndexHtml({ path, pageResult, blockScripts }: RenderWorkerResult) {
		if (!pageResult) {
			return;
		}
		let { head, content, additionalCss, styles, script, additionalScripts } = pageResult;
		let isStatic = this._static;
		if (typeof path === 'object') {
			if (this._useHistory) {
				isStatic = path.static === undefined ? isStatic : path.static;
			}
			path = path.path;
		} else {
			path = path;
		}

		let html = this._manifestContent['index.html'];
		const writtenAssets: string[] = this._entries.map((entry) => this._manifest[entry]);
		if (this._writeHtml) {
			html = html.replace(this._originalRoot, content);
			if (head.length) {
				head = [...head, ...this._headNodes];
				html = html.replace(/<head>[\s\S]*<\/head>/, `<head>\n\t\t${head.join('\n\t\t')}\n\t</head>`);
			}
			const cssFiles = Object.keys(this._manifest).filter((key) => /\.css$/.test(key));
			let css = cssFiles.reduce((css, file) => {
				const cssFile = this._manifest[file];
				const cssFileRegExp = new RegExp(`<link .*?href="${cssFile}".*?>`);
				if (cssFile && cssFileRegExp.test(html)) {
					html = html.replace(cssFileRegExp, '');
					if (this._entries.indexOf(file.replace('.css', '.js')) !== -1) {
						css = `${css}<link rel="stylesheet" href="${cssFile}" />`;
						writtenAssets.push(cssFile);
					}
				}
				return css;
			}, '');

			css = additionalCss.reduce((prev, url) => {
				url = url.replace(this._baseUrl.slice(1), '');
				writtenAssets.push(url);

				return `${prev}<link rel="preload" href="${url}" as="style">`;
			}, css);

			if (this._writeCss) {
				styles = await this._processCss(styles);
				html = html.replace(`</head>`, `<style>${styles}</style></head>`);
			}

			if (isStatic) {
				html = html.replace(this._createScripts(), '');
			} else {
				html = html.replace(this._createScripts(), `${script}${css}${this._createScripts(false)}`);

				const mainScript = this._manifest['main.js'];

				additionalScripts
					.sort((script1, script2) => {
						return script1 === mainScript && !(script2 === mainScript) ? 1 : -1;
					})
					.forEach((additionalChunk: string) => {
						additionalChunk = additionalChunk.replace(this._baseUrl.slice(1), '');
						writtenAssets.push(additionalChunk);

						html = html.replace(
							'</body>',
							`<link rel="preload" href="${additionalChunk}" as="script"></body>`
						);
					});

				Object.keys(this._manifest)
					.filter((name) => name.endsWith('.js') || name.endsWith('.css'))
					.filter((name) => !name.startsWith('runtime/'))
					.filter((name) => !writtenAssets.some((asset) => this._manifest[name] === asset))
					.forEach((preload) => {
						html = html.replace(
							'</body>',
							`<link rel="prefetch" href="${this._manifest[preload].replace(
								this._baseUrl.slice(1),
								''
							)}" /></body>`
						);
					});
			}
		} else {
			if (!this._sync) {
				html = html.replace(
					'</body>',
					`<script type="text/javascript" src="${this._manifest['runtime/blocks.js']}"></script></body>`
				);
			}
		}
		if (!isStatic) {
			blockScripts.forEach((blockScript, i) => {
				writtenAssets.push(blockScript);
				html = html.replace('</body>', `<script type="text/javascript" src="${blockScript}"></script></body>`);
			});
		}
		const htmlPath = join(this._output!, ...path.split('/'), 'index.html');
		if (path) {
			this._writtenHtmlFiles.push(htmlPath);
		}
		outputFileSync(htmlPath, html);
	}

	private _createScripts(regex = true) {
		const scripts = this._entries.reduce(
			(script, entry) => `${script}<script${regex ? '.*' : ''} src="${this._manifest[entry]}"></script>`,
			''
		);
		return regex ? new RegExp(scripts) : scripts;
	}

	private async _processCss(css: string) {
		const cssnanoConfig = cssnano({ preset: ['default', { calc: false, normalizeUrl: false }] });
		const processedCss = await postcss([cssnanoConfig]).process(css, { from: undefined });
		return processedCss.css;
	}

	private _updateHTML(oldHash: string, hash: string) {
		const name = 'index.html';
		let content = this._manifestContent[name];
		content = content.replace(new RegExp(oldHash, 'g'), hash);
		this._manifestContent[name] = content;
		this._filesToWrite.add(name);
	}

	private _createCombinedRenderResult(renderResults: RenderWorkerResult[]): RenderWorkerResult {
		const paths: string[] = [];
		const content: string[] = [];
		const combinedBlockScripts: string[] = [];
		const combinedPageResult: PageResult = {
			additionalCss: [],
			additionalScripts: [],
			content: this._originalRoot,
			head: [],
			script: '',
			styles: ''
		};
		for (let i = 0; i < renderResults.length; i++) {
			const { path, pageResult, blockScripts } = renderResults[i];
			if (!pageResult) {
				continue;
			}
			combinedPageResult.styles = pageResult.styles
				? `${combinedPageResult.styles}\n${pageResult.styles}`
				: combinedPageResult.styles;
			content.push(pageResult.content);
			paths.push(typeof path === 'object' ? path.path : path);
			combinedBlockScripts.push(...blockScripts);
			combinedPageResult.additionalScripts.push(...pageResult.additionalScripts);
			combinedPageResult.additionalCss.push(...pageResult.additionalCss);
		}
		combinedPageResult.script = generateRouteInjectionScript(content, paths, this._root);
		return {
			blockScripts: combinedBlockScripts,
			pageResult: combinedPageResult,
			blockOutput: {},
			discoveredPaths: [],
			errors: [],
			warnings: [],
			path: ''
		};
	}

	private _writeSyncBuildBridgeCache(blockOutput: BlockOutput) {
		const [, , mainHash] = this._manifest['main.js'].match(/(main\.)(.*)(\.bundle)/) || ([] as any);
		Object.keys(blockOutput).forEach((modulePath) => {
			Object.keys(blockOutput[modulePath]).forEach((args) => {
				this._hasBuildBridgeCache = true;
				const blockResult = blockOutput[modulePath][args];
				const blockCacheEntry = ` blockCacheEntry('${modulePath}', '${args}', ${blockResult});`;
				if (this._manifestContent['main.js'].indexOf(blockCacheEntry) === -1) {
					this._manifestContent['main.js'] = this._manifestContent['main.js'].replace(
						'APPEND_BLOCK_CACHE_ENTRY **/',
						`APPEND_BLOCK_CACHE_ENTRY **/${blockCacheEntry}`
					);
				}

				if (mainHash) {
					const currentMainChunkName = this._manifest['main.js'];
					const currentMainHash = this._manifest['main.js']
						.replace('main.js'.replace('js', ''), '')
						.replace(/\..*/, '');
					const newMainHash = genHash(this._manifestContent['main.js']);

					const mainChunkName = `main.${newMainHash}.bundle.js`;
					this._manifest['main.js'] = mainChunkName;
					this._updateHTML(currentMainHash, newMainHash);
					this._filesToRemove.add(currentMainChunkName);
					this._filesToRemove.add(mainChunkName);
				}
				this._filesToWrite.add('main.js');
			});
		});
		return [];
	}

	private _writeBuildBridgeCache(blockOutput: BlockOutput, additionalScripts: string[]) {
		const scripts: string[] = [];
		const [, , mainHash] = this._manifest['main.js'].match(/(main\.)(.*)(\.bundle)/) || ([] as any);
		const chunkMarker = `main:"${mainHash}",`;
		const blockChunk = 'runtime/blocks.js';
		Object.keys(blockOutput).forEach((modulePath) => {
			Object.keys(blockOutput[modulePath]).forEach((args) => {
				this._hasBuildBridgeCache = true;
				const chunkName = `runtime/block-${genHash(modulePath + args)}`;
				const blockCacheEntry = `blockCacheEntry('${modulePath}', '${args}', '${chunkName}')`;
				const blockResult = blockOutput[modulePath][args];
				const blockResultChunk = `
(window['${this._jsonpName}'] = window['${this._jsonpName}'] || []).push([['${chunkName}'],{
/***/ '${chunkName}.js':
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (${blockResult});
/***/ })
}]);
`;
				if (mainHash) {
					scripts.push(`${chunkName}.${genHash(blockResultChunk)}.bundle.js`);
				} else {
					scripts.push(`${chunkName}.js`);
				}

				if (this._blockEntries.indexOf(blockCacheEntry) === -1) {
					this._blockEntries.push(blockCacheEntry);
					if (this._manifestContent[blockChunk].indexOf(blockCacheEntry) === -1) {
						this._manifestContent[blockChunk] = this._manifestContent[blockChunk].replace(
							'APPEND_BLOCK_CACHE_ENTRY **/',
							`APPEND_BLOCK_CACHE_ENTRY **/
${blockCacheEntry}`
						);
					}
					this._manifest[`${chunkName}.js`] = `${chunkName}.js`;
					if (mainHash) {
						const newBlockHash = genHash(this._manifestContent[blockChunk]);
						const currentBlockChunkName = this._manifest[blockChunk];
						const currentBootstrapChunkName = this._manifest['bootstrap.js'];
						const currentBlockHash = currentBlockChunkName
							.replace(blockChunk.replace('js', ''), '')
							.replace(/\..*/, '');
						const blockResultChunkHash = genHash(blockResultChunk);
						this._manifest[`${chunkName}.js`] = `${chunkName}.${blockResultChunkHash}.bundle.js`;
						this._manifestContent['bootstrap.js'] = this._manifestContent['bootstrap.js'].replace(
							chunkMarker,
							`${chunkMarker}"${chunkName}":"${blockResultChunkHash}",`
						);
						this._manifestContent['bootstrap.js'] = this._manifestContent['bootstrap.js'].replace(
							currentBlockHash,
							newBlockHash
						);
						const currentBootstrapHash = this._manifest['bootstrap.js']
							.replace('bootstrap.js'.replace('js', ''), '')
							.replace(/\..*/, '');
						const newBootstrapHash = genHash(this._manifestContent['bootstrap.js']);
						const bootstrapChunkName = `bootstrap.${newBootstrapHash}.bundle.js`;
						const blockChunkName = `runtime/blocks.${newBlockHash}.bundle.js`;
						this._manifest['bootstrap.js'] = bootstrapChunkName;
						this._manifest[blockChunk] = blockChunkName;
						this._updateHTML(currentBootstrapHash, newBootstrapHash);
						this._updateHTML(currentBlockHash, newBlockHash);
						this._filesToRemove.add(currentBootstrapChunkName);
						this._filesToRemove.add(currentBlockChunkName);
						this._filesToRemove.add(blockChunkName);
						this._filesToRemove.add(bootstrapChunkName);
						this._filesToWrite.add('bootstrap.js');
						const additionalScriptIndex = additionalScripts.indexOf(currentBlockChunkName);
						if (additionalScriptIndex !== -1) {
							additionalScripts[additionalScriptIndex] = blockChunkName;
						}
					}
					this._manifestContent[`${chunkName}.js`] = blockResultChunk;
					this._filesToWrite.add(blockChunk);
					this._filesToWrite.add(`${chunkName}.js`);
				}
			});
		});
		return scripts;
	}

	private _writeBuildTimeCacheFiles() {
		if (this._hasBuildBridgeCache) {
			outputFileSync(join(this._output!, 'manifest.json'), JSON.stringify(this._manifest, null, 2), 'utf-8');
			this._filesToRemove.forEach((name) => {
				removeSync(join(this._output!, name));
			});

			this._filesToRemove = new Set();

			this._filesToWrite.forEach((name) => {
				this._filesToRemove.add(this._manifest[name]);
				outputFileSync(join(this._output!, this._manifest[name]), this._manifestContent[name], 'utf-8');
			});

			this._filesToWrite = new Set();
		}
	}

	private async _run(
		compilation: compilation.Compilation | MockCompilation,
		callback: Function,
		path?: BuildTimeRenderPath
	) {
		try {
			this._blockEntries = [];
			if (!this._output || compilation.errors.length > 0) {
				return;
			}
			path = typeof path === 'string' ? { path } : path;
			const paths = path ? [path] : [...this._paths];
			let pageManifest = paths.map((path) => (typeof path === 'object' ? path.path : path));
			if (this._onDemand && !this._initialBtr && existsSync(join(this._output, 'btr-manifest.json'))) {
				pageManifest = JSON.parse(readFileSync(join(this._output, 'btr-manifest.json'), 'utf8'));
			}
			if (this._onDemand && path && pageManifest.indexOf(path.path) !== -1) {
				removeSync(join(this._output, ...path.path.split('/'), 'index.html'));
			} else {
				let htmlFileToRemove = this._writtenHtmlFiles.pop();
				while (htmlFileToRemove) {
					removeSync(htmlFileToRemove);
					htmlFileToRemove = this._writtenHtmlFiles.pop();
				}
			}

			this._manifest = JSON.parse(compilation.assets['manifest.json'].source());
			this._manifestContent = Object.keys(this._manifest).reduce((obj: any, chunkname: string) => {
				obj[chunkname] = compilation.assets[this._manifest[chunkname]].source();
				return obj;
			}, this._manifestContent);
			const originalManifest = { ...this._manifest };

			const html = this._manifestContent['index.html'];
			const root = parse(html, { script: true, style: true });
			const rootNode = root.querySelector(`#${this._root}`);
			const headNode = root.querySelector('head');

			if (headNode) {
				this._headNodes = (headNode.childNodes.filter((node) => node.nodeType === 1) as HTMLElement[])
					.filter(
						(node) =>
							node.tagName === 'script' ||
							(node.tagName === 'link' && dynamicLinkRegExp.test(node.toString()))
					)
					.map((node) => `${node.toString()}`);
			}
			if (!rootNode) {
				compilation.errors.push(
					createError(undefined, `Could not find DOM node with id: "${this._root}" in src/index.html`)
				);
				return;
			}
			this._originalRoot = `${rootNode.toString()}`;
			this._cssFiles = Object.keys(this._manifest)
				.filter((key) => {
					return /\.css$/.test(key);
				})
				.map((key) => this._manifest[key]);

			const renderWorkerPool = new pool.StaticPool({
				size: 5,
				task: __dirname + '/render-worker.js',
				workerData: {
					root: this._root,
					scope: this._scope,
					output: this._output!,
					cssFiles: this._cssFiles,
					renderType: this._renderer,
					basePath: this._basePath,
					baseUrl: this._baseUrl,
					puppeteerOptions: this._puppeteerOptions,
					initialBtr: this._initialBtr,
					entries: this._entries,
					originalManifest: originalManifest,
					discoverPaths: this._discoverPaths,
					onDemand: this._onDemand,
					useHistory: this._useHistory
				}
			});
			const renderWorkerPromises: Promise<RenderWorkerResult>[] = [];
			let renderWorkerProcessCounter = 0;
			while (paths.length || renderWorkerProcessCounter > 0) {
				let renderPath = paths.pop();
				if (renderPath != null) {
					const path = typeof renderPath === 'object' ? renderPath.path : renderPath;
					const pageExists = existsSync(join(this._output, ...path.split('/'), 'index.html'));
					const isBtrPage = pageManifest.indexOf(path) !== -1;
					if (pageExists && !isBtrPage) {
						console.warn(
							`BTR: The page for path: '${path}' already exists, but was not generated by BTR. Skipping.`
						);
						continue;
					}
					if (!isBtrPage) {
						if (!this._initialBtr) {
							console.warn(
								`On demand BTR: This path (${path}) has not been previously discovered by BTR, please make sure that it is discoverable or included in the btr paths array`
							);
						}
						pageManifest.push(path);
					}
					renderWorkerProcessCounter++;
					const renderWorkerPromise: Promise<RenderWorkerResult> = renderWorkerPool.exec({ renderPath });
					renderWorkerPromise
						.then(({ discoveredPaths }) => {
							discoveredPaths.forEach((newPath: string) => {
								if (
									pageManifest.indexOf(newPath) === -1 &&
									this._excludedPaths.indexOf(newPath) === -1
								) {
									(!this._onDemand || this._initialBtr) && paths.push(newPath);
									pageManifest.push(newPath);
								}
							});

							renderWorkerProcessCounter--;
						})
						.catch(() => {
							createError(path, '');
							renderWorkerProcessCounter--;
						});
					renderWorkerPromises.push(renderWorkerPromise);
				}
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			let renderResults = await Promise.all(renderWorkerPromises);
			renderWorkerPool.destroy();
			for (let i = 0; i < renderResults.length; i++) {
				const renderResult = renderResults[i];
				const { pageResult, blockOutput } = renderResult;
				if (!pageResult) {
					continue;
				}
				if (this._sync) {
					this._writeSyncBuildBridgeCache(blockOutput);
				} else {
					renderResult.blockScripts = this._writeBuildBridgeCache(blockOutput, pageResult.additionalScripts);
				}
				compilation.errors.push(...renderResult.errors);
				compilation.warnings.push(...renderResult.warnings);
			}

			this._writeBuildTimeCacheFiles();

			if (!this._useHistory && this._paths.length > 1) {
				renderResults = [this._createCombinedRenderResult(renderResults)];
			}

			await Promise.all(renderResults.map((renderResult) => this._writeIndexHtml(renderResult)));
			if (this._hasBuildBridgeCache) {
				outputFileSync(
					join(this._output, '..', 'info', 'manifest.original.json'),
					compilation.assets['manifest.json'].source(),
					'utf8'
				);
			}
			outputFileSync(join(this._output, 'btr-manifest.json'), JSON.stringify(pageManifest, null, 4), 'utf8');
		} catch (error) {
			compilation.errors.push(createError('', error));
		} finally {
			this._initialBtr = false;
			callback();
		}
	}

	public runPath(callback: Function, path: string, output: string, jsonpName: string) {
		this._output = output;
		this._jsonpName = jsonpName;
		const compilation = new MockCompilation(this._output);
		path = normalizePath(path);
		const foundPath = this._paths.find((p) => normalizePath(typeof p === 'string' ? p : p.path) === path);
		this._initialBtr = false;
		return this._run(compilation, callback, foundPath || path);
	}

	public apply(compiler: Compiler) {
		if (!this._root) {
			return;
		}

		const plugin = new webpack.NormalModuleReplacementPlugin(/\.block/, (resource: any) => {
			const modulePath = join(resource.context, resource.request)
				.replace(this._basePath, '')
				.replace(/\\/g, '/')
				.replace(/^\//, '');
			resource.request = `@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='${modulePath}'!@dojo/webpack-contrib/build-time-render/bridge`;
		});
		plugin.apply(compiler);

		if (compiler.options.output) {
			this._output = compiler.options.output.path;
			this._jsonpName = compiler.options.output.jsonpFunction;
		}

		compiler.hooks.afterEmit.tapAsync(this.constructor.name, async (compilation, callback) => {
			if (!this._output) {
				return callback();
			}
			writeFileSync(join(this._output, 'btr-index.html'), compilation.assets['index.html'].source(), 'utf8');
			if (this._onDemand && !this._initialBtr) {
				return callback();
			}
			return this._run(compilation, callback);
		});
	}
}
