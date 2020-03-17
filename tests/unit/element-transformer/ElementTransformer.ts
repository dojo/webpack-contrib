import * as ts from 'typescript';
import elementTransformer from '../../../src/element-transformer/ElementTransformer';
import * as path from 'path';

const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

const actualPath = path.resolve('actual.ts');
const expectedPath = path.resolve('expected.ts');

describe('element-transformer', () => {
	describe('classes', () => {
		it('does not touch classes that are not the default export', () => {
			const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: source
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it modifies classes that are explicitly the default export', () => {
			const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		export default class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
			const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		export default class DojoInput extends WidgetBase<DojoInputProperties> {
		}
		DojoInput.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: [], properties: [], events: [] }, ...DojoInput.__customElementDescriptor || {} };
`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it modifies classes that are the default export, but aliased', () => {
			const source = `
			class WidgetBase<T> {}
			interface DojoInputProperties {}
			export class DojoInput extends WidgetBase<DojoInputProperties> {
			}
			export default DojoInput;
	`;
			const expected = `
			class WidgetBase<T> {}
			interface DojoInputProperties {}
			export class DojoInput extends WidgetBase<DojoInputProperties> {
			}
			DojoInput.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: [], properties: [], events: [] }, ...DojoInput.__customElementDescriptor || {} };
			export default DojoInput;
	`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it does not modify classes that are not listed in files', () => {
			const source = `
			class WidgetBase<T> {}
			interface DojoInputProperties {}
			export class DojoInput extends WidgetBase<DojoInputProperties> {
			}
			export default DojoInput;
	`;
			const expected = `
			class WidgetBase<T> {}
			interface DojoInputProperties {}
			export class DojoInput extends WidgetBase<DojoInputProperties> {
			}
			export default DojoInput;
	`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: [] })]
				})
			);
		});

		it('it adds attributes, properties, and events', () => {
			const source = `
			enum StringEnum { value1 = 'value1', value2 = 'value2' };
			enum IntEnum { value1 = 0, value 2 = 1 };
			type stringOrNumber = string | number;

			class WidgetBase<T> {}
			interface DojoInputProperties {
				attribute: string;
				property: boolean;
				onClick: () => void;
				onChange(value: string): void;
				stringEnum: StringEnum;
				intEnum?: IntEnum;
				stringOrNumber: stringOrNumber;
			}
			export default class DojoInput extends WidgetBase<DojoInputProperties> {
			}
	`;
			const expected = `
			enum StringEnum { value1 = 'value1', value2 = 'value2' };
			enum IntEnum { value1 = 0, value 2 = 1 };
			type stringOrNumber = string | number;

			class WidgetBase<T> {}
			interface DojoInputProperties {
				attribute: string;
				property: boolean;
				onClick: () => void;
				onChange: Function;
			}
			export default class DojoInput extends WidgetBase<DojoInputProperties> {
			}
			DojoInput.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...DojoInput.__customElementDescriptor || {} };
	`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it leaves classes that do not extend', () => {
			const source = `
			interface DojoInputProperties {
			}
			export default class DojoInput {
			}
	`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: source
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it modifies classes that do not take generics', () => {
			const source = `
			export class WidgetBase {
			}
			export default class DojoInput extends WidgetBase {
			}
	`;
			const expected = `
			export class WidgetBase {
			}
			export default class DojoInput extends WidgetBase {
			}
			DojoInput.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: [], properties: [], events: [] }, ...DojoInput.__customElementDescriptor || {} };
	`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});
	});

	describe('function-based widgets', () => {
		it('does not touch function-based widgets that are not the default export', () => {
			const source = `
import {create} from '@dojo/framework/core/vdom';

const render = create();
export const DojoInput = render(() => 'foo');
		`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: source
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it modifies function-based widgets that are explicitly the default export', () => {
			const source = `
		import {create} from '@dojo/framework/core/vdom';

		const render = create();
		const DojoInput = render(() => 'foo');
		export default DojoInput;
		`;
			const expected = `
		import {create} from '@dojo/framework/core/vdom';

		const render = create();
		const DojoInput = (() => {
			var temp_1 = render(() => 'foo');
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["key"], properties: [], events: [] }, ...temp_1.__customElementDescriptor || {} };
			return temp_1;
		})()
		export default DojoInput;
		`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it does not modify function-based widgets that are not listed in files', () => {
			const source = `
		import {create} from '@dojo/framework/core/vdom';

		const render = create();
		const DojoInput = render(() => 'foo');
		export default DojoInput;
		`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: source
				},
				(program) => ({
					before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: [] })]
				})
			);
		});

		it('it adds attributes, properties, and events', () => {
			const source = `
		import {create} from '@dojo/framework/core/vdom';

		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
			stringEnum: StringEnum;
			intEnum?: IntEnum;
			stringOrNumber: stringOrNumber;
		}
		const render = create().properties<DojoInputProperties>();
		const DojoInput = render(() => 'foo');
		export default DojoInput;
		`;
			const expected = `
		import {create} from '@dojo/framework/core/vdom';

		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
			stringEnum: StringEnum;
			intEnum?: IntEnum;
			stringOrNumber: stringOrNumber;
		}
		const render = create().properties<DojoInputProperties>();
		const DojoInput = (() => {
			var temp_1 = render(() => 'foo')
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["key", "attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };
			return temp_1;
		})();
		export default DojoInput;
		`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it handles a direct export type', () => {
			const source = `
		import {create} from '@dojo/framework/core/vdom';

		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value2 = 1 };
		type stringOrNumber = string | number;

		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
			stringEnum: StringEnum;
			intEnum?: IntEnum;
			stringOrNumber: stringOrNumber;
		}

		const foo = create().properties<{ foo?: string; }>()(() => ({}));

		const render = create({ foo }).properties<DojoInputProperties>();
		export default render(function DojoInput(){ return 'foo'; });
		`;
			const expected = `
		import {create} from '@dojo/framework/core/vdom';

		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value2 = 1 };
		type stringOrNumber = string | number;

		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
			stringEnum: StringEnum;
			intEnum?: IntEnum;
			stringOrNumber: stringOrNumber;
		}

		const foo = create().properties<{ foo?: string; }>()(() => ({}));

		const render = create({ foo }).properties<DojoInputProperties>();
		export default (() {
			var temp_1 = render(function DojoInput() { return 'foo'; });
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["key", "attribute", "stringEnum", "stringOrNumber", "foo"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };
			return temp_1;
		})();
		`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('it handles a direct export with no function name', () => {
			const source = `
		import {create} from '@dojo/framework/core/vdom';

		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value2 = 1 };
		type stringOrNumber = string | number;

		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
			stringEnum: StringEnum;
			intEnum?: IntEnum;
			stringOrNumber: stringOrNumber;
		}

		const foo = create().properties<{ foo?: string; }>()(() => ({}));

		const render = create({ foo }).properties<DojoInputProperties>();
		export default render(() => 'foo');
		`;
			const expected = `
		import {create} from '@dojo/framework/core/vdom';

		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value2 = 1 };
		type stringOrNumber = string | number;

		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
			stringEnum: StringEnum;
			intEnum?: IntEnum;
			stringOrNumber: stringOrNumber;
		}

		const foo = create().properties<{ foo?: string; }>()(() => ({}));

		const render = create({ foo }).properties<DojoInputProperties>();
		export default (() => {
			var temp_1 = render(() => 'foo');
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-actual", attributes: ["key", "attribute", "stringEnum", "stringOrNumber", "foo"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };
			return temp_1;
		})();
		`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});

		it('ignores default exports that have the wrong signature', () => {
			const source = `
			const DojoInput = () => 'foo';
			export default DojoInput;
		`;
			const expected = `
			const DojoInput = () => 'foo';
			export default DojoInput;
		`;
			assertCompile(
				{
					[actualPath]: source,
					[expectedPath]: expected
				},
				(program) => ({
					before: [
						elementTransformer(program, {
							elementPrefix: 'widget',
							customElementFiles: [{ file: actualPath }]
						})
					]
				})
			);
		});
	});
	it('can specify custom element name for class', () => {
		const source = `
	class WidgetBase<T> {}
	interface DojoInputProperties {}
	export default class DojoInput extends WidgetBase<DojoInputProperties> {
	}`;
		const expected = `
	class WidgetBase<T> {}
	interface DojoInputProperties {}
	export default class DojoInput extends WidgetBase<DojoInputProperties> {
	}
	DojoInput.__customElementDescriptor = { ...{ tagName: "widget-foo-bar", attributes: [], properties: [], events: [] }, ...DojoInput.__customElementDescriptor || {} };
`;
		assertCompile(
			{
				[actualPath]: source,
				[expectedPath]: expected
			},
			(program) => ({
				before: [
					elementTransformer(program, {
						elementPrefix: 'widget',
						customElementFiles: [{ file: actualPath, tag: 'foo-bar' }]
					})
				]
			})
		);
	});

	it('can specify custom element name for function', () => {
		const source = `
	enum StringEnum { value1 = 'value1', value2 = 'value2' };
	enum IntEnum { value1 = 0, value 2 = 1 };
	type stringOrNumber = string | number;
	interface Callback<T extends {} = {}> {
		(options: { properties: () => T}): string;
	}

	function create<T>() {
		return function (callback: Callback<T>) {
			return callback({ properties: {} as T });
		};
	}

	interface DojoInputProperties {
		attribute: string;
		property: boolean;
		onClick: () => void;
		onChange(value: string): void;
		stringEnum: StringEnum;
		intEnum?: IntEnum;
		stringOrNumber: stringOrNumber;
	}
	const render = create<DojoInputProperties>();
	export default render(({ properties }) => 'foo');
	`;
		const expected = `
	enum StringEnum { value1 = 'value1', value2 = 'value2' };
	enum IntEnum { value1 = 0, value 2 = 1 };
	type stringOrNumber = string | number;
	interface Callback<T extends {} = {}> {
		(options: { properties: () => T}): string;
	}

	function create<T>() {
		return function (callback: Callback<T>) {
			return callback({ properties: {} as T });
		};
	}

	interface DojoInputProperties {
		attribute: string;
		property: boolean;
		onClick: () => void;
		onChange(value: string): void;
		stringEnum: StringEnum;
		intEnum?: IntEnum;
		stringOrNumber: stringOrNumber;
	}
	const render = create<DojoInputProperties>();
	export default (() => {
		var temp_1 = render(({ properties }) => 'foo');
		temp_1.__customElementDescriptor = { ...{ tagName: "widget-foo-bar", attributes: ["attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };
		return temp_1;
	})();
	`;
		assertCompile(
			{
				[actualPath]: source,
				[expectedPath]: expected
			},
			(program) => ({
				before: [
					elementTransformer(program, {
						elementPrefix: 'widget',
						customElementFiles: [{ tag: 'foo-bar', file: actualPath }]
					})
				]
			})
		);
	});
});

function assertCompile(
	sourceFiles: { [key: string]: string },
	getTransformers: (program: ts.Program) => ts.CustomTransformers,
	otherOptions?: ts.CompilerOptions,
	errorMessage?: string
) {
	const compilerOptions = {
		module: ts.ModuleKind.ESNext,
		target: ts.ScriptTarget.ESNext,
		...otherOptions
	};
	let filePaths = sourceFiles;
	const outputs: Record<string, string> = {};
	const host = testCompilerHost(filePaths, outputs);
	const program = ts.createProgram(Object.keys(filePaths), compilerOptions, host);
	const resultActual = program.emit(
		program.getSourceFile('actual.ts'),
		undefined,
		undefined,
		undefined,
		getTransformers(program)
	);
	if (resultActual.diagnostics.length) {
		console.error(resultActual.diagnostics.map((n) => 'actual: ' + n.messageText).join('\n'));
	}

	const resultExpected = program.emit(program.getSourceFile('expected.ts'));
	if (resultExpected.diagnostics.length) {
		console.error(resultActual.diagnostics.map((n) => 'expected: ' + n.messageText).join('\n'));
	}

	assert.equal(outputs['actual.js'], outputs['expected.js'], errorMessage);
}

function testCompilerHost(inputs: Record<string, string>, outputs: Record<string, string>): ts.CompilerHost {
	const compilerHost = ts.createCompilerHost({});

	return {
		...compilerHost,
		getSourceFile,
		writeFile: (fileName: string, content: string) => {
			const split = fileName.split(/[/\\]/);
			outputs[split[split.length - 1]] = content;
		},
		resolveModuleNames(moduleNames: string[], containingFile: string): (ts.ResolvedModule | undefined)[] {
			const resolvedModules = [];

			for (const moduleName of moduleNames) {
				let result = ts.resolveModuleName(moduleName, containingFile, {}, compilerHost);

				if (result.resolvedModule) {
					resolvedModules.push(result.resolvedModule);
				} else {
					let result = ts.resolveModuleName(
						path.resolve(__dirname, '../node_modules', moduleName),
						containingFile,
						{},
						compilerHost
					);
					resolvedModules.push(result.resolvedModule);
				}
			}

			return resolvedModules;
		}
	};

	function getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void) {
		return inputs[fileName]
			? ts.createSourceFile(fileName, inputs[fileName], languageVersion)
			: compilerHost.getSourceFile(fileName, languageVersion, onError);
	}
}
