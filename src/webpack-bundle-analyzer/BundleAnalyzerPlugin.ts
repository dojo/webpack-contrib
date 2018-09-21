import * as path from 'path';
import * as mkdir from 'mkdirp';
import * as viewer from './viewer';
import { Compiler } from 'webpack';
const bfj = require('bfj-node4');

export interface BundleAnalyzerOptions {
	reportFilename: string;
	generateStatsFile: boolean;
	statsFilename: string;
	statsOptions: string | null;
	analyzerMode: string;
	openAnalyzer: boolean;
	excludeBundles?: string;
}

export default class BundleAnalyzerPlugin {
	private opts: BundleAnalyzerOptions;
	private compiler: any;

	constructor(opts: Partial<BundleAnalyzerOptions>) {
		this.opts = {
			reportFilename: 'report.html',
			generateStatsFile: false,
			statsFilename: 'stats.json',
			statsOptions: null,
			analyzerMode: '',
			openAnalyzer: false,
			...opts
		};
	}

	apply(compiler: Compiler) {
		this.compiler = compiler;
		const done = (stats: any) => {
			stats = stats.toJson(this.opts.statsOptions);
			if (this.opts.generateStatsFile) {
				this.generateStatsFile(stats);
			}
			this.generateStaticReport(stats);
		};

		compiler.plugin('done', done);
	}

	async generateStatsFile(stats: any) {
		const statsFilePath = path.resolve(this.compiler.outputPath, this.opts.statsFilename);
		mkdir.sync(path.dirname(statsFilePath));

		try {
			await bfj.write(statsFilePath, stats, {
				promises: 'ignore',
				buffers: 'ignore',
				maps: 'ignore',
				iterables: 'ignore',
				circular: 'ignore'
			});
		} catch {}
	}

	generateStaticReport(stats: any) {
		viewer.generateReportData(stats, {
			reportFilename: path.resolve(this.compiler.outputPath, this.opts.reportFilename),
			bundleDir: this.getBundleDirFromCompiler(),
			excludeBundle: this.opts.excludeBundles
		});
	}

	getBundleDirFromCompiler() {
		return this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem' ? null : this.compiler.outputPath;
	}
}
