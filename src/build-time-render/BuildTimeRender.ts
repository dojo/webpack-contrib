import { Compiler } from 'webpack';
import { outputFileSync, removeSync, ensureDirSync } from 'fs-extra';

import { join } from 'path';
import {
	serve,
	getClasses,
	getPrefix,
	generateBasePath,
	generateRouteInjectionScript,
	getScriptSources,
	getForSelector,
	setHasFlags
} from './helpers';
import * as cssnano from 'cssnano';
const filterCss = require('filter-css');
const puppeteer = require('puppeteer');
const webpack = require('webpack');
const SourceNode = require('source-map').SourceNode;
const SourceMapConsumer = require('source-map').SourceMapConsumer;
const postcss = require('postcss');
const clearModule = require('clear-module');
const createHash = require('webpack/lib/util/createHash');
import { parse } from 'node-html-parser';

export interface RenderResult {
	path?: string | BuildTimePath;
	content: string;
	styles: string;
	script: string;
}

export interface BuildTimePath {
	path: string;
	match: string[];
}

export interface BuildTimeRenderArguments {
	root: string;
	entries: string[];
	useManifest?: boolean;
	paths?: (BuildTimePath | string)[];
	useHistory?: boolean;
	puppeteerOptions?: any;
	basePath: string;
}

function genHash(content: string): string {
	return createHash('md4')
		.update(content)
		.digest('hex')
		.substr(0, 20);
}

export default class BuildTimeRender {
	private _cssFiles: string[] = [];
	private _entries: string[];
	private _originalManifest: any;
	private _manifest: any;
	private _manifestContent: any = {};
	private _buildBridgeResult: any = {};
	private _output?: string;
	private _paths: any[];
	private _puppeteerOptions: any;
	private _root: string;
	private _useHistory = false;
	private _basePath = '';
	private _filesToWrite = new Set();
	private _filesToRemove = new Set();
	private _originalRoot: string;
	private _bridgePromises: Promise<any>[] = [];
	private _blockErrors: Error[] = [];
	private _hasBuildBridgeCache = false;

	constructor(args: BuildTimeRenderArguments) {
		const { paths = [], root = '', entries, useHistory, puppeteerOptions, basePath } = args;
		const path = paths[0];
		const initialPath = typeof path === 'object' ? path.path : path;

		this._basePath = basePath;
		this._puppeteerOptions = puppeteerOptions;
		this._paths = paths;
		this._root = root;
		this._entries = entries.map((entry) => `${entry.replace('.js', '')}.js`);
		this._useHistory = useHistory !== undefined ? useHistory : paths.length > 0 && !/^#.*/.test(initialPath);
	}

	private async _writeIndexHtml({ content, script, path = '', styles }: RenderResult) {
		path = typeof path === 'object' ? path.path : path;
		let html = this._manifestContent['index.html'];
		const prefix = getPrefix(path);
		html = html.replace(/href="(?!(http(s)?|\/))(.*?)"/g, `href="${prefix}$3"`);
		html = html.replace(this._originalRoot, content);

		const css = this._entries.reduce((css, entry) => {
			const cssFile = this._manifest[entry.replace('.js', '.css')];
			if (cssFile) {
				html = html.replace(`<link href="${prefix}${cssFile}" rel="stylesheet">`, '');
				css = `${css}<link rel="stylesheet" href="${prefix}${cssFile}" media="none" onload="if(media!='all')media='all'" />`;
			}
			return css;
		}, '');

		styles = await this._processCss(styles);
		html = html.replace(`</head>`, `<style>${styles}</style></head>`);
		html = html.replace(this._createScripts(), `${script}${css}${this._createScripts(path)}`);
		outputFileSync(join(this._output!, ...path.split('/'), 'index.html'), html);
	}

	private _createScripts(path = '') {
		const prefix = this._useHistory ? getPrefix(path) : '';
		return this._entries.reduce(
			(script, entry) =>
				`${script}<script type="text/javascript" src="${prefix}${this._manifest[entry]}"></script>`,
			''
		);
	}

	private _filterCss(classes: string[]): string {
		return this._cssFiles.reduce((result, entry: string) => {
			let filteredCss: string = filterCss(join(this._output!, entry), (context: string, value: string) => {
				if (context === 'selector') {
					value = value.replace(/(:| ).*/, '');
					value = value
						.split('.')
						.slice(0, 2)
						.join('.');
					const firstChar = value.substr(0, 1);

					return classes.indexOf(value) === -1 && ['.', '#'].indexOf(firstChar) !== -1;
				}
			});

			return `${result}${filteredCss}`;
		}, '');
	}

	private async _processCss(css: string) {
		const cssnanoConfig = cssnano({ preset: ['default', { calc: false, normalizeUrl: false }] });
		const processedCss = await postcss([cssnanoConfig]).process(css, { from: undefined });
		return processedCss.css;
	}

	private async _getRenderResult(
		page: any,
		path: BuildTimePath | string | undefined = undefined
	): Promise<RenderResult> {
		const classes: any[] = await getClasses(page);
		let pathValue = typeof path === 'object' ? path.path : path;
		let content = await getForSelector(page, `#${this._root}`);
		let styles = this._filterCss(classes);
		let script = '';
		content = content.replace(/http:\/\/localhost:\d+\//g, '');
		if (this._useHistory) {
			styles = styles.replace(/url\("(?!(http(s)?|\/))(.*?)"/g, `url("${getPrefix(pathValue)}$3"`);
			content = content.replace(/src="(?!(http(s)?|\/))(.*?)"/g, `src="${getPrefix(pathValue)}$3"`);
			script = generateBasePath(pathValue);
		}
		return { content, styles, script, path };
	}

	private async _buildBridge(modulePath: string, id: string, args: any[]) {
		try {
			const module = require(`${this._basePath}/${modulePath}`);
			if (module && module.default) {
				const promise = module.default(...args);
				this._bridgePromises.push(promise);
				const result = await promise;
				this._buildBridgeResult[id] = this._buildBridgeResult[id] || [];
				this._buildBridgeResult[id].push(
					`buildBridgeCache('${id}','${JSON.stringify(args)}', ${JSON.stringify(result)});\n`
				);
				return result;
			}
		} catch (e) {
			this._blockErrors.push(e);
		}
	}

	private _updateSourceAndMap(chunkname: string, source: string, sourceMap: string) {
		this._manifestContent[chunkname] = source;
		this._manifestContent[`${chunkname}.map`] = sourceMap;

		this._filesToRemove.add(this._manifest[chunkname]);
		this._filesToRemove.add(this._manifest[`${chunkname}.map`]);

		let content = this._manifestContent[chunkname];
		const oldHash = this._manifest[chunkname].replace(chunkname.replace('js', ''), '').replace(/\..*/, '');
		const hash = genHash(this._manifestContent[chunkname]);
		content = content.replace(new RegExp(oldHash, 'g'), hash);
		this._manifest[chunkname] = this._manifest[chunkname].replace(oldHash, hash);
		this._manifestContent[chunkname] = content;

		const mapName = `${chunkname}.map`;
		let mapContent = this._manifestContent[mapName];
		mapContent = mapContent.replace(new RegExp(oldHash, 'g'), hash);
		this._manifest[mapName] = this._manifest[mapName].replace(oldHash, hash);
		this._manifestContent[mapName] = mapContent;

		this._filesToWrite.add(chunkname);
		this._filesToWrite.add(mapName);
		return [oldHash, hash];
	}

	private _updateBootstrap(oldHash: string, hash: string) {
		const name = 'bootstrap.js';
		let content = this._manifestContent[name];
		content = content.replace(new RegExp(oldHash, 'g'), hash);
		const mapName = `${name}.map`;
		let mapContent = this._manifestContent[mapName];
		mapContent = mapContent.replace(new RegExp(oldHash, 'g'), hash);
		return this._updateSourceAndMap(name, content, mapContent);
	}

	private _updateHTML(oldHash: string, hash: string) {
		const name = 'index.html';
		let content = this._manifestContent[name];
		content = content.replace(new RegExp(oldHash, 'g'), hash);
		this._manifestContent[name] = content;
		this._filesToWrite.add(name);
	}

	private _createCombinedRenderResult(renderResults: RenderResult[]) {
		const combined = renderResults.reduce(
			(combined, result) => {
				combined.styles = result.styles ? `${combined.styles}\n${result.styles}` : combined.styles;
				combined.html.push(result.content);
				combined.paths.push(result.path || '');
				return combined;
			},
			{ styles: '', html: [], paths: [] } as {
				paths: (string | BuildTimePath)[];
				styles: string;
				html: string[];
			}
		);
		const script = generateRouteInjectionScript(combined.html, combined.paths, this._root);
		return {
			styles: combined.styles,
			content: this._originalRoot,
			script
		};
	}

	private _writeBuildBridgeCache(modules: string[]) {
		if (!Object.keys(this._buildBridgeResult).length) {
			return;
		}
		const buildBridgeCacheFunctionString = `function buildBridgeCache(id, args, value) {
	window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};
	window.__dojoBuildBridgeCache[id] = window.__dojoBuildBridgeCache[id] || {};
	window.__dojoBuildBridgeCache[id][args] = value;
};\n`;
		Object.keys(this._manifestContent)
			.filter((chunkname) => {
				const real = this._originalManifest[chunkname];
				return modules.indexOf(real) > -1;
			})
			.forEach((chunkname) => {
				let modified = false;
				if (/\.js$/.test(chunkname) && this._manifestContent[`${chunkname}.map`]) {
					const content = this._manifestContent[chunkname];
					const sourceMap = this._manifestContent[`${chunkname}.map`];
					const node = SourceNode.fromStringWithSourceMap(content, new SourceMapConsumer(sourceMap));
					Object.keys(this._buildBridgeResult).forEach((id) => {
						if (content.indexOf(`/** @preserve dojoBuildBridgeCache '${id}' **/`) !== -1) {
							const buildBridgeResults = this._buildBridgeResult[id];
							buildBridgeResults.forEach((buildBridgeResult: any) => {
								if (content.indexOf(buildBridgeResult) === -1) {
									node.prepend(buildBridgeResult);
								}
							});
							modified = true;
							this._hasBuildBridgeCache = true;
						}
					});
					if (modified) {
						if (content.indexOf(buildBridgeCacheFunctionString) === -1) {
							node.prepend(buildBridgeCacheFunctionString);
						}
						const result = node.toStringWithSourceMap({ file: chunkname });
						if (this._manifest[chunkname] === chunkname) {
							this._manifestContent[chunkname] = result.code;
							this._manifestContent[`${chunkname}.map`] = JSON.stringify(result.map);
							this._filesToWrite.add(chunkname);
							this._filesToWrite.add(`${chunkname}.map`);
						} else {
							const [oldHash, hash] = this._updateSourceAndMap(
								chunkname,
								result.code,
								JSON.stringify(result.map)
							);
							const [oldBootstrapHash, bootstrapHash] = this._updateBootstrap(oldHash, hash);
							this._updateHTML(oldHash, hash);
							this._updateHTML(oldBootstrapHash, bootstrapHash);
						}
					}
				}
			});
		this._buildBridgeResult = {};
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

	private async _waitForBridge() {
		await Promise.all(this._bridgePromises);
		this._bridgePromises = [];
	}

	private async _createPage(browser: any) {
		const reportError = (err: Error) => {
			err.message = `BTR runtime ${err.message}`;
			this._blockErrors.push(err);
		};
		const page = await browser.newPage();
		page.on('error', reportError);
		page.on('pageerror', reportError);
		await setHasFlags(page);
		await page.exposeFunction('__dojoBuildBridge', this._buildBridge.bind(this));
		return page;
	}

	public apply(compiler: Compiler) {
		if (!this._root) {
			return;
		}

		let id = 0;
		const issuers: string[] = [];
		const plugin = new webpack.NormalModuleReplacementPlugin(/\.block/, (resource: any) => {
			const modulePath = join(resource.context, resource.request)
				.replace(this._basePath, '')
				.replace(/\\/g, '/')
				.replace(/^\//, '');
			const issuer = resource.contextInfo.issuer
				.replace(this._basePath, '')
				.replace(/\\/g, '/')
				.replace(/^\//, '');
			resource.request = `@dojo/webpack-contrib/build-time-render/build-bridge-loader?id='${id++}'&modulePath='${modulePath}'!@dojo/webpack-contrib/build-time-render/bridge`;
			if (issuers.indexOf(issuer) === -1) {
				issuers.push(issuer);
				const newPlugin = new webpack.NormalModuleReplacementPlugin(new RegExp(issuer), (resource: any) => {
					resource.request = `${resource.request}?${id}`;
				});
				newPlugin.apply(compiler);
			}
		});
		plugin.apply(compiler);

		compiler.hooks.afterEmit.tapAsync(this.constructor.name, async (compilation, callback) => {
			this._buildBridgeResult = {};
			this._output = compiler.options.output && compiler.options.output.path;
			if (!this._output) {
				return Promise.resolve().then(() => {
					callback();
				});
			}

			this._manifest = JSON.parse(compilation.assets['manifest.json'].source());
			this._originalManifest = JSON.parse(compilation.assets['manifest.json'].source());
			this._manifestContent = Object.keys(this._manifest).reduce((obj: any, chunkname: string) => {
				obj[chunkname] = compilation.assets[this._manifest[chunkname]].source();
				return obj;
			}, this._manifestContent);

			const html = this._manifestContent['index.html'];
			const root = parse(html);
			const rootNode = root.querySelector(`#${this._root}`);
			if (!rootNode) {
				const error = new Error(
					`Failed to run build time rendering. Could not find DOM node with id: "${
						this._root
					}" in src/index.html`
				);
				compilation.errors.push(error);
				callback();
				return;
			}
			this._originalRoot = `${rootNode.toString()}`;
			this._cssFiles = Object.keys(this._manifest)
				.filter((key) => {
					return /\.css$/.test(key);
				})
				.map((key) => this._manifest[key]);

			clearModule.all();
			const browser = await puppeteer.launch(this._puppeteerOptions);
			const app = await serve(`${this._output}`);
			try {
				const screenshotDirectory = join(this._output, '..', 'info', 'screenshots');
				ensureDirSync(screenshotDirectory);
				let page = await this._createPage(browser);
				const wait = page.waitForNavigation({ waitUntil: 'networkidle0' });
				await page.goto(`http://localhost:${app.port}/`);
				await wait;
				await this._waitForBridge();
				const scripts = await getScriptSources(page, app.port);
				this._writeBuildBridgeCache(scripts);
				await page.screenshot({ path: join(screenshotDirectory, 'default.png') });

				let renderResults: RenderResult[] = [];
				renderResults.push(await this._getRenderResult(page, undefined));
				await page.close();

				for (let i = 0; i < this._paths.length; i++) {
					let path = typeof this._paths[i] === 'object' ? this._paths[i].path : this._paths[i];
					page = await this._createPage(browser);
					const wait = page.waitForNavigation({ waitUntil: 'networkidle0' });
					await page.goto(`http://localhost:${app.port}/${path}`);
					const pathDirectories = path.replace('#', '').split('/');
					if (pathDirectories.length > 0) {
						pathDirectories.pop();
						ensureDirSync(join(screenshotDirectory, ...pathDirectories));
					}
					await wait;
					await this._waitForBridge();
					const scripts = await getScriptSources(page, app.port);
					this._writeBuildBridgeCache(scripts);
					await page.screenshot({ path: join(screenshotDirectory, `${path.replace('#', '')}.png`) });
					let result = await this._getRenderResult(page, this._paths[i]);
					renderResults.push(result);
					await page.close();
				}

				this._writeBuildTimeCacheFiles();

				if (!this._useHistory && this._paths.length) {
					renderResults = [this._createCombinedRenderResult(renderResults)];
				}

				await Promise.all(renderResults.map((result) => this._writeIndexHtml(result)));
				if (this._hasBuildBridgeCache) {
					outputFileSync(
						join(this._output, '..', 'info', 'manifest.original.json'),
						compilation.assets['manifest.json'].source(),
						'utf8'
					);
				}
				if (this._blockErrors.length) {
					compilation.errors.push(...this._blockErrors);
				}
			} catch (error) {
				if (this._blockErrors.length) {
					compilation.errors.push(...this._blockErrors);
				}
				compilation.errors.push(error);
			} finally {
				await browser.close();
				await app.server.close();
				callback();
			}
		});
	}
}
