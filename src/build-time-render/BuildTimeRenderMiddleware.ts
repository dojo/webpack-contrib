import BuildTimeRender, { BuildTimeRenderArguments } from './BuildTimeRender';
import { Request, Response, NextFunction } from 'express';
import * as url from 'url';
import webpack = require('webpack');

export interface OnDemandBuildTimeRenderOptions {
	buildTimeRenderOptions: any;
	scope: string;
	base: string;
	compiler: webpack.Compiler;
	entries: string[];
	outputPath: string;
	jsonpName: string;
}

export class OnDemandBuildTimeRender {
	private _pages = new Set();
	private _btrArgs: BuildTimeRenderArguments;
	private _output: string;
	private _jsonpName: string;
	private _scope: string;
	private _base: string;
	private _active = false;
	private _entries: string[];

	constructor(options: OnDemandBuildTimeRenderOptions) {
		this._btrArgs = options.buildTimeRenderOptions;
		this._output = options.outputPath;
		this._jsonpName = options.jsonpName;
		this._scope = options.scope;
		this._base = options.base;
		this._entries = options.entries;
		options.compiler.hooks.invalid.tap(this.constructor.name, () => {
			this._pages.clear();
			this._active = true;
		});
	}

	public middleware(req: Request, _: Response, next: NextFunction) {
		const { pathname: originalPath } = url.parse(req.url);
		if (
			this._active &&
			req.accepts('html') &&
			originalPath &&
			!originalPath.match(/\..*$/) &&
			!this._pages.has(originalPath)
		) {
			const path = originalPath.replace(/^\//, '').replace(/\/$/, '');
			const btr = new BuildTimeRender({
				...this._btrArgs,
				scope: this._scope,
				baseUrl: this._base,
				basePath: process.cwd(),
				entries: this._entries,
				onDemand: true
			});

			this._pages.add(originalPath);
			btr.runPath(next, path, this._output, this._jsonpName);
		} else {
			next();
		}
	}
}

export default OnDemandBuildTimeRender;
