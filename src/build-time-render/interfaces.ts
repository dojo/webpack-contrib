export type Renderer = 'puppeteer' | 'jsdom';

export interface BuildTimeRenderPathOptions {
	path: string;
	match?: string[];
	static?: boolean;
	exclude?: boolean;
}

export type BuildTimeRenderPath = string | BuildTimeRenderPathOptions;

export interface RenderResult {
	head: string[];
	content: string;
	styles: string;
	script: string;
	blockScripts: string[];
	additionalScripts: string[];
	additionalCss: string[];
}

export interface BuildTimeRenderArguments {
	root: string;
	entries: string[];
	useManifest?: boolean;
	paths?: BuildTimeRenderPath[];
	useHistory?: boolean;
	static?: boolean;
	puppeteerOptions?: any;
	basePath: string;
	baseUrl?: string;
	scope: string;
	sync?: boolean;
	renderer?: Renderer;
	discoverPaths?: boolean;
	writeHtml?: boolean;
	onDemand?: boolean;
	writeCss?: boolean;
}

export interface BlockOutput {
	[index: string]: {
		[index: string]: string;
	};
}

export interface RenderWorkerData {
	basePath: string;
	baseUrl: string;
	cssFiles: string[];
	discoverPaths: boolean;
	entries: string[];
	originalManifest: any;
	output: string;
	puppeteerOptions: any;
	renderType: Renderer;
	root: string;
	scope: string;
	useHistory: boolean;
}

export interface RenderWorkerOptions {
	renderPath: BuildTimeRenderPath;
}

export interface PageResult {
	head: string[];
	content: string;
	styles: string;
	script: string;
	additionalScripts: string[];
	additionalCss: string[];
}

export interface RenderWorkerResult {
	path: BuildTimeRenderPath;
	pageResult?: PageResult;
	discoveredPaths: string[];
	errors: Error[];
	warnings: Error[];
	blockOutput: BlockOutput;
	blockScripts: string[];
}
