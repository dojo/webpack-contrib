import { Compiler } from 'webpack';
import { readFileSync, outputFileSync, existsSync } from 'fs-extra';
import * as path from 'path';
const filterCss = require('filter-css');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

declare global {
	interface Window {
		eval: Function;
		NodeFilter: any;
	}
}

export interface BuildTimePath {
	path: string;
	match: string[];
}

export interface RenderResult {
	path: string;
	html: string;
	styles: string;
}

export interface BuildTimeRenderArguments {
	root: string;
	entries: string[];
	useManifest?: boolean;
	paths?: (BuildTimePath | string)[];
	useHistory?: boolean;
}

class BuildTimeRender {
	private _paths: any[];
	private _disabled = false;
	private _root: string;
	private _entries: string[];
	private _useManifest: boolean;
	private _hasPaths: boolean;
	private _btrRoot: string;
	private _useHistory = false;
	private _manifest: any;
	private _output: string;
	private _originalEntries: string[];
	private _inlinedCssClassNames: string[] = [];

	constructor(args: BuildTimeRenderArguments) {
		const { paths = [], root = '', useManifest = false, entries, useHistory } = args;
		let initialPath = paths[0];

		initialPath = typeof initialPath === 'object' ? initialPath.path : initialPath;
		this._useHistory = useHistory !== undefined ? useHistory : paths.length > 0 && !/^#.*/.test(initialPath);
		this._paths = this._useHistory ? [...paths] : ['', ...paths];
		this._hasPaths = paths.length > 0;
		this._root = root;
		this._entries = entries.map((entry) => `${entry.replace('.js', '')}.js`);
		this._useManifest = useManifest;
		this._originalEntries = [...entries];
		if (root === '' || this._paths.length === 0) {
			this._disabled = true;
		}
	}

	private _generateRouteInjectionScript(html: string[]): string {
		let replacement = '';
		if (this._hasPaths) {
			replacement = `<script>
	(function () {
		var paths = ${JSON.stringify(this._paths)};
		var html = ${JSON.stringify(html)};
		var element = document.getElementById('${this._root}');
		var target;
		paths.some(function (path, i) {
			var match = (typeof path === 'string' && path === window.location.hash) || path && (typeof path === 'object' && path.match && new RegExp(path.match.join('|')).test(window.location.hash));
			if (match) {
				target = html[i];
			}
			return match;
		});
		if (target && element) {
			var frag = document.createRange().createContextualFragment(target);
			element.parentNode.replaceChild(frag, element);
		}
	}())
	</script>`;
		}
		return replacement;
	}

	private _filterCss(classes: string[], cssFiles: string[]) {
		return cssFiles.reduce((result, entry: string) => {
			let filteredCss: string = filterCss(path.join(this._output, entry), (context: string, value: string) => {
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

	private _writeIndexHtml(
		indexContent: string,
		html: string,
		styles: string,
		cssFiles: string[],
		route: string,
		other: string = ''
	) {
		let updatedIndexContent = indexContent;
		const prefix = this._getPrefix(route);
		const css = cssFiles.reduce((css, entry: string | undefined) => {
			updatedIndexContent = updatedIndexContent.replace(
				`<link href="${entry}" rel="stylesheet">`,
				`<style>${styles}</style>`
			);
			css = `${css}<link rel="stylesheet" href="${prefix}${entry}" media="none" onload="if(media!='all')media='all'" />`;
			return css;
		}, '');

		updatedIndexContent = updatedIndexContent.replace(
			this._createScripts(),
			`${other}${css}${this._createScripts(route)}`
		);
		if (!this._hasPaths || this._useHistory) {
			updatedIndexContent = updatedIndexContent.replace(this._btrRoot, html);
		}
		outputFileSync(path.join(this._output, ...route.split('/'), 'index.html'), updatedIndexContent);
	}

	private _getPrefix(route: string) {
		return route
			? `${route
					.split('/')
					.map(() => '..')
					.join('/')}/`
			: '';
	}

	private _createScripts(route = '') {
		const prefix = this._getPrefix(route);
		return this._originalEntries.reduce((script, entry) => {
			entry = this._useManifest ? this._manifest[`${entry}.js`] : `${entry}.js`;
			script = `${script}<script type="text/javascript" src="${prefix}${entry}"></script>`;
			return script;
		}, '');
	}

	private _render(
		compiler: Compiler,
		location: string,
		htmlContent: string,
		root: string,
		cssFiles: string[]
	): Promise<RenderResult> {
		const window: Window = new JSDOM(htmlContent, {
			url: `http://localhost/${location}`,
			runScripts: 'outside-only',
			pretendToBeVisual: true
		}).window;
		const document: Document = window.document;
		const parent = document.getElementById(root)!;
		window.eval(`window.DojoHasEnvironment = { staticFeatures: { 'build-time-render': true } };`);

		this._btrRoot = parent.outerHTML;
		this._entries.forEach((entry) => {
			const entryContent = readFileSync(path.join(this._output, entry), 'utf-8');
			window.eval(entryContent);
		});

		const promise = new Promise<RenderResult>((resolve) => {
			setTimeout(() => {
				const treeWalker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_ELEMENT);
				let classes: string[] = [];

				while (treeWalker.nextNode()) {
					const node = treeWalker.currentNode as HTMLElement;
					node.classList.length && classes.push.apply(classes, node.classList);
				}

				classes = classes.map((className) => `.${className}`);
				const styles = this._filterCss(classes, cssFiles);
				const html = this._useHistory
					? parent.outerHTML.replace(/src="(?!(http(s)?|\/))(.*?)"/g, `src="${this._getPrefix(location)}$3"`)
					: parent.outerHTML;
				resolve({ html, styles, path: location });
			}, 500);
		});
		return promise;
	}

	public apply(compiler: Compiler) {
		if (this._disabled) {
			return;
		}
		compiler.plugin('done', () => {
			if (compiler.options.output && compiler.options.output.path) {
				this._output = compiler.options.output && compiler.options.output.path;
				if (this._useManifest) {
					this._manifest = JSON.parse(readFileSync(path.join(this._output, 'manifest.json'), 'utf-8'));
					const extraEntries = Object.keys(this._manifest)
						.filter((key) => this._entries.indexOf(key) === -1 && /.*\.js$/.test(key))
						.map((key) => this._manifest[key]);
					this._entries = [this._manifest['runtime.js'], ...extraEntries, this._manifest['main.js']];
				}
			} else {
				return Promise.resolve();
			}
			let htmlContent = readFileSync(path.join(this._output, 'index.html'), 'utf-8');
			const cssFiles = this._originalEntries.reduce(
				(cssFiles, entry) => {
					if (this._useManifest && this._manifest[`${entry}.css`]) {
						cssFiles.push(this._manifest[`${entry}.css`]);
					} else {
						entry = `${entry}.css`;
						const cssExists = existsSync(path.join(this._output, entry));
						if (cssExists) {
							cssFiles.push(entry);
						}
					}
					return cssFiles;
				},
				[] as string[]
			);

			const renderPromises = this._paths.map((path) => {
				path = typeof path === 'object' ? path.path : path;
				return this._render(compiler, path, htmlContent, this._root, cssFiles);
			});

			return Promise.all(renderPromises).then((results) => {
				if (this._useHistory) {
					results.map((result) => {
						this._writeIndexHtml(htmlContent, result.html, result.styles, cssFiles, result.path);
					});
				} else {
					const combinedResults = results.reduce(
						(combined, result) => {
							combined.styles = result.styles ? `${combined.styles}\n${result.styles}` : combined.styles;
							combined.html.push(result.html);
							return combined;
						},
						{ styles: '', html: [] } as { styles: string; html: string[] }
					);
					this._writeIndexHtml(
						htmlContent,
						combinedResults.html[0],
						combinedResults.styles,
						cssFiles,
						'',
						this._generateRouteInjectionScript(combinedResults.html)
					);
				}
			});
		});
	}
}

export default BuildTimeRender;
