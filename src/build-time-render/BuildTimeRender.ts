import { Compiler } from 'webpack';
import { readFileSync, outputFileSync, existsSync } from 'fs-extra';

import { join } from 'path';
import {
	serve,
	navigate,
	getClasses,
	getPrefix,
	generateBasePath,
	generateRouteInjectionScript,
	getForSelector,
	setHasFlags
} from './helpers';
const filterCss = require('filter-css');
const puppeteer = require('puppeteer');
const webpack = require('webpack');
const SourceNode = require('source-map').SourceNode;
const SourceMapConsumer = require('source-map').SourceMapConsumer;

export interface RenderResult {
	path?: string | BuildTimePath;
	html: string;
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

export default class BuildTimeRender {
	private _cssFiles: string[] = [];
	private _entries: string[];
	private _head: string;
	private _inlinedCssClassNames: string[] = [];
	private _manifest: any;
	private _manifestContent: any = {};
	private _buildBridgeResult: any = {};
	private _output?: string;
	private _paths: any[];
	private _puppeteerOptions: any;
	private _root: string;
	private _useHistory = false;
	private _basePath = '';

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

	private _writeIndexHtml({ html, script, path = '', styles }: RenderResult) {
		path = typeof path === 'object' ? path.path : path;
		const prefix = getPrefix(path);
		if (this._head) {
			const head = this._head.replace(/href="(?!(http(s)?|\/))(.*?)"/g, `href="${prefix}$3"`);
			html = html.replace(/<head>([\s\S]*?)<\/head>/gm, head);
		}
		const css = this._cssFiles.reduce((css, entry: string | undefined) => {
			html = html.replace(`<link href="${prefix}${entry}" rel="stylesheet">`, `<style>${styles}</style>`);
			css = `${css}<link rel="stylesheet" href="${prefix}${entry}" media="none" onload="if(media!='all')media='all'" />`;
			return css;
		}, '');

		html = html.replace(/^(\s*)(\r\n?|\n)/gm, '').trim();
		html = html.replace(this._createScripts(path), `${script}${css}${this._createScripts(path)}`);
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
					if (!this._useHistory && this._inlinedCssClassNames.indexOf(value) !== -1) {
						return true;
					}
					if (classes.indexOf(value) !== -1 || ['.', '#'].indexOf(firstChar) === -1) {
						this._inlinedCssClassNames.push(value);
						return false;
					}
					return true;
				}
			});

			filteredCss = filteredCss
				.replace(/\/\*.*\*\//g, '')
				.replace(/^(\s*)(\r\n?|\n)/gm, '')
				.trim();
			result = `${result}${filteredCss}`;
			return result;
		}, '');
	}

	private async _getRenderResult(
		page: any,
		path: BuildTimePath | string | undefined = undefined,
		allContents = true
	): Promise<RenderResult> {
		const classes: any[] = await getClasses(page);
		let pathValue = typeof path === 'object' ? path.path : path;
		let html = allContents ? await page.content() : await getForSelector(page, `#${this._root}`);
		let styles = this._filterCss(classes);
		let script = '';
		html = html.replace(/http:\/\/localhost:\d+\//g, '');
		if (this._useHistory) {
			styles = styles.replace(/url\("(?!(http(s)?|\/))(.*?)"/g, `url("${getPrefix(pathValue)}$3"`);
			html = html.replace(/src="(?!(http(s)?|\/))(.*?)"/g, `src="${getPrefix(pathValue)}$3"`);
			script = generateBasePath(pathValue);
		}
		return { html, styles, script, path };
	}

	private async _buildBridge(modulePath: string, args: any[]) {
		try {
			const module = require(`${this._basePath}/${modulePath}`);
			if (module && module.default) {
				const result = await module.default(...args);
				this._buildBridgeResult[modulePath] = this._buildBridgeResult[modulePath] || [];
				this._buildBridgeResult[modulePath].push(
					`window.__dojoBuildBridgeCache['${modulePath}']['${JSON.stringify(args)}'] = ${JSON.stringify(
						result
					)};\n`
				);
				return result;
			}
		} catch (e) {
			console.warn(e);
		}
	}

	private _writeBuildBridgeCache() {
		const chunksToWrite = new Set<string>();
		Object.keys(this._manifestContent).forEach((chunkname: string) => {
			if (/\.js$/.test(chunkname)) {
				const content = this._manifestContent[chunkname];
				Object.keys(this._buildBridgeResult).forEach((modulePath: string) => {
					if (content.indexOf(`/** @preserve dojoBuildBridgeCache '${modulePath}' **/`) !== -1) {
						const sourceMap = this._manifestContent[`${chunkname}.map`];
						const buildBridgeResults = this._buildBridgeResult[modulePath];
						const node = SourceNode.fromStringWithSourceMap(content, new SourceMapConsumer(sourceMap));
						buildBridgeResults.forEach((buildBridgeResult: string) => {
							node.prepend(buildBridgeResult);
						});
						node.prepend(`window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};
window.__dojoBuildBridgeCache['${modulePath}'] = window.__dojoBuildBridgeCache['${modulePath}'] || {};`);
						const source = node.toStringWithSourceMap({ file: chunkname });
						this._manifestContent[chunkname] = source.code;
						this._manifestContent[`${chunkname}.map`] = JSON.stringify(source.map);
						chunksToWrite.add(chunkname);
						chunksToWrite.add(`${chunkname}.map`);
					}
				});
			}
		});
		chunksToWrite.forEach((chunkToWrite) => {
			outputFileSync(
				join(this._output!, this._manifest[chunkToWrite]),
				this._manifestContent[chunkToWrite],
				'utf-8'
			);
		});
	}

	public apply(compiler: Compiler) {
		if (!this._root) {
			return;
		}

		const plugin = new webpack.NormalModuleReplacementPlugin(/\.build/, (resource: any) => {
			const modulePath = join(resource.context, resource.request)
				.replace(this._basePath, '')
				.replace(/^\//, '');
			resource.request = `@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='${modulePath}'!@dojo/webpack-contrib/build-time-render/bridge`;
		});
		plugin.apply(compiler);

		compiler.hooks.afterEmit.tapAsync(this.constructor.name, async (compilation, callback) => {
			this._output = compiler.options.output && compiler.options.output.path;
			if (!this._output) {
				return Promise.resolve().then(() => {
					callback();
				});
			}

			this._manifest = JSON.parse(readFileSync(join(this._output, 'manifest.json'), 'utf-8'));
			this._manifestContent = Object.keys(this._manifest).reduce((obj: any, chunkname: string) => {
				obj[chunkname] = readFileSync(join(this._output!, this._manifest[chunkname]), 'utf-8');
				return obj;
			}, this._manifestContent);

			let originalIndexHtml = readFileSync(join(this._output, 'index.html'), 'utf-8');
			const matchingHead = /<head>([\s\S]*?)<\/head>/.exec(originalIndexHtml);
			if (matchingHead) {
				this._head = matchingHead[0];
			}
			this._cssFiles = this._entries.reduce(
				(files, entry) => {
					const fileName = this._manifest[entry.replace('.js', '.css')] || entry.replace('.js', '.css');
					const exists = existsSync(join(this._output!, fileName));
					if (exists) {
						files.push(fileName);
					}
					return files;
				},
				[] as string[]
			);

			const browser = await puppeteer.launch(this._puppeteerOptions);
			const app = await serve(`${this._output}`);
			try {
				const page = await browser.newPage();
				await setHasFlags(page);
				await page.exposeFunction('__dojoBuildBridge', this._buildBridge.bind(this));
				const wait = page.waitForNavigation({ waitUntil: 'networkidle0' });
				await page.goto(`http://localhost:${app.port}/`);
				await wait;

				if (this._paths.length === 0) {
					const result = await this._getRenderResult(page, undefined);
					this._writeIndexHtml(result);
				} else {
					let renderResults: RenderResult[] = [];
					renderResults.push(await this._getRenderResult(page, undefined, this._useHistory));

					for (let i = 0; i < this._paths.length; i++) {
						let path = typeof this._paths[i] === 'object' ? this._paths[i].path : this._paths[i];
						await navigate(page, this._useHistory, path);
						let result = await this._getRenderResult(page, this._paths[i], this._useHistory);
						renderResults.push(result);
					}

					if (this._useHistory) {
						renderResults.forEach((result) => {
							this._writeIndexHtml(result);
						});
					} else {
						const combined = renderResults.reduce(
							(combined, result) => {
								combined.styles = result.styles
									? `${combined.styles}\n${result.styles}`
									: combined.styles;
								combined.html.push(result.html);
								combined.paths.push(result.path || '');
								return combined;
							},
							{ styles: '', html: [], paths: [] } as {
								paths: (string | BuildTimePath)[];
								styles: string;
								html: string[];
							}
						);
						let html = readFileSync(join(this._output, 'index.html'), 'utf-8');
						const script = generateRouteInjectionScript(combined.html, combined.paths, this._root);
						this._writeIndexHtml({ styles: combined.styles, html, script });
					}
					this._writeBuildBridgeCache();
				}
			} catch (error) {
				throw error;
			} finally {
				await browser.close();
				await app.server.close();
				callback();
			}
		});
	}
}
