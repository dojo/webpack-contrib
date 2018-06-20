// tslint:disable
var i18n = require('@dojo/i18n/i18n');
var loadCldrData = require('@dojo/i18n/cldr/load').default;
var systemLocale = i18n.systemLocale;

declare const __cldrData__: any;
declare const __defaultLocale__: string;
declare const __supportedLocales__: string[];

var userLocale = systemLocale.replace(/^([a-z]{2}).*/i, '$1');
var isUserLocaleSupported =
	userLocale === __defaultLocale__ ||
	__supportedLocales__.some(function(locale: string) {
		return locale === systemLocale || locale === userLocale;
	});

loadCldrData(__cldrData__);
i18n.switchLocale(isUserLocaleSupported ? systemLocale : __defaultLocale__);
