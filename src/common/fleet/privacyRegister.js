// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// The record of processing activities (SEC-12): what the organization processes about its
// employees through viper fleet, why, how long, who else gets it and how it is protected.
// Pure: built from the privacy policy and the services this build talks to; printed by
// PrivacyPage. A starting point for the organization and its lawyer, not legal advice.

const days = (t, value) =>
  value ? t('privacyRegisterDays').replace('{0}', value) : t('privacyRegisterNotSet');

export const privacyRegister = (t, { policy, services = {} }) => {
  const recipients = [
    t('privacyRegisterRecipientHosting'),
    t('privacyRegisterRecipientTraccar'),
    ...(services.messaging ? [t('privacyRegisterRecipientMessaging')] : []),
    ...(services.invoicing ? [t('privacyRegisterRecipientInvoicing')] : []),
    ...(services.errors
      ? [t('privacyRegisterRecipientErrors').replace('{0}', services.errors)]
      : []),
    ...(services.analytics
      ? [t('privacyRegisterRecipientAnalytics').replace('{0}', services.analytics)]
      : []),
  ];
  return {
    title: t('privacyRegisterTitle'),
    intro: t('privacyRegisterIntro'),
    sections: [
      { title: t('privacyRegisterController'), paragraphs: [t('privacyRegisterControllerText')] },
      {
        title: t('privacyRegisterPurposes'),
        items: [
          t('privacyRegisterPurposeFleet'),
          t('privacyRegisterPurposeSafety'),
          t('privacyRegisterPurposeMaintenance'),
          t('privacyRegisterPurposeLegal'),
        ],
      },
      {
        title: t('privacyRegisterData'),
        table: {
          headers: [t('privacyRegisterCategory'), t('privacyRegisterRetention')],
          rows: [
            [t('privacyRegisterCategoryLocation'), days(t, policy.retention_days)],
            [t('privacyRegisterCategoryDriver'), t('privacyRegisterWhileEmployed')],
            [t('privacyRegisterCategoryEvents'), t('privacyRegisterBySubject')],
            [t('privacyRegisterCategoryViewLog'), days(t, policy.view_log_days)],
          ],
        },
      },
      {
        title: t('privacyRegisterLimits'),
        items: [
          policy.hide_outside_hours
            ? t('privacyRegisterHoursOn')
                .replace('{0}', String(policy.work_start).slice(0, 5))
                .replace('{1}', String(policy.work_end).slice(0, 5))
            : t('privacyRegisterHoursOff'),
          policy.allow_private_switch
            ? t('privacyRegisterPrivateOn')
            : t('privacyRegisterPrivateOff'),
          t('privacyRegisterConsent'),
        ],
      },
      { title: t('privacyRegisterRecipients'), items: recipients },
      {
        title: t('privacyRegisterRights'),
        items: [t('privacyRegisterRightAccess'), t('privacyRegisterRightErase')],
      },
      {
        title: t('privacyRegisterSecurity'),
        items: [
          t('privacyRegisterSecurityTransport'),
          t('privacyRegisterSecurityAccess'),
          t('privacyRegisterSecurityLog'),
          t('privacyRegisterSecurityBackup'),
        ],
      },
    ],
    signatures: [t('privacyRegisterSignatureOwner'), t('privacyRegisterSignatureSecurity')],
  };
};
