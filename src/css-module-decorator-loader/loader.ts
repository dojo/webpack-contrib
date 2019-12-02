import { join, basename } from 'path';
import { existsSync } from 'fs';
import * as webpack from 'webpack';

const themeKey = ' _key';

const basePath = process.cwd();
const packageJsonPath = join(basePath, 'package.json');
const packageJson = existsSync(packageJsonPath) ? require(packageJsonPath) : {};
const packageName = packageJson.name || '';

export default function(this: webpack.loader.LoaderContext, content: string, map?: any): string {
	let response = content;
	const localsRexExp = /exports.locals = {([.\s\S]*)};/;
	const matches = content.match(localsRexExp);
	const key = `${packageName}/${basename(this.resourcePath, '.m.css')}`;

	if (matches && matches.length > 0) {
		const localExports = `{"${themeKey}": "${key}",${matches[1]}}`;
		response = content.replace(localsRexExp, `exports.locals = ${localExports};`);
	} else {
		const localExports = `{"${themeKey}": "${key}"}`;
		response = content.replace(
			'// exports',
			`// exports
exports.locals = ${localExports};`
		);
	}

	return response;
}
