import { getOptions } from 'loader-utils';
import * as ts from 'typescript';
import * as path from 'path';
import * as webpack from 'webpack';
import LoaderContext = webpack.loader.LoaderContext;
import { discoverDescriptor } from './discoverDescriptor';

interface WidgetConfig {
	path: string;
	tag?: string;
	name?: string;
}

export default function(this: LoaderContext, source: string) {
	const options = getOptions(this) || {};
	const widgets: WidgetConfig[] = options.widgets || [];
	const elementPrefix = options.elementPrefix || '';

	const fullWidgetPaths: Record<string, string> = {};

	widgets.forEach((widget) => {
		fullWidgetPaths[widget.path] = require.resolve(path.resolve(widget.path));
	});

	const program = ts.createProgram(widgets.map((widget) => fullWidgetPaths[widget.path]), {
		jsx: ts.JsxEmit.Preserve,
		jsxFactory: 'tsx'
	});
	const checker = program.getTypeChecker();

	widgets.forEach((widget) => {
		const sourceFile = program.getSourceFile(fullWidgetPaths[widget.path]);

		if (sourceFile) {
			const descriptor = discoverDescriptor(sourceFile, checker);

			if (descriptor) {
				const tagName = `${elementPrefix}-${widget.tag || descriptor.tagName}`;
				const chunkName = widget.name ? `/* webpackChunkName: '${widget.name}' */ ` : '';
				let registration = `registerCustomElement(() => useDefault(import(${chunkName}'${
					widget.path
				}')), ${JSON.stringify({
					...descriptor,
					tagName
				})});`;
				registration = registration.replace(`"${tagName}"`, `useNamespace("${tagName}")`);
				source += registration;
			}
		}
	});

	return source;
}
