import { statSync } from 'fs';
import { dirname } from 'path';
import { createSourceFile, forEachChild, Node, ScriptTarget, SyntaxKind } from 'typescript';
import * as webpack from 'webpack';
const DtsCreator = require('typed-css-modules');
const { getOptions } = require('loader-utils');
const instances = require('ts-loader/dist/instances');

type DtsResult = {
	writeFile(): Promise<void>;
};

type DtsCreatorInstance = {
	create(filePath: string, initialContents: boolean, clearCache: boolean): Promise<DtsResult>;
};

type LoaderArgs = {
	type: string;
	instanceName?: string;
	sourceFilesPattern?: RegExp | string;
};

const creator: DtsCreatorInstance = new DtsCreator();

const mTimeMap = new Map<string, Date>();

function generateDTSFile(filePath: string, sourceFilesRegex: RegExp): Promise<void> {
	return Promise.resolve().then(() => {
		if (!sourceFilesRegex.test(filePath)) {
			return;
		}
		const { mtime } = statSync(filePath);
		const lastMTime = mTimeMap.get(filePath);

		if (!lastMTime || mtime > lastMTime) {
			mTimeMap.set(filePath, mtime);
			return creator.create(filePath, false, true).then((content) => content.writeFile());
		}
	});
}

function getCssImport(node: Node, loaderContext: webpack.loader.LoaderContext): Promise<string> | void {
	if (node.kind === SyntaxKind.StringLiteral) {
		const importPath = node.getText().replace(/\'|\"/g, '');
		if (/\.css$/.test(importPath)) {
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
	const { type = 'ts', instanceName, sourceFilesPattern = /src[\\\/]/ }: LoaderArgs = getOptions(this);
	const sourceFilesRegex =
		typeof sourceFilesPattern === 'string' ? new RegExp(sourceFilesPattern) : sourceFilesPattern;

	Promise.resolve()
		.then(() => {
			let generationPromises: Promise<void>[] = [];
			switch (type) {
				case 'css':
					generationPromises.push(generateDTSFile(this.resourcePath, sourceFilesRegex));
					break;
				case 'ts':
					const sourceFile = createSourceFile(this.resourcePath, content, ScriptTarget.Latest, true);
					const cssFilePathPromises = traverseNode(sourceFile, [], this);

					if (cssFilePathPromises.length) {
						if (instanceName) {
							const instanceWrapper = instances.getTypeScriptInstance({ instance: instanceName });

							if (instanceWrapper.instance) {
								instanceWrapper.instance.files[this.resourcePath] = undefined;
							}
						}

						generationPromises = cssFilePathPromises.map((cssFilePathPromise) =>
							cssFilePathPromise.then((cssFilePath) => generateDTSFile(cssFilePath, sourceFilesRegex))
						);
					}
					break;
			}
			return Promise.all(generationPromises);
		})
		.then(() => callback(null, content, sourceMap), (error) => callback(error));
}
