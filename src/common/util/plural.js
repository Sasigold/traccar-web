// Day counts read naturally: "יום אחד", "יומיים", "3 ימים" (and "1 day", "2 days" in English).
// Phrases around them use forms that agree with every count ("עוד {0}", "לפני {0}").
export const formatDays = (count, t) => {
  const days = Math.abs(Math.round(count));
  if (days === 1) {
    return t('sharedDayOne');
  }
  if (days === 2) {
    return t('sharedDayTwo');
  }
  return t('sharedDaysCount').replace('{0}', days);
};
