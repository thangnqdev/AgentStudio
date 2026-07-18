export interface IExternalNavigator {
  open(url: string): Promise<void>;
}
