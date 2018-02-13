import webpack = require('webpack');
import { join, basename } from 'path';
import { existsSync } from 'fs';

const themeKey = ' _key';

const basePath = process.cwd();
const packageJsonPath = join(basePath, 'package.json');
const packageJson = existsSync(packageJsonPath) ? require(packageJsonPath) : {};
const packageName = packageJson.name || '';

export default function(this: webpack.LoaderContext, content: string, map?: any): string {
	let response = content;
	const localsRexExp = /exports.locals = {([.\s\S]*)};/;
	const matches = content.match(localsRexExp);

	if (matches && matches.length > 0) {
		const key = `${packageName}/${basename(this.resourcePath, '.m.css')}`;
		const localExports = `{"${themeKey}": "${key}",${matches[1]}}`;
		response = content.replace(localsRexExp, `exports.locals = ${localExports};`);
	}

	return response;
}
