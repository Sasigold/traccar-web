import { createContext, use, useEffect, useMemo, Suspense } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import usePersistedState from '../util/usePersistedState';
import Loader from './Loader';
import { setFormatLanguage } from '../util/formatter';
import { setErrorTranslator } from '../util/apiError';

import en from '../../resources/l10n/en.json';
import he from '../../resources/l10n/he.json';
import 'dayjs/locale/en';
import 'dayjs/locale/he';

// viper fleet ships only the languages its customers use. Hebrew and English are bundled so the
// first screen never waits on a locale download; the rest load on demand.
const localeLoaders = import.meta.glob(['../../resources/l10n/{ar,ru}.json']);

const dayjsLoaders = {
  ar: () => import('dayjs/locale/ar.js'),
  ru: () => import('dayjs/locale/ru.js'),
};

const languages = {
  he: { country: 'IL', name: 'עברית' },
  en: { country: 'US', name: 'English' },
  ar: { country: 'AE', name: 'العربية' },
  ru: { country: 'RU', name: 'Русский' },
};

const cache = new Map([
  ['en', Promise.resolve({ data: en, dayjsName: 'en' })],
  ['he', Promise.resolve({ data: he, dayjsName: 'he' })],
]);

const loadLocale = (language) => {
  if (!cache.has(language)) {
    const dataLoader = localeLoaders[`../../resources/l10n/${language}.json`];
    const dayjsLoader = dayjsLoaders[language];
    cache.set(
      language,
      Promise.all([dataLoader(), dayjsLoader()]).then(([dataMod, dayjsMod]) => ({
        data: dataMod.default,
        dayjsName: dayjsMod.default.name,
      })),
    );
  }
  return cache.get(language);
};

// Hebrew-first product: every new visitor starts in Hebrew, whatever the browser language.
// The choice made in the language menu (or stored on the user/server) still wins.
const getDefaultLanguage = () => 'he';

const LocalizationContext = createContext({
  languages,
  language: 'en',
  setLocalLanguage: () => {},
  direction: 'ltr',
});

const ResolvedLocalizationProvider = ({ language, setLocalLanguage, children }) => {
  const { data, dayjsName } = use(loadLocale(language));

  const direction = /^(ar|he|fa)$/.test(language) ? 'rtl' : 'ltr';
  // Before the children render, so their first paint already uses the app language.
  setFormatLanguage(language);
  // Errors are created outside React (fetch helpers); they read their first line in this language.
  setErrorTranslator((key) => data[key] ?? en[key]);

  const value = useMemo(
    () => ({
      languages: { ...languages, [language]: { ...languages[language], data } },
      language,
      setLocalLanguage,
      direction,
    }),
    [language, data, setLocalLanguage, direction],
  );

  useEffect(() => {
    dayjs.locale(dayjsName);
    document.dir = direction;
    document.documentElement.lang = language;
  }, [dayjsName, direction, language]);

  return <LocalizationContext value={value}>{children}</LocalizationContext>;
};

export const LocalizationProvider = ({ children }) => {
  const remoteLanguage = useSelector((state) => {
    const serverLanguage = state.session.server?.attributes?.language;
    const userLanguage = state.session.user?.attributes?.language;
    const targetLanguage = userLanguage || serverLanguage;
    return targetLanguage && targetLanguage in languages ? targetLanguage : null;
  });

  const [localLanguage, setLocalLanguage] = usePersistedState('language', getDefaultLanguage());

  const language =
    remoteLanguage || (localLanguage in languages ? localLanguage : getDefaultLanguage());

  return (
    <Suspense fallback={<Loader />}>
      <ResolvedLocalizationProvider language={language} setLocalLanguage={setLocalLanguage}>
        {children}
      </ResolvedLocalizationProvider>
    </Suspense>
  );
};

export const useLocalization = () => use(LocalizationContext);

export const useTranslation = () => {
  const context = use(LocalizationContext);
  const { data } = context.languages[context.language];
  return useMemo(() => (key) => data[key] ?? en[key], [data]);
};

export const useTranslationKeys = (predicate) => {
  const context = use(LocalizationContext);
  const { data } = context.languages[context.language];
  return Object.keys(data).filter(predicate);
};
