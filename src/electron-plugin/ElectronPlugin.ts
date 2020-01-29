import * as webpack from 'webpack';

interface ElectronPluginOptions {
	electron: {
		browser: any;
	};
	dist: boolean;
	watch: boolean;
	serve: boolean;
	port: number;
	basePath: string;
	outputPath: string;
}

export class ElectronPlugin {
	private _options: ElectronPluginOptions;
	private _defaultOptions: ElectronPluginOptions = {
		dist: false,
		watch: false,
		serve: false,
		port: 9999,
		basePath: process.cwd(),
		outputPath: 'output/dist',
		electron: {
			browser: { width: 800, height: 600 }
		}
	};

	constructor(options: Partial<ElectronPluginOptions>) {
		this._options = { ...this._defaultOptions, ...options };
		this._options.electron.browser = {
			...this._defaultOptions.electron.browser,
			...this._options.electron.browser
		};
	}
	apply(compiler: webpack.Compiler) {
		const {
			electron: { browser },
			watch,
			serve,
			port
		} = this._options;

		const definePlugin = new webpack.DefinePlugin({
			ELECTRON_BROWSER_OPTIONS: JSON.stringify(browser),
			ELECTRON_WATCH_SERVE: JSON.stringify(watch && serve),
			ELECTRON_SERVE_PORT: JSON.stringify(port)
		});

		definePlugin.apply(compiler);
	}
}

export default ElectronPlugin;
