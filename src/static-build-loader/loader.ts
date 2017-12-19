import getFeatures from './getFeatures';
import { LoaderContext, RawSourceMap } from 'webpack';
import * as recast from 'recast';

const { getOptions } = require('loader-utils');
const types = recast.types;
const namedTypes = types.namedTypes;
const builders = types.builders;
const compose = require('recast/lib/util').composeSourceMaps;

/**
 * A map of features that should be statically replaced in the code
 */
export interface StaticHasFeatures {
	[feature: string]: boolean;
}

const HAS_MID = /\/has$/;
const HAS_PRAGMA = /^\s*(!?)\s*has\s*\(["']([^'"]+)['"]\)\s*$/;

/**
 * Checks code for usage of has pragmas or other calls to @dojo/has and optimizes them out based on the flags or
 * feature sets specified statically. This loader should act on JavaScript, so it should run after the compiler
 * if using TypeScript
 * @param content The JavaScript code to optimize
 * @param sourceMap Optional Source map for the code. If provided it will be updated to reflect the optimizations made
 */
export default function loader(this: LoaderContext, content: string, sourceMap?: RawSourceMap): string | void {
	if (content.indexOf('/has') < 0 && content.indexOf('has(') < 0) {
		if (sourceMap) {
			this.callback(null, content, sourceMap);
			return;
		}
		return content;
	}
	// copy features to a local scope, because `this` gets weird
	const options = getOptions(this);
	const { features: featuresOption } = options;
	const parseOptions =
		(sourceMap && {
			sourceFileName: sourceMap.file
		}) ||
		undefined;
	const dynamicFlags = new Set<string>();
	const ast = recast.parse(content, parseOptions);
	let features: StaticHasFeatures;
	let elideNextImport = false;
	let hasIdentifier: string | undefined;

	if (!featuresOption || Array.isArray(featuresOption) || typeof featuresOption === 'string') {
		features = getFeatures(featuresOption);
	} else {
		features = featuresOption;
	}

	types.visit(ast, {
		visitExpressionStatement(path) {
			const { node, parentPath, name } = path;
			let comment;
			if (namedTypes.Literal.check(node.expression) && typeof node.expression.value === 'string') {
				const hasPragma = HAS_PRAGMA.exec(node.expression.value);
				if (hasPragma) {
					const [, negate, flag] = hasPragma;
					comment = ` ${negate}has('${flag}')`;
					if (flag in features) {
						elideNextImport = negate ? !features[flag] : features[flag];
					}
				}
			}

			if (
				namedTypes.CallExpression.check(node.expression) &&
				namedTypes.Identifier.check(node.expression.callee)
			) {
				if (
					node.expression.callee.name === 'require' &&
					node.expression.arguments.length === 1 &&
					elideNextImport === true
				) {
					const [arg] = node.expression.arguments;
					if (namedTypes.Literal.check(arg)) {
						comment = ` elided: import '${arg.value}'`;
						elideNextImport = false;
					}
				}
			}

			if (comment && parentPath && typeof name !== 'undefined') {
				const next = (Array.isArray(parentPath.value) && parentPath.value[Number(name) + 1]) || parentPath.node;
				next.comments = [
					...((node as any).comments || []),
					...(next.comments || []),
					builders.commentLine(comment)
				];
				path.replace(null);
				return false;
			}

			this.traverse(path);
		},

		// Look for `require('*/has');` and set the variable name to `hasIdentifier`
		visitVariableDeclaration(path) {
			const { parentPath: { node: parentNode }, node: { declarations } } = path;
			// Get all the top level variable declarations
			if (ast.program === parentNode && !hasIdentifier) {
				declarations.forEach(({ id, init }) => {
					if (!hasIdentifier) {
						if (namedTypes.Identifier.check(id) && init && namedTypes.CallExpression.check(init)) {
							const { callee, arguments: args } = init;
							if (namedTypes.Identifier.check(callee) && callee.name === 'require' && args.length === 1) {
								const [arg] = args;
								if (
									namedTypes.Literal.check(arg) &&
									typeof arg.value === 'string' &&
									HAS_MID.test(arg.value)
								) {
									hasIdentifier = id.name;
								}
							}
						}
					}
				});
			}
			this.traverse(path);
		}
	});

	// Now we want to walk the AST and find an expressions where the default import of `*/has` is
	// called. Which is a CallExpression, where the callee is an object named the import from above
	// accessing the `default` property, with one argument, which is a string literal.
	if (hasIdentifier) {
		types.visit(ast, {
			visitCallExpression(path) {
				const { node: { arguments: args, callee } } = path;

				if (
					namedTypes.MemberExpression.check(callee) &&
					namedTypes.Identifier.check(callee.object) &&
					callee.object.name === hasIdentifier &&
					namedTypes.Identifier.check(callee.property) &&
					callee.property.name === 'default' &&
					args.length === 1
				) {
					const [arg] = args;
					if (namedTypes.Literal.check(arg) && typeof arg.value === 'string') {
						// check to see if we have a flag that we want to statically swap
						if (arg.value in features) {
							path.replace(builders.literal(Boolean(features[arg.value])));
						} else {
							dynamicFlags.add(arg.value);
						}
					}
					return false;
				}
				this.traverse(path);
			}
		});
	}

	if (dynamicFlags.size > 0) {
		console.log();
		console.log('Dynamic features: ' + Array.from(dynamicFlags).join(', '));
		console.log();
	}
	if (sourceMap) {
		const result = recast.print(ast, { sourceMapName: sourceMap.file });
		const map = compose(sourceMap, result.map);
		this.callback(null, result.code, map, ast);
		return;
	}
	return recast.print(ast).code;
}
