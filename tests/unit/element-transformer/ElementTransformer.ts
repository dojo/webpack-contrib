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
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		interface DojoInputProperties {}
		const render = create().properties<DojoInputProperties>();
		export const DojoInput = render(({ properties }) => 'foo');
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
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		interface DojoInputProperties {}
		const render = create().properties<DojoInputProperties>();
		const DojoInput = render(({ properties }) => 'foo');
		export default DojoInput;
		`;
			const expected = `
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		interface DojoInputProperties {}
		const render = create().properties<DojoInputProperties>();
		const DojoInput = (() => {
			var temp_1 = render(({ properties }) => 'foo');
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: [], properties: [], events: [] }, ...temp_1.__customElementDescriptor || {} };	
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
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		interface DojoInputProperties {}
		const render = create().properties<DojoInputProperties>();
		const DojoInput = render(({ properties }) => 'foo');
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
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create().properties<DojoInputProperties>();
		const DojoInput = render(({ properties }) => 'foo');
		export default DojoInput;
		`;
			const expected = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create().properties<DojoInputProperties>();
		const DojoInput = (() => {
			var temp_1 = render(({ properties }) => 'foo')
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };
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

		it('it handles a combined type', () => {
			const source = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create<any, { foo: string }>().properties<DojoInputProperties>();
		const DojoInput = render(({ properties }) => 'foo');
		export default DojoInput;
		`;
			const expected = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create<any, { foo: string }>().properties<DojoInputProperties>();
		const DojoInput = (() => {
			var temp_1 = render(({ properties }) => 'foo');
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["foo", "attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };	
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
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create<any, { foo: string }>().properties<DojoInputProperties>();
		export default render(function DojoInput({ properties }) {
			return 'foo'
		});
		`;
			const expected = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create<any, { foo: string }>().properties<DojoInputProperties>();
		export default (() => {
			var temp_1 = render(function DojoInput({ properties }) {
				return 'foo'
			});
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["foo", "attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };	
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
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create<any, { foo: string }>().properties<DojoInputProperties>();
		export default render(({ properties }) => 'foo');
		`;
			const expected = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
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
		const render = create<any, { foo: string }>().properties<DojoInputProperties>();
		export default (() => {
			var temp_1 = render(({ properties }) => 'foo');
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-actual", attributes: ["foo", "attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };	
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

		it('it handles an explicit type', () => {
			const source = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		const render = create().properties();
		const DojoInput = render(({ properties }: { properties: () => { bar: string; } }) => 'foo');
		export default DojoInput;
		`;
			const expected = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		const render = create().properties();
		const DojoInput = (() => {
			var temp_1 = render(({ properties }: { properties: () => { bar: string; } }) => 'foo');	
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["bar"], properties: [], events: [] }, ...temp_1.__customElementDescriptor || {} };	
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

		it('handles using variables and types in widget creation', () => {
			const source = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		const render = create().properties();
		type Props = () => { bar: string; };
		type Options = { properties: Props };
		type Callback = (options: Options) => any;
		const callback: Callback = () => 'foo';
		const DojoInput = render(callback);
		export default DojoInput;
		`;
			const expected = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		const render = create().properties();
		type Props = () => { bar: string; };
		type Options = { properties: Props };
		type Callback = (options: Options) => any;
		const callback: Callback = () => 'foo';
		const DojoInput = (() => {
			var temp_1 = render(callback);
			temp_1.__customElementDescriptor = { ...{ tagName: "widget-dojo-input", attributes: ["bar"], properties: [], events: [] }, ...temp_1.__customElementDescriptor || {} };	
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

		it('ignores default exports that have the wrong signature', () => {
			const source = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: () => { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		const render = create().properties();
		type Props = () => { bar: string; };
		type Options = () => { properties: Props };
		type Callback = (options: Options) => any;
		const callback: Callback = () => 'foo';
		const DojoInput = render(callback);
		export default DojoInput;
		`;
			const expected = `
		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value 2 = 1 };
		type stringOrNumber = string | number;
		function create<A = any, B = {}>() {
    		return {
        		properties: <T>() =>
            		function render(callback: (options: () => { properties: () => B & T }) => string) {
                		return (properties: B & T) => '';
            	}
    		};
		}

		const render = create().properties();
		type Props = () => { bar: string; };
		type Options = () => { properties: Props };
		type Callback = (options: Options) => any;
		const callback: Callback = () => 'foo';
		const DojoInput = render(callback);
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
						customElementFiles: [{ file: actualPath, name: 'foo-bar' }]
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
	function create<A = any, B = {}>() {
		return {
			properties: <T>() =>
				function render(callback: (options: { properties: () => B & T }) => string) {
					return (properties: B & T) => '';
			}
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
	const render = create<any, { foo: string }>().properties<DojoInputProperties>();
	export default render(({ properties }) => 'foo');
	`;
		const expected = `
	enum StringEnum { value1 = 'value1', value2 = 'value2' };
	enum IntEnum { value1 = 0, value 2 = 1 };
	type stringOrNumber = string | number;
	function create<A = any, B = {}>() {
		return {
			properties: <T>() =>
				function render(callback: (options: { properties: () => B & T }) => string) {
					return (properties: B & T) => '';
			}
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
	const render = create<any, { foo: string }>().properties<DojoInputProperties>();
	export default (() => {
		var temp_1 = render(({ properties }) => 'foo');
		temp_1.__customElementDescriptor = { ...{ tagName: "widget-foo-bar", attributes: ["foo", "attribute", "stringEnum", "stringOrNumber"], properties: ["property", "intEnum"], events: ["onClick", "onChange"] }, ...temp_1.__customElementDescriptor || {} };	
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
						customElementFiles: [{ name: 'foo-bar', file: actualPath }]
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
	return {
		getSourceFile,
		getDefaultLibFileName: () => 'lib.d.ts',
		writeFile: (fileName: string, content: string) => {
			const split = fileName.split(/[/\\]/);
			outputs[split[split.length - 1]] = content;
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
