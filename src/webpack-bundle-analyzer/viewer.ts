import * as path from 'path';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as mkdir from 'mkdirp';
import * as analyzer from './analyzer';

export interface ReportDataOptions {
	reportFilename: string;
	bundleDir: string | null;
	excludeBundle: string;
}

export function generateReportData(bundleStats: any, opts: Partial<ReportDataOptions> = {}) {
	const { reportFilename = 'report.html', bundleDir = null, excludeBundle } = opts;

	let excludeBundleRegex: RegExp;
	if (excludeBundle) {
		excludeBundleRegex = new RegExp(excludeBundle);
	}

	const chartData: any[] = analyzer.getViewerData(bundleStats, bundleDir);
	let reportFilePath = reportFilename;

	if (!path.isAbsolute(reportFilePath)) {
		reportFilePath = path.resolve(bundleDir || process.cwd(), reportFilePath);
	}
	mkdir.sync(path.dirname(reportFilePath));
	const bundlesList: string[] = [];
	const bundleContent = chartData.reduce((bundleContent: any, data: any) => {
		const bundleFilename = data && data.label && data.label.split('/').slice(-1)[0];
		if (excludeBundle && excludeBundleRegex.test(bundleFilename)) {
			return bundleContent;
		}
		bundlesList.push(bundleFilename);
		bundleContent[bundleFilename] = data;
		return bundleContent;
	}, {});

	const reporterFiles = glob.sync(path.join(__dirname, 'reporter', '**', '*.*'));
	reporterFiles.forEach((file) => {
		fs.copySync(
			file,
			path.join(path.dirname(reportFilePath), 'analyzer', `${path.parse(file).name}${path.parse(file).ext}`)
		);
	});
	fs.writeFileSync(
		path.join(path.dirname(reportFilePath), 'analyzer', 'bundleContent.js'),
		`window.__bundleContent = ${JSON.stringify(bundleContent)}`
	);
	fs.writeFileSync(
		path.join(path.dirname(reportFilePath), 'analyzer', 'bundleList.js'),
		`window.__bundleList = ${JSON.stringify(bundlesList)}`
	);
}
