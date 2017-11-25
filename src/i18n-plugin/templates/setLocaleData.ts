const i18n = require('@dojo/i18n/i18n');
const loadCldrData = require('@dojo/i18n/cldr/load').default;
const systemLocale = i18n.systemLocale;

declare const __cldrData__: any;
declare const __defaultLocale__: string;
declare const __supportedLocales__: string[];

const userLocale = systemLocale.replace(/^([a-z]{2}).*/i, '$1');
const isUserLocaleSupported = (userLocale === __defaultLocale__) ||
	__supportedLocales__.some(function (locale: string) {
		return locale === systemLocale || locale === userLocale;
	});

loadCldrData(__cldrData__);
i18n.switchLocale(isUserLocaleSupported ? systemLocale : __defaultLocale__);
