export interface AppApi {
  getAppVersion(): Promise<string>
}

declare global {
  interface Window {
    appApi: AppApi
  }
}

export {}
