export type PublicRemoteTriggerSettings = {
  enabled: boolean;
  baseUrl?: string;
  hasBearerToken: boolean;
};

export type SaveRemoteTriggerSettingsPayload = {
  enabled: boolean;
  baseUrl?: string;
  bearerToken?: string;
  clearBearerToken?: boolean;
};
