import { AudioClip, AudioSource, Node, director, game, resources, sys } from 'cc';

/**
 * 音频管理（设计 05 音频 / UI-12 声音设置）。
 * - 三开关：总开关 masterEnabled（一票否决）、音乐 musicEnabled、音效 sfxEnabled，持久化到 localStorage。
 * - BGM：创业/经营两条，循环；切后台自动暂停、回前台按开关恢复（game 事件）。
 * - JNG（年盈/年亏/三连）与 SFX 为一次性短音，受 sfxEnabled 与 masterEnabled 控制。
 * - 浏览器自动播放策略：首次用户手势后才初始化/解锁 AudioContext。
 *
 * 音频为可选增强：任何加载/播放失败都静默降级，绝不影响经营逻辑。
 */

const STORAGE_KEY = 'ceo.audio.settings.v1';

export interface AudioSettings {
  masterEnabled: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

const DEFAULTS: AudioSettings = { masterEnabled: true, musicEnabled: true, sfxEnabled: true };

type SfxId =
  | 'ui_tap' | 'ui_select' | 'ui_confirm' | 'ui_back' | 'ui_invalid'
  | 'company_reroll_name' | 'employee_recruited' | 'department_created'
  | 'employee_laid_off' | 'time_speed_change' | 'cash_warning'
  | 'year_profit' | 'year_loss' | 'three_year_goal';

const SFX_FILE: Record<SfxId, string> = {
  ui_tap: 'sfx/SFX_01_UITap',
  ui_select: 'sfx/SFX_02_Select',
  ui_confirm: 'sfx/SFX_03_Confirm',
  ui_back: 'sfx/SFX_04_Back',
  ui_invalid: 'sfx/SFX_05_Invalid',
  company_reroll_name: 'sfx/SFX_06_RerollName',
  employee_recruited: 'sfx/SFX_07_Recruit',
  department_created: 'sfx/SFX_08_CreateDepartment',
  employee_laid_off: 'sfx/SFX_09_Layoff',
  time_speed_change: 'sfx/SFX_10_SpeedChange',
  cash_warning: 'sfx/SFX_11_CashWarning',
  year_profit: 'jingles/JNG_01_YearProfit',
  year_loss: 'jingles/JNG_02_YearLoss',
  three_year_goal: 'jingles/JNG_03_ThreeYearGoal',
};

const JINGLE: ReadonlySet<SfxId> = new Set(['year_profit', 'year_loss', 'three_year_goal']);

export class AudioManager {
  private source: AudioSource | null = null;
  private settings: AudioSettings = { ...DEFAULTS };
  private clips = new Map<string, AudioClip>();
  private unlocked = false;
  private currentBgm: 'startup' | 'operation' | null = null;
  private loadingPaths = new Set<string>();
  private pauseReasons = new Set<string>();

  /** 读取持久化设置（localStorage，失败用默认）。 */
  loadSettings(): AudioSettings {
    try {
      if (sys.localStorage) {
        const raw = sys.localStorage.getItem(STORAGE_KEY);
        if (raw) this.settings = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
      }
    } catch {
      this.settings = { ...DEFAULTS };
    }
    return this.settings;
  }

  private persist(): boolean {
    try {
      sys.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      return true;
    } catch {
      return false;
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /** 更新一个或多个开关；总开关关闭立即静音 BGM。 */
  updateSettings(patch: Partial<AudioSettings>): boolean {
    const previous = this.settings;
    this.settings = { ...this.settings, ...patch };
    if (!this.persist()) {
      this.settings = previous;
      return false;
    }
    if (!this.canPlayMusic()) {
      this.source?.pause();
    } else if (this.currentBgm) {
      this.playBgm(this.currentBgm);
    }
    return true;
  }

  private canPlayMusic(): boolean {
    return this.unlocked && this.settings.masterEnabled && this.settings.musicEnabled && this.pauseReasons.size === 0;
  }

  private canPlaySfx(): boolean {
    return this.unlocked && this.settings.masterEnabled && this.settings.sfxEnabled && this.pauseReasons.size === 0;
  }

  /** 首次用户手势时调用：创建 AudioSource 并解锁。 */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.ensureSource();
    if (this.currentBgm && this.canPlayMusic()) {
      this.playBgm(this.currentBgm);
    }
  }

  private ensureSource(): void {
    if (this.source) return;
    const node = new Node('AudioManager');
    director.getScene()?.addChild(node);
    director.addPersistRootNode(node);
    this.source = node.addComponent(AudioSource);
  }

  private preload(path: string): Promise<AudioClip | null> {
    if (this.clips.has(path)) return Promise.resolve(this.clips.get(path)!);
    if (this.loadingPaths.has(path)) return Promise.resolve(null);
    this.loadingPaths.add(path);
    return new Promise((resolve) => {
      resources.load(path, AudioClip, (err: Error | null, clip: AudioClip | null) => {
        this.loadingPaths.delete(path);
        if (err || !clip) {
          resolve(null);
          return;
        }
        this.clips.set(path, clip);
        resolve(clip);
      });
    });
  }

  /** 播放 BGM（startup=创业启程 / operation=日常经营），循环、按开关静音。 */
  async playBgm(kind: 'startup' | 'operation'): Promise<void> {
    this.currentBgm = kind;
    if (!this.canPlayMusic()) return;
    this.ensureSource();
    const path = kind === 'startup' ? 'bgm/BGM_01_StartupLoop' : 'bgm/BGM_02_OfficeLoop';
    const clip = await this.preload(path);
    if (!clip || !this.source || !this.canPlayMusic() || this.currentBgm !== kind) return;
    if (this.source.clip === clip && this.source.playing) return;
    this.source.stop();
    this.source.clip = clip;
    this.source.loop = true;
    this.source.volume = 0.6;
    this.source.play();
  }

  /** 播放一次性音效/短乐（节流：同名 80ms 内不重叠）。 */
  private lastPlayedAt = new Map<SfxId, number>();
  async playSfx(id: SfxId): Promise<void> {
    if (!this.canPlaySfx()) return;
    const now = game.totalTime;
    if ((this.lastPlayedAt.get(id) ?? -999) + 80 > now) return;
    this.lastPlayedAt.set(id, now);

    const path = SFX_FILE[id];
    const clip = await this.preload(path);
    if (!clip || !this.canPlaySfx()) return;
    // 短乐用独立 one-shoot，避免打断 BGM
    const volume = JINGLE.has(id) ? 0.7 : 1;
    this.source?.playOneShot(clip, volume);
  }

  // 语义化快捷方式（对应 11 SFX + 3 JNG）
  uiTap() { return this.playSfx('ui_tap'); }
  uiSelect() { return this.playSfx('ui_select'); }
  uiConfirm() { return this.playSfx('ui_confirm'); }
  uiBack() { return this.playSfx('ui_back'); }
  uiInvalid() { return this.playSfx('ui_invalid'); }
  rerollName() { return this.playSfx('company_reroll_name'); }
  recruit() { return this.playSfx('employee_recruited'); }
  createDepartment() { return this.playSfx('department_created'); }
  layoff() { return this.playSfx('employee_laid_off'); }
  speedChange() { return this.playSfx('time_speed_change'); }
  cashWarning() { return this.playSfx('cash_warning'); }
  yearProfit() { return this.playSfx('year_profit'); }
  yearLoss() { return this.playSfx('year_loss'); }
  threeYearGoal() { return this.playSfx('three_year_goal'); }

  /** 切后台：暂停 BGM（离线不逐条播短乐）。 */
  onAppHide(): void {
    this.pauseForReason('BACKGROUND');
  }

  /** 回前台：按开关恢复。 */
  onAppShow(): void {
    this.resumeForReason('BACKGROUND');
  }

  pauseForReason(reason: string): void {
    this.pauseReasons.add(reason);
    this.source?.pause();
  }

  resumeForReason(reason: string): void {
    this.pauseReasons.delete(reason);
    if (this.pauseReasons.size === 0 && this.canPlayMusic()) this.source?.play();
  }
}

/** 全局单例。 */
export const audioManager = new AudioManager();
