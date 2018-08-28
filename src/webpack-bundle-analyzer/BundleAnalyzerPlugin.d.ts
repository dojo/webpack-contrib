import { Compiler } from 'webpack';

export interface BundleAnalyzerPluginOptions {
	analyzerMode?: 'server' | 'static' | 'disabled';
	analyzerPort?: number;
	reportFilename?: string;
	openAnalyzer?: boolean;
	generateStatsFile?: boolean;
	statsFilename?: string;
	statsOptions?: any;
	logLevel?: 'info' | 'warn' | 'error' | 'silent';
}

export default class BundleAnalyzerPlugin {
	constructor(options: BundleAnalyzerPluginOptions);

	apply(compiler: Compiler): void;
}
