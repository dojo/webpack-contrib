const jsdom = require('jsdom');
const { JSDOM, ResourceLoader } = jsdom;

export type Renderer = 'puppeteer' | 'jsdom';

export default (renderer: Renderer = 'jsdom') => {
	if (renderer === 'puppeteer') {
		try {
			return require('puppeteer');
		} catch {
			throw new Error(
				'Cannot find puppeteer, unable to run BTR. Please install puppeteer or use `jsdom` renderer'
			);
		}
	}
	return {
		launch: (options: any) => {
			return Promise.resolve({
				close: () => {
					return Promise.resolve();
				},
				newPage: () => {
					const beforeParseFuncs: any[] = [];
					let window: any;
					let requestCount = 0;
					class CustomResourceLoader extends ResourceLoader {
						fetch(url: string, options: any) {
							if (options.element && options.element.localName === 'iframe') {
								return null;
							}
							requestCount++;
							const response = super.fetch(url.replace(/#.*/, ''), options);
							response.then(
								() => {
									requestCount--;
								},
								() => {
									requestCount--;
								}
							);
							return response;
						}
					}
					return {
						evaluate: (func: () => any, ...args: any[]) => {
							return new Promise((resolve) => {
								setTimeout(() => {
									resolve(window.eval(`(${func.toString()})('${args.join(`','`)}')`));
								}, 0);
							});
						},
						evaluateOnNewDocument: (func: () => any, ...args: any[]) => {
							beforeParseFuncs.push((window: any) => {
								window.eval(`(${func.toString()})('${args.join(`','`)}')`);
							});
							return Promise.resolve();
						},
						$eval: (selector: string, func: (node: Element) => any) => {
							const node = window.document.querySelector(selector);
							return Promise.resolve(func(node));
						},
						$$eval: (selector: string, func: (nodes: Element[]) => any) => {
							const nodes = [...window.document.querySelectorAll(selector)];
							return Promise.resolve(func(nodes));
						},
						goto: async (url: string, options: any) => {
							const jsdomOptions: any = {
								runScripts: 'dangerously',
								pretendToBeVisual: true,
								resources: new CustomResourceLoader()
							};

							jsdomOptions.beforeParse = (win: any) => {
								window = win;
								(global as any).document = win.document;
								(global as any).window = window;

								beforeParseFuncs.forEach((beforeParseFunc) => {
									beforeParseFunc(win);
								});
							};
							let timeout = false;
							const jsdom = JSDOM.fromURL(url, jsdomOptions);
							const timeoutHandle = setTimeout(() => {
								timeout = true;
							}, 30000);
							await new Promise((resolve) => setTimeout(resolve, 10));
							while (requestCount && !timeout) {
								await new Promise((resolve) => setTimeout(resolve, 10));
							}
							if (timeout) {
								throw new Error(`Page ${url} timed out`);
							}
							clearTimeout(timeoutHandle);
							return jsdom;
						},
						exposeFunction: (name: string, func: () => any) => {
							beforeParseFuncs.push((window: any) => {
								window[name] = func;
							});
						},
						screenshot: () => {
							return Promise.resolve();
						},
						on: (eventName: string, func: () => void) => {
							// no op for now
						},
						close: () => {
							return Promise.resolve();
						}
					};
				}
			});
		}
	};
};
