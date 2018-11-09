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
}

export default class BuildTimeRender {
	private _paths: any[];
	private _useManifest: boolean;
	private _manifest: any;
	private _entries: string[];
	private _root: string;
	private _output?: string;
	private _cssFiles: string[] = [];
	private _useHistory = false;
	private _inlinedCssClassNames: string[] = [];
	private _head: string;
	private _puppeteerOptions: any;

	constructor(args: BuildTimeRenderArguments) {
		const { paths = [], root = '', useManifest = false, entries, useHistory, puppeteerOptions } = args;
		const path = paths[0];
		const initialPath = typeof path === 'object' ? path.path : path;

		this._puppeteerOptions = puppeteerOptions;
		this._paths = paths;
		this._root = root;
		this._useManifest = useManifest;
		this._entries = entries.map((entry) => `${entry.replace('.js', '')}.js`);
		this._manifest = this._entries.reduce(
			(manifest, entry) => {
				manifest[entry] = entry;
				return manifest;
			},
			{} as any
		);
		this._useHistory = useHistory !== undefined ? useHistory : paths.length > 0 && !/^#.*/.test(initialPath);
	}

	private _writeIndexHtml({ html, script, path = '', styles }: RenderResult) {
		path = typeof path === 'object' ? path.path : path;
		const prefix = getPrefix(path);
		if (this._head) {
			html = html.replace(/<head>([\s\S]*?)<\/head>/gm, this._head);
		}
		const css = this._cssFiles.reduce((css, entry: string | undefined) => {
			html = html.replace(`<link href="${entry}" rel="stylesheet">`, `<style>${styles}</style>`);
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
			(script, entry) => `${script}<script type="text/javascript" src="${prefix}${entry}"></script>`,
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
		if (this._useHistory) {
			styles = styles.replace(/url\("(?!(http(s)?|\/))(.*?)"/g, `url("${getPrefix(pathValue)}$3"`);
			html = html.replace(/src="(?!(http(s)?|\/))(.*?)"/g, `src="${getPrefix(pathValue)}$3"`);
			script = generateBasePath(pathValue);
		}
		return { html, styles, script, path };
	}

	public apply(compiler: Compiler) {
		if (!this._root) {
			return;
		}
		compiler.plugin('after-emit', async (compilation, callback) => {
			this._output = compiler.options.output && compiler.options.output.path;
			if (!this._output) {
				return Promise.resolve().then(() => {
					callback();
				});
			}

			if (this._useManifest) {
				this._manifest = JSON.parse(readFileSync(join(this._output, 'manifest.json'), 'utf-8'));
			}

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
