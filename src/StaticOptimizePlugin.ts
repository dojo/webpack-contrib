import * as Compiler from 'webpack/lib/Compiler';
import { Program, VariableDeclaration } from 'estree';
import walk from './util/walk';
import ConstDependency = require('webpack/lib/dependencies/ConstDependency');
import NormalModule = require('webpack/lib/NormalModule');
import NullFactory = require('webpack/lib/NullFactory');

export interface StaticHasFeatures {
	[feature: string]: boolean;
}

const HAS_MID = /\/has$/;

export default class HasPlugin {
	private _features: StaticHasFeatures;

	constructor(features: StaticHasFeatures) {
		this._features = features;
	}

	public apply(compiler: Compiler) {
		// copy features to a local scope, because `this` gets weird
		const features = this._features;
		const dynamicFlags = new Set<string>();

		// setup the dependencies for the substitution
		compiler.plugin('compilation', (compilation) => {
			compilation.dependencyFactories.set(ConstDependency, new NullFactory());
			compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());
		});

		// when all is said and done, we will log out any flags that were left dynamic
		compiler.plugin('emit', (compilation, callback) => {
			if (dynamicFlags.size > 0) {
				console.log();
				console.log('Dynamic features: ' + Array.from(dynamicFlags).join(', '));
				console.log();
			}
			callback();
		});

		// we need to hook the compiler
		compiler.plugin('compilation', (compilation, data) => {
			// and we want to hook the parser
			data.normalModuleFactory.plugin('parser', (parser) => {
				// we need direct access to the AST to properly figure out the has substitution
				parser.plugin('program', (ast: Program) => {
					// some guards to help ensure we are only deaing with modules we care about
					if (parser.state && parser.state.current && parser.state.current instanceof NormalModule) {
						// Get all the top level variable declarations
						const variableDeclarations = ast.body.filter((node) => {
							if (!Array.isArray(node) && node.type === 'VariableDeclaration') {
								return true;
							}
						}) as VariableDeclaration[];

						// Look for `require('*/has');` and set the variable name to `hasIdentifier`
						let hasIdentifier: string | undefined;
						variableDeclarations.find(({ declarations }) => {
							let found = false;
							declarations.forEach(({ id, init }) => {
								if (init && !Array.isArray(init) && init.type === 'CallExpression') {
									const { callee, arguments: args } = init;
									if (callee.type === 'Identifier' && callee.name === 'require' && args.length === 1) {
										const [ arg ] = args;
										if (arg.type === 'Literal' && typeof arg.value === 'string' && HAS_MID.test(arg.value)) {
											if (id.type === 'Identifier') {
												hasIdentifier = id.name;
											}
											found = true;
										}
									}
								}
							});
							return found;
						});

						if (!hasIdentifier) {
							// This doesn't import `has`
							return;
						}

						// Now we want to walk the AST and find an expressions where the default import of `*/has` is
						// called.  Which is a CallExpression, where the callee is an object named the import from above
						// accessing the `default` property, with one argument, which is a string literal.
						walk(ast, {
							enter(node, parent, prop, index) {
								if (node.type === 'CallExpression') {
									this.skip();
									const { arguments: args, callee } = node;
									if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' &&
										callee.object.name === hasIdentifier && callee.property.type === 'Identifier' &&
										callee.property.name === 'default' && args.length === 1) {
										const [ arg ] = args;
										if (arg.type === 'Literal' && typeof arg.value === 'string') {
											// check to see if we have a flag that we want to statically swap
											if (arg.value in features) {
												const dep = new ConstDependency(features[arg.value] ? 'true' : 'false', node.range);
												dep.loc = node.loc;
												parser.state.current.addDependency(dep);
											}
											else {
												dynamicFlags.add(arg.value);
											}
										}
									}
								}
							}
						});
					}
				});
			});
		});
	}
}
