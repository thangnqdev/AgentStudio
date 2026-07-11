export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'
  | 'unsupported';

export type AppUpdateSnapshot = {
  status: AppUpdateStatus;
  version?: string;
  progress?: number;
  message?: string;
};
