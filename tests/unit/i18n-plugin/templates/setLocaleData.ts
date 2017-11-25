import MockModule from '../../../support/MockModule';
import { stub } from 'sinon';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

let mockModule: MockModule;

describe('I18nPlugin template', () => {
	const systemLocale = 'xk-CD';

	function configureMocks() {
		const i18n = mockModule.getMock('@dojo/i18n/i18n');
		i18n.systemLocale = systemLocale;
		i18n.switchLocale = stub();

		const loadCldrData = mockModule.getMock('@dojo/i18n/cldr/load');
		loadCldrData.default = stub();
	}

	function setLocaleData({
		locale = 'en',
		supportedLocales = [],
		cldrData = {}
	}: {
		locale?: string;
		supportedLocales?: string[];
		cldrData?: {}
	} = {}) {
		(<any> global).__defaultLocale__ = locale;
		(<any> global).__supportedLocales__ = supportedLocales;
		(<any> global).__cldrData__ = cldrData;
	}

	beforeEach(() => {
		mockModule = new MockModule('../../../../src/i18n-plugin/templates/setLocaleData', require);
		mockModule.dependencies([
			'@dojo/i18n/i18n',
			'@dojo/i18n/cldr/load'
		]);
	});

	afterEach(() => {
		mockModule.destroy();
		delete (<any> global).__defaultLocale__;
		delete (<any> global).__supportedLocales__;
		delete (<any> global).__cldrData__;
	});

	it('should use the default locale when the system locale is unsupported', () => {
		configureMocks();
		setLocaleData();
		mockModule.getModuleUnderTest();

		const i18n = mockModule.getMock('@dojo/i18n/i18n');
		assert.isTrue(i18n.switchLocale.calledWith('en'));
	});

	it('should use the system locale when it is supported', () => {
		configureMocks();
		setLocaleData({ supportedLocales: [ 'xk' ] });
		mockModule.getModuleUnderTest();

		const i18n = mockModule.getMock('@dojo/i18n/i18n');
		assert.isTrue(i18n.switchLocale.calledWith(systemLocale));
	});

	it('should register CLDR data', () => {
		const cldrData = {};

		configureMocks();
		setLocaleData({ cldrData });
		mockModule.getModuleUnderTest();

		const i18n = mockModule.getMock('@dojo/i18n/i18n');
		const loadCldrData = mockModule.getMock('@dojo/i18n/cldr/load');
		assert.isTrue(loadCldrData.default.calledWith(cldrData));
		assert.isTrue(loadCldrData.default.calledBefore(i18n.switchLocale),
			'CLDR data should be registered before the locale is switched.');
	});
});
