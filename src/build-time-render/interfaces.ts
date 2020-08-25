export type Renderer = 'puppeteer' | 'jsdom';

export interface BtrPathOptions {
	path: string;
	match?: string[];
	static?: boolean;
	exclude?: boolean;
}

export type BtrPath = string | BtrPathOptions;

export interface BlockOutput {
	[index: string]: {
		[index: string]: string;
	};
}

export interface BtrResult {
	path?: BtrPath;
	head: string[];
	content: string;
	styles: string;
	script: string;
	blockScripts?: string[];
	additionalScripts: string[];
	additionalCss: string[];
}

export interface RenderWorkerData {
	root: string;
	scope: string;
	output: string;
	cssFiles: string[];
	rendererType?: Renderer;
	basePath: string;
	baseUrl: string;
	puppeteerOptions: any;
	initialBtr: boolean;
	entries: string[];
	originalManifest: any;
	discoverPaths: boolean;
	useHistory: boolean;
	onDemand: boolean;
}

export interface RenderWorkerResult {
	discoveredPaths: string[];
	blocksOutput: BlockOutput;
	btrResult?: BtrResult;
	warnings: Error[];
	errors: Error[];
}
