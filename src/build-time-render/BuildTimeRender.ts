import { Compiler } from 'webpack';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as path from 'path';

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

export interface BuildTimeRenderArguments {
	root: string;
	entries: string[];
	useManifest?: boolean;
	paths?: (BuildTimePath | string)[];
}

class BuildTimeRender {
	private _paths: any[];
	private _disabled = false;
	private _root: string;
	private _entries: string[];
	private _useManifest: boolean;
	private _hasPaths: boolean;
	private _btrRoot: string;

	constructor(args: BuildTimeRenderArguments) {
		const { paths = [], root = '', useManifest = false, entries } = args;
		this._paths = ['', ...paths];
		this._hasPaths = paths.length > 0;
		this._root = root;
		this._entries = entries;
		this._useManifest = useManifest;
		if (root === '') {
			this._disabled = true;
		}
	}

	private _render(compiler: Compiler, location: string, htmlContent: string, root: string, output: string) {
		const window: Window = new JSDOM(htmlContent, { runScripts: 'outside-only', pretendToBeVisual: true }).window;
		const document: Document = window.document;
		const parent = document.getElementById(root)!;
		if (!this._btrRoot) {
			this._btrRoot = parent.outerHTML;
		}
		let manifest: any = {};
		if (this._useManifest) {
			manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json'), 'utf-8'));
		}
		window.eval(`
window.location.hash = '${location}';
window.DojoHasEnvironment = { staticFeatures: { 'build-time-render': true } };`);

		this._entries.forEach((entry) => {
			entry = this._useManifest ? manifest[`${entry}.js`] : `${entry}.js`;
			const entryContent = readFileSync(path.join(output, entry), 'utf-8');
			window.eval(entryContent);
		});

		const treeWalker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_ELEMENT);
		let classes: string[] = [];

		while (treeWalker.nextNode()) {
			const node = treeWalker.currentNode as HTMLElement;
			node.classList.length && classes.push.apply(classes, node.classList);
		}

		classes = classes.map((className) => `.${className}`);
		return { html: parent.outerHTML, classes };
	}

	public apply(compiler: Compiler) {
		if (this._disabled) {
			return;
		}
		compiler.plugin('done', () => {
			const output = compiler.options.output && compiler.options.output.path;
			if (!output) {
				return;
			}
			let htmlContent = readFileSync(path.join(output, 'index.html'), 'utf-8');
			let manifest: any = {};
			if (this._useManifest) {
				manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json'), 'utf-8'));
			}
			const filterCss = require('filter-css');

			let html: string[] = [];
			let classes: string[] = [];
			const cssFiles: string[] = [];

			this._paths.forEach((path) => {
				path = typeof path === 'object' ? path.path : path;
				const result = this._render(compiler, path, htmlContent, this._root, output);
				classes = [...classes, ...result.classes];
				html = [...html, result.html];
			});

			const result = this._entries.reduce((result, entry: string | undefined) => {
				if (this._useManifest) {
					entry = manifest[`${entry}.css`];
				} else {
					entry = `${entry}.css`;
					const cssExists = existsSync(path.join(output, entry));
					if (!cssExists) {
						entry = undefined;
					}
				}
				if (entry) {
					cssFiles.push(entry);
					const filteredCss = filterCss(path.join(output, entry), (context: string, value: string) => {
						if (context === 'selector') {
							value = value.replace(/(:| ).*/, '');
							const firstChar = value.substr(0, 1);
							if (classes.indexOf(value) !== -1 || ['.', '#'].indexOf(firstChar) === -1) {
								return false;
							}
							return true;
						}
					})
						.replace(/\/\*.*\*\//g, '')
						.replace(/^(\s*)(\r\n?|\n)/gm, '');
					result = `${result}\n${filteredCss}`;
				}
				return result;
			}, '');

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

			const script = this._entries.reduce((script, entry) => {
				entry = this._useManifest ? manifest[`${entry}.js`] : `${entry}.js`;
				script = `${script}<script type="text/javascript" src="${entry}"></script>`;
				return script;
			}, '');
			const css = cssFiles.reduce((css, entry: string | undefined) => {
				htmlContent = htmlContent.replace(
					`<link href="${entry}" rel="stylesheet">`,
					`<style>${result}</style>`
				);
				css = `${css}<link rel="stylesheet" href="${entry}" media="none" onload="if(media!='all')media='all'" />`;
				return css;
			}, '');

			htmlContent = htmlContent.replace(script, `${replacement}${css}${script}`);
			if (!this._hasPaths) {
				htmlContent = htmlContent.replace(this._btrRoot, html[0]);
			}
			writeFileSync(path.join(output, 'index.html'), htmlContent);
		});
	}
}

export default BuildTimeRender;
