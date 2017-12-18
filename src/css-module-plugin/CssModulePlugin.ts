import { existsSync } from 'fs';
import { normalize, sep, isAbsolute, resolve } from 'path';
import { Compiler, NormalModuleReplacementPlugin } from 'webpack';
import NormalModuleFactory = require('webpack/lib/NormalModuleFactory');

/**
 * Test whether a module ID is relative or absolute.
 *
 * @param id
 * The module ID.
 *
 * @return
 * `true` if the path is relative; `false` otherwise.
 */
function isRelative(id: string): boolean {
	const first = normalize(id.charAt(0));
	return first !== sep && first !== '@' && /^\W/.test(id);
}

export default class CssModulePlugin {
	private basePath: string;

	constructor(basePath: string) {
		this.basePath = basePath;
	}

	apply(compiler: Compiler) {
		compiler.apply(
			new NormalModuleReplacementPlugin(/\.m\.css$/, (result: NormalModuleFactory.BeforeData) => {
				if (isAbsolute(result.request)) {
					return;
				}
				const requestFileName = isRelative(result.request)
					? resolve(result.context, result.request)
					: resolve(this.basePath, 'node_modules', result.request);
				const jsFileName = requestFileName + '.js';

				if (existsSync(jsFileName)) {
					result.request = result.request.replace(/\.m\.css$/, '.m.css.js');
				}
			})
		);
	}
}
