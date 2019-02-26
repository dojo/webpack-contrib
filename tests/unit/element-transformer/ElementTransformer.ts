import * as ts from 'typescript';
import elementTransformer from '../../../src/element-transformer/ElementTransformer';

const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

describe('element-transformer', () => {
	it('does not touch classes that are not the default export', () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
		assertCompile(
			{
				'actual.ts': source,
				'expected.ts': source
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: ['actual'] })]
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
		DojoInput.prototype.__customElementDescriptor = { tagName: "dojo-input", attributes: [], properties: [], events: [] }
`;
		assertCompile(
			{
				'actual.ts': source,
				'expected.ts': expected
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: ['actual'] })]
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
		DojoInput.prototype.__customElementDescriptor = { tagName: "dojo-input", attributes: [], properties: [], events: [] }
		export default DojoInput;
`;
		assertCompile(
			{
				'actual.ts': source,
				'expected.ts': expected
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: ['actual'] })]
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
				'actual.ts': source,
				'expected.ts': expected
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: [] })]
			})
		);
	});

	it('it adds attributes, properties, and events', () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
		}
		export default class DojoInput extends WidgetBase<DojoInputProperties> {
		}
`;
		const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange: Function;
		}
		export default class DojoInput extends WidgetBase<DojoInputProperties> {
		}
		DojoInput.prototype.__customElementDescriptor = { tagName: "dojo-input", attributes: ["attribute"], properties: ["property"], events: ["onClick", "onChange"] }
`;
		assertCompile(
			{
				'actual.ts': source,
				'expected.ts': expected
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: ['actual'] })]
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
				'actual.ts': source,
				'expected.ts': source
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: ['actual'] })]
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
		DojoInput.prototype.__customElementDescriptor = { tagName: "dojo-input", attributes: [], properties: [], events: [] }
`;
		assertCompile(
			{
				'actual.ts': source,
				'expected.ts': expected
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: ['actual'] })]
			})
		);
	});

	it('prepends the element prefix if there are no dashes in the name', () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		export default class Hello extends WidgetBase<DojoInputProperties> {
		}`;
		const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		export default class Hello extends WidgetBase<DojoInputProperties> {
		}
		Hello.prototype.__customElementDescriptor = { tagName: "widget-hello", attributes: [], properties: [], events: [] }
`;
		assertCompile(
			{
				'actual.ts': source,
				'expected.ts': expected
			},
			(program) => ({
				before: [elementTransformer(program, { elementPrefix: 'widget', customElementFiles: ['actual'] })]
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
	return {
		getSourceFile,
		getDefaultLibFileName: () => 'lib.d.ts',
		writeFile: (fileName: string, content: string) => {
			outputs[fileName] = content;
		},
		getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
		getDirectories: (path) => ts.sys.getDirectories(path),
		getCanonicalFileName: (fileName) => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
		getNewLine: () => ts.sys.newLine,
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		fileExists,
		readFile
	};

	function fileExists(fileName: string): boolean {
		return !!inputs[fileName] || !!outputs[fileName];
	}

	function readFile(fileName: string): string | undefined {
		return inputs[fileName];
	}

	function getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void) {
		return inputs[fileName] ? ts.createSourceFile(fileName, inputs[fileName], languageVersion) : undefined;
	}
}
