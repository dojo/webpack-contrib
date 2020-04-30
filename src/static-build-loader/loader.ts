import getFeatures from './getFeatures';
import * as webpack from 'webpack';
import * as recast from 'recast';
import { ExpressionStatement, BaseNode } from 'estree';

const { getOptions } = require('loader-utils');
const types = recast.types;
const namedTypes = types.namedTypes;
const builders = types.builders;
const compose = require('recast/lib/util').composeSourceMaps;
const { Parser } = require('acorn');
const dynamicImport = require('acorn-dynamic-import').default;

/**
 * A map of features that should be statically replaced in the code
 */
export interface StaticHasFeatures {
	[feature: string]: boolean;
}

const acorn = Parser.extend(dynamicImport);

const HAS_MID = /\/has$/;
const HAS_PRAGMA = /^\s*(!?)\s*has\s*\(["']([^'"]+)['"]\)\s*$/;
const HAS_MODULE_REGEXP = /@dojo(\/|\\)framework(\/|\\)core(\/|\\)has\.(js|mjs|ts)$/;

function hasCheck(hasIdentifier: string, hasNamespaceIdentifier: string | undefined, args: any, callee: any) {
	return (
		(namedTypes.Identifier.check(callee) && callee.name === hasIdentifier && args.length === 1) ||
		(namedTypes.MemberExpression.check(callee) &&
			namedTypes.Identifier.check(callee.object) &&
			callee.object.name === hasNamespaceIdentifier &&
			namedTypes.Identifier.check(callee.property) &&
			callee.property.name === 'default' &&
			args.length === 1)
	);
}

function existsCheck(existsIdentifier: string, hasNamespaceIdentifier: string | undefined, args: any, callee: any) {
	return (
		(namedTypes.Identifier.check(callee) && callee.name === existsIdentifier && args.length === 1) ||
		(namedTypes.MemberExpression.check(callee) &&
			namedTypes.Identifier.check(callee.object) &&
			callee.object.name === hasNamespaceIdentifier &&
			namedTypes.Identifier.check(callee.property) &&
			callee.property.name === 'exists' &&
			args.length === 1)
	);
}

function addCheck(addIdentifier: string, hasNamespaceIdentifier: string | undefined, args: any, callee: any) {
	return (
		(namedTypes.Identifier.check(callee) &&
			callee.name === addIdentifier &&
			(args.length === 3 || args.length === 2)) ||
		(namedTypes.MemberExpression.check(callee) &&
			namedTypes.Identifier.check(callee.object) &&
			callee.object.name === hasNamespaceIdentifier &&
			namedTypes.Identifier.check(callee.property) &&
			callee.property.name === 'add' &&
			(args.length === 3 || args.length === 2))
	);
}

function getExpressionValue(node: ExpressionStatement): string | undefined {
	if (namedTypes.Literal.check(node.expression) && typeof node.expression.value === 'string') {
		return node.expression.value;
	}
	if (namedTypes.TemplateLiteral.check(node.expression)) {
		if (
			node.expression.quasis.length === 1 &&
			namedTypes.TemplateElement.check(node.expression.quasis[0]) &&
			typeof node.expression.quasis[0].value.raw === 'string'
		) {
			return node.expression.quasis[0].value.raw;
		}
	}
}

function setComment<T>(
	node: T,
	path: recast.Path<T>,
	comment: string,
	parentPath: recast.Path<BaseNode>,
	name: string,
	replacement: any = null
) {
	const next = (Array.isArray(parentPath.value) && parentPath.value[Number(name) + 1]) || parentPath.node;
	next.comments = [...((node as any).comments || []), ...(next.comments || []), builders.commentLine(comment)];
	path.replace(replacement);
}

/**
 * Checks code for usage of has pragmas or other calls to @dojo/framework/has and optimizes them out based on the flags or
 * feature sets specified statically. This loader should act on JavaScript, so it should run after the compiler
 * if using TypeScript
 * @param content The JavaScript code to optimize
 * @param sourceMap Optional Source map for the code. If provided it will be updated to reflect the optimizations made
 */
export default function loader(
	this: webpack.loader.LoaderContext,
	content: string,
	sourceMap?: webpack.RawSourceMap
): string | void {
	if (
		!HAS_MODULE_REGEXP.test(this.resourcePath) &&
		content.indexOf('/has') < 0 &&
		content.indexOf('has(') < 0 &&
		content.indexOf('exists(') < 0
	) {
		if (sourceMap) {
			this.callback(null, content, sourceMap);
			return;
		}
		return content;
	}
	// copy features to a local scope, because `this` gets weird
	const options = getOptions(this);
	const { features: featuresOption, staticOnly = [] } = options;
	const parseOptions: any = {
		parser: {
			parse(source: string) {
				return acorn.parse(source, {
					plugins: { dynamicImport: true },
					locations: true,
					sourceType: 'module'
				});
			}
		}
	};

	if (sourceMap) {
		parseOptions.sourceFileName = sourceMap.file;
	}
	const dynamicFlags = new Set<string>();
	const ast = recast.parse(content, parseOptions);
	let features: StaticHasFeatures;
	let elideNextImport = false;
	let hasIdentifier: string | undefined;
	let hasNamespaceIdentifier: string | undefined;
	let existsIdentifier: string | undefined;
	let addIdentifier: string | undefined;
	let comment: string | undefined;
	if (!featuresOption || Array.isArray(featuresOption) || typeof featuresOption === 'string') {
		features = getFeatures(featuresOption);
	} else {
		features = featuresOption;
	}

	if (HAS_MODULE_REGEXP.test(this.resourcePath)) {
		addIdentifier = 'add';
		hasIdentifier = 'has';
	} else {
		types.visit(ast, {
			visitExpressionStatement(path) {
				const { node, parentPath, name } = path;
				const expressionValue = getExpressionValue(node);
				if (expressionValue) {
					const hasPragma = HAS_PRAGMA.exec(expressionValue);
					if (hasPragma) {
						const [, negate, flag] = hasPragma;
						comment = ` ${negate}has('${flag}')`;
						if (flag in features) {
							elideNextImport = negate ? !!features[flag] : !features[flag];
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
					setComment(node, path, comment, parentPath, name);
					comment = undefined;
					return false;
				}

				comment = undefined;
				this.traverse(path);
			},

			visitDeclaration(path) {
				const { node, parentPath, name } = path;
				if (namedTypes.ImportDeclaration.check(path.node)) {
					const value = path.node.source.value;

					if (elideNextImport) {
						comment = ` elided: import '${value}'`;
						elideNextImport = false;
					}
					if (comment && parentPath && typeof name !== 'undefined') {
						let replacement: any = null;
						if (path.node.specifiers.length) {
							replacement = builders.variableDeclaration(
								'var',
								path.node.specifiers.map((specifier) => {
									return builders.variableDeclarator(
										specifier.local,
										builders.identifier('undefined')
									);
								})
							);
						}

						setComment(node, path, comment, parentPath, name, replacement);
						comment = undefined;
						return false;
					}

					comment = undefined;

					if (typeof value === 'string' && HAS_MID.test(value)) {
						path.node.specifiers.forEach((specifier) => {
							if (
								specifier.type === 'ImportDefaultSpecifier' ||
								(specifier.type === 'ImportSpecifier' && specifier.imported.name === 'default')
							) {
								hasIdentifier = specifier.local.name;
							} else if (specifier.type === 'ImportNamespaceSpecifier') {
								hasNamespaceIdentifier = specifier.local.name;
							} else if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'exists') {
								existsIdentifier = specifier.local.name;
							} else if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'add') {
								addIdentifier = specifier.local.name;
							}
						});
					}
				}
				this.traverse(path);
			},

			// Look for `require('*/has');` and set the variable name to `hasNamespaceIdentifier`
			visitVariableDeclaration(path) {
				const {
					name,
					node,
					parentPath,
					parentPath: { node: parentNode },
					node: { declarations }
				} = path;

				let identifier: any = undefined;

				if (elideNextImport === true && declarations.length === 1) {
					const callExpression = declarations[0];
					if (namedTypes.VariableDeclarator.check(callExpression)) {
						if (
							callExpression.init &&
							namedTypes.CallExpression.check(callExpression.init) &&
							namedTypes.Identifier.check(callExpression.init.callee)
						) {
							if (
								callExpression.init.callee.name === 'require' &&
								callExpression.init.arguments.length === 1
							) {
								if (callExpression.id) {
									identifier = callExpression.id;
								}

								const [arg] = callExpression.init.arguments;
								if (namedTypes.Literal.check(arg)) {
									comment = ` elided: import '${arg.value}'`;
									elideNextImport = false;
								}
							}
						}
					}

					if (comment && parentPath && typeof name !== 'undefined') {
						const replacement = builders.variableDeclaration('var', [
							builders.variableDeclarator(identifier, builders.objectExpression([]))
						]);
						setComment(node, path, comment, parentPath, name, replacement);

						comment = undefined;
						return false;
					}
					comment = undefined;
				}

				// Get all the top level variable declarations
				if (ast.program === parentNode && !hasNamespaceIdentifier) {
					declarations.forEach(({ id, init }) => {
						if (!hasNamespaceIdentifier) {
							if (namedTypes.Identifier.check(id) && init && namedTypes.CallExpression.check(init)) {
								const { callee, arguments: args } = init;
								if (
									namedTypes.Identifier.check(callee) &&
									callee.name === 'require' &&
									args.length === 1
								) {
									const [arg] = args;
									if (
										namedTypes.Literal.check(arg) &&
										typeof arg.value === 'string' &&
										HAS_MID.test(arg.value)
									) {
										hasNamespaceIdentifier = id.name;
									}
								}
							}
						}
					});
				}
				this.traverse(path);
			}
		});
	}

	// Now we want to walk the AST and find an expressions where the default import or `exists` of `*/has` is
	// called. This will be a CallExpression, where the callee is an object named the import from above
	// accessing the `default` or `exists` properties, with one argument, which is a string literal.
	if (hasIdentifier || hasNamespaceIdentifier || existsIdentifier || addIdentifier) {
		types.visit(ast, {
			visitCallExpression(path) {
				const {
					node: { arguments: args, callee }
				} = path;
				const isHasCheck = hasCheck(hasIdentifier as string, hasNamespaceIdentifier, args, callee);
				const isExistsCheck = existsCheck(
					existsIdentifier as string,
					hasNamespaceIdentifier as string,
					args,
					callee
				);
				const isAdd = addCheck(addIdentifier as string, hasNamespaceIdentifier, args, callee);
				if (isHasCheck || isExistsCheck) {
					const [arg] = args;
					if (namedTypes.Literal.check(arg) && typeof arg.value === 'string') {
						// check to see if we have a flag that we want to statically swap
						if (arg.value in features) {
							path.replace(builders.literal(isExistsCheck ? true : features[arg.value]));
						} else {
							dynamicFlags.add(arg.value);
						}
					}
					return false;
				}

				if (isAdd) {
					const [feature] = args;

					if (
						namedTypes.Literal.check(feature) &&
						typeof feature.value === 'string' &&
						feature.value in features &&
						staticOnly.indexOf(feature.value) === -1
					) {
						path.replace(
							builders.callExpression(callee, [args[0], builders.literal(features[feature.value])])
						);
						return false;
					}
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
		const map = compose(
			sourceMap,
			result.map
		);
		this.callback(null, result.code, map);
		return;
	}
	return recast.print(ast).code;
}
