import elementTransformer from '../../../src/element-transformer/index';
import * as ts from 'typescript';

const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

describe('element-transformer', () => {
	it('normalizes string arg to object', () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@customElement("dojo-input")
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
		const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@customElement({ tag: "dojo-input" })
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
		assertCompile(source, expected, (program) => ({
			before: [elementTransformer(program)]
		}));
	});

	it('extracts attributes', () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			a: string;
			b: string;
		}
		@customElement({ tag: "dojo-input" })
		export class DojoInput extends WidgetBase<DojoInputProperties> {
			public a = "1";
			public b = "true";
			public c = "string";
		}`;
		const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			a: string;
			b: string;
		}
		@customElement({tag: "dojo-input", attributes: ["a", "b"]})
		export class DojoInput extends WidgetBase<DojoInputProperties> {
			public a = "1";
			public b = "true";
			public c = "string";
		}`;
		assertCompile(source, expected, (program) => ({
			before: [elementTransformer(program)]
		}));
	});

	it('extracts events', () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			onA: (x: number) => boolean;
			onB(): void;
		}
		@customElement({ tag: "dojo-input" })
		export class DojoInput extends WidgetBase<DojoInputProperties> {
			onA(x: number) {
				return true
			}
			onB() {}
		}`;
		const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			onA: (x: number) => boolean;
			onB(): void;
		}
		@customElement({ tag: "dojo-input": events: ["onA", "onB"] })
		export class DojoInput extends WidgetBase<DojoInputProperties> {
			onA(x: number) {
				return true
			}
			onB() {}
		}`;
		assertCompile(source, expected, (program) => ({
			before: [elementTransformer(program)]
		}));
	});

	it('extracts properties', () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			a: number;
			b: boolean;
			aFn(): void;
		}
		@customElement({ tag: "dojo-input" })
		export class DojoInput extends WidgetBase<DojoInputProperties> {
			public a = 1;
			public b = true;
			public c = "string";
			aFn(){}
		}`;
		const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			a: number;
			b: boolean;
			aFn(): void;
		}
		@customElement({tag: "dojo-input", properties: ["a", "b", "aFn"]})
		export class DojoInput extends WidgetBase<DojoInputProperties> {
			public a = 1;
			public b = true;
			public c = "string";
			aFn(){}
		}`;
		assertCompile(source, expected, (program) => ({
			before: [elementTransformer(program)]
		}));
	});

	it("doesn't override explicitly set properties", () => {
		const source = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			a: number;
			b: boolean;
			onA(): void;
		}
		@customElement({ tag: "dojo-input", properties: ["a"], childType: 'DOJO' })
		export class DojoInput extends WidgetBase<DojoInputProperties> {
			public a = 1;
			public b = true;
			public c = "string";
			onA() {}
		}`;
		const expected = `
		class WidgetBase<T> {}
		interface DojoInputProperties {
			a: number;
			b: boolean;
			onA(): void;
		}
		@customElement({tag: "dojo-input", properties: ["a"], childType: 'DOJO', events: ["onA"]})
			export class DojoInput extends WidgetBase<DojoInputProperties> {
			public a = 1;
			public b = true;
			public c = "string";
			onA() {}
		}`;
		assertCompile(source, expected, (program) => ({
			before: [elementTransformer(program)]
		}));
	});

	it('validates assumptions', () => {
		const noCall = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@blah
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
		assert.doesNotThrow(() => {
			assertCompile(noCall, noCall, (program) => ({
				before: [elementTransformer(program)]
			}));
		});

		const missingArg = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@customElement()
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
		assert.throw(() => {
			assertCompile(missingArg, '', (program) => ({
				before: [elementTransformer(program)]
			}));
		}, /single argument:/);

		const extraArg = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@customElement(true, true)
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
		assert.throw(() => {
			assertCompile(extraArg, '', (program) => ({
				before: [elementTransformer(program)]
			}));
		}, /single argument:/);

		const wrongArg = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@customElement(true)
		export class DojoInput extends WidgetBase<DojoInputProperties> {
		}`;
		assert.throw(() => {
			assertCompile(wrongArg, '', (program) => ({
				before: [elementTransformer(program)]
			}));
		}, /either a string/);

		const noExtends = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@customElement("dojo-input")
		export class DojoInput {
		}`;
		assert.throw(() => {
			assertCompile(noExtends, '', (program) => ({
				before: [elementTransformer(program)]
			}));
		}, /extends WidgetBase/);

		const badExtends = `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		@customElement("dojo-input")
		export class DojoInput extends WidgetBase {
		}`;
		assert.throw(() => {
			assertCompile(badExtends, '', (program) => ({
				before: [elementTransformer(program)]
			}));
		}, /extends WidgetBase/);
	});
});

function assertCompile(
	actual: string,
	expected: string,
	getTransformers: (program: ts.Program) => ts.CustomTransformers,
	otherOptions?: ts.CompilerOptions,
	errorMessage?: string
) {
	const compilerOptions = {
		module: ts.ModuleKind.ESNext,
		target: ts.ScriptTarget.ESNext,
		...otherOptions
	};
	let filePaths = { 'actual.ts': actual, 'expected.ts': expected };
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
