// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { createContext, use, useEffect, useMemo, Suspense } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import usePersistedState from '../util/usePersistedState';
import Loader from './Loader';
import { setFormatLanguage } from '../util/formatter';
import { setTranslator } from '../util/translator';

// PRF-06: only Hebrew is in the first load. It has every key (src/resources/__tests__), so it needs
// no fallback; English loads when chosen, and as the fallback of the other languages.
import he from '../../resources/l10n/he.json';
import 'dayjs/locale/he';

// viper fleet ships only the languages its customers use. Hebrew and English are bundled so the
// first screen never waits on a locale download; the rest load on demand.
const localeLoaders = import.meta.glob(['../../resources/l10n/{en,ar,ru}.json']);

const dayjsLoaders = {
  en: () => import('dayjs/locale/en.js'),
  ar: () => import('dayjs/locale/ar.js'),
  ru: () => import('dayjs/locale/ru.js'),
};

const languages = {
  he: { country: 'IL', name: 'עברית' },
  en: { country: 'US', name: 'English' },
  ar: { country: 'AE', name: 'العربية' },
  ru: { country: 'RU', name: 'Русский' },
};

// `fallback`: where a key missing in `data` is looked up (English, for languages other than
// Hebrew and English).
const cache = new Map([['he', Promise.resolve({ data: he, fallback: he, dayjsName: 'he' })]]);

const loadData = (language) =>
  localeLoaders[`../../resources/l10n/${language}.json`]().then((module) => module.default);

const loadLocale = (language) => {
  if (!cache.has(language)) {
    cache.set(
      language,
      Promise.all([
        loadData(language),
        language === 'en' ? null : loadData('en'),
        dayjsLoaders[language](),
      ]).then(([data, fallback, dayjsMod]) => ({
        data,
        fallback: fallback ?? data,
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
  const { data, fallback, dayjsName } = use(loadLocale(language));

  const direction = /^(ar|he|fa)$/.test(language) ? 'rtl' : 'ltr';
  // Before the children render, so their first paint already uses the app language.
  setFormatLanguage(language);
  // For code outside React (errors, exported files).
  setTranslator((key) => data[key] ?? fallback[key]);

  const value = useMemo(
    () => ({
      languages: { ...languages, [language]: { ...languages[language], data, fallback } },
      language,
      setLocalLanguage,
      direction,
    }),
    [language, data, fallback, setLocalLanguage, direction],
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

// A11-10: a key with no text anywhere shows as nothing; in development it is said once.
const warned = new Set();
const warnMissing = (key) => {
  if (import.meta.env.DEV && key && !warned.has(key)) {
    warned.add(key);
    console.warn(`Missing translation: ${key}`);
  }
};

export const useTranslation = () => {
  const context = use(LocalizationContext);
  const { data, fallback } = context.languages[context.language];
  return useMemo(
    () => (key) => {
      const text = data[key] ?? fallback?.[key];
      if (text === undefined) warnMissing(key);
      return text;
    },
    [data, fallback],
  );
};

export const useTranslationKeys = (predicate) => {
  const context = use(LocalizationContext);
  const { data } = context.languages[context.language];
  return Object.keys(data).filter(predicate);
};
