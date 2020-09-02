import ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
import ReplaceSource = require('webpack-sources/lib/ReplaceSource');
import RuntimeTemplate = require('webpack/lib/RuntimeTemplate');
import * as webpack from 'webpack';

export declare class Template {
	apply(dep: any, source: any): void;
	compilation?: webpack.Compilation;
}
/**
 * A custom Webpack dependency used to inject an arbitrary `require` to the beginning of the target source.
 */
export default class InjectedModuleDependency extends ModuleDependency {
	/**
	 * An optional string representing the variable name to which the require should be assigned. If no
	 * variable is provided, then the module is not assigned to a variable and is assumed to contain
	 * only side effects.
	 */
	variable?: string;

	static Template: typeof Template;
}

/**
 * A custom template for rendering injected `require`s to the beginning of the target source.
 */
InjectedModuleDependency.Template = class {
	compilation?: webpack.Compilation;

	/**
	 * Add the depedency's module to the source as a `require` call.
	 *
	 * @param dep The module dependency
	 * @param source The source to be modified
	 */
	apply(dep: InjectedModuleDependency, source: ReplaceSource) {
		const module = this.compilation && this.compilation.moduleGraph.getModule(dep);
		const content = module
			? `__webpack_require__(${JSON.stringify(module.id)});`
			: new RuntimeTemplate().missingModule(dep);

		const prefix = dep.variable ? `var ${dep.variable} = ` : '';
		source.insert(0, `${prefix}${content}\n`);
	}
};
