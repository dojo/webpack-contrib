import BuildTimeRender, { BuildTimeRenderArguments } from './BuildTimeRender';
import { Request, Response, NextFunction } from 'express';
import * as url from 'url';

export class OnDemandBuildTimeRender {
	private _pages = new Set();
	private _btrArgs: BuildTimeRenderArguments;
	private _output: string;
	private _jsonpName: string;
	private _libName: string;
	private _base: string;
	private _active = false;
	private _entry: {};

	constructor(args: BuildTimeRenderArguments, config: any, libraryName: string, base: string) {
		this._btrArgs = args;
		this._output = (config.output && config.output.path) || process.cwd();
		this._jsonpName = (config.output && config.output.jsonpFunction) || 'unknown';
		this._libName = libraryName;
		this._base = base || '/';
		this._entry = config.entry;
	}

	public resetPages() {
		this._pages.clear();
	}

	public start() {
		this._active = true;
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
				scope: this._libName,
				baseUrl: this._base,
				basePath: process.cwd(),
				entries: Object.keys(this._entry!)
			});

			this._pages.add(originalPath);
			btr.runPath(next, path, this._output, this._jsonpName);
		} else {
			next();
		}
	}
}
