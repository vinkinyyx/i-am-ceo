/**
 * 《我是CEO》UI -> Domain TypeScript bridge contracts only (not runnable game code).
 * TODO: adapt these to actual GameQueryService / GameCommandService.
 */
export type UIID =
  | 'UI-01' | 'UI-02' | 'UI-03' | 'UI-04' | 'UI-05' | 'UI-06' | 'UI-07' | 'UI-08'
  | 'UI-09' | 'UI-10' | 'UI-11' | 'UI-12' | 'UI-13' | 'UI-14' | 'UI-15' | 'UI-16'
  | 'UI-17' | 'UI-18' | 'UI-19' | 'UI-20' | 'UI-21' | 'UI-22' | 'UI-23' | 'UI-24'
  | 'UI-25' | 'UI-26' | 'UI-27' | 'UI-28' | 'UI-29' | 'UI-30' | 'UI-31' | 'UI-32' | 'UI-33';

export type PrimaryTab = 'T01' | 'T02' | 'T03' | 'T04';
export type ViewStatus = 'loading' | 'empty' | 'normal' | 'error' | 'readonly';

export interface UIState<TModel extends object = Record<string, unknown>> {
  id: UIID;
  status: ViewStatus;
  model: Readonly<TModel>;
  errorMessage?: string;
}

export interface UIIntent {
  sourceScreen: UIID;
  action: string; // action key from Config/screen_registry.json
  payload?: Readonly<Record<string, unknown>>;
}

export interface NavigationGateway {
  showScreen(screenId: UIID, params?: Readonly<Record<string, unknown>>): void;
  closeTopLayer(): void;
  selectTab(tab: PrimaryTab): void;
}

export interface ViewModelGateway {
  read(screenId: UIID, params?: Readonly<Record<string, unknown>>): Promise<UIState>;
}

export interface UIActionGateway {
  /** Domain commands must be validated/idempotent; UI action is not authoritative. */
  dispatch(intent: UIIntent): Promise<void>;
}

export const MOBILE_LAYOUT = {
  designWidth: 375, designHeight: 812, minTouchPx: 44,
  tabCount: 4, // Company, Departments, Staff, Ranking. Settings is a detail page.
} as const;
