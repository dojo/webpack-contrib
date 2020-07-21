import * as Cldr from 'cldrjs';
import * as webpack from 'webpack';
import { getOptions } from 'loader-utils';
const likelySubtags = require('cldr-core/supplemental/likelySubtags.json');
const plurals = require('cldr-core/supplemental/plurals.json');
const parentLocales = require('cldr-core/supplemental/parentLocales.json');

function generateCldr(cldrData: any, locales: string[], includeInverse = false) {
	return locales.reduce(
		(targetedCldr, locale) => {
			const cldr = new Cldr(locale);
			const langRegExp = new RegExp(`^${cldr.attributes.language}`);
			return Object.keys(cldrData).reduce((localeCldr, key) => {
				if (langRegExp.test(key)) {
					localeCldr[key] = cldrData[key];
				}
				if (includeInverse && langRegExp.test(cldrData[key])) {
					localeCldr[key] = cldrData[key];
				}
				return localeCldr;
			}, targetedCldr);
		},
		{} as any
	);
}

function getValidCldrDataLocale(locale: string): string {
	const cldr = new Cldr(locale);
	try {
		require(`cldr-data/main/${locale}/ca-gregorian.json`);
	} catch {
		locale = cldr.attributes.language;
	}
	return locale;
}

export default function(this: webpack.loader.LoaderContext) {
	const { locale, supportedLocales = [], sync } = getOptions(this);

	Cldr.load(likelySubtags);
	const definedLocales: string[] = [locale, ...supportedLocales];
	const locales = definedLocales.reduce(
		(calculatedLocales, locale) => {
			const cldr = new Cldr(locale);
			if (
				cldr.attributes.minLanguageId !== locale &&
				definedLocales.indexOf(cldr.attributes.minLanguageId) === -1
			) {
				return [...calculatedLocales, locale, cldr.attributes.minLanguageId];
			}
			return [...calculatedLocales, locale];
		},
		[] as string[]
	);
	const registeredCldrLocales: string[] = [];

	likelySubtags.supplemental.likelySubtags = generateCldr(likelySubtags.supplemental.likelySubtags, locales, true);
	plurals.supplemental['plurals-type-cardinal'] = generateCldr(
		plurals.supplemental['plurals-type-cardinal'],
		locales
	);

	function loadLocaleCldrTemplate(locale: string) {
		locale = getValidCldrDataLocale(locale);
		if (registeredCldrLocales.indexOf(locale) !== -1) {
			return '';
		}
		registeredCldrLocales.push(locale);
		return `
cldrData.push(require('cldr-data/main/${locale}/ca-gregorian.json'));
cldrData.push(require('cldr-data/main/${locale}/dateFields.json'));
cldrData.push(require('cldr-data/main/${locale}/timeZoneNames.json'));
cldrData.push(require('cldr-data/main/${locale}/currencies.json'));
cldrData.push(require('cldr-data/main/${locale}/numbers.json'));
cldrData.push(require('cldr-data/main/${locale}/units.json'));
`;
	}

	function loadSupplementalCldrTemplate() {
		return `
var weekData = require('cldr-core/supplemental/weekData.json');
var ordinals = require('cldr-core/supplemental/ordinals.json');
var numberingSystems = require('cldr-core/supplemental/numberingSystems.json');
var parentLocales = require('cldr-core/supplemental/parentLocales.json');
var likelySubtags = require('cldr-core/supplemental/likelySubtags.json');
var plurals = require('cldr-core/supplemental/plurals.json');
var cldrData = [weekData, ordinals, numberingSystems, parentLocales, likelySubtags, plurals];
`;
	}

	const syncLocaleCldrData = locales.reduce((template, locale) => {
		template = `${template}
${loadLocaleCldrTemplate(locale)}`;
		return template;
	}, '');

	function createSupplementalCldrTemplate() {
		if (sync) {
			return 'true';
		}
		return `function() {
	var promises = [
		Promise.resolve({ default: ${JSON.stringify(parentLocales)} }),
		Promise.resolve({ default: ${JSON.stringify(likelySubtags)} }),
		Promise.resolve({ default: ${JSON.stringify(plurals)} })
	];

	if (has('__i18n_date__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/date-time" */ 'cldr-core/supplemental/weekData.json')
		);
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/date-time" */ 'cldr-core/supplemental/timeData.json')
		);
	}
	if (has('__i18n_number__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/currency" */ 'cldr-core/supplemental/currencyData.json')
		);
	}
	if (has('__i18n_date__') || has('__i18n_number__') || has('__i18n_unit__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/common" */ 'cldr-core/supplemental/ordinals.json')
		);
		promises.push(
			import(
				/* webpackChunkName: "i18n/supplemental/common" */ 'cldr-core/supplemental/numberingSystems.json'
			)
		);
	}

	return Promise.all(promises);
}`;
	}

	const fallbackLikelySubtagsCldrData = sync
		? 'true'
		: `function () {
		return Promise.all([
			import(/* webpackChunkName: "i18n/supplemental/fallback" */ 'cldr-core/supplemental/likelySubtags.json'),
			import(/* webpackChunkName: "i18n/supplemental/fallback" */ 'cldr-core/supplemental/plurals.json')
		]);
	}`;

	function createLocaleCldrTemplate(locale: string) {
		locale = getValidCldrDataLocale(locale);
		if (sync) {
			return 'true';
		}
		return `function() {
	var promises = [];

	if (has('__i18n_date__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/date-time" */ 'cldr-data/main/${locale}/ca-gregorian.json')
		);
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/date-time" */ 'cldr-data/main/${locale}/dateFields.json')
		);
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/date-time" */ 'cldr-data/main/${locale}/timeZoneNames.json')
		);
	}
	if (has('__i18n_number__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/currency" */ 'cldr-data/main/${locale}/currencies.json')
		);
	}
	if (has('__i18n_date__') || has('__i18n_number__') || has('__i18n_unit__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/common" */ 'cldr-data/main/${locale}/numbers.json')
		);
	}
	if (has('__i18n_unit__')) {
		promises.push(import(/* webpackChunkName: "i18n/${locale}/unit" */ 'cldr-data/main/${locale}/units.json'));
	}

	return Promise.all(promises);
}`;
	}

	const localeLoaders = locales
		.map((locale) => {
			return `'${locale}': ${createLocaleCldrTemplate(locale)}`;
		})
		.join(',');

	const syncLoaders = `var Globalize = require('globalize/dist/globalize/message');
${loadSupplementalCldrTemplate()}
${syncLocaleCldrData}
Globalize.load(cldrData)`;

	return `var has = require('@dojo/framework/core/has').default;
var i18n = require('@dojo/framework/i18n/i18n');
${sync ? syncLoaders : ''}
i18n.setCldrLoaders({ ${localeLoaders}, fallback: ${fallbackLikelySubtagsCldrData}, supplemental: ${createSupplementalCldrTemplate()} });
i18n.setSupportedLocales(${JSON.stringify(locales)});
i18n.setDefaultLocale('${locale}');
export default i18n.setLocale({ default: true });
`;
}
