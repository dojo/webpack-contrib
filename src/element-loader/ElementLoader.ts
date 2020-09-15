import { getOptions } from 'loader-utils';
import * as ts from 'typescript';
import * as path from 'path';
import { discoverDescriptor } from './discoverDescriptor';

interface WidgetConfig {
	path: string;
	tag?: string;
}

export default function(this: any, source: string) {
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
				source += `registerCustomElement(() => useDefault(import('${widget.path}')), ${JSON.stringify({
					...descriptor,
					tagName: `${elementPrefix}-${widget.tag || descriptor.tagName}`
				})});`;
			}
		}
	});

	return source;
}
