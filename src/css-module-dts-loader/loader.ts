import { statSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { dirname, normalize } from 'path';
import { createSourceFile, forEachChild, Node, ScriptTarget, SyntaxKind } from 'typescript';
import * as webpack from 'webpack';
const DtsCreator = require('typed-css-modules');
const { getOptions } = require('loader-utils');
const instances = require('ts-loader/dist/instances');

type DtsResult = {
	writeFile(): Promise<void>;
	formatted: string;
};

type DtsCreatorInstance = {
	create(filePath: string, initialContents: boolean, clearCache: boolean): Promise<DtsResult>;
};

type LoaderArgs = {
	type: string;
	instanceName?: string;
};

const creator: DtsCreatorInstance = new DtsCreator();

const mTimeMap = new Map<string, Date>();
const cssMap = new Map<string, string>();

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
	return first !== '/' && first !== '@' && /^\W/.test(id);
}

function generateDTSFile(filePath: string): Promise<void> {
	return Promise.resolve().then(() => {
		const { mtime } = statSync(filePath);
		const lastMTime = mTimeMap.get(filePath);

		if (!lastMTime || mtime > lastMTime) {
			const newCss = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

			const dtsFilePath = `${filePath}.d.ts`;
			const definition = existsSync(dtsFilePath) ? readFileSync(dtsFilePath, 'utf-8') : '';

			const css = cssMap.get(filePath) || '';
			mTimeMap.set(filePath, mtime);

			if (newCss !== css || !definition) {
				return creator.create(filePath, false, true).then((content) => {
					cssMap.set(filePath, newCss);
					const newDefinition = content.formatted;
					if (!newDefinition) {
						return writeFileSync(
							dtsFilePath,
							`declare const styles: {};
export = styles;`,
							'utf8'
						);
					} else if (newDefinition !== definition) {
						return content.writeFile();
					}
				});
			}
		}
	});
}

function getCssImport(node: Node, loaderContext: webpack.loader.LoaderContext): Promise<string> | void {
	if (node.kind === SyntaxKind.StringLiteral) {
		const importPath = node.getText().replace(/\'|\"/g, '');
		if (/\.css$/.test(importPath) && isRelative(importPath)) {
			const parentFileName = node.getSourceFile().fileName;
			return new Promise((resolve, reject) => {
				loaderContext.resolve(dirname(parentFileName), importPath, (error, path) => {
					if (error) {
						reject(error);
					}
					if (!path) {
						reject(new Error('Unable to resolve path to css file'));
					}
					resolve(path);
				});
			});
		}
	}
}

function traverseNode(
	node: Node,
	filePaths: Promise<string>[],
	loaderContext: webpack.loader.LoaderContext
): Promise<string>[] {
	switch (node.kind) {
		case SyntaxKind.SourceFile:
			forEachChild(node, (childNode: Node) => {
				traverseNode(childNode, filePaths, loaderContext);
			});
			break;
		case SyntaxKind.ImportDeclaration:
			forEachChild(node, (childNode: Node) => {
				const path = getCssImport(childNode, loaderContext);
				path && filePaths.push(path);
			});
			break;
	}
	return filePaths;
}

export default function(this: webpack.loader.LoaderContext, content: string, sourceMap?: string) {
	const callback = this.async() as Function;
	const { instanceName }: LoaderArgs = getOptions(this);

	Promise.resolve()
		.then(
			(): Promise<any> => {
				const sourceFile = createSourceFile(this.resourcePath, content, ScriptTarget.Latest, true);
				const cssFilePathPromises = traverseNode(sourceFile, [], this);

				if (!cssFilePathPromises.length) {
					return Promise.resolve();
				}

				if (instanceName) {
					const instanceWrapper = instances.getTypeScriptInstance({ instance: instanceName });

					if (instanceWrapper.instance) {
						instanceWrapper.instance.files[this.resourcePath] = undefined;
					}
				}

				return Promise.all(
					cssFilePathPromises.map((cssFilePathPromise) =>
						cssFilePathPromise.then((cssFilePath) => generateDTSFile(cssFilePath))
					)
				);
			}
		)
		.then(() => callback(null, content, sourceMap), (error) => callback(error));
}
