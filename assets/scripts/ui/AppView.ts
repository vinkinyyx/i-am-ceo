import {
  BlockInputEvents,
  Button,
  Color,
  Component,
  EditBox,
  Graphics,
  Input,
  input,
  Label,
  Mask,
  Node,
  profiler,
  ScrollView,
  Size,
  UIOpacity,
  UITransform,
  Vec2,
  view,
} from 'cc';
import { GameFacade } from '../../core/application/GameFacade';
import type { CandidateOffer, GameState, GameSpeed, IndustryId, CeoTrait, AnnualReport, SupportDeptType, Policy, Department, DeptType } from '../../core/domain/types';
import type { DepartmentVM, UncreatedDeptVM } from '../../core/application/DepartmentOverviewService';
import type { TalentRowVM } from '../../core/application/TalentOverviewService';
import { createPlatform } from '../platform/PlatformFactory';
import { computeShellLayout, computePaneLayout, computeScrollBody, type ShellLayout } from './shellLayout';
import {
  CEO_NAME_MAX,
  CREATE_COPY,
  CreateSubmitGuard,
  INDUSTRY_PRESENTATION,
  candidateRows,
  ceoNameError,
  generateCeoName,
  initialHireView,
} from './createFlow';
import { loadEconomyConfig } from '../platform/loadConfig';
import { loadRuntimeConfig } from '../platform/loadRuntimeConfig';
import { getRuntimeConfig } from '../platform/runtimeConfig';
import { AuthService } from '../../core/platform/AuthService';
import type { IdentityRefreshReason } from '../../core/platform/AuthService';
import { acceptPrivacy, hasAcceptedPrivacy } from '../../core/platform/privacyConsent';
import { PRIVACY_POLICY_TEXT } from '../../core/platform/privacyPolicyText';
import { GameError } from '../../core/domain/errors';
import { validateCompanyName } from '../../core/domain/validation';
import {
  findOpenDialog,
  hasOpenDialog,
  invalidateDialogs,
  openConfirmDialog,
  openInputDialog,
  openScrollableDialog,
  pruneDialogs,
  setDialogClosedListener,
  type DialogHandle,
} from './dialogs';
import { createForegroundClock } from '../../core/platform/foregroundClock';
import { bootTrapError, bootTrapReady, bootTrapWatchdog } from '../boot/BootTrap';
import { getBootController, initCocosBootDiagnostics } from '../boot/cocosBootHost';
import {
  attachCoverBackground,
  createButton,
  createLabel,
  createRect,
  moneyText,
  setButtonEnabled,
  setButtonLabel,
  setButtonLook,
  setUiInteractionHook,
  stretchToParent,
} from './UiFactory';
import { BUTTON_BASELINE, fitTextWithEllipsis, layoutActionRow } from './uiMetrics';
import { THEME, DESIGN_WIDTH, DESIGN_HEIGHT } from './theme';
import { TEXT_TOKENS } from './textTokens';
import { audioManager } from '../audio/AudioManager';
import { loadAdsConfig } from '../ads/loadAdsConfig';
import { TapRewardedAdProvider } from '../../core/platform/TapRewardedAdProvider';
import { isAdCouponAvailable } from '../../core/application/AdRewardService';
import { AdRewardCoordinator } from '../ads/AdRewardCoordinator';
import { loadCloudConfig, loadLeaderboardConfig } from '../platform/loadExternalServiceConfig';
import type { CloudRuntimeConfig } from '../../core/persistence/CloudSaveTypes';
import type { LeaderboardRuntimeConfig } from '../../core/platform/externalServiceConfig';
import { CloudSyncService, type CloudRestorePreview, type PendingCreate } from '../../core/application/CloudSyncService';
import { compareCloudHeads, type CloudHeadRelation } from '../../core/application/CloudConflict';
import { LeaderboardSyncService } from '../../core/application/LeaderboardSyncService';
import { PlayerIdentityState, SessionPlayerIdentityProvider } from '../../core/platform/PlayerIdentity';
import type { PlayerIdentityResult } from '../../core/platform/PlayerIdentity';
import { TapCloudSaveProvider } from '../../core/platform/TapCloudSaveProvider';
import { TapLeaderboardProvider } from '../../core/platform/TapLeaderboardProvider';
import type { CloudArchiveRef, CloudCheckpointV1 } from '../../core/persistence/CloudSaveTypes';

type TabId = 'COMPANY' | 'DEPARTMENT' | 'TALENT' | 'RANK';

const INDUSTRY_LABELS: Record<IndustryId, string> = {
  TRADE: '电商贸易',
  SOFTWARE: '软件科技',
  SERVICE: '企业服务',
};

const TRAIT_LABELS: Record<CeoTrait, { name: string; desc: string }> = {
  BOLD: { name: '进取', desc: '每年 商业+2 管理+1 财务+1，擅长开发市场' },
  STEADY: { name: '稳健', desc: '每年 商业+1 管理+1 财务+2，擅长资金管理' },
  PEOPLE: { name: '亲和', desc: '每年 商业+1 管理+2 财务+1，擅长团队协作' },
};

const SUPPORT_DEPT_META: Record<SupportDeptType, { name: string; desc: string }> = {
  PROCUREMENT: { name: '采购部', desc: '降低可适用的直接采购成本' },
  CUSTOMER_SERVICE: { name: '客服部', desc: '降低售后费用' },
  MARKETING: { name: '市场部', desc: '提升潜在订单（受产能上限）' },
  FINANCE: { name: '财务部', desc: '降低固定管理费用' },
  HR: { name: '人力资源部', desc: '提升业务产能、降低招聘费' },
};

const POLICY_META: Record<Policy, { name: string; desc: string }> = {
  STEADY: { name: '稳健', desc: 'ROI≥1.0，保留6个月刚性费用' },
  GROWTH: { name: '扩张', desc: 'ROI≥0.8，适度提前准备产能' },
  PROFIT: { name: '利润优先', desc: 'ROI≥1.2，保留9个月刚性费用' },
};

/** R29：部门效益口径说明（与月结同一套领域公式，页面只解释不重算）。 */
const DEPT_EFFECT_TEXT: Record<SupportDeptType, string> = {
  PROCUREMENT: '对可适用直接采购成本的节省',
  CUSTOMER_SERVICE: '对售后费用的节省',
  MARKETING: '提升潜在订单（收入仍取 min(订单, 产能)）',
  FINANCE: '对固定管理费与其他可控运营费的节省',
  HR: '提升主营交付产能；招聘费折扣另计',
};

const VALUE_KIND_TEXT: Record<DepartmentVM['valueKind'], string> = {
  BUSINESS_DELIVERY: '主营毛利',
  COST_SAVING: '成本节省',
  DEMAND_UPLIFT: '需求增量',
  CAPACITY_UPLIFT: '产能增量',
  NO_EFFECT: '无效益',
};

/** 卡片内金额压缩（仅展示，不改领域值；详情弹窗仍用精确金额）。 */
function compactMoney(yuan: number): string {
  const sign = yuan < 0 ? '-' : '';
  const abs = Math.abs(yuan);
  if (abs >= 10_000) return `${sign}¥${(abs / 10_000).toFixed(1)}万`;
  return `${sign}¥${abs.toLocaleString('zh-CN')}`;
}

function percentText(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

const COMPANY_NAME_ERROR_TEXT: Record<
  'EMPTY' | 'TOO_SHORT' | 'TOO_LONG' | 'CONTROL_CHAR' | 'TAG' | 'FORBIDDEN_WORD',
  string
> = {
  EMPTY: '公司名不能为空',
  TOO_SHORT: '公司名至少 2 个字',
  TOO_LONG: '公司名最多 20 个字',
  CONTROL_CHAR: '公司名不能包含控制字符',
  TAG: '公司名不能包含网页标签',
  FORBIDDEN_WORD: '公司名包含不允许的词语，请换一个',
};

let commandSeq = 0;
function nextCommandId(prefix: string): string {
  commandSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${commandSeq}`;
}

/**
 * 游戏主界面（设计文档 07 路由 S00/S01/S02/S03/T01-T04/D04/D05）。
 * 单一入口：bootstrap 后根据 phase 渲染；所有动作经 GameFacade 命令，不直接改状态。
 */
export class AppView extends Component {
  private facade!: GameFacade;
  private platform: ReturnType<typeof createPlatform> | null = null;
  private auth: AuthService | null = null;
  private authed = false;
  /** B2：登录单飞，避免隐私同意后的并行初始化触发两次 tap.login/换票。 */
  private loginInFlight: Promise<void> | null = null;
  private root!: Node;
  /** TASK-M3-12-03：稳定分层——render 只清 PageLayer，月结/弹窗不互毁。 */
  private pageLayer!: Node;
  private modalLayer!: Node;
  private toastLayer!: Node;
  private toastNode: Node | null = null;
  private selectedIndustry: IndustryId = 'TRADE';
  private selectedTrait: CeoTrait = 'BOLD';
  /** 创建流程子步骤：公司页 / CEO 页（避免两者都靠 phase 分发导致互相覆盖）。 */
  private createStep: 'COMPANY' | 'CEO' = 'COMPANY';
  /** 首聘 2/2 后先停留在 S03 让玩家点「进入公司」，而不是被领域态直接切走。 */
  private awaitingEnterCompany = false;
  private customCompanyName = '';
  private customCeoName = '';
  private randomCompanyNames: string[] = [];
  /** 选中的候选名下标；-1 表示使用自定义名称。 */
  private selectedNameIndex = 0;
  /** 「换一批」批次序号：每次点击递增，保证换出不同名字。 */
  private nameNonce = 0;
  private activeTab: TabId = 'COMPANY';
  private rankMode: 'assets' | 'years' = 'assets';
  private leaderboardConfig: LeaderboardRuntimeConfig | null = null;
  private leaderboardConsent = false;
  private leaderboardConsentEpoch = 0;
  private cloudConfig: CloudRuntimeConfig | null = null;
  private cloudStatusText = '云备份尚未检查';
  private cloudSync: CloudSyncService | null = null;
  private cloudProvider: TapCloudSaveProvider | null = null;
  /** A24-05：可信身份状态；只有 verified 的 profileId 才能绑定云档。 */
  private identity: PlayerIdentityState | null = null;
  private leaderboardSync: LeaderboardSyncService | null = null;
  private cloudArchives: CloudArchiveRef[] = [];
  private cloudArchiveOwner: { authEpoch: number; contextEpoch: number; profileId: string; runId: string; revision: number } | null = null;
  private cloudBusy = false;
  /** A24-09：同一冻结 checkpoint 的部分失败待补发（内存内，重启后重新备份）。 */
  private pendingLeaderboard: {
    checkpointId: string;
    snapshot: GameState;
    runId: string;
    epoch: number;
    assets: boolean;
    years: boolean;
  } | null = null;
  /** R31：只有平台返回稳定账号标识后，云上传/恢复才允许启用；不猜昵称/设备号。 */
  private cloudProfileBound = false;
  /** A1：云档预览前由用户明确暂停；记录暂停前倍速，取消/恢复后由用户显式选择是否继续。 */
  private cloudPausedForPreview = false;
  private cloudPausedFromSpeed: GameSpeed = 1;
  private annualReportYear: number | null = null;
  private pendingOffer: CandidateOffer | null = null;
  /** R24：主壳布局引用——热 resize 时只重算几何，不重建内容（保 Tab/滚动/输入）。 */
  private shell: {
    scrollRoot: Node;
    viewNode: Node;
    content: Node;
    scrollView: ScrollView;
    footer: Node;
    footerBg: Graphics;
    footerButtons: Node[];
    /** Tab 内容在 authored 坐标（812 中心原点）下的最低下探。 */
    minBottom: number;
    /** 当前内容容器相对 authored 坐标的整体位移。 */
    shift: number;
  } | null = null;
  /** R24：布局监听注销句柄（平台 resize + 引擎 canvas-resize）。 */
  private unbindLayout: Array<() => void> = [];
  /** R27：创建三步页的滚动壳（与主壳互斥；热 resize 只重算几何）。 */
  private createPane: {
    header: Node | null;
    scrollRoot: Node;
    viewNode: Node;
    content: Node;
    scrollView: ScrollView;
    footer: Node;
    footerBg: Graphics;
    footerButtons: Node[];
    headerHeight: number;
    footerHeight: number;
    minBottom: number;
    shift: number;
  } | null = null;
  /** R27：创建公司提交守卫（同一意图一个 commandId，连点只发一次）。 */
  private createGuard = new CreateSubmitGuard();
  private createCommandId: string | null = null;
  private ceoNameNonce = 0;
  private ceoErrorLabel: Node | null = null;
  /** R28：时间按钮引用——暂停/倍速切换只就地重绘，不重建整页、不重置滚动。 */
  private speedButtons: Array<{ node: Node; speed: GameSpeed }> = [];
  /** R30：人才页筛选（'ALL' 或部门 deptId）。 */
  private talentFilterKey = 'ALL';
  /** R30：人才页虚拟化卡片池（只渲染可视窗口，复用节点不串员工）。 */
  private talentPool: {
    rows: TalentRowVM[];
    listTop: number;
    step: number;
    cards: Array<{ node: Node; name: Node; meta: Node; pay: Node; state: Node; index: number }>;
  } | null = null;
  /** R31：应用上下文代际（换 run/恢复云档/重开公司时递增，旧弹窗必须失效）。 */
  private contextEpoch = 0;
  /** R31：账号代际；登录/登出/换号后旧弹窗不得继续提交。 */
  private authEpoch = 0;
  /** DEV-02：前台代际；每次回到前台递增，作为权威刷新 singleflight key 与迟到丢弃依据。 */
  private foregroundGeneration = 0;
  /** DEV-02：当前前台代际的平台身份确认状态（缓存 TTL 不能证明平台未换号）。 */
  private identityVerification: 'unverified' | 'verifying' | 'verified' | 'unavailable' = 'unverified';
  /** DEV-02：最近一次 verified 对应的前台代际。 */
  private verifiedGeneration = 0;
  /** DEV-02：当前代际共享的身份刷新（防止 UI 侧重入；网络层 singleflight 在 AuthService）。 */
  private identityRefreshInFlight: Promise<void> | null = null;
  /** DEV-02：最近一次成功云备份时的 authEpoch；确认换号后首次备份必须明确归属当前账号。 */
  private lastBackupAuthEpoch = -1;
  private bootStarted = false;
  private clockScheduled = false;
  private backdrop: Node | null = null;
  /** R31：危机的“已忽略”语义键；同一 run/年份/月份只自动弹一次。 */
  private distressAckKey: string | null = null;
  /** §29.7：音频补播手势只绑定一次（start 可能因重试执行两次）。 */
  private audioGestureBound = false;
  /** §23.5.6：最近一次主壳渲染的 Tab；仅同 Tab 刷新才恢复滚动。 */
  private lastRenderedTab: TabId | null = null;
  /** R31：详情快照会话；跨月只提示一次“数据已更新”，手动刷新才重取 VM。 */
  private detailSessions: Array<{
    key: string;
    employeeId: string;
    asOfYear: number;
    asOfMonth: number;
    notified: boolean;
    notify: () => void;
    alive: () => boolean;
  }> = [];

  override async start(): Promise<void> {
    // R31：启动页重试/二次启动必须销毁旧根与旧时钟，避免双重 Backdrop、Root 与时钟叠加
    if (this.bootStarted) {
      this.exitApplicationContext('application-dispose');
      this.unschedule(this.clockTick);
      this.clockScheduled = false;
      this.teardownLayoutListeners();
    }
    this.bootStarted = true;
    setDialogClosedListener((reason) => {
      if (reason === 'application-dispose' || !this.bootStarted) return;
      // 详情/确认关闭后再补弹危机提示（危机不抢占阅读，也不永久消失）
      this.scheduleOnce(() => this.ensureDistressNotice(), 0);
    });
    // 启动故障捕获：真机卡启动页时把错误显示在屏幕上（诊断设施，ready 后自动失效）
    bootTrapWatchdog(this.node);
    // R03：统一启动诊断（引擎前注入片段可能已安装；这里取得控制器并补引擎后阶段打点）
    const boot = getBootController() ?? initCocosBootDiagnostics();
    boot.begin('scene');
    boot.end('scene');
    try {
    // 关闭屏幕左下角调试统计面板（发布包不应显示）
    profiler.hideStats();
    audioManager.loadSettings();
    boot.begin('engine');
    const platform = createPlatform();
    this.platform = platform;
    boot.end('engine');
    boot.begin('config');
    const [cfg] = await Promise.all([loadEconomyConfig(), loadRuntimeConfig()]);
    boot.end('config');
    this.auth = new AuthService(platform, { endpoint: getRuntimeConfig().authEndpoint });
    boot.begin('save');
    // R13：显式装载结果——unavailable/corrupt 时不创建可写 facade、不开启时钟
    const loadResult = await GameFacade.bootstrapWithStatus(platform, cfg);
    boot.end('save');
    if (loadResult.kind === 'unavailable' || loadResult.kind === 'corrupt') {
      const code = loadResult.kind === 'unavailable'
        ? (loadResult.reason === 'timeout' ? 'SAVE_UNAVAILABLE_TIMEOUT' : 'SAVE_UNAVAILABLE')
        : 'SAVE_CORRUPT';
      // 闸门 UI 依赖分层节点（modalOverlay 需要 modalLayer）：先建根再渲染，
      // 否则 try/catch 静默吞掉后玩家只看到 8s 看门狗的"引擎卡死"误报。
      this.buildRoot();
      this.renderSaveGateError(code, 'save', loadResult.kind);
      boot.fail('BOOT_SAVE_GATE', 'save', `${loadResult.kind}:${loadResult.message}`);
      // 闸门是本次启动的终态界面：撤销看门狗，避免误报覆盖恢复入口。
      bootTrapReady();
      return;
    }
    this.facade = loadResult.facade;
    if (loadResult.kind === 'recovered') this.toast('已从本地备份恢复存档');
    // 回前台先记录时间点；进入后台记录水位，用于离线结算
    this.lastForegroundMs = Date.now();
    this.lastFrameMs = Date.now();
    this.buildRoot();
    this.render();
    this.bindLayoutListeners();
    // R03：只有 UI 已建好且事件绑定完成才声明 interactive（而非引擎 init 成功即完成）
    boot.markInteractive();

    // 首次启动隐私告知：未同意当前版本隐私政策前，先展示政策弹窗（A23）
    const privacyAccepted = await hasAcceptedPrivacy(platform);
    if (!privacyAccepted) {
      this.renderPrivacyDialog();
    } else {
      void this.ensurePlatformLogin(false);
      void this.setupAdsAfterConsent();
      void this.setupLeaderboardAfterConsent();
      void this.setupCloudAfterConsent();
    }

    bootTrapReady();

    // 首次触摸/点击解锁音频（浏览器自动播放策略）；用全局 input 监听，避免首触被 BlockInputEvents/弹层吞掉
    const unlockAudio = (): void => {
      audioManager.unlock();
      this.syncBgm();
    };
    input.once(Input.EventType.TOUCH_START, unlockAudio);
    input.once(Input.EventType.MOUSE_DOWN, unlockAudio);
    // 弹层/BlockInputEvents 会截断全局事件；按钮入口再兜底一次，保证首触必有声音。
    setUiInteractionHook(() => {
      audioManager.unlock();
      audioManager.retryIfNeeded();
    });
    // §29.7：自动播放被拒绝或加载失败时，下一次真实点击再补一次（已成功则不会重播）
    if (!this.audioGestureBound) {
      this.audioGestureBound = true;
      const retryAudio = (): void => {
        audioManager.unlock();
        audioManager.retryIfNeeded();
      };
      input.on(Input.EventType.TOUCH_END, retryAudio);
      input.on(Input.EventType.MOUSE_UP, retryAudio);
    }

    // 在线经营时钟：按真实帧时间推进（仅 RUNNING 且 speed>0 时月结）
    // 每秒保存一次真实进度，避免 5Hz 双槽事务产生过多平台存储写入。
    // GameClock 仍按真实 elapsed 逐月结算；跨阈值 tick 会在同一事务内补齐所有月份。
    if (this.clockScheduled) this.unschedule(this.clockTick);
    this.schedule(this.clockTick, 1);
    this.clockScheduled = true;

    // 前后台生命周期：进后台暂停音频+记水位；回前台做离线结算
    platform.onHide(() => {
      const now = Date.now();
      this.lastBackgroundMs = now;
      this.fgClock.enterBackground(now);
      audioManager.onAppHide();
      this.adCoordinator?.cancelLoading();
      this.adForegroundEligibleSinceMs = 0;
      // R15：保存提示只跟随真实提交结果，不在 onHide 无条件声称“已自动保存”
    });
    platform.onShow(() => {
      // DEV-02：回到前台推进前台代际；旧代际的身份确认资格作废，敏感操作按新代际重新确认。
      this.foregroundGeneration += 1;
      if (this.identityVerification === 'verified' && this.verifiedGeneration !== this.foregroundGeneration) {
        this.identityVerification = 'unverified';
      }
      void this.onReturnForeground();
    });
    } catch (err) {
      const stage = boot.snapshot().stage;
      const code = err instanceof GameError ? err.code : 'BOOT_FAILED';
      boot.fail('APP_START_FAILED', stage, err instanceof Error ? err.message : String(err));
      bootTrapError(err);
      // R07：正式错误页（错误编号 + 重试/退出），不仅结束首屏留下黑屏
      this.renderBootError(code, stage);
    }
  }

  /** R13：存档不可读/损坏专用闸门页：重试与退出；不提供新建、不开启时钟。 */
  private renderSaveGateError(code: string, stage: string, kind: 'unavailable' | 'corrupt'): void {
    try {
      const overlay = this.modalOverlay(true);
      createRect({ width: 320, height: 320, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
      createLabel({ text: kind === 'corrupt' ? '本地存档异常' : '暂时读不到存档', fontSize: 20, bold: true, parent: overlay }).setPosition(0, 120);
      createLabel({
        text:
          kind === 'corrupt'
            ? `错误编号：${code}\n本地存档校验未通过，为避免覆盖你的进度，\n暂不创建新公司。可重试读取或退出后再进。`
            : `错误编号：${code}\n存储暂时无响应（可能是系统卡顿或权限问题）。\n进度仍在本机，不会被替换。请重试。`,
        fontSize: 14,
        color: THEME.text,
        width: 272,
        lineHeight: 22,
        parent: overlay,
      }).setPosition(0, 30);
      createButton({
        text: '重试读取',
        width: 220,
        height: 46,
        parent: overlay,
        onClick: () => {
          overlay.destroy();
          void this.restartBootAfterSaveGate();
        },
      }).setPosition(0, -80);
      createButton({
        text: '退出',
        width: 220,
        height: 40,
        fontSize: 14,
        color: Color.WHITE,
        textColor: THEME.textWeak,
        parent: overlay,
        onClick: () => {
          const g = globalThis as { tap?: { exitMiniProgram?: () => void } };
          g.tap?.exitMiniProgram?.();
        },
      }).setPosition(0, -132);
    } catch {
      /* Cocos UI 也不可用时 BootTrap 提供最后通道 */
    }
  }

  /** R13：闸门重试只重新执行一次启动尝试（不叠加 bootstrap/时钟）。 */
  private async restartBootAfterSaveGate(): Promise<void> {
    try {
      const platform = this.platform ?? createPlatform();
      this.platform = platform;
      const [cfg] = await Promise.all([loadEconomyConfig(), loadRuntimeConfig()]);
      const loadResult = await GameFacade.bootstrapWithStatus(platform, cfg);
      if (loadResult.kind === 'unavailable' || loadResult.kind === 'corrupt') {
        const code = loadResult.kind === 'unavailable' ? 'SAVE_UNAVAILABLE' : 'SAVE_CORRUPT';
        this.renderSaveGateError(code, 'save', loadResult.kind);
        return;
      }
      this.facade = loadResult.facade;
      this.lastForegroundMs = Date.now();
      this.buildRoot();
      this.render();
      this.bindLayoutListeners();
      const privacyAccepted = await hasAcceptedPrivacy(platform);
      if (!privacyAccepted) this.renderPrivacyDialog();
      else { void this.ensurePlatformLogin(false); void this.setupAdsAfterConsent(); void this.setupLeaderboardAfterConsent(); void this.setupCloudAfterConsent(); }
      this.schedule(this.clockTick, 1);
    } catch {
      this.renderSaveGateError('SAVE_UNAVAILABLE', 'save', 'unavailable');
    }
  }

  /** R03/R07：启动失败页——错误编号、阶段、重试与退出；不自动新建公司。 */
  private renderBootError(code: string, stage: string): void {
    try {
      const overlay = this.modalOverlay(true);
      createRect({ width: 320, height: 300, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
      createLabel({ text: '启动失败', fontSize: 20, bold: true, parent: overlay }).setPosition(0, 110);
      createLabel({
        text: `错误编号：${code}\n阶段：${stage}\n\n本地经营数据未被修改，可重试启动；\n多次失败请稍后再试。`,
        fontSize: 14,
        color: THEME.text,
        width: 272,
        lineHeight: 22,
        parent: overlay,
      }).setPosition(0, 20);
      createButton({
        text: '重试',
        width: 220,
        height: 46,
        parent: overlay,
        onClick: () => {
          overlay.destroy();
          void this.start();
        },
      }).setPosition(0, -70);
      createButton({
        text: '退出',
        width: 220,
        height: 40,
        fontSize: 14,
        color: Color.WHITE,
        textColor: THEME.textWeak,
        parent: overlay,
        onClick: () => {
          const g = globalThis as { tap?: { exitMiniProgram?: () => void } };
          g.tap?.exitMiniProgram?.();
        },
      }).setPosition(0, -122);
    } catch {
      // Cocos UI 也不可用时，BootTrap 2D 画布/看门狗仍提供最后通道
    }
  }

  /**
   * 平台登录（设计 08.4）。
   * 真机：隐私同意后调用；失败不阻断本地单机玩法，展示可重试的提示条。
   * @param silent true=静默尝试验证已有会话（回前台等场景），失败不弹强提示
   */
  private async ensurePlatformLogin(silent: boolean): Promise<void> {
    if (!this.auth) return;
    // B2：authed 只是上次结果，进入云/身份流程前必须复验会话（过期或作用域不符则重新登录）。
    if (this.authed && await this.auth.hasValidSession()) return;
    if (this.loginInFlight) { await this.loginInFlight; return; }
    this.loginInFlight = this.doPlatformLogin(silent).finally(() => { this.loginInFlight = null; });
    await this.loginInFlight;
  }

  private async doPlatformLogin(silent: boolean): Promise<void> {
    if (!this.auth) return;
    try {
      const session = await this.auth.ensureAuthenticated();
      this.authed = true;
      if (!silent || session.kind === 'taptap') this.toast('平台登录成功');
    } catch (err) {
      this.authed = false;
      const code = err instanceof GameError ? err.code : '';
      if (silent) return;
      if (code === 'PLATFORM_UNAVAILABLE') {
        this.toast('网络或登录服务暂不可用，可先本地游玩');
      } else {
        this.renderLoginRetry();
      }
    }
  }

  /** 登录失败的可重试浮层（不抹本地经营档，可跳过进入单机玩法）。 */
  private renderLoginRetry(): void {
    const overlay = this.modalOverlay();
    createRect({ width: 300, height: 250, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '平台登录未完成', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 92);
    createLabel({
      text: 'TapTap 登录暂时失败。\n你的经营进度只保存在本机，不会丢失。\n可重试登录，或先进入单机游玩。',
      fontSize: 13,
      color: THEME.text,
      width: 250,
      lineHeight: 22,
      parent: overlay,
    }).setPosition(0, 20);
    createButton({
      text: '重试登录',
      width: 220,
      height: 46,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.ensurePlatformLogin(false);
      },
    }).setPosition(0, -56);
    createButton({
      text: '先进入单机游玩',
      width: 220,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -106);
  }

  /** 首次启动隐私政策告知弹窗（R18：可在应用内读完全文；同意落盘成功前不登录/不外发）。 */
  private renderPrivacyDialog(): void {
    const layout = this.shellLayout();
    const overlay = this.modalOverlay();
    // R25：标题与底部操作固定，政策全文放可滚动正文（小屏也能读到结尾）
    const handle = openScrollableDialog({
      overlay,
      viewportHeight: layout.viewportHeight,
      title: '隐私保护提示',
      width: 320,
      desiredBodyHeight: 380,
      session: { semanticKey: `privacy-consent:${this.contextEpoch}`, kind: 'blocking-recovery', owner: this.dialogOwner() },
    });
    const contentWidth = 320 - 56;
    const body = handle.body;
    createLabel({
      text: PRIVACY_POLICY_TEXT.summary,
      fontSize: 12,
      color: THEME.text,
      width: contentWidth,
      lineHeight: 19,
      align: 'left',
      parent: body,
    });
    for (const section of PRIVACY_POLICY_TEXT.sections) {
      createLabel({
        text: section.heading,
        fontSize: 13,
        bold: true,
        color: THEME.primary,
        width: contentWidth,
        align: 'left',
        parent: body,
      });
      createLabel({
        text: section.body,
        fontSize: 12,
        color: THEME.text,
        width: contentWidth,
        lineHeight: 19,
        align: 'left',
        parent: body,
      });
    }
    createLabel({
      text: `生效日期：${PRIVACY_POLICY_TEXT.effectiveDate}  联系：${PRIVACY_POLICY_TEXT.contact}`,
      fontSize: 11,
      color: THEME.textWeak,
      width: contentWidth,
      align: 'left',
      parent: body,
    });

    createButton({
      text: '同意并继续',
      width: 168,
      height: 48,
      parent: handle.footer,
      onClick: () => void this.onAcceptPrivacy(handle),
    }).setPosition(-60, 0);
    createButton({
      text: '不同意并退出',
      width: 110,
      height: 48,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.textWeak,
      parent: handle.footer,
      onClick: () => {
        handle.close();
        const g = globalThis as { tap?: { exitMiniProgram?: () => void } };
        g.tap?.exitMiniProgram?.();
      },
    }).setPosition(87, 0);
  }

  private async onAcceptPrivacy(handle: DialogHandle): Promise<void> {
    if (!this.platform || this.privacyBusy) return;
    this.privacyBusy = true;
    try {
      // R18：同意记录必须先成功落盘，成功后才允许平台登录/外发
      await acceptPrivacy(this.platform);
    } catch {
      this.privacyBusy = false;
      handle.setError('同意记录保存失败，请重试或检查存储权限');
      return;
    }
    handle.close();
    await this.ensurePlatformLogin(false);
    await this.setupAdsAfterConsent();
    await this.setupLeaderboardAfterConsent();
    await this.setupCloudAfterConsent();
    this.render();
  }

  /** 打开隐私政策：真机经 tap 能力受限，最小实现为复制/展示 URL；web 用新窗口。 */
  private openPrivacyPolicy(url: string): void {
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '隐私政策链接',
      width: 316,
      desiredBodyHeight: 130,
      session: { semanticKey: `privacy-link:${this.contextEpoch}`, kind: 'notice', owner: this.dialogOwner() },
    });
    createLabel({ text: url, fontSize: 12, color: THEME.primary, width: 260, align: 'left', parent: handle.body });
    createLabel({
      text: '如未自动打开，请在浏览器访问以上地址查看完整政策。',
      fontSize: 12,
      color: THEME.textWeak,
      width: 260,
      lineHeight: 18,
      align: 'left',
      parent: handle.body,
    });
    createButton({
      text: '知道了',
      width: 240,
      height: 48,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
    // web/编辑器可直接打开；真机运行时没有 DOM，打开失败静默（链接已展示）
    try {
      const g = globalThis as { open?: (u: string) => void };
      g.open?.(url);
    } catch {
      // ignore：小游戏运行时无 window.open
    }
  }

  private lastForegroundMs = 0;
  private lastBackgroundMs = 0;
  /** R25：隐私同意落盘进行中（防止重复点击发起两次登录）。 */
  private privacyBusy = false;
  /** R15：前后台真实时间水位（去重/防回拨），替代固定 200ms 与无条件保存提示。 */
  private readonly fgClock = createForegroundClock(() => Date.now());
  private lastFrameMs = 0;
  private settlingForeground = false;
  private clockTickInFlight = false;
  private pendingForegroundSettlement = false;
  private pendingOnlineTick: { elapsedMs: number; runId: string; atMs: number } | null = null;
  private adCoordinator: AdRewardCoordinator | null = null;
  private adForegroundEligibleSinceMs = 0;
  private adFirstEligibleRunId: string | null = null;
  private persistenceRecoveryOverlay: Node | null = null;

  private async setupAdsAfterConsent(): Promise<void> {
    if (!this.facade || !this.platform || !(await hasAcceptedPrivacy(this.platform))) return;
    const config = await loadAdsConfig();
    const provider = new TapRewardedAdProvider(config.enabled, config.rewardedAdUnitId);
    this.adCoordinator = new AdRewardCoordinator(provider, this.facade, () => {
      const authEpoch = this.authEpoch;
      const contextEpoch = this.contextEpoch;
      const profileId = this.identity?.profileId ?? null;
      return () => this.authEpoch === authEpoch && this.contextEpoch === contextEpoch
        && (this.identity?.profileId ?? null) === profileId;
    }, () => this.adRewardOwnerScope(), () => {
      // DEV-02：身份核对中/网络未知 → owner 未确认，pending 保留待核对；
      // 已绑定平台身份但当前前台代际尚未确认 → 同样按未知处理；其余为 confirmed。
      if (this.identityVerification === 'verifying' || this.identityVerification === 'unavailable') return 'unknown';
      if (this.identity?.profileId
        && (this.identityVerification !== 'verified' || this.verifiedGeneration !== this.foregroundGeneration)) return 'unknown';
      return 'confirmed';
    });
    try { await this.adCoordinator.recoverInterruptedSession(); }
    catch { if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery(); }
  }

  private async setupLeaderboardAfterConsent(): Promise<void> {
    if (!this.platform || !(await hasAcceptedPrivacy(this.platform))) return;
    this.leaderboardConfig = await loadLeaderboardConfig();
    const consent = await this.platform.get<boolean>('ceo/leaderboard/consent/v1').catch(() => false) === true;
    if (consent !== this.leaderboardConsent) this.leaderboardConsentEpoch += 1;
    this.leaderboardConsent = consent;
    this.leaderboardSync ??= new LeaderboardSyncService(new TapLeaderboardProvider(), this.leaderboardConfig);
  }

  /**
   * A24-05：账号代际推进。换号后旧弹窗/旧榜单/旧云操作凭 epoch 失效，
   * 不把新账号的档写回旧上下文。
   */
  private async advanceAuthEpoch(): Promise<void> {
    const transition = () => {
      const previous = this.authEpoch;
      this.authEpoch += 1;
      this.facade?.setAdOwnerScope(this.adRewardOwnerScope());
      this.leaderboardSync?.changeAccount();
      this.pendingLeaderboard = null;
      invalidateDialogs('context-invalidated', { accountEpoch: previous });
    };
    if (this.facade) await this.facade.transitionOwner(transition);
    else transition();
  }

  /**
   * DEV-02：把身份解析结果原子应用到经营上下文。
   * identity.apply、authEpoch 推进、券 owner scope、榜换号、待补榜清理、旧弹窗失效
   * 在同一 transitionOwner 回调内完成；回调内不得再获取同一门（嵌套等待）。
   * 明显无变化（同账号重复确认/本就无身份）时不占切换门，避免打扰经营写入。
   */
  private async applyIdentityAtomically(identityResult: PlayerIdentityResult): Promise<PlayerIdentityResult> {
    const identity = this.identity;
    if (!identity) return { kind: 'unavailable', reason: 'identity-missing' };
    const currentProfileId = identity.profileId;
    const noChange = (identityResult.kind === 'verified' && identityResult.profileId === currentProfileId)
      || (identityResult.kind === 'unavailable' && currentProfileId === null);
    if (noChange) return identity.apply(identityResult);
    let result: PlayerIdentityResult = identityResult;
    const transition = () => {
      const beforeEpoch = identity.currentEpoch;
      result = identity.apply(identityResult);
      if (identity.currentEpoch !== beforeEpoch) {
        const previous = this.authEpoch;
        this.authEpoch += 1;
        this.facade?.setAdOwnerScope(this.adRewardOwnerScope());
        this.leaderboardSync?.changeAccount();
        this.pendingLeaderboard = null;
        this.cloudArchives = [];
        this.cloudArchiveOwner = null;
        invalidateDialogs('context-invalidated', { accountEpoch: previous });
      }
    };
    if (this.facade) await this.facade.transitionOwner(transition);
    else transition();
    return result;
  }

  /**
   * DEV-02：统一身份门。云备份/云恢复/旧未决核对/榜单提交/补榜等敏感操作前必须 await。
   * 返回 true：当前前台代际已用新平台登录态确认账号（有稳定 profileId），可按 owner 外发；
   * 返回 false：未确认（网络未知/无可信账号/代际已切换）——阻断外发，本地经营不受影响。
   * 非真机（编辑器/Web 预览）无真实平台账号可核对，沿用已注入/绑定的本地身份。
   */
  private async ensureVerifiedIdentity(reason: IdentityRefreshReason): Promise<boolean> {
    if (this.platform?.getEnvironment() !== 'TAPTAP') {
      return !!this.identity?.profileId && this.cloudProfileBound;
    }
    if (!this.auth || !this.identity || !this.cloudConfig) return false;
    const generation = this.foregroundGeneration;
    if (this.identityVerification === 'verified' && this.verifiedGeneration === generation
      && this.cloudProfileBound && this.identity.profileId) return true;
    if (this.identityRefreshInFlight) await this.identityRefreshInFlight;
    else await this.performIdentityRefresh(generation, reason);
    return this.identityVerification === 'verified'
      && this.verifiedGeneration === this.foregroundGeneration
      && !!this.identity?.profileId
      && this.cloudProfileBound;
  }

  /** DEV-02：按前台代际执行一次权威身份确认；同代际 UI 层共享，网络层 singleflight 在 AuthService。 */
  private async performIdentityRefresh(generation: number, reason: IdentityRefreshReason): Promise<void> {
    const auth = this.auth;
    const identity = this.identity;
    const config = this.cloudConfig;
    if (!auth || !identity || !config) return;
    this.identityVerification = 'verifying';
    const environment = config.environment === 'production' ? 'production' : 'test';
    const flight = (async () => {
      const result = await auth.refreshCurrentIdentity({
        reason,
        generation,
        stillCurrent: () => this.foregroundGeneration === generation,
      });
      // 前台代际已切换：结果丢弃，由新代际自行重新确认。
      if (this.foregroundGeneration !== generation) return;
      if (result.kind === 'verified') {
        const resolved = await new SessionPlayerIdentityProvider(
          () => auth.currentSession().catch(() => null),
          config.appId,
          environment,
        ).resolve();
        if (resolved.kind === 'verified') {
          const previousEpoch = identity.currentEpoch;
          const applied = await this.applyIdentityAtomically(resolved);
          if (applied.kind === 'verified' || applied.kind === 'changed') {
            if (identity.currentEpoch !== previousEpoch && this.platform) {
              // 确认换号/首绑：云服务改绑新 profile；旧云列表与归属已在切换回调内清空。
              this.cloudProvider = new TapCloudSaveProvider();
              this.cloudSync = new CloudSyncService(this.cloudProvider, this.platform, config,
                config.appId, environment, identity.profileId);
              if (applied.kind === 'changed') {
                this.cloudStatusText = '云备份：已切换账号；首次备份需确认归属当前账号';
              }
            }
            this.identityVerification = 'verified';
            this.verifiedGeneration = generation;
            this.cloudProfileBound = true;
            return;
          }
        }
        // 已登录但无稳定 profile（marker 会话/旧服务端）：未知而非换号——保留最近已确认身份，仅禁用云榜外发。
        this.identityVerification = 'unavailable';
        this.cloudProfileBound = false;
        return;
      }
      if (result.kind === 'superseded') {
        if (this.foregroundGeneration === generation) this.identityVerification = 'unverified';
        return;
      }
      // 网络未知/平台不可用：阻断外发，不清旧绑定、不产生账号切换副作用。
      this.identityVerification = 'unavailable';
    })();
    this.identityRefreshInFlight = flight.finally(() => { this.identityRefreshInFlight = null; });
    await this.identityRefreshInFlight;
  }

  private adRewardOwnerScope(): string {
    const profileId = this.identity?.profileId;
    if (!this.cloudConfig || !profileId) return 'local';
    const environment = this.cloudConfig.environment === 'production' ? 'production' : 'test';
    return `${this.cloudConfig.appId}/${environment}/${profileId}`;
  }

  private async setupCloudAfterConsent(): Promise<void> {
    if (!this.platform || !(await hasAcceptedPrivacy(this.platform))) return;
    this.cloudConfig = await loadCloudConfig();
    const environment = this.cloudConfig.environment === 'production' ? 'production' : 'test';
    // A24-05：身份只来自可信来源；开发者 OAuth / 昵称 / 设备号 / 随机每设备 ID 都不是账号。
    if (!this.identity || this.identity.appId !== this.cloudConfig.appId
      || this.identity.environment !== environment) {
      if (this.identity) await this.advanceAuthEpoch();
      this.identity = new PlayerIdentityState(this.cloudConfig.appId, environment);
    }
    // B2：云作用域先登记到 AuthService，缓存会话若属于其他 app/环境会被拒绝并重新换票。
    this.auth?.setExpectedScope(this.cloudConfig.appId, environment);
    await this.ensurePlatformLogin(true);
    // DEV-02：身份应用与 epoch/券scope/榜换号/旧弹窗失效在同一 owner 切换内完成。
    const identity = await this.applyIdentityAtomically(await new SessionPlayerIdentityProvider(
      () => this.auth?.currentSession() ?? Promise.resolve(null),
      this.cloudConfig.appId,
      environment,
    ).resolve());
    this.cloudProfileBound = identity.kind === 'verified';
    // DEV-02：启动身份基于缓存会话，不等于平台当前账号；敏感操作前由统一身份门强制刷新。
    this.identityVerification = 'unverified';
    this.lastBackupAuthEpoch = this.authEpoch;
    this.cloudProvider = new TapCloudSaveProvider();
    this.cloudSync = new CloudSyncService(this.cloudProvider, this.platform, this.cloudConfig,
      this.cloudConfig.appId, environment, this.identity.profileId);
    const status = await this.cloudSync.status();
    this.cloudProfileBound = status.profileId !== null;
    if (!this.cloudConfig.enabled) this.cloudStatusText = '云备份：未启用（当前进度只保存在本机）';
    else if (!status.available) this.cloudStatusText = '云备份：平台能力未就绪（仅本机保存）';
    else if (!status.profileId) this.cloudStatusText = '云备份：平台暂未提供可信账号标识，上传/恢复保持禁用';
    else this.cloudStatusText = status.pendingCheckpointId
      ? '云备份：上次结果待核对，请先点“恢复云档”核对，勿重复上传'
      : '云备份：已绑定账号，可手动备份/恢复';
  }

  // ---------------------------------------------------------------- A24-08 云备份/恢复

  private async ensureCloudDeviceId(): Promise<string> {
    const key = this.cloudScopeKey('device-instance');
    const existing = await this.platform!.get<string>(key).catch(() => null);
    if (typeof existing === 'string' && existing.length > 0) return existing;
    // 仅用于 checkpoint 分支溯源，不是玩家身份。
    const generated = `dev-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    await this.platform!.set(key, generated).catch(() => undefined);
    return generated;
  }

  private cloudScopeKey(name: string): string {
    const appId = this.cloudConfig?.appId ?? 'unconfigured';
    const environment = this.cloudConfig?.environment === 'production' ? 'production' : 'test';
    const profileId = this.identity?.profileId ?? 'unbound';
    return `ceo/cloud/v2/${encodeURIComponent(appId)}/${environment}/${encodeURIComponent(profileId)}/${name}`;
  }

  private cloudFailureText(result: { kind: string; reason?: string }): string {
    switch (result.reason) {
      case 'upload-rate-limited': return '距上次云备份不足 1 分钟，请稍后再试';
      case 'prior-create-needs-platform-reconciliation': return '上次上传结果未确认，请先打开“恢复云档”核对，避免重复创建';
      case 'account-switch-pending-create': return '账号已切换且有未决上传，请在本机核对后再操作';
      case 'legacy-create-needs-manual-reconciliation': return '旧版云上传结果无法确认所属账号，请先在原账号与设备核对，当前不会重放上传';
      case 'base-changed-after-download': return '下载期间本机已变化，请重新预览云档后再恢复';
      case 'closed-run-tombstone': return '该云档属于本机已关闭的公司，不能恢复';
      case 'active-ad-session': return '广告奖励会话进行中，请稍后再恢复';
      case 'account-profile-mismatch': return '云档与当前账号不一致，已拒绝恢复';
      case 'native-write-fence': return '本机存档写入未确认，请先完成恢复核对';
      default:
        if (result.kind === 'unsupported') return '当前平台未提供云备份能力（仅本机保存）';
        if (result.kind === 'unknown') return '云操作结果待核对，请稍后打开云档列表对账';
        return '云操作失败，本机进度未受影响';
    }
  }

  private async backupToCloud(allowNewCheckpointWithLegacy = false): Promise<void> {
    const sync = this.cloudSync;
    const facade = this.facade;
    const config = this.cloudConfig;
    if (!sync || !facade || !config) { this.toast('云备份尚未初始化'); return; }
    if (this.cloudBusy) { this.toast('云备份正在进行中'); return; }
    const syncStatus = await sync.status();
    if (syncStatus.legacyPending && !allowNewCheckpointWithLegacy) {
      this.showLegacyCloudReconciliation(syncStatus.legacyPending); return;
    }
    // DEV-02：统一身份门——缓存 TTL 不能证明平台未换号，备份前必须确认当前平台账号。
    if (!(await this.ensureVerifiedIdentity('cloud'))) {
      this.toast('平台账号暂时无法确认，本次云备份未发起；进度仍保存在本机'); return;
    }
    if (!this.cloudProfileBound || !this.identity?.profileId) { this.toast('云备份需平台可信账号；当前未提供，进度仍保存在本机'); return; }
    if (facade.getPersistenceStatus() !== 'ready') { this.toast('存档写入未确认，暂不能上传'); return; }
    const state = facade.getState();
    if (!state.company || state.phase === 'CREATING' || state.onboarding.initialHiresCompleted < 2) {
      this.toast('完成公司创建与首聘后才能备份'); return;
    }
    // DEV-02：确认换号后首次备份必须明确归属当前账号；玩家未确认前不自动备份。
    if (this.lastBackupAuthEpoch !== this.authEpoch) {
      this.confirmFirstBackupToCurrentAccount(allowNewCheckpointWithLegacy);
      return;
    }
    this.cloudBusy = true;
    try {
      const owner = { authEpoch: this.authEpoch, contextEpoch: this.contextEpoch,
        profileId: this.identity.profileId, runId: state.runId, revision: facade.getRevision() };
      const ownerCurrent = () => this.isCloudOwnerCurrent(owner);
      const nowMs = Date.now();
      const deviceId = await this.ensureCloudDeviceId();
      if (!ownerCurrent()) { this.toast('账号或本机进度已变化，本次备份未继续'); return; }
      const chainKey = this.cloudScopeKey('chain');
      const chain = await this.platform!.get<string[]>(chainKey).catch(() => null);
      if (!ownerCurrent()) { this.toast('账号或本机进度已变化，本次备份未继续'); return; }
      const parents = Array.isArray(chain) ? chain.filter((id) => typeof id === 'string').slice(-2) : [];
      const checkpoint = facade.captureCloudCheckpoint({
        appId: config.appId,
        environment: config.environment === 'production' ? 'production' : 'test',
        cloudProfileId: this.identity.profileId,
        checkpointId: `${state.runId}:${facade.getRevision()}:${nowMs.toString(36)}`,
        parentCheckpointIds: parents,
        resetEpoch: { id: state.runId, parentId: parents[0] ?? null, closedRunId: null },
        deviceInstanceId: deviceId,
        capturedAtMs: nowMs,
      });
      const path = this.cloudProvider?.defaultFilePath?.(`ceo-cloud-${checkpoint.checkpointId.replace(/[^A-Za-z0-9]/g, '')}.json`);
      if (!path) { this.toast('平台未提供可写存档目录，本次未上传'); return; }
      const result = await sync.backup(checkpoint, path, `backup:${checkpoint.checkpointId}`, nowMs, ownerCurrent,
        { allowNewCheckpointWithLegacy });
      if (result.kind !== 'ok') {
        this.cloudStatusText = result.kind === 'unknown'
          ? '云备份：上次结果待核对，请先核对云档'
          : `云备份：${this.cloudFailureText(result)}`;
        this.toast(this.cloudFailureText(result));
        return;
      }
      if (!ownerCurrent()) { this.toast('云备份已返回，但账号或本机进度变化；结果保留在原账号，请重新核对'); return; }
      await this.platform!.set(chainKey, [...parents, checkpoint.checkpointId].slice(-2)).catch(() => undefined);
      this.lastBackupAuthEpoch = this.authEpoch;
      this.cloudStatusText = allowNewCheckpointWithLegacy
        ? '云备份：已另建独立新档；旧未决记录仍保持隔离'
        : '云备份：已完成；可用同一冻结档提交公开榜';
      this.toast(allowNewCheckpointWithLegacy
        ? `已另建新云档：第${checkpoint.summary.year}年${checkpoint.summary.month}月（未重发旧上传）`
        : `云备份成功：第${checkpoint.summary.year}年${checkpoint.summary.month}月`);
      await this.submitLeaderboardReceipt(checkpoint);
    } finally {
      this.cloudBusy = false;
    }
  }

  /**
   * DEV-02：确认换号后的首次云备份。本机公司保留，但上传前必须明确归属当前账号；
   * 玩家取消则 lastBackupAuthEpoch 保持旧值，后续任何（自动/手动）备份仍会先询问。
   */
  private confirmFirstBackupToCurrentAccount(allowNewCheckpointWithLegacy: boolean): void {
    const state = this.facade?.getState();
    const yearText = state ? `第${state.gameYear}年${state.gameMonth}月` : '当前进度';
    openConfirmDialog({
      overlay: this.modalOverlay(), viewportHeight: this.shellLayout().viewportHeight,
      title: '备份到当前账号',
      message: '检测到平台账号已切换。确认后会把当前本机公司'
        + `（${yearText}）备份到当前账号的云空间；不会改动云端可能存在的其他账号数据，也不会删除本机进度。`,
      confirmText: '将当前本机公司备份到当前账号',
      cancelText: '暂不备份',
      session: { semanticKey: `first-backup:${this.authEpoch}:${this.contextEpoch}`, kind: 'confirm', owner: this.dialogOwner() },
      onConfirm: (dialog) => {
        dialog.succeed();
        // 用户确认即完成本 epoch 的归属授权；先落 epoch 再重进备份流程，
        // 否则 lastBackupAuthEpoch 仍旧值会无限重复弹确认、永远走不到上传。
        this.lastBackupAuthEpoch = this.authEpoch;
        void this.backupToCloud(allowNewCheckpointWithLegacy).then(() => this.render());
      },
      onCancel: () => undefined,
    });
  }

  /** A24-09：只有云确认成功回执的同一冻结快照才驱动两榜；同意/身份/epoch 任一失效即停止。 */
  private async submitLeaderboardReceipt(checkpoint: CloudCheckpointV1): Promise<void> {
    const sync = this.leaderboardSync;
    if (!sync || !this.leaderboardConfig) return;
    if (!this.leaderboardConsent) return; // 同意与开榜都不隐含；撤回即不再外发
    // DEV-02：榜单外发同样过统一身份门（备份流程已过时瞬时返回）。
    if (!(await this.ensureVerifiedIdentity('leaderboard'))) return;
    const epoch = this.authEpoch;
    const runId = checkpoint.snapshot.runId;
    const consentEpoch = this.leaderboardConsentEpoch;
    const stillCurrent = (): boolean =>
      this.leaderboardConsent && this.leaderboardConsentEpoch === consentEpoch
      && this.authEpoch === epoch && this.identity?.profileId === checkpoint.cloudProfileId
      && this.facade.getState().runId === runId;
    const result = await sync.submitCloudConfirmed(checkpoint.snapshot.payload, checkpoint.checkpointId, Date.now(), stillCurrent);
    if (result.assets === 'skipped' && result.years === 'skipped') {
      if (result.reason === 'engineering-rate-limit') {
        this.pendingLeaderboard = { checkpointId: checkpoint.checkpointId, snapshot: checkpoint.snapshot.payload, runId, epoch, assets: false, years: false };
        this.toast('公开榜节流中：稍后可在设置里补发，不重复上传云档');
      }
      return;
    }
    if (result.assets === 'synced' && result.years === 'synced') {
      this.pendingLeaderboard = null;
      this.toast('公开榜已同步：总资产与经营年限');
      return;
    }
    this.pendingLeaderboard = {
      checkpointId: checkpoint.checkpointId, snapshot: checkpoint.snapshot.payload, runId, epoch,
      assets: result.assets === 'synced', years: result.years === 'synced',
    };
    this.toast(`公开榜部分完成：资产榜${result.assets === 'synced' ? '已同步' : '待重试'}，年限榜${result.years === 'synced' ? '已同步' : '待重试'}`);
  }

  private async retryPendingLeaderboard(): Promise<void> {
    const pending = this.pendingLeaderboard;
    const sync = this.leaderboardSync;
    if (!pending || !sync) { this.toast('没有待补发的榜单'); return; }
    if (!this.leaderboardConsent) { this.toast('公开榜同意已撤回，停止补发'); return; }
    // DEV-02：补榜前确认当前平台账号；未确认不补发也不丢弃（上下文校验仍按原 epoch）。
    if (!(await this.ensureVerifiedIdentity('leaderboard'))) { this.toast('平台账号暂时无法确认，请稍后再试'); return; }
    if (this.authEpoch !== pending.epoch || this.facade.getState().runId !== pending.runId) {
      this.pendingLeaderboard = null;
      this.toast('上下文已变化，旧榜单结果不再补发');
      return;
    }
    const consentEpoch = this.leaderboardConsentEpoch;
    const stillCurrent = (): boolean => this.leaderboardConsent && this.leaderboardConsentEpoch === consentEpoch
      && this.authEpoch === pending.epoch && this.facade.getState().runId === pending.runId;
    const result = await sync.submitCloudConfirmed(pending.snapshot, pending.checkpointId, Date.now(), stillCurrent);
    if (result.assets === 'synced' && result.years === 'synced') {
      this.pendingLeaderboard = null;
      this.toast('公开榜补发完成');
    } else {
      this.pendingLeaderboard = { ...pending, assets: result.assets === 'synced', years: result.years === 'synced' };
      this.toast(result.reason === 'engineering-rate-limit' ? '仍在节流期内，请稍后再试' : '榜单补发未全部成功，稍后再试');
    }
  }

  private async openCloudRestore(): Promise<void> {
    const sync = this.cloudSync;
    if (!sync) { this.toast('云备份尚未初始化'); return; }
    if (this.cloudBusy) { this.toast('云操作进行中'); return; }
    const syncStatus = await sync.status();
    if (syncStatus.legacyPending) { this.showLegacyCloudReconciliation(syncStatus.legacyPending); return; }
    // DEV-02：统一身份门——先确认当前平台账号再谈暂停/预览，避免暂停后才发现账号未确认。
    if (!(await this.ensureVerifiedIdentity('cloud'))) { this.toast('平台账号暂时无法确认，请稍后再试'); return; }
    if (!this.cloudProfileBound || !this.identity?.profileId) { this.toast('云恢复需平台可信账号；当前未提供'); return; }
    // A1：正在经营时先让用户明确选择暂停/保持；不偷偷停经营，也不假装暂停。
    if (this.facade.getState().speed > 0) { this.renderCloudPreviewChoice(); return; }
    await this.openCloudRestoreList();
  }

  /** A1：云档预览前的三选一（暂停并预览 / 保持经营 / 返回）。 */
  private renderCloudPreviewChoice(): void {
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(), viewportHeight: this.shellLayout().viewportHeight,
      title: '恢复云档前选择时钟状态', width: 330, desiredBodyHeight: 240,
      session: { semanticKey: `cloud-pause-choice:${this.contextEpoch}`, kind: 'confirm', owner: this.dialogOwner() },
    });
    createLabel({
      text: '经营正在运行，月结会改变本机进度，使云档预览的基线失效。\n\n'
        + '暂停经营并预览：先暂停并确认写入本机存档，再读取云档；取消预览后仍保持暂停。\n\n'
        + '保持经营并预览：不暂停时钟；若期间本机变化，确认会被安全拒绝，需要暂停后重新预览。',
      fontSize: 13, color: THEME.text, width: 292, lineHeight: 20, align: 'left', parent: handle.body,
    });
    createButton({
      text: '暂停经营并预览', width: 270, height: 48, parent: handle.body,
      onClick: () => {
        handle.close();
        void (async () => {
          if (!(await this.pauseForCloudPreview())) return;
          await this.openCloudRestoreList();
        })();
      },
    });
    createButton({
      text: '保持经营并预览', width: 270, height: 48, variant: 'secondary',
      color: THEME.divider, textColor: THEME.text, parent: handle.footer,
      onClick: () => { handle.close(); void this.openCloudRestoreList(); },
    }).setPosition(0, 28);
    createButton({
      text: '返回', width: 270, height: 48, variant: 'secondary',
      color: THEME.divider, textColor: THEME.text, parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, -28);
  }

  /**
   * A1：显式暂停并等待持久化成功。失败时不假装暂停、也不沿用旧基线。
   * 已暂停时直接返回 true（不覆盖用户原本的暂停选择）。
   */
  private async pauseForCloudPreview(): Promise<boolean> {
    const facade = this.facade;
    if (!facade) return false;
    const before = facade.getState();
    if (before.speed !== 0) {
      const r = await facade.setSpeed(0, { commandId: nextCommandId('speed'), expectedRunId: before.runId });
      if (!r.ok) { this.toast(r.displayMessage); return false; }
      this.cloudPausedForPreview = true;
      this.cloudPausedFromSpeed = before.speed;
      audioManager.speedChange();
    }
    if (facade.getState().speed !== 0) { this.toast('暂停未生效，本次不打开云档预览'); return false; }
    if (facade.getPersistenceStatus() !== 'ready') {
      this.toast('暂停写入未确认，请先在存档恢复提示中重试后再预览');
      return false;
    }
    for (const btn of this.speedButtons) this.paintSpeedButton(btn.node, btn.speed === 0);
    return true;
  }

  /** A1：预览取消/列表关闭后保持暂停，并提供明确的“继续经营”。 */
  private offerResumeAfterCloudPreview(): void {
    if (!this.cloudPausedForPreview) return;
    if (this.facade.getState().speed !== 0) { this.cloudPausedForPreview = false; return; }
    this.renderCloudResumeNotice('已关闭云档预览，经营保持暂停');
  }

  private renderCloudResumeNotice(message: string): void {
    const target: GameSpeed = this.cloudPausedFromSpeed === 0 ? 1 : this.cloudPausedFromSpeed;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(), viewportHeight: this.shellLayout().viewportHeight,
      title: '经营已暂停', width: 320, desiredBodyHeight: 150,
      session: { semanticKey: `cloud-resume:${this.contextEpoch}`, kind: 'notice', owner: this.dialogOwner() },
    });
    createLabel({
      text: `${message}。\n当前时间：暂停（不会在后台自动恢复倍速）。\n继续经营可恢复 ${this.speedLabel(target)}；也可保持暂停稍后手动切换。`,
      fontSize: 13, color: THEME.text, width: 284, lineHeight: 20, align: 'left', parent: handle.body,
    });
    createButton({
      text: `继续经营（${this.speedLabel(target)}）`, width: 270, height: 48, parent: handle.footer,
      onClick: () => {
        handle.close();
        this.cloudPausedForPreview = false;
        void this.onSetSpeed(target);
      },
    }).setPosition(0, 28);
    createButton({
      text: '保持暂停', width: 270, height: 48, variant: 'secondary',
      color: Color.WHITE, textColor: THEME.textWeak, parent: handle.footer,
      onClick: () => { this.cloudPausedForPreview = false; handle.close(); },
    }).setPosition(0, -28);
  }

  private async openCloudRestoreList(): Promise<void> {
    const sync = this.cloudSync;
    if (!sync) { this.toast('云备份尚未初始化'); return; }
    if (this.cloudBusy) { this.toast('云操作进行中'); return; }
    const syncStatus = await sync.status();
    if (syncStatus.legacyPending) { this.showLegacyCloudReconciliation(syncStatus.legacyPending); return; }
    // DEV-02：统一身份门（已确认时瞬时返回）。
    if (!(await this.ensureVerifiedIdentity('cloud'))) { this.toast('平台账号暂时无法确认，请稍后再试'); return; }
    if (!this.cloudProfileBound || !this.identity?.profileId) { this.toast('云恢复需平台可信账号；当前未提供'); return; }
    this.cloudBusy = true;
    try {
      const owner = { authEpoch: this.authEpoch, contextEpoch: this.contextEpoch,
        profileId: this.identity.profileId, runId: this.facade!.getState().runId, revision: this.facade!.getRevision() };
      const result = await sync.list(`list:${Date.now().toString(36)}`, () => this.isCloudOwnerCurrent(owner));
      if (result.kind !== 'ok') { this.toast(this.cloudFailureText(result)); return; }
      if (!this.isCloudOwnerCurrent(owner)) { this.toast('账号或本机进度已变化，请重新打开云档列表'); return; }
      this.cloudArchives = result.value;
      this.cloudArchiveOwner = owner;
      this.renderCloudArchiveList();
    } finally {
      this.cloudBusy = false;
    }
  }

  /**
   * A2：旧全局 pending 的出口。
   * - 核对只读（list/download/本地校验），绝不重放旧 create、绝不删除旧云档；
   * - 另建新备份必须由玩家明确确认，创建独立 checkpoint，旧记录继续隔离。
   */
  private showLegacyCloudReconciliation(pending: PendingCreate): void {
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(), viewportHeight: this.shellLayout().viewportHeight,
      title: '旧云上传待核对', width: 330, desiredBodyHeight: 300,
      session: { semanticKey: `legacy-cloud-pending:${pending.operationId}`, kind: 'form', owner: this.dialogOwner() },
    });
    createLabel({
      text: `操作编号：${pending.operationId}\n存档编号：${pending.checkpointId}\n记录时间：${new Date(pending.createdAtMs).toLocaleString('zh-CN')}\n\n`
        + '旧版记录没有可校验的账号与环境范围，因此系统不会自动按当前账号重放上传，也不会删除云档或记录。\n'
        + '“核对旧备份”只读取当前账号可见的云档，并校验 app/环境/账号/存档编号；全程不会创建新云档。',
      fontSize: 13, color: THEME.text, width: 292, lineHeight: 20, align: 'left', parent: handle.body,
    });
    createButton({
      text: '核对旧备份（只读）', width: 270, height: 48, parent: handle.body,
      onClick: () => { handle.close(); void this.reconcileLegacyCloud(pending); },
    });
    createButton({
      text: '保留旧未决，另建新备份', width: 270, height: 48, variant: 'secondary',
      color: THEME.divider, textColor: THEME.text, parent: handle.body,
      onClick: () => { handle.close(); this.confirmNewBackupDespiteLegacy(pending); },
    });
    createButton({
      text: '关闭', width: 270, height: 48, variant: 'secondary',
      color: THEME.divider, textColor: THEME.text, parent: handle.body,
      onClick: () => handle.close(),
    });
  }

  private async reconcileLegacyCloud(pending: PendingCreate): Promise<void> {
    const sync = this.cloudSync;
    const facade = this.facade;
    if (!sync || !facade || this.cloudBusy) { this.toast('云服务暂不可用或正在处理其他操作'); return; }
    // DEV-02：旧未决核对是只读操作，但核对结论会绑定到身份；先过统一身份门。
    if (!(await this.ensureVerifiedIdentity('cloud'))) { this.toast('平台账号暂时无法确认，请稍后再核对'); return; }
    if (!this.identity?.profileId) { this.toast('核对旧备份需要平台可信账号'); return; }
    const owner = { authEpoch: this.authEpoch, contextEpoch: this.contextEpoch, profileId: this.identity.profileId };
    this.cloudBusy = true;
    try {
      const path = this.cloudProvider?.defaultFilePath?.(`ceo-legacy-reconcile-${Date.now().toString(36)}.json`) ?? 'ceo-legacy-reconcile.json';
      const result = await sync.reconcileLegacyPending(pending, path, Date.now(),
        () => this.isCloudIdentityCurrent(owner));
      this.renderLegacyReconcileOutcome(pending, result);
      if (result.kind === 'ok') {
        const status = await sync.status();
        this.cloudStatusText = status.pendingCheckpointId
          ? '云备份：上次结果待核对，请先点“恢复云档”核对，勿重复上传'
          : '云备份：已绑定账号，可手动备份/恢复';
      }
    } finally {
      this.cloudBusy = false;
    }
  }

  private renderLegacyReconcileOutcome(
    pending: PendingCreate,
    result: { kind: string; reason?: string; value?: { archiveCheckpointId?: string } },
  ): void {
    let title = '核对结果';
    let message: string;
    if (result.kind === 'ok') {
      title = '已核对，未重发上传';
      message = `当前账号下唯一匹配到原存档：\n${result.value?.archiveCheckpointId ?? pending.checkpointId}\n\n`
        + '该记录已登记为“已确认”，原始 legacy 记录已清理；旧云档保留未删除。\n本次核对 create=0。';
    } else if (result.kind === 'missing' && result.reason === 'legacy-create-not-found') {
      title = '未查到该云档';
      message = `当前账号列表中没有找到存档 ${pending.checkpointId}。\n\n`
        + '“没有查到”不等于原上传失败：可能是原上传属于其他账号、已过期或平台未返回。系统不会重发旧上传，也不会删除记录。\n本次核对 create=0。';
    } else if (result.kind === 'missing') {
      title = '旧记录已不存在';
      message = '本机已没有该 legacy 记录（可能已被其他流程清理），本次未创建任何云档。';
    } else if (result.reason === 'duplicate-checkpoint-metadata') {
      title = '存在重复记录';
      message = '当前账号下发现多条相同存档编号的云档，无法确认唯一归属，已保持隔离。\n本次核对 create=0。';
    } else if (result.reason === 'legacy-account-mismatch') {
      title = '属于其他账号';
      message = '该云档属于其他账号范围，不能迁移到当前账号；原记录继续隔离，未创建新档。';
    } else if (result.reason === 'legacy-scope-mismatch') {
      title = '应用或环境不一致';
      message = '该云档的 app/环境与当前配置不一致，已拒绝迁移；未创建新档。';
    } else if (String(result.reason ?? '').startsWith('legacy-list-')) {
      title = '列表读取失败';
      message = '暂时无法读取云档列表，未确认旧上传结果。原记录继续保持隔离，未创建新档。可稍后重试核对。';
    } else {
      title = '校验未通过';
      message = `下载或校验未通过（${result.reason ?? result.kind}）。原记录继续保持隔离，未创建新档。`;
    }
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(), viewportHeight: this.shellLayout().viewportHeight,
      title, width: 324, desiredBodyHeight: 240,
      session: { semanticKey: `legacy-reconcile:${pending.operationId}:${result.kind}:${result.reason ?? ''}`, kind: 'notice', owner: this.dialogOwner() },
    });
    createLabel({ text: message, fontSize: 13, color: THEME.text, width: 286, lineHeight: 20, align: 'left', parent: handle.body });
    createButton({ text: '知道了', width: 260, height: 48, parent: handle.footer, onClick: () => handle.close() }).setPosition(0, 0);
  }

  private confirmNewBackupDespiteLegacy(pending: PendingCreate): void {
    openConfirmDialog({
      overlay: this.modalOverlay(), viewportHeight: this.shellLayout().viewportHeight,
      title: '另建新备份',
      message: `旧未决记录（${pending.operationId}）会继续保留，系统不会重试旧上传，也不会删除旧云档。\n\n`
        + '确认后会基于当前本机进度创建全新的 checkpoint 与 operation；它可能与旧云档并存。'
        + `若距上次备份不足 1 分钟，会先提示稍后再试。\n\n旧存档可能已经存在于云端，本次不是“重试旧上传”。`,
      confirmText: '确认另建新备份', cancelText: '取消',
      session: { semanticKey: `legacy-new-backup:${pending.operationId}:${this.contextEpoch}`, kind: 'confirm', owner: this.dialogOwner() },
      onConfirm: (dialog) => {
        dialog.succeed();
        void this.backupToCloud(true).then(() => this.render());
      },
      onCancel: () => undefined,
    });
  }

  private archiveMeta(ref: CloudArchiveRef): { checkpointId?: string; year?: number; month?: number; capturedAtMs?: number; parents?: string[] } | null {
    if (typeof ref.extra !== 'string') return null;
    try {
      const raw = JSON.parse(ref.extra) as Record<string, unknown>;
      const parents = Array.isArray(raw.parentCheckpointIds) ? raw.parentCheckpointIds.filter((x): x is string => typeof x === 'string') : undefined;
      return {
        ...(typeof raw.checkpointId === 'string' ? { checkpointId: raw.checkpointId } : {}),
        ...(Number.isSafeInteger(raw.year) ? { year: raw.year as number } : {}),
        ...(Number.isSafeInteger(raw.month) ? { month: raw.month as number } : {}),
        ...(Number.isSafeInteger(raw.capturedAtMs) ? { capturedAtMs: raw.capturedAtMs as number } : {}),
        ...(parents ? { parents } : {}),
      };
    } catch { return null; }
  }

  private renderCloudArchiveList(): void {
    const s = this.state();
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '云档列表',
      subtitle: '整档恢复，不合并现金与员工',
      width: 330,
      desiredBodyHeight: 360,
      session: {
        semanticKey: `cloud-list:${s.runId}:${this.contextEpoch}`,
        kind: 'form',
        owner: this.dialogOwner(),
      },
    });
    if (this.cloudArchives.length === 0) {
      createLabel({
        text: '当前账号下没有可用云档。可先在设置里“备份到云”。',
        fontSize: 13, color: THEME.textWeak, width: 286, lineHeight: 20, align: 'left', parent: handle.body,
      });
    }
    for (const ref of this.cloudArchives) {
      const meta = this.archiveMeta(ref);
      const year = meta?.year;
      const month = meta?.month;
      const time = meta?.capturedAtMs ? new Date(meta.capturedAtMs).toLocaleString('zh-CN') : '时间未知';
      const label = year && month ? `第${year}年${month}月｜${time}` : `${ref.summary ?? '云档'}｜${time}`;
      createLabel({
        text: label, fontSize: 12, color: THEME.text, width: 270, lineHeight: 18, align: 'left', parent: handle.body,
      });
      createButton({
        text: '恢复此档',
        width: 270, height: 44, variant: 'secondary', color: THEME.divider, textColor: THEME.text, parent: handle.body,
        onClick: () => { handle.close(); void this.prepareCloudRestore(ref, this.cloudArchiveOwner); },
      });
    }
    createButton({
      text: '关闭', width: 260, height: 48, parent: handle.footer,
      onClick: () => { handle.close(); this.offerResumeAfterCloudPreview(); },
    }).setPosition(0, 0);
  }

  private async prepareCloudRestore(
    ref: CloudArchiveRef,
    owner: { authEpoch: number; contextEpoch: number; profileId: string; runId: string; revision: number } | null,
  ): Promise<void> {
    if (!owner || !this.isCloudIdentityCurrent(owner)) { this.toast('账号或本机进度已变化，请重新打开云档列表'); return; }
    // DEV-02：预览生成前确认当前平台账号（列表已过时瞬时返回）。
    if (!(await this.ensureVerifiedIdentity('cloud'))) { this.toast('平台账号暂时无法确认，请重新打开云档列表'); return; }
    const out = await this.downloadCloudPreview(ref, owner);
    if (!out.ok) {
      if (out.reason === 'base-changed-after-download') {
        this.renderCloudPreviewExpired(() => {
          void (async () => {
            if (this.facade.getState().speed > 0 && !(await this.pauseForCloudPreview())) return;
            await this.prepareCloudRestore(ref, owner);
          })();
        });
        return;
      }
      if (out.reason === 'owner-changed') { this.toast('账号已变化，请重新打开云档列表'); return; }
      this.toast(this.cloudFailureText({ kind: 'unavailable', reason: out.reason }));
      return;
    }
    this.confirmCloudRestoreShell(ref, out.preview, out.owner, out.relation);
  }

  /** 下载并校验云档；基线以调用时的 run/revision 为准，下载后再由确认步骤做 CAS 复核。 */
  private async downloadCloudPreview(
    ref: CloudArchiveRef,
    owner: { authEpoch: number; contextEpoch: number; profileId: string; runId: string; revision: number },
  ): Promise<
    | { ok: true; preview: CloudRestorePreview; owner: typeof owner; relation: CloudHeadRelation }
    | { ok: false; reason: string }
  > {
    const sync = this.cloudSync;
    const facade = this.facade;
    if (!sync || !facade) return { ok: false, reason: 'unavailable' };
    if (this.cloudBusy) return { ok: false, reason: 'busy' };
    const liveOwner = { ...owner, runId: facade.getState().runId, revision: facade.getRevision() };
    // 保持经营时 revision 会随每次 tick 推进：下载期间只校验身份与局面，
    // 基线由 prepareRestore 在下载完成那一刻捕获（之后的变化交给确认步骤拒绝）。
    const ownerCurrent = () => this.isCloudIdentityCurrent(liveOwner)
      && this.facade?.getState().runId === liveOwner.runId;
    this.cloudBusy = true;
    const path = this.cloudProvider?.defaultFilePath?.(`ceo-restore-preview-${Date.now().toString(36)}.json`) ?? 'ceo-restore-preview.json';
    let prepared: Awaited<ReturnType<CloudSyncService['prepareRestore']>>;
    try {
      prepared = await sync.prepareRestore(ref, path, `restore-preview:${Date.now().toString(36)}`, facade,
        undefined, ownerCurrent,
        { authEpoch: liveOwner.authEpoch, contextEpoch: liveOwner.contextEpoch });
    } finally { this.cloudBusy = false; }
    if (prepared.kind !== 'ok') {
      const reason = prepared.kind === 'unavailable' || prepared.kind === 'unknown' ? prepared.reason ?? prepared.kind : prepared.kind;
      return { ok: false, reason };
    }
    if (!ownerCurrent()) return { ok: false, reason: 'owner-changed' };
    const relation = await this.cloudHeadRelation(prepared.value);
    if (!ownerCurrent()) return { ok: false, reason: 'owner-changed' };
    const settledOwner = { ...liveOwner, runId: prepared.value.base.runId, revision: prepared.value.base.revision };
    return { ok: true, preview: prepared.value, owner: settledOwner, relation };
  }

  /** A1：保持经营导致基线失效时保留窗口，只提供“暂停并重新预览”或关闭。 */
  private renderCloudPreviewExpired(onRetry: () => void): void {
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(), viewportHeight: this.shellLayout().viewportHeight,
      title: '预览基线已失效', width: 320, desiredBodyHeight: 170,
      session: { semanticKey: `cloud-preview-expired:${this.contextEpoch}`, kind: 'confirm', owner: this.dialogOwner() },
    });
    createLabel({
      text: '保持经营期间本机进度已变化（月结/操作），旧预览不能安全确认。\n\n'
        + '系统不会把基线直接改成最新版本。可暂停经营后重新读取云档；本次不会导入任何内容。',
      fontSize: 13, color: THEME.text, width: 284, lineHeight: 20, align: 'left', parent: handle.body,
    });
    createButton({
      text: '暂停并重新预览', width: 270, height: 48, parent: handle.footer,
      onClick: () => { handle.close(); onRetry(); },
    }).setPosition(0, 28);
    createButton({
      text: '关闭', width: 270, height: 48, variant: 'secondary',
      color: Color.WHITE, textColor: THEME.textWeak, parent: handle.footer,
      onClick: () => { handle.close(); this.offerResumeAfterCloudPreview(); },
    }).setPosition(0, -28);
  }

  private async cloudHeadRelation(preview: CloudRestorePreview): Promise<CloudHeadRelation> {
    const chain = await this.platform?.get<string[]>(this.cloudScopeKey('chain')).catch(() => null);
    const validChain = Array.isArray(chain) ? chain.filter((id) => typeof id === 'string') : [];
    const localHead = validChain.length > 0 ? validChain[validChain.length - 1]! : null;
    const graph = new Map<string, readonly string[]>();
    for (const ref of this.cloudArchives) {
      const meta = this.archiveMeta(ref);
      if (meta?.checkpointId) graph.set(meta.checkpointId, meta.parents ?? []);
    }
    graph.set(preview.checkpoint.checkpointId, preview.checkpoint.parentCheckpointIds);
    return compareCloudHeads(localHead, preview.checkpoint.checkpointId, graph);
  }

  private confirmCloudRestoreShell(
    ref: CloudArchiveRef,
    preview: CloudRestorePreview,
    owner: { authEpoch: number; contextEpoch: number; profileId: string; runId: string; revision: number },
    relation: CloudHeadRelation,
  ): void {
    let currentPreview = preview;
    let currentOwner = owner;
    let currentRelation = relation;
    const checkpoint = preview.checkpoint;
    const buildMessage = () => {
      const cp = currentPreview.checkpoint;
      return `云档第${cp.summary.year}年${cp.summary.month}月｜现金${moneyText(cp.summary.cashYuan)}｜资产${moneyText(cp.summary.assetsYuan)}｜员工${cp.summary.employeeCount}人\n`
        + `存档时间：${new Date(cp.capturedAtMs).toLocaleString('zh-CN')}\n分支关系：${this.cloudHeadRelationText(currentRelation)}\n\n`
        + '确认后整档替换本机经营；不合并现金/员工。本机广告券与消费账本保留，恢复不产生离线收益。'
        + '若本机期间变化，确认会被安全拒绝，可“暂停并重新预览”。';
    };
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '恢复云档',
      message: buildMessage(),
      confirmText: '确认整档替换',
      cancelText: '取消',
      session: {
        semanticKey: `cloud-restore:${checkpoint.checkpointId}:${this.contextEpoch}`,
        kind: 'confirm',
        owner: this.dialogOwner(),
      },
      // A1：基线失效后保留窗口；重新预览一定先暂停并等待持久化成功，再以新基线下发。
      onRefreshPreview: async () => {
        if (!this.isCloudIdentityCurrent(currentOwner)) throw new Error('账号已变化，请关闭后重新打开云档列表');
        if (this.facade.getState().speed > 0) {
          const paused = await this.pauseForCloudPreview();
          if (!paused) throw new Error('暂停经营失败，未重新读取云档');
        }
        const out = await this.downloadCloudPreview(ref, currentOwner);
        if (!out.ok) {
          throw new Error(`重新预览失败：${this.cloudFailureText({ kind: 'unavailable', reason: out.reason })}`);
        }
        currentPreview = out.preview;
        currentOwner = out.owner;
        currentRelation = out.relation;
        return { message: buildMessage(), confirmText: '确认整档替换', confirmEnabled: true };
      },
      onConfirm: (dialog) => this.confirmCloudRestore(dialog, currentPreview, currentOwner),
      onCancel: () => this.offerResumeAfterCloudPreview(),
    });
  }

  private cloudHeadRelationText(relation: CloudHeadRelation): string {
    switch (relation) {
      case 'same': return '与本机云档相同';
      case 'cloud-descends-from-local': return '云档沿本机已知父链更新';
      case 'local-descends-from-cloud': return '本机云头沿此档已知父链更新';
      case 'conflict': return '检测到分支冲突';
      default: return '父链信息不足，无法判定';
    }
  }

  private isCloudOwnerCurrent(owner: { authEpoch: number; contextEpoch: number; profileId: string; runId: string; revision: number }): boolean {
    return this.isCloudIdentityCurrent(owner)
      && this.facade?.getState().runId === owner.runId
      && this.facade.getRevision() === owner.revision;
  }

  private isCloudIdentityCurrent(owner: { authEpoch: number; contextEpoch: number; profileId: string }): boolean {
    return this.authEpoch === owner.authEpoch && this.contextEpoch === owner.contextEpoch
      && this.identity?.profileId === owner.profileId;
  }

  private async confirmCloudRestore(dialog: import('./dialogs').DialogHandle, preview: CloudRestorePreview,
    owner: { authEpoch: number; contextEpoch: number; profileId: string; runId: string; revision: number }): Promise<void> {
    const sync = this.cloudSync;
    if (!sync || !this.facade) { dialog.fail('云服务尚未初始化'); return; }
    // DEV-02：确认恢复是敏感外发，先过统一身份门；未确认明确失败可重试，不静默放行。
    if (!(await this.ensureVerifiedIdentity('cloud'))) { dialog.fail('平台账号暂时无法确认，请稍后重试'); return; }
    if (!this.isCloudOwnerCurrent(owner)) {
      // 运行中本机进度推进只影响 revision：旧预览必须作废，但身份/局面仍有效，
      // 给出“暂停并重新预览”这条明确出口；身份或局面变化才要求重开列表。
      if (this.isCloudIdentityCurrent(owner) && this.facade.getState().runId === owner.runId) {
        dialog.markExpired('本机经营已变化，旧预览与当前进度不一致；请暂停并重新预览', '暂停并重新预览');
      } else {
        dialog.markExpired('账号或本机进度已变化，请重新打开云档预览');
      }
      return;
    }
    const ownerCurrent = () => this.isCloudOwnerCurrent(owner);
    const result = await sync.confirmRestore(preview, this.facade, Date.now(), ownerCurrent);
    if (result.kind !== 'ok') {
      const reason = result.kind === 'unavailable' || result.kind === 'unknown' ? result.reason : '';
      if (reason === 'base-changed-after-download') {
        dialog.markExpired('本机经营已变化，旧预览与当前进度不一致；请暂停并重新预览', '暂停并重新预览');
        return;
      }
      if (result.kind === 'unknown') { dialog.blockSubmit('恢复提交结果待核对；请读取本机存档确认后再继续'); return; }
      dialog.fail(this.cloudFailureText(result));
      return;
    }
    const receipt = result.value;
    if (!this.isCloudIdentityCurrent(owner)) {
      dialog.succeed();
      this.toast('恢复已提交到原账号；当前账号已切换，请切回原账号核对');
      return;
    }
    if (this.facade.getState().runId !== receipt.appliedRunId || this.facade.getRevision() !== receipt.appliedRevision) {
      dialog.blockSubmit('恢复提交结果待核对；请重新读取本机存档后继续');
      return;
    }
    dialog.succeed();
    this.pendingLeaderboard = null;
    const restoredSpeed = this.facade.getState().speed;
    this.exitApplicationContext('context-invalidated');
    this.adForegroundEligibleSinceMs = 0;
    this.adFirstEligibleRunId = null;
    this.render();
    // A1：恢复后强制停在暂停状态，由用户显式决定是否继续，避免“以为仍在自动运行”。
    if (restoredSpeed !== 0) {
      const paused = await this.facade.setSpeed(0, { commandId: nextCommandId('speed'), expectedRunId: this.facade.getState().runId });
      if (!paused.ok) {
        this.toast('已恢复云档，但暂停时钟未确认；请手动检查倍速');
        return;
      }
      this.render();
    }
    this.cloudPausedForPreview = true;
    if (restoredSpeed !== 0) this.cloudPausedFromSpeed = restoredSpeed;
    this.toast('已恢复云档；本机广告券与账本保留');
    this.renderCloudResumeNotice('云档已恢复，经营已暂停');
  }

  private async maybeShowDailyRewardPrompt(): Promise<void> {
    if (!this.facade || !this.adCoordinator || this.facade.getState().phase !== 'RUNNING') return;
    if (!this.adCoordinator.canStart()) return;
    if (this.adCoordinator.hasActiveSession()) return;
    // R31：以弹窗会话栈为准，不再按 ModalLayer 子节点名猜测；任何窗口在场都不叠加
    if (hasOpenDialog()) return;
    const adState = this.facade.getState();
    if (!this.facade.canRequestRewardedAd()
      || (adState.adRewards?.couponIds ?? []).some((id) => isAdCouponAvailable(adState, id, Date.now(), this.adRewardOwnerScope()))) return;
    const marked = await this.facade.markRewardPromptShown();
    if (marked.ok && marked.payload) this.renderRewardPrompt('完整观看可领1张免招聘费券，仅免一次招聘费，月薪照常支付，下月到岗；每天最多领取1次，7天内使用。');
  }

  private renderRewardPrompt(message: string): void {
    const s = this.state();
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '自愿激励广告',
      subtitle: '可跳过，不影响经营',
      width: 316,
      desiredBodyHeight: 140,
      session: {
        semanticKey: `reward-prompt:${s.runId}:${s.gameYear}:${s.gameMonth}:${this.contextEpoch}`,
        kind: 'notice',
        owner: this.dialogOwner(),
      },
    });
    createLabel({
      text: `${message}\n完整观看后发券；也可跳过继续经营。`,
      fontSize: 13,
      color: THEME.text,
      width: 260,
      lineHeight: 22,
      align: 'left',
      parent: handle.body,
    });
    const items = layoutActionRow(260, 2, BUTTON_BASELINE.gap);
    const watch = items[0]!;
    const skip = items[1]!;
    createButton({
      text: '看视频领取',
      width: watch.width,
      height: 48,
      variant: 'primary',
      parent: handle.footer,
      onClick: () => {
        handle.close();
        void this.requestAdCoupon();
      },
    }).setPosition(watch.x, 0);
    createButton({
      text: '跳过',
      width: skip.width,
      height: 48,
      variant: 'secondary',
      color: Color.WHITE,
      textColor: THEME.textWeak,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(skip.x, 0);
  }

  private async requestAdCoupon(): Promise<void> {
    if (!this.adCoordinator) return;
    // 24.14.3.7：发券结果未决时只核对原奖励，不要求玩家重新看视频。
    const retryingGrant = this.adCoordinator.hasPendingGrant();
    if (!retryingGrant && !this.isAdForegroundEligible()) { this.toast('经营满1分钟后可自愿观看广告'); return; }
    const runId = this.facade.getState().runId;
    const epoch = this.authEpoch;
    audioManager.pauseForReason('REWARDED_AD');
    const result = await this.adCoordinator.request().finally(() => audioManager.resumeForReason('REWARDED_AD'));
    if (this.facade.getState().runId !== runId || this.authEpoch !== epoch) {
      this.toast('公司或账号已变化，本次广告结果不发放');
      return;
    }
    if (result.kind === 'completed') {
      this.toast('已领取招聘券：仅免一次招聘费，月薪照付');
      this.render();
    } else if (result.kind === 'skipped') this.toast('未完整观看，本次未发券');
    else if (result.kind === 'failed' && result.reason?.startsWith('grant-unresolved')) {
      this.toast('观看已完成，发券结果待核对；无需重新观看，稍后会自动重试');
    } else if (result.kind === 'unavailable' && result.reason === 'daily-limit') {
      this.toast('今天已领取过，明天再来');
    } else this.toast('广告暂不可用，可继续经营');
  }

  private async onReturnForeground(): Promise<void> {
    if (!this.facade) return;
    // R15：连续/重复 onShow 只允许一个结算尝试，旧 attempt 不再触发弹窗或写档
    if (this.settlingForeground) return;
    this.settlingForeground = true;
    try {
      const now = Date.now();
      const elapsedMs = this.fgClock.peekForegroundElapsed(now);
      this.lastForegroundMs = now;
      this.lastFrameMs = 0;
      audioManager.onAppShow();
      if (this.adCoordinator?.hasActiveSession()) {
        // Native ad coverage can trigger hide/show. Lifecycle alone is not a failed view.
        this.lastFrameMs = now;
        this.fgClock.markSettled(now);
        return;
      }
      // 回到前台按当前代际 singleflight 刷新权威身份（不打断单机玩法；失败仅阻断云/榜外发）
      const identityReady = this.ensureVerifiedIdentity('foreground').catch(() => false);
      if (elapsedMs <= 0) {
        this.fgClock.markSettled(now);
        this.lastFrameMs = now;
        return;
      }
      this.pendingForegroundSettlement = true;
      const r = await this.facade.settleOffline(now);
      if (!r.ok) {
        if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery();
        return; // keep the interval pending; retry/reload must reconcile before consuming it
      }
      // 只有结算提交成功后才消费该区间；paused/非经营态也由settleOffline更新水位。
      this.pendingForegroundSettlement = false;
      if (this.adCoordinator?.hasPendingGrant()) {
        // 24.14.3.6：观看已完成但发券未决 → 回前台只补核对原奖励，不重看视频、不重复发券。
        // DEV-02：补发核对必须等当前代际身份确认结束；owner 未知时协调器保留 pending 后续再核。
        void identityReady.then(() => this.adCoordinator?.request()).then((r2) => {
          if (r2?.kind === 'completed') { this.toast('广告奖励已补发'); this.render(); }
        }).catch(() => undefined);
      }
      this.fgClock.markSettled(now);
      this.lastFrameMs = now;
      if (r.ok && r.payload.monthsSettled > 0) {
        this.renderOfflineSummary(r.payload);
        this.render();
      }
    } finally {
      this.settlingForeground = false;
    }
  }

  /** 离线结算摘要弹窗（M3-01）。 */
  private renderOfflineSummary(p: { monthsSettled: number; yearsClosed: number[]; cashBefore: number; cashAfter: number }): void {
    const s = this.state();
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '欢迎回来',
      width: 316,
      desiredBodyHeight: 170,
      session: {
        semanticKey: `offline-summary:${s.runId}:${s.gameYear}:${s.gameMonth}:${this.contextEpoch}`,
        kind: 'notice',
        owner: this.dialogOwner(),
      },
    });
    createLabel({
      text:
        `离线期间结算 ${p.monthsSettled} 个月` +
        (p.yearsClosed.length ? `（含 ${p.yearsClosed.length} 个年度结算）` : '') +
        `\n现金：${moneyText(p.cashBefore)} → ${moneyText(p.cashAfter)}` +
        `\n净变化：${moneyText(p.cashAfter - p.cashBefore)}`,
      fontSize: 14,
      color: THEME.text,
      width: 260,
      lineHeight: 24,
      align: 'left',
      parent: handle.body,
    });
    createButton({
      text: '知道了',
      width: 240,
      height: 48,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  private clockTick(): void {
    if (!this.facade) return;
    this.tickAdEligibility();
    if (this.settlingForeground || this.clockTickInFlight) return;
    if (this.pendingForegroundSettlement) {
      void this.onReturnForeground();
      return;
    }
    if (this.pendingOnlineTick) {
      void this.reconcilePendingOnlineTick();
      return;
    }
    if (this.adCoordinator?.hasActiveSession()) { this.lastFrameMs = Date.now(); return; }
    if (this.facade.getPersistenceStatus() !== 'ready') {
      this.lastFrameMs = 0;
      this.renderPersistenceRecovery();
      return;
    }
    const s = this.facade.getState();
    if (s.phase !== 'RUNNING' || s.speed === 0) {
      this.lastFrameMs = Date.now();
      return;
    }
    // R15：用真实帧间隔，不再固定传 200ms；首帧/异常回拨按 0 处理
    const now = Date.now();
    const dt = this.lastFrameMs > 0 && now > this.lastFrameMs ? now - this.lastFrameMs : 0;
    if (dt <= 0) return;
    this.clockTickInFlight = true;
    void this.facade
      .advanceRealTime(dt, s.runId, now)
      .then((r) => {
        if (!r.ok) {
          if (this.facade?.getPersistenceStatus() === 'ready') {
            if (this.facade.getState().runId !== s.runId) this.lastFrameMs = now;
            // Keep the elapsed interval pending after a known non-commit conflict.
            return;
          }
          this.pendingOnlineTick = { elapsedMs: dt, runId: s.runId, atMs: now };
          this.lastFrameMs = 0;
          this.renderPersistenceRecovery();
          return;
        }
        this.pendingOnlineTick = null;
        this.lastFrameMs = now;
        // 在线推进已消耗的真实时间同步到前后台水位，避免下次离线重复计入
        this.fgClock.noteOnlineProgress(now);
        if (r.payload.monthsAdvanced === 0 && r.payload.yearsClosed.length === 0) return;
        // 年结短乐：按刚关闭年份的盈亏播放
        for (const y of r.payload.yearsClosed) {
          const rep = this.facade!.getAnnualReport(y);
          if (rep) {
            if (rep.profitYuan >= 0) void audioManager.yearProfit();
            else void audioManager.yearLoss();
          }
        }
        const after = this.facade!.getState();
        if (after.target3YearsAchieved && !s.target3YearsAchieved) void audioManager.threeYearGoal();
        this.render();
      })
      .catch(() => {
        if (this.facade?.getPersistenceStatus() !== 'ready') {
          this.pendingOnlineTick = { elapsedMs: dt, runId: s.runId, atMs: now };
          this.lastFrameMs = 0;
          this.renderPersistenceRecovery();
        }
      })
      .finally(() => { this.clockTickInFlight = false; });
  }

  private tickAdEligibility(): void {
    if (!this.facade || !this.adCoordinator || !this.facade.getState().company) {
      this.adForegroundEligibleSinceMs = 0;
      this.adFirstEligibleRunId = null;
      return;
    }
    const state = this.facade.getState();
    if (!this.adCoordinator.canStart()) {
      this.adForegroundEligibleSinceMs = 0;
      this.adFirstEligibleRunId = null;
      return;
    }
    if (state.phase !== 'RUNNING' || state.onboarding.initialHiresCompleted < 2 || this.adCoordinator.hasActiveSession()) {
      this.adForegroundEligibleSinceMs = 0;
      this.adFirstEligibleRunId = null;
      return;
    }
    const now = Date.now();
    if (this.adFirstEligibleRunId !== state.runId) {
      this.adFirstEligibleRunId = state.runId;
      this.adForegroundEligibleSinceMs = now;
      return;
    }
    if (this.adForegroundEligibleSinceMs === 0) this.adForegroundEligibleSinceMs = now;
    if (now - this.adForegroundEligibleSinceMs >= 60_000) void this.maybeShowDailyRewardPrompt();
  }

  private isAdForegroundEligible(): boolean {
    if (!this.facade || !this.adCoordinator) return false;
    if (!this.adCoordinator.canStart()) return false;
    const state = this.facade.getState();
    return state.phase === 'RUNNING' && state.onboarding.initialHiresCompleted >= 2
      && this.adFirstEligibleRunId === state.runId && this.adForegroundEligibleSinceMs > 0
      && Date.now() - this.adForegroundEligibleSinceMs >= 60_000
      && (!this.adCoordinator.hasActiveSession() || this.adCoordinator.hasPendingGrant());
  }

  private async reconcilePendingOnlineTick(): Promise<void> {
    const pending = this.pendingOnlineTick;
    if (!pending || !this.facade || this.facade.getPersistenceStatus() !== 'ready') return;
    const current = this.facade.getState();
    if (current.runId !== pending.runId) {
      this.pendingOnlineTick = null;
      this.lastFrameMs = Date.now();
      return;
    }
    if (current.lastWallClockMs >= pending.atMs) {
      this.pendingOnlineTick = null;
      this.lastFrameMs = pending.atMs;
      this.fgClock.noteOnlineProgress(pending.atMs);
      return;
    }
    this.clockTickInFlight = true;
    try {
      const result = await this.facade.advanceRealTime(pending.elapsedMs, pending.runId, pending.atMs);
      if (!result.ok) {
        if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery();
        return;
      }
      this.pendingOnlineTick = null;
      this.lastFrameMs = pending.atMs;
      this.fgClock.noteOnlineProgress(pending.atMs);
      if (result.payload.monthsAdvanced > 0 || result.payload.yearsClosed.length > 0) this.render();
    } catch {
      if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery();
    } finally {
      this.clockTickInFlight = false;
    }
  }

  private renderPersistenceRecovery(): void {
    if (!this.facade || this.persistenceRecoveryOverlay?.isValid) return;
    const overlay = this.modalOverlay();
    this.persistenceRecoveryOverlay = overlay;
    createRect({ width: 318, height: 250, color: Color.WHITE, radius: 12, parent: overlay });
    createLabel({ text: '正在保护经营存档', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 88);
    createLabel({
      text: '上次操作的保存结果尚未确认。经营时间已暂停，请重试核对；核对前不会提交新操作。',
      fontSize: 13, color: THEME.text, width: 276, lineHeight: 22, align: 'center', parent: overlay,
    }).setPosition(0, 20);
    createButton({
      text: '重试核对存档', width: 220, height: 44, parent: overlay,
      onClick: async () => {
        try {
          if (this.facade?.getPersistenceStatus() === 'reset-pending') {
            overlay.destroy();
            this.persistenceRecoveryOverlay = null;
            await this.restartBootAfterSaveGate();
            return;
          }
          await this.facade?.retryPersistenceRecovery();
          if (this.facade?.getPersistenceStatus() !== 'ready') return;
          if (this.pendingOnlineTick) await this.reconcilePendingOnlineTick();
          if (this.facade?.getPersistenceStatus() !== 'ready') return;
          overlay.destroy();
          this.persistenceRecoveryOverlay = null;
          this.render();
          await this.onReturnForeground();
        } catch {
          this.toast('存档仍无法确认，请稍后再试');
        }
      },
    }).setPosition(0, -62);
    createButton({ text: '退出', width: 180, height: 38, fontSize: 13, color: Color.WHITE, textColor: THEME.textWeak, parent: overlay,
      onClick: () => { const g = globalThis as { tap?: { exitMiniProgram?: () => void } }; g.tap?.exitMiniProgram?.(); },
    }).setPosition(0, -118);
  }

  private buildRoot(): void {
    const canvas = this.node;
    // R31：启动页重试/二次 start 时先销毁旧根与旧背景，禁止双 Backdrop / 双 AppRoot
    if (this.root && this.root.isValid) this.root.destroy();
    if (this.backdrop && this.backdrop.isValid) this.backdrop.destroy();
    const backdrop = createRect({
      name: 'Backdrop',
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      color: THEME.bg,
      radius: 0,
      parent: canvas,
    });
    this.backdrop = backdrop;
    backdrop.setPosition(0, 0);
    stretchToParent(backdrop);
    attachCoverBackground(backdrop, 'backgrounds/CEO_BG_SoftBlue_UI_9x20/spriteFrame');

    this.root = new Node('AppRoot');
    this.root.parent = canvas;
    this.root.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));

    // TASK-M3-12-03：三层稳定结构
    this.pageLayer = new Node('PageLayer');
    this.pageLayer.parent = this.root;
    this.pageLayer.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));

    this.modalLayer = new Node('ModalLayer');
    this.modalLayer.parent = this.root;
    this.modalLayer.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));

    this.toastLayer = new Node('ToastLayer');
    this.toastLayer.parent = this.root;
    this.toastLayer.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));

    // R24：不再对 812 内容层整体缩放（原 BUG-002 兜底会把页面缩到 640 并等比缩小所有文字/热区）；
    // 改为页面壳按真实安全区锚定 Header/Footer，Body 取剩余高度滚动（见 renderMainShell/shellLayout）。
  }

  /** R24：当前窗口的壳布局（平台异常时回落设计基准，不阻断渲染）。 */
  private shellLayout(): ShellLayout {
    try {
      return computeShellLayout(this.platform ? this.platform.getWindowInfo() : null);
    } catch {
      return computeShellLayout(null);
    }
  }

  /** R24：订阅窗口/安全区变化；重复调用幂等（存档闸门重试路径会再次走到）。 */
  private bindLayoutListeners(): void {
    if (this.unbindLayout.length > 0) return;
    const relayout = () => this.relayout();
    const platform = this.platform;
    if (platform && typeof platform.onWindowResize === 'function') {
      this.unbindLayout.push(platform.onWindowResize(() => relayout()));
    }
    // 引擎级兜底：web/编辑器窗口拖拽、横竖屏切换
    view.on('canvas-resize', relayout, this);
    this.unbindLayout.push(() => view.off('canvas-resize', relayout, this));
  }

  /** R24/R27：热 resize 只重算壳几何，不重建内容——当前 Tab/页面、滚动位置与输入全部保留。 */
  private relayout(): void {
    const layout = this.shellLayout();
    if (this.shell) {
      const offset = this.shell.scrollView.getScrollOffset();
      this.applyShellLayout(layout, offset);
    }
    if (this.createPane) this.applyCreatePane(layout);
  }

  override onDestroy(): void {
    setDialogClosedListener(null);
    this.unschedule(this.clockTick);
    this.clockScheduled = false;
    this.teardownLayoutListeners();
    this.exitApplicationContext('application-dispose');
    this.bootStarted = false;
  }

  /** R31：真正换上下文（重开公司/整档恢复/销毁）时，旧弹窗与旧快照全部作废。 */
  private exitApplicationContext(reason: 'context-invalidated' | 'application-dispose'): void {
    this.detailSessions = [];
    this.distressAckKey = null;
    this.contextEpoch += 1;
    invalidateDialogs(reason);
    this.disposeApplication();
  }

  private teardownLayoutListeners(): void {
    for (const unbind of this.unbindLayout) unbind();
    this.unbindLayout = [];
  }

  /** R31：弹窗归属信息；跨月 revision 变化不算上下文失效。 */
  private dialogOwner(entityId?: string): { runId: string | null; accountEpoch: number; contextEpoch: number; entityId?: string } {
    let runId: string | null = null;
    try {
      const s = this.facade?.getState?.();
      runId = s?.runId ?? null;
    } catch {
      runId = null;
    }
    return { runId, accountEpoch: this.authEpoch, contextEpoch: this.contextEpoch, ...(entityId ? { entityId } : {}) };
  }

  /** TASK-M3-12-03：月结/年结/普通刷新——只清 PageLayer，保留 ModalLayer 与 ToastLayer。 */
  private clearPageContent(): void {
    this.pageLayer.destroyAllChildren();
    this.shell = null;
    this.createPane = null;
    this.createGuard = new CreateSubmitGuard();
    this.createCommandId = null;
    this.ceoErrorLabel = null;
    this.speedButtons = [];
    this.lastRenderedTab = null;
  }

  /** TASK-M3-12-03：显式重建应用（重开/登出等）——全部层清。 */
  private disposeApplication(): void {
    this.pageLayer?.destroyAllChildren();
    this.modalLayer?.destroyAllChildren();
    this.toastLayer?.destroyAllChildren();
    this.toastNode = null;
    this.persistenceRecoveryOverlay = null;
    this.shell = null;
    this.createPane = null;
    this.createGuard = new CreateSubmitGuard();
    this.createCommandId = null;
    this.ceoErrorLabel = null;
    this.speedButtons = [];
  }

  /** @deprecated 用 clearPageContent/disposeApplication 替代。 */
  private clearRoot(): void {
    this.disposeApplication();
  }

  private state(): GameState {
    return this.facade.getState();
  }

  // ---------------------------------------------------------------- 路由渲染

  private render(): void {
    // TASK-M3-12-03：月结/年结只清 PageLayer，保留 ModalLayer 的详情/确认弹窗。
    // R31：外部销毁的弹窗先补注销，避免“幽灵弹窗”占用最上层。
    // §23.5.6：同 Tab 的自动刷新保留滚动锚点，不把玩家从长列表中段弹回首卡。
    const previous = this.shell;
    const keepScroll = previous !== null && this.lastRenderedTab === this.activeTab;
    const offset = keepScroll && previous ? previous.scrollView.getScrollOffset() : null;
    pruneDialogs();
    this.clearPageContent();
    const s = this.state();
    if (s.phase === 'CREATING') {
      if (this.customCompanyName === '' && this.randomCompanyNames.length === 0) {
        this.selectedIndustry = 'TRADE';
        this.rollNames();
      }
      // 创建流程有两页（公司 / CEO），必须按子步骤分发，否则 CEO 页任何点击都会回到公司页
      if (this.createStep === 'CEO') this.renderCreateCeo();
      else this.renderCreateCompany();
    } else if (s.phase === 'HIRING_INITIAL' || (s.phase === 'TUTORIAL_DASHBOARD' && this.awaitingEnterCompany)) {
      this.renderInitialHiring();
    } else {
      this.renderMainShell();
      this.lastRenderedTab = this.activeTab;
      if (offset && offset.y > 0) {
        this.scheduleOnce(() => {
          if (!this.shell) return;
          this.shell.scrollView.stopAutoScroll();
          this.shell.scrollView.scrollToOffset(offset, 0);
        }, 0);
      }
      this.refreshDetailFreshness();
      this.ensureDistressNotice();
    }
    this.syncBgm();
  }

  /** §29.7：创业阶段用创业曲、经营阶段用经营曲；同一曲目只保留一条循环，不因重绘重播。 */
  private syncBgm(): void {
    if (!this.facade) return;
    const phase = this.state().phase;
    const startup = phase === 'CREATING' || phase === 'HIRING_INITIAL' || phase === 'TUTORIAL_DASHBOARD';
    void audioManager.playBgm(startup ? 'startup' : 'operation');
  }

  private distressKey(s: GameState): string {
    return `distress:${s.runId}:${s.gameYear}:${s.gameMonth}`;
  }

  /** R31：危机不叠层、不抢占正在阅读的详情；关闭详情后自动补弹，除非玩家已忽略该月。 */
  private ensureDistressNotice(): void {
    if (!this.bootStarted) return;
    let s: GameState;
    try {
      s = this.state();
    } catch {
      return;
    }
    if (s.phase !== 'DISTRESS') return;
    const key = this.distressKey(s);
    if (this.distressAckKey === key) return;
    if (findOpenDialog(key)) return;
    if (hasOpenDialog()) return;
    this.renderDistressDialog();
  }

  /** 经营困难弹窗：现金无法覆盖下月刚性费用，引导救助（一次性10万）。 */
  private renderDistressDialog(): void {
    const s = this.state();
    const key = this.distressKey(s);
    if (this.distressAckKey === key || findOpenDialog(key)) return;
    const risk = this.facade.assessRisk();
    const rescueHint = s.rescueCapitalUsed
      ? '救助资本已使用，无法再次领取。\n请裁员、降低工资支出或关闭公司重开。'
      : `当前现金 ${moneyText(risk.cash)}，下月必要支出约 ${moneyText(risk.nextMonthNeed)}。\n月结已暂停，时间不会继续推进。`;
    const handle = openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '经营困难',
      danger: true,
      message: rescueHint,
      width: 320,
      desiredBodyHeight: 120,
      confirmText: s.rescueCapitalUsed ? '去人事页裁员/调整' : '领取 10 万元 CEO 救助资本',
      cancelText: '我再想想（稍后处理）',
      session: { semanticKey: key, kind: 'blocking-recovery', policy: 'recovery', owner: this.dialogOwner() },
      onConfirm: async (dialog) => {
        if (s.rescueCapitalUsed) {
          this.activeTab = 'TALENT';
          dialog.close();
          this.render();
          return;
        }
        const r = await this.facade.injectRescueCapital({
          commandId: nextCommandId('rescue'),
          expectedRunId: s.runId,
        });
        if (!r.ok) {
          if (r.code === 'RUN_CHANGED') {
            dialog.blockSubmit('本局已切换，旧救助意图失效；请关闭窗口后在新局面重新操作。');
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        this.toast(`已到账救助资本 ${moneyText(r.payload.amountYuan)}（不计收入/利润）`);
        this.render();
      },
      onCancel: () => {
        // 玩家主动忽略：本月不再自动弹，但保留入口，关闭后回到公司页可再次查看
        this.distressAckKey = key;
        this.render();
      },
    });
    handle.onClose(() => {
      if (this.state().phase === 'DISTRESS') this.distressAckKey = key;
    });
  }

  // ---------------------------------------------------------------- R27 创建页通用壳

  /** 创建三步页：固定页头/页脚 + 中间滚动主体（与主壳同一套 authored 坐标）。 */
  private mountCreatePage(
    layout: ShellLayout,
    opts: { headerHeight?: number; footerHeight?: number },
  ): { content: Node; footer: Node } {
    const panel = this.fullPanel();
    const headerHeight = opts.headerHeight ?? 0;
    const footerHeight = opts.footerHeight ?? 72;
    const pane = computePaneLayout(layout, { headerHeight, footerHeight });

    let header: Node | null = null;
    if (headerHeight > 0) {
      header = createRect({
        name: 'CreateHeader',
        width: DESIGN_WIDTH,
        height: headerHeight,
        color: Color.WHITE,
        radius: 0,
        parent: panel,
      });
      header.addComponent(BlockInputEvents);
    }

    const scrollRoot = new Node('CreateScroll');
    scrollRoot.parent = panel;
    scrollRoot.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, pane.bodyHeight));
    scrollRoot.addComponent(BlockInputEvents);
    const scrollView = scrollRoot.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;

    const viewNode = new Node('CreateView');
    viewNode.parent = scrollRoot;
    viewNode.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, pane.bodyHeight));
    const mask = viewNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const content = new Node('CreateContent');
    content.parent = viewNode;
    content.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    scrollView.content = content;

    const footer = new Node('CreateFooter');
    footer.parent = panel;
    footer.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, pane.footerTotal));
    footer.addComponent(BlockInputEvents);
    const footerBg = footer.addComponent(Graphics);

    this.createPane = {
      header,
      scrollRoot,
      viewNode,
      content,
      scrollView,
      footer,
      footerBg,
      footerButtons: [],
      headerHeight,
      footerHeight,
      minBottom: 0,
      shift: 0,
    };
    return { content, footer };
  }

  /** 创建页底部固定操作按钮（几何由 applyCreatePane 统一摆放）。 */
  private addCreateFooterButton(opts: {
    text: string;
    x: number;
    width: number;
    height?: number;
    disabled?: boolean;
    color?: Color;
    textColor?: Color;
    fontSize?: number;
    onClick: () => void;
  }): Node {
    const pane = this.createPane;
    if (!pane) return new Node();
    const btn = createButton({
      text: opts.text,
      width: opts.width,
      height: opts.height ?? 48,
      color: opts.color,
      textColor: opts.textColor,
      fontSize: opts.fontSize,
      disabled: opts.disabled,
      parent: pane.footer,
      onClick: opts.onClick,
    });
    btn.setPosition(opts.x, 0);
    pane.footerButtons.push(btn);
    return btn;
  }

  /** 内容填充完毕后测量下探并应用几何。 */
  private finishCreatePage(layout: ShellLayout): void {
    const pane = this.createPane;
    if (!pane) return;
    pane.minBottom = this.measureContentBottom(pane.content);
    this.applyCreatePane(layout);
  }

  /** 创建页热 resize：只重算几何（保留滚动位置与输入节点）。 */
  private applyCreatePane(layout: ShellLayout): void {
    const pane = this.createPane;
    if (!pane) return;
    const geo = computePaneLayout(layout, {
      headerHeight: pane.headerHeight,
      footerHeight: pane.footerHeight,
    });
    const body = computeScrollBody(geo.bodyHeight, pane.minBottom);
    const delta = body.shift - pane.shift;
    if (delta !== 0) {
      for (const child of pane.content.children) {
        child.setPosition(child.position.x, child.position.y + delta, child.position.z);
      }
      pane.shift = body.shift;
    }
    pane.content.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, body.contentHeight));
    pane.content.setPosition(0, body.contentY);
    pane.scrollRoot.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, geo.bodyHeight));
    pane.scrollRoot.setPosition(0, geo.bodyCenterY);
    pane.viewNode.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, geo.bodyHeight));

    if (pane.header) {
      pane.header.setPosition(layout.footerShiftX, geo.bodyTopY + pane.headerHeight / 2);
      pane.header.getComponent(UITransform)!.setContentSize(new Size(layout.contentWidth, pane.headerHeight));
    }

    pane.footer.setPosition(layout.footerShiftX, geo.footerBgY);
    pane.footer.getComponent(UITransform)!.setContentSize(new Size(layout.contentWidth, geo.footerTotal));
    const g = pane.footerBg;
    g.clear();
    g.fillColor = Color.WHITE;
    g.rect(-layout.contentWidth / 2, -geo.footerTotal / 2, layout.contentWidth, geo.footerTotal);
    g.fill();
    for (const btn of pane.footerButtons) {
      btn.setPosition(btn.position.x, layout.bottomInset / 2, btn.position.z);
    }
  }

  /** 整块可点的选择卡：标题 + 可选说明，长文本换行不缩字。 */
  private createChoiceCard(
    parent: Node,
    opts: {
      y: number;
      height: number;
      width?: number;
      selected: boolean;
      title: string;
      titleSize?: number;
      caption?: string;
      onTap: () => void;
    },
  ): Node {
    const width = opts.width ?? 343;
    const card = createRect({
      width,
      height: opts.height,
      color: opts.selected ? new Color().fromHEX('#EAF1FB') : Color.WHITE,
      radius: 8,
      parent,
    });
    card.setPosition(0, opts.y);
    card.addComponent(BlockInputEvents);
    card.on(Node.EventType.TOUCH_END, opts.onTap);
    createLabel({
      text: opts.title,
      fontSize: opts.titleSize ?? 15,
      bold: opts.selected,
      color: opts.selected ? THEME.primary : THEME.text,
      width: width - 24,
      align: 'left',
      parent: card,
    }).setPosition(0, opts.caption ? 9 : 0);
    if (opts.caption) {
      createLabel({
        text: opts.caption,
        fontSize: 12,
        color: THEME.textWeak,
        width: width - 24,
        lineHeight: 18,
        align: 'left',
        parent: card,
      }).setPosition(0, -15);
    }
    return card;
  }

  /** 提交中禁用页脚全部按钮（连点不再发命令）。 */
  private setCreateFooterBusy(busy: boolean): void {
    const pane = this.createPane;
    if (!pane) return;
    for (const btn of pane.footerButtons) {
      const button = btn.getComponent(Button);
      if (button) button.enabled = !busy;
      const opacity = btn.getComponent(UIOpacity) ?? btn.addComponent(UIOpacity);
      opacity.opacity = busy ? 150 : 255;
    }
  }

  private showCeoNameError(message: string): void {
    const label = this.ceoErrorLabel?.getComponent(Label);
    if (label) label.string = message;
    else this.toast(message);
  }

  /** 随机 CEO 姓名：批次号递增，确定性派生，不消耗市场 RNG。 */
  private rollCeoName(advance: boolean): void {
    if (advance) this.ceoNameNonce += 1;
    this.customCeoName = generateCeoName(this.state().runId, this.ceoNameNonce);
    this.render();
  }

  // ---------------------------------------------------------------- S01 创建公司

  /**
   * 重新抽取候选公司名。
   * @param advance true=用户点「换一批」，递增批次号换出新名字；
   *                false=切换行业等场景，沿用当前批次。
   */
  private rollNames(advance = false): void {
    if (advance) this.nameNonce += 1;
    const rolled = this.facade.rollCompanyNames(this.selectedIndustry, 3, this.nameNonce);
    this.randomCompanyNames = Array.from(rolled).map((n) => String(n));
    this.selectedNameIndex = 0;
  }

  /** 当前将使用的公司名（自定义优先由 selectedNameIndex=-1 表示）。 */
  private chosenCompanyName(): string {
    if (this.selectedNameIndex < 0) return this.customCompanyName;
    return this.randomCompanyNames[this.selectedNameIndex] ?? '';
  }

  private renderCreateCompany(): void {
    const layout = this.shellLayout();
    const { content } = this.mountCreatePage(layout, { footerHeight: 72 });

    createLabel({ text: '《我是CEO》', fontSize: 24, bold: true, color: THEME.primary, parent: content }).setPosition(0, 372);
    createLabel({
      text: CREATE_COPY.stepCompany,
      fontSize: TEXT_TOKENS.caption.fontSize,
      color: THEME.textWeak,
      parent: content,
    }).setPosition(0, 342);

    // 行业组：标题 + 说明 + 三个选项（选项间 8）
    createLabel({ text: '主营行业', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 308);
    createLabel({
      text: CREATE_COPY.industryHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, 282);
    (Object.keys(INDUSTRY_LABELS) as IndustryId[]).forEach((id, i) => {
      this.createChoiceCard(content, {
        y: 228 - i * 68,
        height: 60,
        selected: this.selectedIndustry === id,
        title: INDUSTRY_LABELS[id],
        caption: INDUSTRY_PRESENTATION[id].blurb,
        onTap: () => {
          this.selectedIndustry = id;
          this.rollNames();
          this.render();
        },
      });
    });

    // 名称组
    createLabel({ text: '公司名称', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 26);
    createLabel({
      text: CREATE_COPY.companyNameHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, -2);
    this.randomCompanyNames.forEach((name, i) => {
      this.createChoiceCard(content, {
        y: -48 - i * 58,
        height: 50,
        selected: this.selectedNameIndex === i,
        title: name,
        onTap: () => {
          this.selectedNameIndex = i;
          this.render();
        },
      });
    });

    const hasCustom = this.customCompanyName.length >= 2;
    const customY = -48 - this.randomCompanyNames.length * 58;
    if (hasCustom) {
      this.createChoiceCard(content, {
        y: customY,
        height: 50,
        selected: this.selectedNameIndex < 0,
        title: `自定义：${this.customCompanyName}`,
        onTap: () => {
          this.selectedNameIndex = -1;
          this.render();
        },
      });
    }
    const actionY = hasCustom ? customY - 58 : customY;
    createButton({
      text: '换一批',
      width: 158,
      height: 44,
      color: Color.WHITE,
      textColor: THEME.primary,
      fontSize: 13,
      parent: content,
      onClick: () => {
        this.rollNames(true);
        this.render();
      },
    }).setPosition(-83, actionY);
    createButton({
      text: hasCustom ? '改名' : '自定义名称',
      width: 158,
      height: 44,
      color: Color.WHITE,
      textColor: THEME.primary,
      fontSize: 13,
      parent: content,
      onClick: () => this.openCustomNameDialog(),
    }).setPosition(83, actionY);

    const chosenName = this.chosenCompanyName();
    this.addCreateFooterButton({
      text: '下一步：创建 CEO',
      width: 327,
      height: 50,
      x: 0,
      disabled: Array.from(chosenName).length < 2,
      onClick: () => {
        this.createStep = 'CEO';
        this.render();
      },
    });
    this.finishCreatePage(layout);
  }

  /** 自定义公司名输入弹窗（Cocos EditBox，真机会唤起系统键盘）。 */
  private openCustomNameDialog(): void {
    // R25：通用输入弹窗——标签/字数/内联校验，卡片固定在上半区避让键盘
    const layout = this.shellLayout();
    openInputDialog({
      overlay: this.modalOverlay(),
      viewportHeight: layout.viewportHeight,
      title: '自定义公司名称',
      label: '公司名称',
      hint: '2–20 个字，创建后不可修改',
      initialValue: this.customCompanyName,
      minLength: 2,
      maxLength: 20,
      placeholder: '例如：向上生长科技',
      submitText: '使用这个名字',
      validate: (raw) => {
        const result = validateCompanyName(raw);
        return result.ok ? null : COMPANY_NAME_ERROR_TEXT[result.reason];
      },
      onSubmit: (value, dialog) => {
        this.customCompanyName = value;
        this.selectedNameIndex = -1;
        dialog.succeed();
        this.render();
      },
    });
  }

  // ---------------------------------------------------------------- S02 CEO

  private renderCreateCeo(): void {
    const layout = this.shellLayout();
    const { content } = this.mountCreatePage(layout, { footerHeight: 72 });
    if (!this.customCeoName) {
      this.customCeoName = generateCeoName(this.state().runId, this.ceoNameNonce);
    }

    createLabel({ text: '《我是CEO》', fontSize: 24, bold: true, color: THEME.primary, parent: content }).setPosition(0, 372);
    createLabel({
      text: CREATE_COPY.stepCeo,
      fontSize: 12,
      color: THEME.textWeak,
      parent: content,
    }).setPosition(0, 342);

    // CEO 姓名：真实 EditBox（键盘可输入） + 随机按钮
    createLabel({ text: 'CEO 姓名', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 308);
    createLabel({
      text: CREATE_COPY.ceoNameHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, 282);
    createRect({ width: 224, height: 48, color: THEME.bg, radius: 8, parent: content }).setPosition(-52, 238);
    const ceoInput = new Node('CeoNameInput');
    ceoInput.parent = content;
    ceoInput.setPosition(-52, 238);
    ceoInput.addComponent(UITransform).setContentSize(new Size(208, 40));
    const edit = ceoInput.addComponent(EditBox);
    edit.placeholder = '输入 CEO 姓名';
    edit.maxLength = CEO_NAME_MAX;
    edit.inputMode = EditBox.InputMode.SINGLE_LINE;
    edit.string = this.customCeoName;
    // EditBox 默认白字在浅色背景上不可见；锚点改 (0,1) 防止文字甩出输入框
    const paintInput = (): void => {
      const placeholder = edit.placeholderLabel as Label | null;
      if (placeholder) {
        placeholder.color = THEME.textWeak;
        placeholder.fontSize = 14;
        placeholder.node.getComponent(UITransform)?.setAnchorPoint(0, 1);
      }
      const text = edit.textLabel as Label | null;
      if (text) {
        text.color = THEME.text;
        text.fontSize = 14;
        text.node.getComponent(UITransform)?.setAnchorPoint(0, 1);
      }
    };
    paintInput();
    edit.node.on(EditBox.EventType.TEXT_CHANGED, () => {
      // 手填即写入字段：上一步/下一步/重载模板都从这里恢复
      this.customCeoName = edit.string ?? '';
      const errorLabel = this.ceoErrorLabel?.getComponent(Label);
      if (errorLabel) errorLabel.string = '';
    });
    edit.node.on(EditBox.EventType.EDITING_DID_ENDED, paintInput);
    createButton({
      text: '随机姓名',
      width: 96,
      height: 44,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: content,
      onClick: () => this.rollCeoName(true),
    }).setPosition(116, 238);

    // 姓名校验错误（内联，不覆盖输入内容）
    this.ceoErrorLabel = createLabel({
      text: '',
      fontSize: 12,
      color: THEME.danger,
      width: 343,
      align: 'left',
      parent: content,
    });
    this.ceoErrorLabel.setPosition(0, 198);

    // 性格：标题与说明分行，整卡可点
    createLabel({ text: '选择性格（决定年度成长方向）', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 150);
    (Object.keys(TRAIT_LABELS) as CeoTrait[]).forEach((trait, i) => {
      const meta = TRAIT_LABELS[trait];
      const selected = this.selectedTrait === trait;
      const card = createRect({
        width: 343,
        height: 72,
        color: selected ? new Color().fromHEX('#EAF1FB') : Color.WHITE,
        radius: 8,
        parent: content,
      });
      card.setPosition(0, 94 - i * 82);
      card.addComponent(BlockInputEvents);
      card.on(Node.EventType.TOUCH_END, () => {
        this.selectedTrait = trait;
        this.render();
      });
      createLabel({
        text: meta.name,
        fontSize: 15,
        bold: true,
        color: selected ? THEME.primary : THEME.text,
        align: 'left',
        width: 80,
        parent: card,
      }).setPosition(-115, 16);
      createLabel({
        text: meta.desc,
        fontSize: 12,
        color: THEME.textWeak,
        align: 'left',
        width: 300,
        lineHeight: 18,
        parent: card,
      }).setPosition(-1, -12);
    });

    // 初始能力：三项分列
    createLabel({ text: '初始能力', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, -142);
    const abilities: Array<[string, number]> = [
      ['商业', 50],
      ['管理', 50],
      ['财务', 50],
    ];
    abilities.forEach(([name, value], i) => {
      const card = createRect({ width: 108, height: 64, color: Color.WHITE, radius: 8, parent: content });
      card.setPosition(-115 + i * 115, -196);
      createLabel({ text: name, fontSize: 12, color: THEME.textWeak, parent: card }).setPosition(0, 14);
      createLabel({ text: String(value), fontSize: 20, bold: true, color: THEME.primary, parent: card }).setPosition(0, -10);
    });
    createLabel({
      text: CREATE_COPY.abilityHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, -244);

    this.addCreateFooterButton({
      text: '上一步',
      width: 158,
      height: 48,
      x: -85,
      color: Color.WHITE,
      textColor: THEME.text,
      onClick: () => {
        this.createStep = 'COMPANY';
        this.render();
      },
    });
    this.addCreateFooterButton({
      text: '下一步：招聘员工',
      width: 158,
      height: 48,
      x: 85,
      onClick: () => void this.submitCreateCompany(),
    });
    this.finishCreatePage(layout);
  }

  /**
   * R27：创建公司只从 CEO 页「下一步」发出一次。
   * 连点由 CreateSubmitGuard + 页脚禁用拦截；明确失败复用同一 commandId 重试（领域幂等）。
   */
  private async submitCreateCompany(): Promise<void> {
    if (this.createGuard.busy || this.createGuard.done) return;
    const name = this.chosenCompanyName();
    const companyCheck = validateCompanyName(name);
    if (!companyCheck.ok) {
      this.toast(COMPANY_NAME_ERROR_TEXT[companyCheck.reason]);
      return;
    }
    const nameError = ceoNameError(this.customCeoName);
    if (nameError) {
      this.showCeoNameError(nameError);
      return;
    }

    const commandId = this.createCommandId ?? nextCommandId('create');
    this.createCommandId = commandId;
    if (!this.createGuard.begin(commandId)) return;
    const originRunId = this.state().runId;
    this.setCreateFooterBusy(true);
    const result = await this.facade.createCompany(
      {
        companyName: companyCheck.name,
        industry: this.selectedIndustry,
        ceoName: this.customCeoName,
        ceoTrait: this.selectedTrait,
      },
      { commandId, expectedRunId: originRunId },
    );
    this.setCreateFooterBusy(false);
    if (!result.ok) {
      if (result.code === 'RUN_CHANGED' || result.code === 'NOT_READY') {
        // 公司已由本轮其他路径创建：结束本意图，按真实 phase 重渲染
        this.createGuard.abort();
        this.createCommandId = null;
        this.toast(result.displayMessage);
        this.render();
        return;
      }
      this.createGuard.fail();
      this.toast(result.displayMessage);
      return;
    }
    this.createGuard.succeed();
    this.createCommandId = null;
    this.render();
  }

  // ---------------------------------------------------------------- S03 首聘

  private renderInitialHiring(): void {
    const layout = this.shellLayout();
    const s = this.state();
    const view = initialHireView(s.onboarding.initialHiresCompleted, 2);
    const { content } = this.mountCreatePage(layout, { headerHeight: 64, footerHeight: 76 });

    // 固定页头：进度与现金始终可见（滚动候选时不丢失）
    const header = this.createPane?.header;
    if (header) {
      createLabel({
        text: CREATE_COPY.stepHiring,
        fontSize: 16,
        bold: true,
        width: 180,
        align: 'left',
        parent: header,
      }).setPosition(-82, 12);
      createLabel({
        text: `现金 ${moneyText(s.company?.cashYuan ?? 0)}`,
        fontSize: 14,
        bold: true,
        width: 160,
        align: 'right',
        parent: header,
      }).setPosition(92, 12);
      createLabel({
        text: `${view.progressLabel} · ${view.hintLabel}`,
        fontSize: 12,
        color: THEME.textWeak,
        width: 343,
        align: 'left',
        parent: header,
      }).setPosition(0, -14);
    }

    createLabel({
      text: CREATE_COPY.hireFeeHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, 386);

    const deptId = s.departments[0]?.deptId;
    if (!deptId) {
      this.toast('部门数据异常');
      this.finishCreatePage(layout);
      return;
    }
    const offer = this.facade.getOffer(deptId);
    this.pendingOffer = offer;

    // 已录用候选不再出现在可选列表；2/2 后不再允许继续录用（phase 已转看板）
    const hiredIds = new Set(s.employees.map((e) => e.candidateId));
    const available = offer.candidates.filter((c) => !hiredIds.has(c.candidateId));
    if (view.done) {
      createLabel({
        text: '两名员工已到岗',
        fontSize: 18,
        bold: true,
        color: THEME.primary,
        parent: content,
      }).setPosition(0, 300);
      createLabel({
        text: s.employees.map((e) => e.name).join('、'),
        fontSize: 15,
        width: 343,
        parent: content,
      }).setPosition(0, 264);
      createLabel({
        text: '点击下方「进入公司」开始经营',
        fontSize: 14,
        color: THEME.textWeak,
        width: 343,
        parent: content,
      }).setPosition(0, 220);
      this.addCreateFooterButton({
        text: view.continueLabel,
        width: 327,
        height: 50,
        x: 0,
        onClick: () => void this.startClock(),
      });
      this.finishCreatePage(layout);
      return;
    }

    available.forEach((c, idx) => {
      // 费用一律取领域层 previewHire（含 HR 折扣与余额判断），UI 不猜公式
      const preview = this.facade.previewHire({
        offerId: offer.offerId,
        candidateId: c.candidateId,
        departmentId: deptId,
      });
      const fee = preview.ok ? preview.payload.feeYuan : Number.NaN;
      const affordable = preview.ok ? preview.payload.affordable : false;
      const salary = preview.ok ? preview.payload.salaryMonthlyYuan : c.salaryMonthlyYuan;
      const rows = candidateRows({ ...c, salaryMonthlyYuan: salary }, fee, affordable);

      const card = createRect({ width: 343, height: 160, color: Color.WHITE, radius: 8, parent: content });
      card.setPosition(0, 326 - idx * 170);
      createLabel({
        text: rows.nameLine,
        fontSize: 15,
        bold: true,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, 60);
      createLabel({
        text: rows.abilityLine,
        fontSize: 12,
        color: THEME.textWeak,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, 34);
      createLabel({
        text: rows.salaryLine,
        fontSize: 14,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, 12);
      createLabel({
        text: rows.feeLine,
        fontSize: 14,
        color: preview.ok ? THEME.primary : THEME.textWeak,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, -12);
      createButton({
        text: rows.hireLabel,
        width: 311,
        height: 44,
        fontSize: 14,
        disabled: !rows.hireEnabled,
        parent: card,
        onClick: () => this.openInitialHireConfirm(c.candidateId),
      }).setPosition(0, -50);
    });

    this.addCreateFooterButton({
      text: view.continueLabel,
      width: 327,
      height: 50,
      x: 0,
      disabled: !view.done,
      onClick: () => void this.startClock(),
    });
    this.finishCreatePage(layout);
  }

  private openInitialHireConfirm(candidateId: string): void {
    const s = this.state();
    const deptId = s.departments[0]?.deptId;
    const offer = this.pendingOffer;
    if (!deptId || !offer) return;
    this.openHireConfirm(candidateId, deptId, { initial: true, offer });
  }

  /**
   * R26：录用收费确认（preview → confirm → submitting → committed）。
   * 费用由领域层 previewHire 给出（含 HR 折扣），UI 不猜测公式；
   * 取消零变更；同一意图固定一个 commandId，提交忙碌防重，重试幂等。
   */
  private openHireConfirm(
    candidateId: string,
    deptId: string,
    opts: { initial: boolean; offer: CandidateOffer; couponId?: string },
  ): void {
    const previewInput = { offerId: opts.offer.offerId, candidateId, departmentId: deptId, ...(opts.couponId ? { couponId: opts.couponId } : {}) };
    const pv = this.facade.previewHire(previewInput);
    if (!pv.ok) {
      this.toast(pv.displayMessage);
      if (pv.code === 'OFFER_EXPIRED' && !opts.initial) this.openHireForDept(deptId);
      return;
    }
    const p = pv.payload;
    const input = { ...previewInput, expectedRevision: pv.revision };
    // 一次开框固定一个意图：commandId 与发起 runId 都在闭包里，重试复用同一个
    const commandId = nextCommandId('hire');
    const originRunId = this.state().runId;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认录用？',
      message:
        `候选人：${p.candidateName}\n月薪：${moneyText(p.salaryMonthlyYuan)}\n` +
        `一次性招聘费：${moneyText(p.feeYuan)}（确认即支付）\n` +
        (opts.couponId ? '招聘券只免本次招聘费；月薪仍正常支付。\n' : '') +
        `当前现金：${moneyText(p.cashBeforeYuan)}\n支付后现金：${moneyText(p.cashAfterYuan)}\n` +
        (p.firstHire ? '首聘当月到岗' : '次月到岗'),
      width: 312,
      confirmText: p.feeYuan === 0 ? '使用招聘券并录用' : `确认支付 ${moneyText(p.feeYuan)}`,
      busyText: '录用中…',
      confirmEnabled: p.affordable,
      onConfirm: async (dialog) => {
        const r = await this.facade.hireEmployee(input, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'OFFER_EXPIRED' || r.code === 'RUN_CHANGED' || r.code === 'CONFIRMATION_EXPIRED') {
            dialog.succeed();
            this.toast(r.displayMessage);
            if (r.code === 'OFFER_EXPIRED' && !opts.initial) this.openHireForDept(deptId);
            else if (r.code === 'CONFIRMATION_EXPIRED' && opts.initial) this.render();
            else if (r.code === 'CONFIRMATION_EXPIRED') this.openHireForDept(deptId);
            return;
          }
          // 明确失败：内联显示原因，允许同一 commandId 重试
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        this.toast(opts.initial
          ? `已录用，支付招聘费 ${moneyText(r.payload.feePaidYuan)}`
          : `已录用，支付招聘费 ${moneyText(r.payload.feePaidYuan)}，次月到岗`);
        if (!opts.initial) audioManager.recruit();
        if (opts.initial && this.state().onboarding.initialHiresCompleted >= 2) {
          this.awaitingEnterCompany = true;
        }
        if (this.state().runId === originRunId) this.render();
      },
      onCancel: () => {
        if (!opts.initial && this.state().runId === originRunId) this.renderHireDialog(opts.offer, deptId);
      },
    });
  }

  private async startClock(): Promise<void> {
    const s = this.state();
    const result = await this.facade.startOperating({
      commandId: nextCommandId('start'),
      expectedRunId: s.runId,
    });
    if (!result.ok) {
      this.toast(result.displayMessage);
      return;
    }
    this.awaitingEnterCompany = false;
    this.render();
  }

  // ---------------------------------------------------------------- 四 Tab 主壳

  private renderMainShell(): void {
    const panel = this.fullPanel();
    const layout = this.shellLayout();

    // R24：Body = 头尾之间剩余高度 + ScrollView；内容容器按 authored 坐标（812 中心原点）
    // 交给各 Tab，渲染后按实际下探扩展内容高并顶部对齐，长列表（部门/员工）不再被底栏遮挡。
    const scrollRoot = new Node('BodyScroll');
    scrollRoot.parent = panel;
    scrollRoot.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    scrollRoot.setPosition(0, layout.bodyCenterY);
    // 挡住滚动区自身的空白处触摸，避免落到下层
    scrollRoot.addComponent(BlockInputEvents);
    const scrollView = scrollRoot.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;

    const viewNode = new Node('BodyView');
    viewNode.parent = scrollRoot;
    viewNode.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    const mask = viewNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const content = new Node('BodyContent');
    content.parent = viewNode;
    content.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    scrollView.content = content;

    if (this.activeTab === 'COMPANY') this.renderCompanyTab(content);
    else if (this.activeTab === 'DEPARTMENT') this.renderDepartmentTab(content);
    else if (this.activeTab === 'TALENT') this.renderTalentTab(content);
    else this.renderRankTab(content);

    const footer = this.renderBottomTabs(panel, layout);

    this.shell = {
      scrollRoot,
      viewNode,
      content,
      scrollView,
      footer: footer.root,
      footerBg: footer.bg,
      footerButtons: footer.buttons,
      minBottom: this.measureContentBottom(content),
      shift: 0,
    };
    this.applyShellLayout(layout, null);
    // R30：人才页按滚动位置复用卡片池
    if (this.activeTab === 'TALENT') {
      scrollView.node.on(ScrollView.EventType.SCROLLING, this.updateTalentWindow, this);
      this.updateTalentWindow();
    }
  }

  /** R24：内容容器直接子节点的最低下探（authored 坐标）。 */
  private measureContentBottom(content: Node): number {
    let minBottom = 0;
    for (const child of content.children) {
      const tr = child.getComponent(UITransform);
      if (!tr) continue;
      minBottom = Math.min(minBottom, child.position.y - tr.height / 2);
    }
    return minBottom;
  }

  /**
   * R24：应用壳几何。preserveOffset 非空时为热 resize：只改几何并恢复滚动位置；
   * 为 null 时是首次排版：内容顶部对齐可视顶。
   */
  private applyShellLayout(layout: ShellLayout, preserveOffset: Vec2 | null): void {
    const shell = this.shell;
    if (!shell) return;

    // 内容高：至少一屏设计高与当前可视高，且覆盖 Tab 内容实际下探（顶锚 812/2 基准）
    const geo = computeScrollBody(layout.bodyHeight, shell.minBottom);
    const delta = geo.shift - shell.shift;
    if (delta !== 0) {
      for (const child of shell.content.children) {
        child.setPosition(child.position.x, child.position.y + delta, child.position.z);
      }
      shell.shift = geo.shift;
    }
    shell.content.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, geo.contentHeight));

    // Body 可视区
    shell.scrollRoot.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    shell.scrollRoot.setPosition(0, layout.bodyCenterY);
    shell.viewNode.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    shell.content.setPosition(0, geo.contentY);

    // Footer：锚定可视区底部，底部 inset 抬升按钮行，背景含 inset
    shell.footer.setPosition(layout.footerShiftX, layout.footerBgY);
    shell.footer.getComponent(UITransform)!.setContentSize(new Size(layout.contentWidth, layout.footerTotal));
    const g = shell.footerBg;
    g.clear();
    g.fillColor = Color.WHITE;
    g.rect(-layout.contentWidth / 2, -layout.footerTotal / 2, layout.contentWidth, layout.footerTotal);
    g.fill();
    for (const btn of shell.footerButtons) {
      btn.setPosition(btn.position.x, layout.bottomInset / 2, btn.position.z);
    }

    if (preserveOffset) {
      shell.scrollView.scrollToOffset(new Vec2(preserveOffset.x, preserveOffset.y), 0);
    }
    // R30：窗口尺寸变化后重算人才页可视窗口
    if (this.activeTab === 'TALENT') this.updateTalentWindow();
  }

  private renderCompanyTab(parent: Node): void {
    const s = this.state();
    const company = s.company;
    const vm = this.facade.getCompanyOverview();
    if (!company || !vm) return;

    // R28/§29.6：顶部栏避开 TapTap 胶囊（约 44 设计单位），公司名与设置同处一条标题布局
    createRect({ width: 375, height: 100, color: THEME.primary, radius: 0, parent: parent }).setPosition(0, 350);
    const nameNode = createLabel({
      text: company.name,
      fontSize: 15,
      bold: true,
      color: Color.WHITE,
      width: 238,
      height: 32,
      lineHeight: 16,
      align: 'left',
      parent: parent,
    });
    nameNode.setPosition(-38, 350);
    const nameLabel = nameNode.getComponent(Label);
    if (nameLabel) {
      // 公司名最多 20 字：允许两行，超出才裁切；两行行高 16，避免压住副标题
      nameLabel.overflow = Label.Overflow.CLAMP;
      nameLabel.enableWrapText = true;
    }
    createLabel({
      text: `${INDUSTRY_LABELS[company.industry]} · 创业第 ${s.gameYear} 年 · 第 ${s.gameMonth} 月`,
      fontSize: 11,
      color: new Color(220, 230, 245),
      parent: parent,
    }).setPosition(-38, 320);
    // 透明整块热区：长名不压设置，点按公司名查看完整档案
    createButton({
      text: '',
      width: 252,
      height: 56,
      fontSize: 12,
      color: new Color(255, 255, 255, 0),
      parent: parent,
      onClick: () => this.renderCompanyDetail(),
    }).setPosition(-38, 344);
    createButton({
      text: '设置',
      width: 56,
      height: 44,
      fontSize: 12,
      color: new Color(255, 255, 255, 40),
      parent: parent,
      onClick: () => this.renderSettings(),
    }).setPosition(145, 340);

    // R28：现金主指标；营收/利润为已结算累计附指标（口径写在标题里，不把预计当实际）
    const cashCard = createRect({ width: 343, height: 86, color: Color.WHITE, radius: 8, parent: parent });
    cashCard.setPosition(0, 258);
    createLabel({ text: '当前可用现金', fontSize: 12, color: THEME.textWeak, parent: cashCard }).setPosition(0, 26);
    createLabel({
      text: moneyText(vm.cashYuan),
      fontSize: 26,
      bold: true,
      color: vm.cashYuan < 0 ? THEME.danger : THEME.text,
      width: 320,
      parent: cashCard,
    }).setPosition(0, -6);
    createLabel({
      text: '可立即用于招聘、扩产与发薪',
      fontSize: 11,
      color: THEME.textWeak,
      parent: cashCard,
    }).setPosition(0, -32);

    const profitColor = vm.ytdProfitYuan < 0 ? THEME.danger : THEME.profit;
    const secondary: Array<[string, number, Color]> = [
      ['本年累计收入（已结算）', vm.ytdRevenueYuan, THEME.text],
      ['本年累计利润（已结算）', vm.ytdProfitYuan, profitColor],
    ];
    secondary.forEach(([title, value, color], i) => {
      const card = createRect({ width: 167, height: 62, color: Color.WHITE, radius: 8, parent: parent });
      card.setPosition(i === 0 ? -87 : 87, 186);
      createLabel({ text: title, fontSize: 11, color: THEME.textWeak, width: 155, parent: card }).setPosition(0, 15);
      createLabel({
        text: value < 0 ? `-${moneyText(Math.abs(value))}` : moneyText(value),
        fontSize: 15,
        bold: true,
        color,
        width: 155,
        parent: card,
      }).setPosition(0, -10);
    });

    // 时间控制单独成区：暂停/1×/2×/5× 就地更新，不重建整页
    this.renderTimeControl(parent, 126);

    // CEO 与团队
    const ceoCard = createRect({ width: 343, height: 56, color: Color.WHITE, radius: 8, parent: parent });
    ceoCard.setPosition(0, 62);
    createLabel({
      text: `${s.ceo?.name ?? ''}（${TRAIT_LABELS[s.ceo?.trait ?? 'STEADY'].name}）`,
      fontSize: 13,
      bold: true,
      align: 'left',
      width: 160,
      parent: ceoCard,
    }).setPosition(-84, 8);
    createLabel({
      text: `商业 ${s.ceo?.businessSkill} · 管理 ${s.ceo?.managementSkill} · 财务 ${s.ceo?.financeSkill}`,
      fontSize: 12,
      color: THEME.textWeak,
      align: 'left',
      width: 220,
      parent: ceoCard,
    }).setPosition(-56, -12);
    createLabel({
      text: `员工 ${s.employees.length} 人`,
      fontSize: 12,
      color: THEME.primary,
      width: 90,
      parent: ceoCard,
    }).setPosition(118, 0);

    // 业务资产 / 产能 / 需求 / 报告入口
    const actionCard = createRect({ width: 343, height: 124, color: Color.WHITE, radius: 8, parent: parent });
    actionCard.setPosition(0, -22);
    createLabel({
      text: '业务资产与产能',
      fontSize: 13,
      bold: true,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, 48);
    createLabel({
      text: `业务资产 ${moneyText(vm.businessAssetBookYuan)} · 产能加成 +${(vm.capacityCoeffBps - 10_000) / 100}%（上限 +30%）`,
      fontSize: 12,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, 26);
    createLabel({
      text: `当月产能 ${moneyText(vm.monthlyCapacityYuan)} · 当月需求 ${moneyText(vm.monthlyPotentialOrderYuan)}`,
      fontSize: 11,
      color: THEME.textWeak,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, 6);
    createLabel({
      text: vm.idleRisk
        ? '需求不足：产能已高于当月需求，继续扩产可能闲置'
        : '需求可覆盖当前产能，扩产前可再评估',
      fontSize: 11,
      color: vm.idleRisk ? THEME.danger : THEME.textWeak,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, -14);
    createButton({
      text: '扩大产能（1万起）',
      width: 158,
      height: 48,
      visualHeight: 40,
      fontSize: 13,
      color: THEME.primary,
      parent: actionCard,
      onClick: () => this.renderInvestDialog(),
    }).setPosition(-83, -44);
    createButton({
      text: '年度报告',
      width: 158,
      height: 48,
      visualHeight: 40,
      fontSize: 13,
      color: THEME.chip,
      textColor: THEME.primary,
      parent: actionCard,
      onClick: () => this.renderAnnualReport(),
    }).setPosition(83, -44);

    // 盈利目标与现金风险（口径来自领域 assessRisk）
    const goalCard = createRect({ width: 343, height: 76, color: Color.WHITE, radius: 8, parent: parent });
    goalCard.setPosition(0, -126);
    createLabel({
      text: vm.target3YearsAchieved
        ? '已达成连续 3 年盈利目标，可继续自由经营'
        : `连续盈利目标：${vm.consecutiveProfitableYears}/3 年`,
      fontSize: 13,
      bold: true,
      color: vm.target3YearsAchieved ? THEME.profit : THEME.text,
      width: 320,
      parent: goalCard,
    }).setPosition(0, 18);
    createLabel({
      text: vm.risk.level === 'WARNING'
        ? `现金预警：当前现金低于未来 6 个月刚性费用 ${moneyText(vm.risk.sixMonthNeed)}`
        : `现金可覆盖未来 6 个月刚性费用 ${moneyText(vm.risk.sixMonthNeed)}`,
      fontSize: 11,
      color: vm.risk.level === 'WARNING' ? THEME.danger : THEME.textWeak,
      width: 320,
      lineHeight: 16,
      parent: goalCard,
    }).setPosition(0, -8);

    // 新手引导 TUT-04/05：看板预览态（暂停）讲解三指标，确认后开始经营
    if (s.phase === 'TUTORIAL_DASHBOARD') {
      this.renderStartOperatingBubble();
    }

    // R31：忽略危机后的常驻入口（不自动再弹，但玩家可随时回到救助/裁员）
    if (s.phase === 'DISTRESS') {
      createButton({
        text: '经营困难：查看救助 / 调整人员',
        width: 343,
        height: 48,
        visualHeight: 40,
        variant: 'danger',
        parent: parent,
        onClick: () => {
          this.distressAckKey = null;
          this.ensureDistressNotice();
        },
      }).setPosition(0, -190);
    }
  }

  /** R28：公司完整档案（长名不被顶部栏裁切影响，完整名称在此查看）。 */
  private renderCompanyDetail(): void {
    const s = this.state();
    const company = s.company;
    const vm = this.facade.getCompanyOverview();
    if (!company || !vm) return;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '公司档案',
      width: 336,
      desiredBodyHeight: 360,
      session: { semanticKey: 'company-detail', kind: 'detail', owner: this.dialogOwner() },
    });
    const body = handle.body;
    const innerWidth = 336 - 40;
    createLabel({
      text: `数据截至：第 ${s.gameYear} 年 ${s.gameMonth} 月（月结快照）`,
      fontSize: 11,
      color: THEME.textWeak,
      width: innerWidth,
      align: 'left',
      parent: body,
    });
    createLabel({
      text: company.name,
      fontSize: 16,
      bold: true,
      width: innerWidth,
      align: 'left',
      parent: body,
    });
    createLabel({
      text: `${INDUSTRY_LABELS[company.industry]} · 创业于第 ${company.foundedYear} 年 · 当前第 ${s.gameYear} 年第 ${s.gameMonth} 月`,
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 20,
      align: 'left',
      parent: body,
    });
    const totalAssets = vm.cashYuan + vm.businessAssetBookYuan;
    const rows: Array<[string, string]> = [
      ['当前可用现金', moneyText(vm.cashYuan)],
      ['业务资产账面', moneyText(vm.businessAssetBookYuan)],
      ['总资产（现金+资产）', moneyText(totalAssets)],
      ['初始资本 / 实收资本', `${moneyText(company.initialCapitalYuan)} / ${moneyText(company.paidInCapitalYuan)}`],
      ['本月产能 / 本月需求', `${moneyText(vm.monthlyCapacityYuan)} / ${moneyText(vm.monthlyPotentialOrderYuan)}`],
      ['团队规模', `${s.employees.length} 名员工 · ${s.departments.length} 个部门`],
      ['CEO', `${s.ceo?.name ?? ''}（商业 ${s.ceo?.businessSkill} / 管理 ${s.ceo?.managementSkill} / 财务 ${s.ceo?.financeSkill}）`],
    ];
    for (const [label, value] of rows) {
      const row = new Node('DetailRow');
      row.parent = body;
      row.addComponent(UITransform).setContentSize(new Size(innerWidth, 30));
      createLabel({
        text: label,
        fontSize: 12,
        color: THEME.textWeak,
        align: 'left',
        width: 132,
        parent: row,
      }).setPosition(-75, 0);
      createLabel({
        text: value,
        fontSize: 12,
        align: 'right',
        width: 158,
        parent: row,
      }).setPosition(71, 0);
    }
    createLabel({
      text: '提示：顶部栏只显示单行公司名，完整名称以本页为准。',
      fontSize: 11,
      color: THEME.textWeak,
      width: innerWidth,
      parent: body,
    });
    createButton({
      text: '关闭',
      width: 240,
      height: 46,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  /** TUT-04 三指标 + TUT-05 开始经营合并引导：确认即启动时钟；可跳过教学（TC-055）。 */
  private renderStartOperatingBubble(): void {
    const overlay = this.modalOverlay(true);
    createRect({
      width: 308,
      height: 292,
      color: new Color(39, 50, 68, 245),
      radius: 12,
      parent: overlay,
    }).setPosition(0, 0);
    createLabel({ text: '新手提示', fontSize: 15, bold: true, color: Color.WHITE, parent: overlay }).setPosition(
      0,
      112,
    );
    createLabel({
      text: '营收是卖出去多少；利润才是扣掉成本后赚的钱。\n\n公司会自动经营，你可以暂停或加速时间。',
      fontSize: 14,
      color: Color.WHITE,
      width: 264,
      lineHeight: 22,
      parent: overlay,
    }).setPosition(0, 38);
    createButton({
      text: '开始经营',
      width: 168,
      height: 46,
      color: THEME.secondary,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.startClock();
      },
    }).setPosition(0, -64);
    // TC-055：可跳过教学浮层，但首聘 2 人的约束由领域层强制（不跳过必要业务）
    createButton({
      text: '跳过教学',
      width: 168,
      height: 42,
      fontSize: 13,
      color: new Color(238, 241, 247),
      textColor: THEME.text,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.skipTutorial();
      },
    }).setPosition(0, -118);
  }

  /** 跳过教学浮层：进入经营但保持暂停，由玩家自行按开始（TC-055）。 */
  private async skipTutorial(): Promise<void> {
    const s = this.state();
    const result = await this.facade.skipTutorial({
      commandId: nextCommandId('skip-tut'),
      expectedRunId: s.runId,
    });
    if (!result.ok) {
      this.toast(result.displayMessage);
      return;
    }
    this.toast('已跳过教学，可在「时间」栏手动开始经营');
    this.render();
  }

  private renderTimeControl(parent: Node, centerY: number): void {
    const s = this.state();
    const wrap = createRect({ width: 343, height: 56, color: Color.WHITE, radius: 8, parent });
    wrap.setPosition(0, centerY);
    createLabel({ text: '时间', fontSize: 12, color: THEME.textWeak, parent: wrap }).setPosition(-140, 0);
    const speeds: Array<[string, GameSpeed]> = [
      ['暂停', 0],
      ['1×', 1],
      ['2×', 2],
      ['5×', 5],
    ];
    this.speedButtons = [];
    speeds.forEach(([label, speed], i) => {
      const active = s.speed === speed;
      const node = createButton({
        text: label,
        width: 52,
        height: 44,
        visualHeight: 32,
        fontSize: 13,
        color: active ? THEME.primary : THEME.chip,
        textColor: active ? Color.WHITE : THEME.textWeak,
        parent: wrap,
        onClick: () => void this.onSetSpeed(speed),
      });
      node.setPosition(-66 + i * 60, 0);
      this.speedButtons.push({ node, speed });
    });
  }

  /** R28：倍速切换成功后只就地重绘按钮，不重建整页（滚动位置与弹窗都保留）。 */
  private async onSetSpeed(speed: GameSpeed): Promise<void> {
    const s = this.state();
    if (s.speed === speed) {
      this.toast(this.speedLabel(speed));
      return;
    }
    const r = await this.facade.setSpeed(speed, { commandId: nextCommandId('speed'), expectedRunId: s.runId });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    audioManager.speedChange();
    for (const btn of this.speedButtons) {
      this.paintSpeedButton(btn.node, btn.speed === speed);
    }
    this.toast(`时间已切换：${this.speedLabel(speed)}`);
  }

  private speedLabel(speed: GameSpeed): string {
    return speed === 0 ? '暂停' : `${speed}×`;
  }

  private paintSpeedButton(node: Node, active: boolean): void {
    // §29.3：底色可能挂在独立 ButtonBg 上，统一走按钮视觉接口，不再直接改节点 Graphics。
    setButtonLook(node, active ? THEME.primary : THEME.chip, active ? Color.WHITE : THEME.textWeak);
  }

  // ---------------------------------------------------------------- 部门页

  /**
   * R29：部门页。数据全部来自 GameFacade.getDepartmentOverview（纯计算），
   * 卡片只做排版；历史归因不可核时明确写“当月估算”，不冒充已实现收益。
   */
  private renderDepartmentTab(parent: Node): void {
    const s = this.state();
    const vm = this.facade.getDepartmentOverview();
    if (!vm) return;
    createLabel({ text: '部门', fontSize: 22, bold: true, color: THEME.text, parent: parent }).setPosition(0, 344);

    // 经营方针：按钮与说明分组，说明在上、按钮在下
    createRect({ width: 343, height: 92, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, 282);
    createLabel({
      text: `自动经营方针：${POLICY_META[s.policy].name}（${POLICY_META[s.policy].desc}）`,
      fontSize: 12,
      color: THEME.textWeak,
      width: 320,
      parent: parent,
    }).setPosition(0, 312);
    (['GROWTH', 'STEADY', 'PROFIT'] as Policy[]).forEach((p, i) => {
      createButton({
        text: POLICY_META[p].name,
        width: 88,
        height: 44,
        visualHeight: 32,
        fontSize: 13,
        color: s.policy === p ? THEME.primary : THEME.chip,
        textColor: s.policy === p ? Color.WHITE : THEME.textWeak,
        parent: parent,
        onClick: () => void this.onSetPolicy(p),
      }).setPosition(-100 + i * 100, 268);
    });

    // 自动预算入口：门槛/安全线/可支配余量（真实查询）
    createRect({ width: 343, height: 64, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, 196);
    createLabel({
      text: `自动预算｜${POLICY_META[vm.autoBudget.policy].name}（ROI≥${(vm.autoBudget.roiThresholdBps / 10_000).toFixed(1)}）\n`
        + `保留 ${vm.autoBudget.cashReserveMonths} 个月刚性费用｜可支配 ${compactMoney(vm.autoBudget.spendableYuan)}`,
      fontSize: 12,
      color: vm.autoBudget.spendableYuan > 0 ? THEME.textWeak : THEME.warning,
      width: 210,
      lineHeight: 17,
      parent: parent,
    }).setPosition(-60, 196);
    createButton({
      text: '预览',
      width: 76,
      height: 48,
      fontSize: 13,
      parent: parent,
      onClick: () => this.openAutoBudgetDialog(),
    }).setPosition(125, 196);

    // 归因说明：历史账本无逐部门归因，数字只代表当月估算
    createLabel({
      text: '贡献为「按当前团队 + 当月预计收入」的估算；月账只存净费用、未按部门留存归因，故不展示历史“已实现收益”。',
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 17,
      parent: parent,
    }).setPosition(0, 150);

    // 已建部门卡片（主营 + 支持部门）
    let y = 40;
    const ordered = [
      ...vm.departments.filter((d) => d.type === 'BUSINESS'),
      ...vm.departments.filter((d) => d.type !== 'BUSINESS'),
    ];
    for (const deptVm of ordered) {
      this.renderDeptCard(parent, s, deptVm, y);
      y -= 166;
    }
    for (const u of vm.uncreated) {
      this.renderUncreatedDept(parent, u, y);
      y -= 100;
    }
  }

  private renderDeptCard(parent: Node, s: GameState, deptVm: DepartmentVM, y: number): void {
    const isBiz = deptVm.type === 'BUSINESS';
    const name = isBiz ? '主营业务部' : SUPPORT_DEPT_META[deptVm.type as SupportDeptType].name;
    const effectText = isBiz
      ? `收入覆盖 ${percentText(deptVm.effectBps)}（收入/产能）`
      : deptVm.headcount === 0
        ? '尚未配置人员：无部门效益'
        : `系数 ${percentText(deptVm.effectBps)}｜${VALUE_KIND_TEXT[deptVm.valueKind]}`;
    const valueText = isBiz
      ? `主营毛利 ${compactMoney(deptVm.estimatedMonthlyValueYuan)}`
      : `估算${VALUE_KIND_TEXT[deptVm.valueKind]} ${compactMoney(deptVm.estimatedMonthlyValueYuan)}`;

    createRect({ width: 343, height: 156, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, y);
    createLabel({ text: name, fontSize: 15, bold: true, width: 214, align: 'left', parent: parent }).setPosition(-54, y + 54);
    createLabel({
      text: deptVm.staffingMode === 'AUTO' ? '自动编制' : '手动锁定',
      fontSize: 12,
      color: deptVm.staffingMode === 'AUTO' ? THEME.secondary : THEME.textWeak,
      width: 74,
      align: 'right',
      parent: parent,
    }).setPosition(124, y + 54);
    createLabel({
      text: `在岗 ${deptVm.headcount} 人｜月薪合计 ${compactMoney(deptVm.monthlyPayrollYuan)}`,
      fontSize: 12,
      color: deptVm.headcount === 0 && !isBiz ? THEME.warning : THEME.text,
      width: 311,
      align: 'left',
      parent: parent,
    }).setPosition(-16, y + 30);
    createLabel({
      text: effectText,
      fontSize: 12,
      color: deptVm.headcount === 0 && !isBiz ? THEME.warning : THEME.textWeak,
      width: 311,
      align: 'left',
      parent: parent,
    }).setPosition(-16, y + 6);
    createLabel({
      text: `${valueText}｜净贡献 ${compactMoney(deptVm.estimatedNetContributionYuan)}`,
      fontSize: 12,
      color: deptVm.estimatedNetContributionYuan >= 0 ? THEME.profit : THEME.danger,
      width: 303,
      lineHeight: 16,
      align: 'left',
      parent: parent,
    }).setPosition(-16, y - 18);

    // 操作行：编制 / 招聘 / 详情（间距独立，不越卡）
    const dept = s.departments.find((d) => d.deptId === deptVm.deptId);
    if (!dept) return;
    const actions = layoutActionRow(311, 3, BUTTON_BASELINE.gap);
    const a0 = actions[0]!;
    const a1 = actions[1]!;
    const a2 = actions[2]!;
    createButton({
      text: deptVm.staffingMode === 'AUTO' ? '编制 自动' : '编制 手动',
      width: a0.width,
      height: 44,
      visualHeight: 36,
      fontSize: 12,
      color: deptVm.staffingMode === 'AUTO' ? THEME.primarySoft : THEME.chip,
      textColor: deptVm.staffingMode === 'AUTO' ? THEME.primary : THEME.textWeak,
      parent: parent,
      onClick: () => void this.onToggleStaffing(dept),
    }).setPosition(a0.x, y - 52);
    createButton({
      text: '招聘',
      width: a1.width,
      height: 44,
      visualHeight: 40,
      fontSize: 12,
      parent: parent,
      onClick: () => this.openHireForDept(deptVm.deptId),
    }).setPosition(a1.x, y - 52);
    createButton({
      text: '详情',
      width: a2.width,
      height: 44,
      visualHeight: 36,
      fontSize: 12,
      color: THEME.chip,
      textColor: THEME.primary,
      parent: parent,
      onClick: () => this.openDeptDetail(deptVm.deptId),
    }).setPosition(a2.x, y - 52);
  }

  private renderUncreatedDept(parent: Node, u: UncreatedDeptVM, y: number): void {
    const meta = SUPPORT_DEPT_META[u.type];
    createRect({ width: 343, height: 92, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, y);
    createLabel({ text: meta.name, fontSize: 14, bold: true, width: 200, align: 'left', parent: parent }).setPosition(-60, y + 28);
    createLabel({
      text: meta.desc,
      fontSize: 12,
      color: THEME.textWeak,
      width: 214,
      lineHeight: 16,
      align: 'left',
      parent: parent,
    }).setPosition(-53, y + 6);
    createLabel({
      text: `设立费 ${moneyText(u.feeYuan)}｜建后余额 ${compactMoney(u.cashAfterYuan)}`,
      fontSize: 12,
      color: u.affordable ? THEME.textWeak : THEME.danger,
      width: 214,
      lineHeight: 16,
      align: 'left',
      parent: parent,
    }).setPosition(-53, y - 10);
    createLabel({
      text: u.affordable ? '默认手动编制，0 员工无部门效益' : '现金不足，无法设立',
      fontSize: 12,
      color: u.affordable ? THEME.textWeak : THEME.danger,
      width: 214,
      lineHeight: 16,
      align: 'left',
      parent: parent,
    }).setPosition(-53, y - 26);
    createButton({
      text: u.affordable ? '创建' : '余额不足',
      width: 80,
      height: 48,
      visualHeight: 40,
      fontSize: 12,
      parent: parent,
      disabled: !u.affordable,
      onClick: () => this.confirmCreateDept(u.type),
    }).setPosition(110, y);
  }

  private async onSetPolicy(policy: Policy): Promise<void> {
    const s = this.state();
    const r = await this.facade.setPolicy(policy, { commandId: nextCommandId('policy'), expectedRunId: s.runId });
    if (!r.ok) this.toast(r.displayMessage);
    else this.render();
  }

  private async onToggleStaffing(dept: Department): Promise<void> {
    const s = this.state();
    const next = dept.staffingMode === 'AUTO' ? 'LOCKED' : 'AUTO';
    const r = await this.facade.setStaffingMode(dept.deptId, next, {
      commandId: nextCommandId('mode'),
      expectedRunId: s.runId,
    });
    if (!r.ok) this.toast(r.displayMessage);
    else {
      this.render();
      this.toast(next === 'AUTO' ? '已切为自动编制：仅在 ROI 达标且现金安全时自动招人' : '已切为手动锁定：自动决策不再增删本部门人员');
    }
  }

  /** 自动预算预览：门槛、安全线、本年自动招聘进度与硬性约束（只读）。 */
  private openAutoBudgetDialog(): void {
    const vm = this.facade.getDepartmentOverview();
    if (!vm) return;
    const b = vm.autoBudget;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '自动经营预算预览',
      width: 320,
      desiredBodyHeight: 320,
    });
    const body = handle.body;
    const innerWidth = 288;
    const rows: Array<[string, string]> = [
      ['当前方针', `${POLICY_META[b.policy].name}（${POLICY_META[b.policy].desc}）`],
      ['自动招聘门槛', `预计 12 个月贡献 ≥ 12 个月工资+招聘费 × ${(b.roiThresholdBps / 10_000).toFixed(2)}`],
      ['现金安全线', `需保留 ${b.cashReserveMonths} 个月刚性费用 ${moneyText(b.reserveRequiredYuan)}`],
      ['当前现金', moneyText(b.cashYuan)],
      ['可支配余量', `${moneyText(b.spendableYuan)}${b.spendableYuan <= 0 ? '（低于安全线，自动招聘将被冻结）' : ''}`],
      ['AUTO 编制部门', `${b.autoDeptCount} 个（手动锁定部门不参与自动招聘）`],
      ['本年自动招聘', `${b.autoHiresThisYear} / ${b.maxAutoHiresPerYear} 人（每月最多 ${b.maxAutoHiresPerMonth} 人）`],
    ];
    for (const [k, v] of rows) {
      createLabel({
        text: `${k}：${v}`,
        fontSize: 12,
        color: THEME.text,
        width: innerWidth,
        lineHeight: 17,
        align: 'left',
        parent: body,
      });
    }
    createLabel({
      text: '硬性约束：系统不会自动裁员、不会自动建部门、不会自动扩产；自动录用仅发生在 AUTO 编制部门，且受 ROI 与现金安全线双重限制。',
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 17,
      align: 'left',
      parent: body,
    });
    createButton({
      text: '关闭',
      width: 200,
      height: 46,
      fontSize: 14,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  /** 部门详情：效益口径、成本来源、历史归因限制、建议人数与编制模式。 */
  private openDeptDetail(deptId: string): void {
    const s = this.state();
    const vm = this.facade.getDepartmentOverview();
    const dept = s.departments.find((d) => d.deptId === deptId);
    const dv = vm?.departments.find((d) => d.deptId === deptId);
    if (!dept || !dv || !vm) return;
    const isBiz = dv.type === 'BUSINESS';
    const name = isBiz ? '主营业务部' : SUPPORT_DEPT_META[dv.type as SupportDeptType].name;
    const sessionKey = `dept-detail:${s.runId}:${deptId}:${this.contextEpoch}`;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: `${name} · 详情`,
      width: 320,
      desiredBodyHeight: 430,
      session: { semanticKey: sessionKey, kind: 'detail', owner: this.dialogOwner(deptId) },
    });
    const body = handle.body;
    const innerWidth = 288;
    const asOfLabel = createLabel({ text: this.detailAsOfText(s), fontSize: 11, color: THEME.textWeak, width: innerWidth, align: 'left', parent: body });
    const hintLabel = createLabel({
      text: '数据已跨月更新；当月数字请点“更新数据”刷新，本窗口不重建。',
      fontSize: 11,
      color: THEME.warning,
      width: innerWidth,
      lineHeight: 16,
      align: 'left',
      parent: body,
    });
    hintLabel.active = false;
    const lineNodes: Node[] = [];
    const addLine = (text: string, color = THEME.text, bold = false): void => {
      const node = createLabel({
        text,
        fontSize: 12,
        bold,
        color,
        width: innerWidth,
        lineHeight: 17,
        align: 'left',
        parent: body,
      });
      lineNodes.push(node);
    };
    for (let i = 0; i < 8; i += 1) addLine('');

    // 建议人数：仅记录目标，减少目标不裁员、不退费
    const targetRow = new Node('TargetRow');
    targetRow.parent = body;
    targetRow.addComponent(UITransform).setContentSize(new Size(innerWidth, 52));
    const targetLabel = createLabel({
      text: `建议编制人数：${dv.targetCount} 人（仅建议，不自动裁员）`,
      fontSize: 12,
      width: 176,
      align: 'left',
      parent: targetRow,
    });
    targetLabel.setPosition(-52, 0);
    createButton({
      text: '－',
      width: 48,
      height: 48,
      fontSize: 14,
      color: THEME.divider,
      textColor: THEME.text,
      parent: targetRow,
      onClick: () => void this.changeTarget(deptId, -1, handle),
    }).setPosition(72, 0);
    createButton({
      text: '＋',
      width: 48,
      height: 48,
      fontSize: 14,
      parent: targetRow,
      onClick: () => void this.changeTarget(deptId, 1, handle),
    }).setPosition(122, 0);

    const row1 = layoutActionRow(288, 2, BUTTON_BASELINE.gap);
    const r1a = row1[0]!;
    const r1b = row1[1]!;
    const staffingButton = createButton({
      text: dept.staffingMode === 'AUTO' ? '切为手动锁定' : '切为自动编制',
      width: r1a.width,
      height: 48,
      fontSize: 12,
      color: THEME.divider,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => {
        void this.onToggleStaffing(dept).then(() => {
          if (!handle.closed) handle.close();
        });
      },
    });
    staffingButton.setPosition(r1a.x, 30);
    createButton({
      text: '更新数据',
      width: r1b.width,
      height: 48,
      fontSize: 13,
      parent: handle.footer,
      onClick: () => fill(),
    }).setPosition(r1b.x, 30);
    createButton({
      text: '关闭',
      width: 288,
      height: 48,
      fontSize: 14,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, -30);

    const fill = (): void => {
      const latest = this.state();
      const latestVm = this.facade.getDepartmentOverview();
      const latestDept = latest.departments.find((d) => d.deptId === deptId);
      const latestDv = latestVm?.departments.find((d) => d.deptId === deptId);
      if (!latestDept || !latestDv || !latestVm) {
        handle.setError('该部门已不存在，可能已随本局重置。');
        return;
      }
      const biz = latestDv.type === 'BUSINESS';
      const texts: Array<[string, Color, boolean]> = [
        [
          biz
            ? `职责：交付主营产能。当月产能 ${moneyText(latestVm.monthlyCapacityYuan)}，当月需求 ${moneyText(latestVm.monthlyPotentialOrderYuan)}，预计收入 ${moneyText(latestVm.projectedRevenueYuan)}。`
            : `职责：${SUPPORT_DEPT_META[latestDv.type as SupportDeptType].desc}。${latestDv.headcount === 0 ? '当前 0 人，效益严格为 0。' : ''}`,
          THEME.textWeak,
          false,
        ],
        [`在岗：${latestDv.headcount} 人｜月薪合计 ${moneyText(latestDv.monthlyPayrollYuan)}`, THEME.text, false],
        [
          biz
            ? `收入覆盖率：${percentText(latestDv.effectBps)}（预计收入 / 当月产能）`
            : `部门系数：${percentText(latestDv.effectBps)}（${DEPT_EFFECT_TEXT[latestDv.type as SupportDeptType]}）`,
          THEME.text,
          false,
        ],
        [`当月估算效益：${moneyText(latestDv.estimatedMonthlyValueYuan)}（${VALUE_KIND_TEXT[latestDv.valueKind]}）`, THEME.profit, false],
        [
          `部门月薪成本：${moneyText(latestDv.monthlyPayrollYuan)}；估算净贡献：${moneyText(latestDv.estimatedNetContributionYuan)}`,
          latestDv.estimatedNetContributionYuan >= 0 ? THEME.profit : THEME.danger,
          false,
        ],
        [
          biz ? '' : `设立费：${moneyText(latestVm.setupFeeYuan)}（${latestDv.setupPaid ? '确认建部时已一次性支付' : '尚未支付'}）`,
          THEME.textWeak,
          false,
        ],
        [
          '归因限制：月账只保存净费用，未按部门留存“历史节省”；所以本页数字均为当月估算，不代表历史已实现收益，也不会重复计入利润。',
          THEME.textWeak,
          false,
        ],
        [
          `编制模式：${latestDept.staffingMode === 'AUTO' ? '自动（自动招聘受 ROI/安全线约束）' : '手动锁定（自动决策不增删人员）'}。切换编制不产生费用，也永不自动裁员。`,
          THEME.textWeak,
          false,
        ],
      ];
      texts.forEach(([text, color, bold], index) => this.setLabelText(lineNodes[index]!, text, color, bold));
      this.setLabelText(targetLabel, `建议编制人数：${latestDv.targetCount} 人（仅建议，不自动裁员）`);
      setButtonLabel(staffingButton, latestDept.staffingMode === 'AUTO' ? '切为手动锁定' : '切为自动编制');
      this.setLabelText(asOfLabel, this.detailAsOfText(latest));
      hintLabel.active = false;
    };

    fill();
    this.detailSessions.push({
      key: sessionKey,
      employeeId: `dept:${deptId}`,
      asOfYear: s.gameYear,
      asOfMonth: s.gameMonth,
      notified: false,
      notify: () => {
        if (!handle.closed) hintLabel.active = true;
      },
      alive: () => !handle.closed,
    });
    handle.onClose = () => {
      this.detailSessions = this.detailSessions.filter((item) => item.key !== sessionKey);
    };
  }

  private async changeTarget(deptId: string, delta: number, handle: DialogHandle): Promise<void> {
    const vm = this.facade.getDepartmentOverview();
    const dv = vm?.departments.find((d) => d.deptId === deptId);
    if (!dv) return;
    const target = Math.max(0, Math.min(50, dv.targetCount + delta));
    if (target === dv.targetCount) return;
    const s = this.state();
    const r = await this.facade.setTargetCount(deptId, target, {
      commandId: nextCommandId('target'),
      expectedRunId: s.runId,
    });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    if (!handle.closed) handle.close();
    this.openDeptDetail(deptId);
  }

  private confirmCreateDept(type: SupportDeptType): void {
    const p = this.facade.previewCreateDepartment(type);
    if (p.alreadyExists) {
      this.toast(`${SUPPORT_DEPT_META[type].name}已经创建`);
      this.render();
      return;
    }
    const cash = this.state().company?.cashYuan ?? 0;
    const commandId = nextCommandId('dept');
    const originRunId = this.state().runId;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: `创建${SUPPORT_DEPT_META[type].name}？`,
      session: { semanticKey: `create-dept:${originRunId}:${type}:${this.contextEpoch}`, kind: 'confirm', owner: this.dialogOwner(type) },
      message:
        `${SUPPORT_DEPT_META[type].desc}\n` +
        `设立费：${moneyText(p.feeYuan)}（确认即扣现金）\n` +
        `现金：${moneyText(cash)} → ${moneyText(p.cashAfterYuan)}\n` +
        `创建后默认手动编制，不自动招人；0 员工无部门效益。`,
      width: 320,
      confirmText: `支付 ${moneyText(p.feeYuan)} 创建`,
      busyText: '创建中…',
      confirmEnabled: p.cashAfterYuan >= 0,
      onConfirm: async (dialog) => {
        const r = await this.facade.createDepartment(type, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'RUN_CHANGED') {
            // 旧 run 的建部意图永久失效：不自动关框、不重开，只锁定提交
            dialog.blockSubmit(r.displayMessage);
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        audioManager.createDepartment();
        if (this.state().runId === originRunId) {
          this.render();
          this.toast(`已创建${SUPPORT_DEPT_META[type].name}，支付 ${moneyText(r.payload.feePaidYuan)}`);
        }
      },
    });
  }

  // ---------------------------------------------------------------- 人才页

  private deptLabel(type: DeptType): string {
    return type === 'BUSINESS' ? '主营业务部' : SUPPORT_DEPT_META[type].name;
  }

  private renderTalentTab(parent: Node): void {
    this.talentPool = null;
    const ov = this.facade.getTalentOverview(this.talentFilterKey);
    if (!ov) return;
    createLabel({ text: '员工', fontSize: 22, bold: true, color: THEME.text, parent: parent }).setPosition(0, 344);
    createLabel({
      text:
        `在职 ${ov.headcount} 人｜月薪合计 ${moneyText(ov.monthlyPayrollYuan)}` +
        (this.talentFilterKey === 'ALL' ? '' : `（全公司 ${ov.allHeadcount} 人｜${moneyText(ov.allMonthlyPayrollYuan)}）`),
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      parent: parent,
    }).setPosition(0, 316);

    // 部门筛选：最多 6 个部门 + 全部（每行 4 个，热区 44）
    ov.filters.forEach((f, i) => {
      const label = f.deptType === null ? '全部' : this.deptLabel(f.deptType).replace('部', '');
      createButton({
        text: `${label} ${f.headcount}`,
        width: 80,
        height: 44,
        visualHeight: 32,
        fontSize: 12,
        color: f.key === this.talentFilterKey ? THEME.primary : THEME.chip,
        textColor: f.key === this.talentFilterKey ? Color.WHITE : THEME.textWeak,
        parent: parent,
        onClick: () => {
          if (this.talentFilterKey === f.key) return;
          this.talentFilterKey = f.key;
          audioManager.uiSelect();
          this.render();
        },
      }).setPosition(-126 + (i % 4) * 84, 286 - Math.floor(i / 4) * 48);
    });

    const cardHeight = 108;
    const step = 116;
    // Keep the first card below every filter row, with the same 8-unit gap
    // used between controls. The filter grid is authored at y=286 in 48-unit
    // row steps and each button has a 44-unit hit target.
    const filterRows = Math.ceil(ov.filters.length / 4);
    const filterBottom = 286 - Math.max(0, filterRows - 1) * 48 - 22;
    const listTop = filterBottom - 8 - cardHeight / 2;
    if (ov.rows.length === 0) {
      createLabel({
        text: this.talentFilterKey === 'ALL' ? '暂无在职员工' : '该部门暂无员工',
        fontSize: 14,
        color: THEME.textWeak,
        width: 343,
        parent: parent,
      }).setPosition(0, listTop - 20);
    }

    // 复用卡片池：只渲染可视窗口内约 12 张卡，滚动时更新内容与位置
    const cards: Array<{ node: Node; name: Node; meta: Node; pay: Node; state: Node; index: number }> = [];
    for (let i = 0; i < 12; i += 1) {
      const card = createRect({ width: 343, height: cardHeight, color: Color.WHITE, radius: 8, parent });
      card.active = false;
      const name = createLabel({ text: '', fontSize: 15, bold: true, width: 210, align: 'left', parent: card });
      name.setPosition(-55, 32);
      const meta = createLabel({ text: '', fontSize: 12, color: THEME.textWeak, width: 210, align: 'left', parent: card });
      meta.setPosition(-55, 12);
      const pay = createLabel({ text: '', fontSize: 12, color: THEME.primary, width: 210, align: 'left', parent: card });
      pay.setPosition(-55, -8);
      const state = createLabel({ text: '', fontSize: 12, color: THEME.textWeak, width: 210, align: 'left', parent: card });
      state.setPosition(-55, -30);
      const entry = { node: card, name, meta, pay, state, index: -1 };
      cards.push(entry);
      createButton({
        text: '详情',
        width: 56,
        height: 44,
        visualHeight: 36,
        fontSize: 12,
        color: THEME.chip,
        textColor: THEME.primary,
        parent: card,
        onClick: () => {
          const row = this.talentPool?.rows[entry.index];
          if (row) this.openEmployeeDetail(row.employeeId);
        },
      }).setPosition(132, 0);
    }
    // 占位撑高：让内容高覆盖整份列表，滚动条可到最后一位员工
    const spacer = new Node('TalentSpacer');
    spacer.parent = parent;
    spacer.addComponent(UITransform).setContentSize(new Size(343, 1));
    // Extra tail room lets the last card scroll above the fixed footer with a
    // full hit target, including on compact 360x640 screens.
    spacer.setPosition(0, listTop - Math.max(0, ov.rows.length - 1) * step - cardHeight / 2 - 40);

    this.talentPool = { rows: ov.rows, listTop, step, cards };
    this.updateTalentWindow();
  }

  /** R30：按滚动位置复用卡片（不销毁重建、不串员工）。 */
  private updateTalentWindow(): void {
    const shell = this.shell;
    const pool = this.talentPool;
    if (!shell || !pool || this.activeTab !== 'TALENT') return;
    const contentTr = shell.content.getComponent(UITransform);
    const viewTr = shell.viewNode.getComponent(UITransform);
    if (!contentTr || !viewTr) return;
    const offset = shell.scrollView.getScrollOffset().y;
    const authoredTop = contentTr.height / 2 - offset - viewTr.height / 2 - shell.shift;
    const maxFirst = Math.max(0, pool.rows.length - pool.cards.length);
    const first = Math.min(
      maxFirst,
      Math.max(0, Math.floor((pool.listTop - authoredTop) / pool.step) - 1),
    );
    for (let k = 0; k < pool.cards.length; k += 1) {
      const card = pool.cards[k]!;
      const index = first + k;
      const row = pool.rows[index];
      card.index = index;
      card.node.active = !!row;
      if (!row) continue;
      card.node.setPosition(0, pool.listTop - index * pool.step + shell.shift);
      card.name.getComponent(Label)!.string = `${row.name}（${this.deptLabel(row.deptType).replace('部', '')}）`;
      card.meta.getComponent(Label)!.string = `能力 ${row.skill}｜潜力 ${row.potential}｜协作 ${row.teamwork}`;
      card.pay.getComponent(Label)!.string = `月薪 ${moneyText(row.salaryMonthlyYuan)}｜入职 ${row.tenureMonths} 个月`;
      if (row.status === 'PENDING_DISMISSAL') {
        card.state.getComponent(Label)!.string = '次月离岗';
        card.state.getComponent(Label)!.color = THEME.danger;
      } else if (row.pendingDeptId) {
        const dept = this.state().departments.find((d) => d.deptId === row.pendingDeptId);
        // Keep the fixed-height virtual row readable. The detail view retains
        // the full current-month payroll explanation.
        card.state.getComponent(Label)!.string = `下月调岗→${dept ? this.deptLabel(dept.type).replace('部', '') : '—'}`;
        card.state.getComponent(Label)!.color = THEME.warning;
      } else {
        card.state.getComponent(Label)!.string = '在职';
        card.state.getComponent(Label)!.color = THEME.textWeak;
      }
    }
  }

  private openEmployeeDetail(employeeId: string): void {
    const s = this.state();
    const emp = s.employees.find((e) => e.employeeId === employeeId);
    if (!emp) return;
    const snapshotKey = `employee:${s.runId}:${employeeId}:${this.contextEpoch}`;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '员工详情',
      subtitle: emp.name,
      width: 330,
      desiredBodyHeight: 420,
      session: { semanticKey: snapshotKey, kind: 'detail', owner: this.dialogOwner(employeeId) },
    });
    if (handle.closed) return;

    const body = handle.body;
    const asOfLabel = createLabel({
      text: this.detailAsOfText(s),
      fontSize: 11,
      color: THEME.textWeak,
      width: 292,
      align: 'left',
      parent: body,
    });
    const updateHint = createLabel({
      text: '月结快照：月中发生的变化不会自动改写本窗口',
      fontSize: 11,
      color: THEME.textWeak,
      width: 292,
      align: 'left',
      parent: body,
    });

    const salaryLabel = createLabel({ text: '', fontSize: 15, bold: true, width: 292, lineHeight: 22, align: 'left', parent: body });
    const attrLabel = createLabel({ text: '', fontSize: 13, width: 292, lineHeight: 22, align: 'left', parent: body });
    const tenureLabel = createLabel({ text: '', fontSize: 13, width: 292, lineHeight: 22, align: 'left', parent: body });
    const stateLabel = createLabel({ text: '', fontSize: 13, width: 292, lineHeight: 22, align: 'left', parent: body });

    const fill = (note?: string): void => {
      const latest = this.state();
      const latestEmp = latest.employees.find((e) => e.employeeId === employeeId);
      const dept = latest.departments.find((d) => d.deptId === latestEmp?.departmentId);
      const deptName = dept ? this.deptLabel(dept.type) : '—';
      const monthIndex = (latest.gameYear - 1) * 12 + (latest.gameMonth - 1);
      const pendingDept = latestEmp?.pendingDepartmentId
        ? latest.departments.find((d) => d.deptId === latestEmp.pendingDepartmentId)
        : null;
      const asOf = this.detailAsOfText(latest);
      this.setLabelText(asOfLabel, note ? `${asOf}\n${note}` : asOf);
      if (!latestEmp) {
        this.setLabelText(salaryLabel, '员工已不在当前名册');
        this.setLabelText(attrLabel, '可能已离岗；本窗口不再展示旧能力/薪资。');
        this.setLabelText(tenureLabel, '');
        this.setLabelText(stateLabel, '状态：已离岗（以最新月结为准）');
        setButtonEnabled(transferButton, false);
        setButtonEnabled(layoffButton, false);
        return;
      }
      this.setLabelText(salaryLabel, `${deptName}｜月薪 ${moneyText(latestEmp.salaryMonthlyYuan)}`);
      this.setLabelText(attrLabel, `能力 ${latestEmp.skill}｜潜力 ${latestEmp.potential}｜协作 ${latestEmp.teamwork}`);
      const tenureMonths = Math.max(1, monthIndex - latestEmp.hiredAtMonthIndex + 1);
      const hiredYear = Math.floor(latestEmp.hiredAtMonthIndex / 12) + 1;
      const hiredMonth = (latestEmp.hiredAtMonthIndex % 12) + 1;
      this.setLabelText(
        tenureLabel,
        `入职 ${tenureMonths} 个月（第 ${hiredYear} 年 ${hiredMonth} 月入职）`,
      );
      this.setLabelText(
        stateLabel,
        latestEmp.status === 'PENDING_DISMISSAL'
          ? '状态：次月离岗（补偿已支付，本月仍计薪/计产能）'
          : pendingDept
            ? `状态：调岗下月生效 → ${this.deptLabel(pendingDept.type)}（当月仍按原部门计薪）`
            : '状态：在职',
      );
      const color =
        latestEmp.status === 'PENDING_DISMISSAL' ? THEME.danger : pendingDept ? THEME.warning : THEME.textWeak;
      stateLabel.getComponent(Label)!.color = color;
      const active = latestEmp.status === 'ACTIVE';
      setButtonEnabled(transferButton, active);
      setButtonEnabled(layoffButton, active);
    };

    const row1 = layoutActionRow(292, 2, BUTTON_BASELINE.gap);
    const r1a = row1[0]!;
    const r1b = row1[1]!;
    const transferButton = createButton({
      text: '调岗',
      width: r1a.width,
      height: 48,
      variant: 'secondary',
      color: THEME.secondary,
      parent: handle.footer,
      onClick: () => {
        const current = this.state().employees.find((e) => e.employeeId === employeeId);
        if (!current || current.status !== 'ACTIVE') {
          this.toast('该员工已进入离岗流程，不能调岗');
          fill();
          return;
        }
        // A24-01：父详情保持打开，子流程取消即回到同一窗口
        this.openTransfer(employeeId, handle);
      },
    });
    transferButton.setPosition(r1a.x, 30);
    const layoffButton = createButton({
      text: '裁员',
      width: r1b.width,
      height: 48,
      variant: 'danger',
      color: THEME.danger,
      parent: handle.footer,
      onClick: () => {
        const current = this.state().employees.find((e) => e.employeeId === employeeId);
        if (!current || current.status !== 'ACTIVE') {
          this.toast('该员工已进入离岗流程，不能重复裁员');
          fill();
          return;
        }
        this.openLayoffConfirm(employeeId, handle);
      },
    });
    layoffButton.setPosition(r1b.x, 30);
    const row2 = layoutActionRow(292, 2, BUTTON_BASELINE.gap);
    const r2a = row2[0]!;
    const r2b = row2[1]!;
    const refreshButton = createButton({
      text: '更新数据',
      width: r2a.width,
      height: 48,
      variant: 'secondary',
      color: Color.WHITE,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => {
        fill(`已手动刷新至 ${this.detailAsOfText(this.state())}`);
        updateHint.active = false;
      },
    });
    refreshButton.setPosition(r2a.x, -30);
    const closeButton = createButton({
      text: '关闭',
      width: r2b.width,
      height: 48,
      variant: 'secondary',
      color: Color.WHITE,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => handle.close(),
    });
    closeButton.setPosition(r2b.x, -30);
    fill();

    // R31：跨月只提示一次；不接受自动换行/跳动，玩家点“更新数据”才重取 VM
    const refreshSession = {
      key: snapshotKey,
      employeeId,
      asOfYear: s.gameYear,
      asOfMonth: s.gameMonth,
      notified: false,
      notify: () => {
        updateHint.active = true;
        this.setLabelText(updateHint, '数据已更新：本月有新变化，点“更新数据”查看最新');
      },
      alive: () => !handle.closed,
    };
    this.detailSessions.push(refreshSession);
    handle.onClose(() => {
      this.detailSessions = this.detailSessions.filter((item) => item.key !== snapshotKey);
    });
  }

  /** 统一设置 Label 文本（空串安全）；可选同步颜色/加粗。 */
  private setLabelText(node: Node, text: string, color?: Color, bold?: boolean): void {
    const label = node.getComponent(Label);
    if (!label) return;
    label.string = text;
    if (color) label.color = color;
    if (bold !== undefined) label.isBold = bold;
  }

  private detailAsOfText(s: GameState): string {
    return `数据截至：第 ${s.gameYear} 年 ${s.gameMonth} 月（月结快照）`;
  }

  /** R31：已打开详情遇到新月份时只提示一次，不自动刷新内容。 */
  private refreshDetailFreshness(): void {
    for (const session of this.detailSessions) {
      if (!session.alive()) continue;
      const s = this.state();
      if (session.notified) continue;
      if (s.gameYear !== session.asOfYear || s.gameMonth !== session.asOfMonth) {
        session.notified = true;
        session.notify();
      }
    }
  }

  private openTransfer(employeeId: string, parent?: DialogHandle): void {
    const s = this.state();
    const emp = s.employees.find((e) => e.employeeId === employeeId);
    if (!emp) return;
    const targets = this.facade.getTransferTargets(employeeId) ?? [];
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '调岗目标',
      subtitle: `${emp.name}：下月生效，当月仍按原部门计薪`,
      width: 330,
      desiredBodyHeight: 380,
      session: {
        semanticKey: `transfer-targets:${s.runId}:${employeeId}:${this.contextEpoch}`,
        kind: 'form',
        owner: this.dialogOwner(employeeId),
        // A24-01：挂在员工详情下；取消子框回到同一父详情（员工/窗口/滚动位置保持）
        parentSessionId: parent?.id,
      },
    });
    if (targets.length === 0) {
      createLabel({
        text: '没有可调往的部门。先到部门页建立支持部门，再回到这里调岗。',
        fontSize: 13,
        color: THEME.textWeak,
        width: 292,
        lineHeight: 22,
        align: 'left',
        parent: handle.body,
      });
    }
    for (const target of targets) {
      const impact = this.facade.getTransferImpact(employeeId, target.deptId);
      if (!impact) continue;
      createButton({
        text: `调入 ${this.deptLabel(target.type)}（${impact.toHeadcountBefore}→${impact.toHeadcountAfter} 人）`,
        width: 292,
        height: 48,
        variant: 'secondary',
        fontSize: 13,
        color: THEME.secondary,
        parent: handle.body,
        onClick: () => {
          this.openTransferConfirm(employeeId, target.deptId, handle, parent);
        },
      });
    }
    createButton({
      text: '取消',
      width: 240,
      height: 48,
      variant: 'secondary',
      color: Color.WHITE,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  private openTransferConfirm(employeeId: string, toDeptId: string, parent?: DialogHandle, root?: DialogHandle): void {
    const impact = this.facade.getTransferImpact(employeeId, toDeptId);
    if (!impact) {
      this.toast('该员工状态已变化，请重新打开详情');
      return;
    }
    const commandId = nextCommandId('transfer');
    const originRunId = this.state().runId;
    const capacityLine =
      impact.businessCapacityLossYuan === null
        ? ''
        : impact.businessCapacityLossYuan > 0
          ? `主营产能：次月起 -${moneyText(impact.businessCapacityLossYuan)}/月\n`
          : '主营产能：次月起不减少（产能仍受需求上限约束）\n';
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认调岗？',
      message:
        `员工：${impact.name}（月薪 ${moneyText(impact.salaryMonthlyYuan)}）\n` +
        `原部门人数：${impact.fromHeadcountBefore} → ${impact.fromHeadcountAfter}\n` +
        `目标部门人数：${impact.toHeadcountBefore} → ${impact.toHeadcountAfter}\n` +
        `工资总额：${moneyText(impact.payrollBeforeYuan)}（同一员工只计一次）\n` +
        `生效：第 ${impact.effectiveGameYear} 年 ${impact.effectiveGameMonth} 月\n` +
        capacityLine,
      width: 312,
      desiredBodyHeight: 220,
      confirmText: '确认调岗（下月生效）',
      busyText: '处理中…',
      session: {
        semanticKey: `transfer:${originRunId}:${employeeId}:${this.contextEpoch}`,
        kind: 'confirm',
        owner: this.dialogOwner(employeeId),
        parentSessionId: parent?.id,
      },
      onConfirm: async (dialog) => {
        const r = await this.facade.transferEmployee(employeeId, toDeptId, {
          commandId,
          expectedRunId: originRunId,
        });
        if (!r.ok) {
          if (r.code === 'RUN_CHANGED') {
            dialog.blockSubmit('本局已切换，旧调岗意图失效；请关闭窗口后在新局面重新操作。');
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        // A24-01：成功后整条链（确认 → 目标选择 → 员工详情）一起收起
        parent?.close();
        root?.close();
        this.toast('已安排调岗，下月生效');
        if (this.state().runId === originRunId) this.render();
      },
    });
  }
  private openLayoffConfirm(employeeId: string, parent?: DialogHandle): void {
    let pv = this.facade.previewLayoff(employeeId, Date.now());
    // token 与 commandId 在开框时固定：连点只产生一次补偿；过期必须手动重新预览
    let token = this.facade.createLayoffToken(pv, Date.now());
    let commandId = nextCommandId('layoff');
    const originRunId = this.state().runId;
    const capacityLoss = this.facade.getLayoffCapacityLoss(employeeId) ?? 0;

    const buildMessage = (): string => {
      const insufficient = pv.cashAfterYuan < 0;
      return (
        `员工：${pv.name}\n任职：${pv.tenureYears} 年（${pv.tenureMonths} 个月）\n` +
        `月薪：${moneyText(pv.salaryMonthlyYuan)}\n补偿月数：${pv.severanceMonths} 个月\n\n` +
        `补偿金额：${moneyText(pv.severanceYuan)}（确认即支付）\n` +
        `当月主营产能：${capacityLoss > 0 ? `-${moneyText(capacityLoss)}/月` : '不涉及（非主营员工）'}\n` +
        `次年约节约工资：${moneyText(pv.nextYearSalarySavingYuan)}\n` +
        `裁后现金：${moneyText(pv.cashAfterYuan)}` +
        (insufficient ? '\n现金不足以支付补偿，请先回笼资金。' : '')
      );
    };

    const handle = openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认裁员？',
      danger: true,
      message: buildMessage(),
      width: 312,
      desiredBodyHeight: 220,
      confirmEnabled: pv.cashAfterYuan >= 0,
      confirmText: `确认支付补偿 ${moneyText(pv.severanceYuan)}`,
      busyText: '处理中…',
      session: {
        semanticKey: `layoff:${originRunId}:${employeeId}:${this.contextEpoch}`,
        kind: 'confirm',
        owner: this.dialogOwner(employeeId),
        parentSessionId: parent?.id,
      },
      onRefreshPreview: async () => {
        pv = this.facade.previewLayoff(employeeId, Date.now());
        token = this.facade.createLayoffToken(pv, Date.now());
        commandId = nextCommandId('layoff');
        return {
          message: buildMessage(),
          confirmText: `确认支付补偿 ${moneyText(pv.severanceYuan)}`,
          confirmEnabled: pv.cashAfterYuan >= 0,
        };
      },
      onConfirm: async (dialog) => {
        const r = await this.facade.confirmLayoff(token, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'CONFIRMATION_EXPIRED') {
            // §23.5：过期不得自动关框；保留内容，改为手动重新预览
            dialog.markExpired('确认已过期（超过 60 秒），金额可能变化；请点“重新预览”后再确认。');
            return;
          }
          if (r.code === 'RUN_CHANGED') {
            dialog.blockSubmit('本局已切换，旧裁员意图失效；请关闭窗口后在新局面重新操作。');
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        // A24-01：裁员成功后收起父员工详情
        parent?.close();
        this.toast(`已支付补偿 ${moneyText(r.payload.severancePaidYuan)}，次月离岗`);
        audioManager.layoff();
        if (this.state().runId === originRunId) this.render();
      },
    });
    if (pv.cashAfterYuan < 0) {
      handle.setError('现金不足以支付补偿，请先回笼资金后再裁员。');
    }
  }

  private openHireForDept(deptId: string): void {
    const offer = this.facade.getOffer(deptId);
    this.pendingOffer = offer;
    this.renderHireDialog(offer, deptId);
  }

  private renderHireDialog(offer: CandidateOffer, deptId: string): void {
    const s = this.state();
    const storedCouponId = s.adRewards?.couponIds[0];
    const couponId = isAdCouponAvailable(s, storedCouponId, Date.now(), this.adRewardOwnerScope()) ? storedCouponId : undefined;
    const overlay = this.modalOverlay();
    createRect({ width: 340, height: 470, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '招聘候选人', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 206);
    createLabel({ text: '招聘费=1个月月薪（HR已生效可折扣），次月到岗', fontSize: 10, color: THEME.textWeak, width: 300, parent: overlay }).setPosition(0, 186);

    offer.candidates.forEach((c, idx) => {
      const cardY = 150 - idx * 108;
      // R26：费用与可负担性一律取领域层 preview（含 HR 折扣），UI 不猜公式
      const pv = this.facade.previewHire({ offerId: offer.offerId, candidateId: c.candidateId, departmentId: deptId, ...(couponId ? { couponId } : {}) });
      const feeText = pv.ok ? moneyText(pv.payload.feeYuan) : moneyText(c.salaryMonthlyYuan);
      const affordable = pv.ok ? pv.payload.affordable : s.company!.cashYuan >= c.salaryMonthlyYuan;
      createRect({ width: 308, height: 98, color: THEME.bg, radius: 8, parent: overlay }).setPosition(0, cardY);
      const arch = c.archetype === 'A' ? '即战力' : c.archetype === 'B' ? '潜力股' : '经济型';
      createLabel({ text: `${c.name}（${arch}）`, fontSize: 14, bold: true, width: 180, align: 'left', parent: overlay }).setPosition(-56, cardY + 32);
      createLabel({ text: `能力 ${c.skill} 潜力 ${c.potential} 协作 ${c.teamwork}`, fontSize: 11, color: THEME.textWeak, width: 200, align: 'left', parent: overlay }).setPosition(-46, cardY + 12);
      createLabel({ text: `月薪 ${moneyText(c.salaryMonthlyYuan)}｜招聘费 ${feeText}${couponId ? '（券）' : ''}`, fontSize: 11, color: THEME.primary, width: 200, align: 'left', parent: overlay }).setPosition(-46, cardY - 8);
      createButton({
        text: '录用',
        width: 60,
        height: 38,
        fontSize: 13,
        parent: overlay,
        disabled: !affordable,
        onClick: () => {
          overlay.destroy();
          this.openHireConfirm(c.candidateId, deptId, { initial: false, offer, ...(couponId ? { couponId } : {}) });
        },
      }).setPosition(124, cardY);
    });

    createButton({
      text: '换一批',
      width: 96,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.refreshHire(deptId);
      },
    }).setPosition(-60, -206);
    if (this.adCoordinator && (this.adCoordinator.canStart() || this.adCoordinator.hasPendingGrant())
      && !couponId && this.facade.canRequestRewardedAd()) {
      createButton({
        text: '自愿看视频领免招聘费券',
        width: 224,
        height: 36,
        fontSize: 12,
        parent: overlay,
        onClick: () => {
          // 24.14.3.8：广告返回前核对 owner 与 offer，旧 run/旧候选不得重开窗口
          const ownerRunId = s.runId;
          const ownerEpoch = this.authEpoch;
          const ownerOfferId = offer.offerId;
          overlay.destroy();
          void this.requestAdCoupon().then(() => {
            if (!this.facade) return;
            if (this.authEpoch !== ownerEpoch || this.facade.getState().runId !== ownerRunId) return;
            const live = this.pendingOffer;
            if (!live || live.offerId !== ownerOfferId) {
              this.toast('招聘信息已更新，请重新打开人才页');
              return;
            }
            this.renderHireDialog(live, deptId);
          });
        },
      }).setPosition(0, -158);
    }
    createButton({
      text: '关闭',
      width: 96,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(60, -206);
  }

  private async refreshHire(deptId: string): Promise<void> {
    const s = this.state();
    const r = await this.facade.refreshOffer(deptId, { commandId: nextCommandId('refresh'), expectedRunId: s.runId });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    this.pendingOffer = r.payload;
    this.renderHireDialog(r.payload, deptId);
  }

  // ---------------------------------------------------------------- 排行榜

  private renderRankTab(parent: Node): void {
    createLabel({ text: '排行榜', fontSize: 20, bold: true, color: THEME.text, width: 200, align: 'left', parent }).setPosition(-71, 352);

    const boardId = this.rankMode === 'assets' ? this.leaderboardConfig?.assetsBoardId : this.leaderboardConfig?.yearsBoardId;
    const realBoardReady = Boolean(this.leaderboardConfig?.enabled && this.leaderboardConsent);
    // §29.4：诊断信息不进玩家主视区；未启用时只在标题右侧保留状态标签。
    if (!realBoardReady) {
      createRect({ width: 68, height: 22, color: THEME.chip, radius: 11, parent }).setPosition(121, 352);
      createLabel({ text: '本地模拟', fontSize: 11, color: THEME.textWeak, width: 68, parent }).setPosition(121, 352);
    }

    const rankItems = layoutActionRow(220, 2, BUTTON_BASELINE.gap);
    const assetsItem = rankItems[0]!;
    const yearsItem = rankItems[1]!;
    createButton({
      text: '资产榜',
      width: assetsItem.width,
      height: 44,
      visualHeight: 32,
      fontSize: 14,
      color: this.rankMode === 'assets' ? THEME.primarySoft : THEME.chip,
      textColor: this.rankMode === 'assets' ? THEME.primary : THEME.textWeak,
      parent,
      onClick: () => {
        if (this.rankMode === 'assets') return;
        this.rankMode = 'assets';
        audioManager.uiSelect();
        this.render();
      },
    }).setPosition(assetsItem.x, 310);
    createButton({
      text: '年限榜',
      width: yearsItem.width,
      height: 44,
      visualHeight: 32,
      fontSize: 14,
      color: this.rankMode === 'years' ? THEME.primarySoft : THEME.chip,
      textColor: this.rankMode === 'years' ? THEME.primary : THEME.textWeak,
      parent,
      onClick: () => {
        if (this.rankMode === 'years') return;
        this.rankMode = 'years';
        audioManager.uiSelect();
        this.render();
      },
    }).setPosition(yearsItem.x, 310);

    // 真实榜已启用时单独提供入口；未启用时只保留标题标签，不再重复长说明。
    let cursor = 310 - 22;
    if (realBoardReady) {
      const entryY = cursor - 12 - 22;
      createButton({ text: '打开 TapTap 公开榜', width: 168, height: 44, visualHeight: 32, fontSize: 12, color: THEME.chip,
        textColor: THEME.primary, parent,
        onClick: () => {
          if (!boardId) { this.toast('真实榜单缺少后台榜 ID'); return; }
          void new TapLeaderboardProvider().open(boardId).then((r) => { if (r.kind !== 'ok') this.toast('TapTap榜单暂不可用（需后台白名单/登录态）'); });
        } }).setPosition(0, entryY);
      cursor = entryY - 22;
    }

    const rows = this.rankMode === 'assets'
      ? this.facade.assetsLeaderboard()
      : this.facade.yearsLeaderboard();
    const playerRank = rows.findIndex((r) => r.isPlayer) + 1;
    const player = rows.find((r) => r.isPlayer);

    // §29.4：摘要白卡左右分离；左侧最多两行，右侧独立“定位我方”。
    const SUMMARY_H = 72;
    const summaryCenter = cursor - 12 - SUMMARY_H / 2;
    createRect({ width: 343, height: SUMMARY_H, color: Color.WHITE, radius: 12, parent }).setPosition(0, summaryCenter);
    createLabel({
      text: player ? `我方 第 ${playerRank}/${rows.length} 名` : '尚未创建公司',
      fontSize: 15,
      bold: true,
      color: player ? THEME.primary : THEME.textWeak,
      width: 208,
      align: 'left',
      parent,
    }).setPosition(-48, summaryCenter + 14);
    createLabel({
      text: player
        ? `总资产 ${moneyText(player.assetsYuan)}｜经营 ${player.yearsOperated} 年`
        : '创建公司后显示我方名次',
      fontSize: 12,
      color: THEME.textWeak,
      width: 208,
      align: 'left',
      parent,
    }).setPosition(-48, summaryCenter - 12);
    const firstRowY = summaryCenter - SUMMARY_H / 2 - 12 - 24;
    if (player) {
      createButton({
        text: '定位我方 ›',
        width: 96,
        height: 44,
        flat: true,
        fontSize: 13,
        textColor: THEME.primary,
        parent,
        onClick: () => {
          audioManager.uiTap();
          this.scrollRankTo(firstRowY - (playerRank - 1) * 56);
        },
      }).setPosition(111.5, summaryCenter);
    }

    // §29.4：整行可点；不再为每行塞一个“详情”按钮。表头三列固定宽度避免长名称/大金额相撞。
    rows.forEach((row, i) => {
      const y = firstRowY - i * 56;
      const rowButton = createButton({
        text: '',
        name: `RankRow${i + 1}`,
        width: 343,
        height: 48,
        fontSize: 12,
        color: row.isPlayer ? THEME.primarySoft : Color.WHITE,
        parent,
        onClick: () => {
          audioManager.uiTap();
          const dialog = openScrollableDialog({
            overlay: this.modalOverlay(),
            viewportHeight: this.shellLayout().viewportHeight,
            title: row.isPlayer ? '我方排行详情' : '模拟企业排行详情',
            subtitle: `第 ${i + 1} 名`,
            width: 316,
            desiredBodyHeight: 220,
            session: {
              semanticKey: `rank-detail:${this.state().runId}:${this.rankMode}:${i}:${this.contextEpoch}`,
              kind: 'detail',
              owner: this.dialogOwner(),
            },
          });
          createLabel({ text: `企业：${row.name}`, fontSize: 14, color: THEME.text, width: 276, parent: dialog.body });
          createLabel({ text: `总资产：${moneyText(row.assetsYuan)}（现金 + 未折旧业务资产）`, fontSize: 13, color: THEME.text, width: 276, parent: dialog.body });
          createLabel({ text: `经营年限：${row.yearsOperated} 年`, fontSize: 13, color: THEME.text, width: 276, parent: dialog.body });
          createButton({ text: '关闭', width: 108, height: 44, visualHeight: 40, parent: dialog.footer, onClick: () => dialog.close() }).setPosition(0, 0);
        },
      });
      rowButton.setPosition(0, y);
      createLabel({ text: `${i + 1}`, fontSize: 14, bold: true, width: 26, color: i < 3 ? THEME.warning : THEME.textWeak, parent: rowButton }).setPosition(-146.5, 0);
      const nameNode = createLabel({
        // §29.12：CLAMP 不产生省略号，长公司名会像被切断；先按列宽截断再渲染。
        text: fitTextWithEllipsis(row.isPlayer ? `我方 · ${row.name}` : row.name, 14, 140),
        fontSize: 14,
        bold: row.isPlayer,
        width: 143,
        align: 'left',
        color: row.isPlayer ? THEME.primary : THEME.text,
        parent: rowButton,
      });
      nameNode.setPosition(-52.5, 0);
      const nameLabel = nameNode.getComponent(Label);
      if (nameLabel) {
        nameLabel.overflow = Label.Overflow.CLAMP;
        nameLabel.enableWrapText = false;
      }
      const metric = this.rankMode === 'assets'
        ? moneyText(row.assetsYuan)
        : `${row.yearsOperated} 年`;
      createLabel({ text: metric, fontSize: 13, width: 110, align: 'right', color: THEME.text, parent: rowButton }).setPosition(82.5, 0);
      createLabel({ text: '›', fontSize: 14, width: 14, color: THEME.textWeak, parent: rowButton }).setPosition(152.5, 0);
    });
  }

  /** §29.4：按真实行位置与内容高度滚动，使目标行出现在可视区中部。 */
  private scrollRankTo(rowY: number): void {
    const shell = this.shell;
    if (!shell) return;
    const layout = this.shellLayout();
    const geo = computeScrollBody(layout.bodyHeight, shell.minBottom);
    const maxOffset = Math.max(0, geo.contentHeight - layout.bodyHeight);
    // authoredTop 恒为 406；把目标行放到可视区中部，再按内容高度夹取。
    const target = 406 - rowY - layout.bodyHeight / 2;
    shell.scrollView.scrollToOffset(new Vec2(0, Math.max(0, Math.min(maxOffset, target))), 0.25);
  }

  /** R24：底部 Tab 锚定可视区底部（含底部 inset 抬升）；返回壳引用供几何重算。 */
  private renderBottomTabs(
    parent: Node,
    layout: ShellLayout,
  ): { root: Node; bg: Graphics; buttons: Node[] } {
    const tabs: Array<[TabId, string]> = [
      ['COMPANY', '公司'],
      ['DEPARTMENT', '部门'],
      ['TALENT', '人才'],
      ['RANK', '排行'],
    ];
    const footer = new Node('Footer');
    footer.parent = parent;
    footer.addComponent(UITransform).setContentSize(new Size(layout.contentWidth, layout.footerTotal));
    footer.setPosition(layout.footerShiftX, layout.footerBgY);
    // T04：挡住被滚动裁切内容的残余热区（拖动/点击底栏不再触到正文按钮）
    footer.addComponent(BlockInputEvents);

    const bgNode = new Node('FooterBg');
    bgNode.parent = footer;
    bgNode.addComponent(UITransform).setContentSize(new Size(layout.contentWidth, layout.footerTotal));
    const bg = bgNode.addComponent(Graphics);
    bg.fillColor = Color.WHITE;
    bg.rect(-layout.contentWidth / 2, -layout.footerTotal / 2, layout.contentWidth, layout.footerTotal);
    bg.fill();

    const buttons: Node[] = [];
    tabs.forEach(([id, label], i) => {
      const active = this.activeTab === id;
      const x = -141 + i * 94;
      const btn = createButton({
        text: label,
        width: 80,
        height: 56,
        fontSize: 13,
        color: new Color(0, 0, 0, 0),
        textColor: active ? THEME.primary : THEME.textWeak,
        parent: footer,
        onClick: () => {
          if (this.activeTab === id) return;
          this.activeTab = id;
          audioManager.uiTap();
          this.render();
        },
      });
      btn.setPosition(x, layout.bottomInset / 2);
      buttons.push(btn);
    });
    return { root: footer, bg, buttons };
  }

  // ---------------------------------------------------------------- 扩产与年报

  /** R28：扩产预览全部走 GameFacade.previewInvest（真实现金/资产/产能/需求），不在此处自算。 */
  private renderInvestDialog(): void {
    const s = this.state();
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '扩大主营业务产能',
      width: 336,
      desiredBodyHeight: 420,
      session: { semanticKey: `invest:${s.runId}:${this.contextEpoch}`, kind: 'detail', owner: this.dialogOwner() },
    });
    const body = handle.body;
    const innerWidth = 336 - 40;
    createLabel({
      text: `可用现金 ${moneyText(s.company?.cashYuan ?? 0)}`,
      fontSize: 13,
      color: THEME.textWeak,
      width: innerWidth,
      align: 'left',
      parent: body,
    });
    createLabel({
      text: '每投入 1 万元，交付产能 +1.5%（封顶 +30%）。现金即时转为业务资产，不计当月利润，次年起按 10% 折旧。',
      fontSize: 11,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 16,
      align: 'left',
      parent: body,
    });

    const steps = [10_000, 50_000, 100_000];
    for (const amount of steps) {
      const pv = this.facade.previewInvest(amount);
      const p = pv.ok ? pv.payload : null;
      const row = createButton({
        text: '',
        width: innerWidth,
        height: 104,
        color: p?.valid ? new Color(246, 249, 253) : new Color(238, 241, 247),
        disabled: !p?.valid,
        parent: body,
        onClick: () => this.openInvestConfirm(amount),
      });
      createLabel({
        text: `投入 ${moneyText(amount)}`,
        fontSize: 14,
        bold: true,
        align: 'left',
        width: 150,
        parent: row,
      }).setPosition(-76, 32);
      if (p) {
        createLabel({
          text: `产能加成 +${(p.capacityCoeffBeforeBps - 10_000) / 100}% → +${(p.capacityCoeffAfterBps - 10_000) / 100}%`,
          fontSize: 11,
          color: THEME.textWeak,
          align: 'right',
          width: 148,
          parent: row,
        }).setPosition(74, 32);
        createLabel({
          text: `现金 ${moneyText(p.cashAfter)} · 业务资产 ${moneyText(p.assetBookAfter)}`,
          fontSize: 11,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, 8);
        createLabel({
          text: `月产能 ${moneyText(p.monthlyCapacityBeforeYuan)} → ${moneyText(p.monthlyCapacityAfterYuan)} · 月需求 ${moneyText(p.monthlyPotentialOrderYuan)}`,
          fontSize: 11,
          color: THEME.textWeak,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, -12);
        createLabel({
          text: p.valid
            ? p.idleRiskAfter
              ? '需求不足：投资后产能超过当月需求，可能闲置'
              : '需求可覆盖：投资后产能仍在当月需求以内'
            : p.reason === 'INSUFFICIENT_CASH'
              ? '现金不足，无法投资'
              : '当前不可投资',
          fontSize: 11,
          color: p.valid && !p.idleRiskAfter ? THEME.profit : THEME.danger,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, -32);
      } else {
        createLabel({
          text: pv.ok ? '暂不可投资' : pv.displayMessage,
          fontSize: 11,
          color: THEME.danger,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, -8);
      }
    }

    createButton({
      text: '取消',
      width: 240,
      height: 46,
      color: Color.WHITE,
      textColor: THEME.textWeak,
      fontSize: 14,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  /** 扩产二次确认：取消不扣款；确认只扣一次（一个 commandId）。 */
  private openInvestConfirm(amount: number): void {
    const pv = this.facade.previewInvest(amount);
    if (!pv.ok || !pv.payload.valid) {
      this.toast(pv.ok ? '当前不可投资' : pv.displayMessage);
      return;
    }
    const p = pv.payload;
    const commandId = nextCommandId('invest');
    const originRunId = this.state().runId;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认扩大产能？',
      message:
        `投入金额：${moneyText(amount)}\n` +
        `现金：${moneyText(p.cashAfter + amount)} → ${moneyText(p.cashAfter)}\n` +
        `业务资产：${moneyText(p.assetBookAfter - amount)} → ${moneyText(p.assetBookAfter)}\n` +
        `总资产当时不变（现金转为业务资产）\n` +
        `产能加成：+${(p.capacityCoeffBeforeBps - 10_000) / 100}% → +${(p.capacityCoeffAfterBps - 10_000) / 100}%\n` +
        (p.idleRiskAfter ? '注意：投资后产能超过当月需求，可能闲置。' : '投资后产能仍在当月需求以内。'),
      width: 320,
      confirmText: `确认投入 ${moneyText(amount)}`,
      busyText: '投资中…',
      confirmEnabled: p.valid,
      onConfirm: async (dialog) => {
        const r = await this.facade.invest(amount, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'RUN_CHANGED') {
            dialog.succeed();
            this.toast(r.displayMessage);
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        this.toast(`已投入 ${moneyText(amount)}，业务资产 ${moneyText(r.payload.assetBookAfter)}`);
        if (this.state().runId === originRunId) this.render();
      },
    });
  }

  private renderAnnualReport(): void {
    const s = this.state();
    const years = s.annualReports.map((r) => r.year).sort((a, b) => b - a);
    const latestYear = years[0];
    const selectedYear = this.annualReportYear !== null && years.includes(this.annualReportYear)
      ? this.annualReportYear
      : latestYear;
    const report: AnnualReport | null =
      selectedYear !== undefined ? this.facade.getAnnualReport(selectedYear) : null;
    this.annualReportYear = selectedYear ?? null;
    // R25：标题与底部固定，账目行放可滚动正文（小屏也能看全所有科目）
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: report ? `第 ${report.year} 年财务报告` : '年度财务报告',
      width: 324,
      desiredBodyHeight: 430,
      session: {
        semanticKey: `annual-report:${s.runId}:${selectedYear ?? 'none'}:${this.contextEpoch}`,
        kind: 'detail',
        owner: this.dialogOwner(),
      },
    });
    const body = handle.body;
    const innerWidth = 276;

    if (report) {
      const index = years.indexOf(report.year);
      // §29.5：年份只出现在标题；左右各一个独立按钮槽位，不再用中间文字桥接导致重叠。
      const navRow = new Node('AnnualReportYearSelector');
      navRow.parent = body;
      navRow.addComponent(UITransform).setContentSize(new Size(innerWidth, 44));
      const olderDisabled = index >= years.length - 1;
      const newerDisabled = index <= 0;
      createButton({
        text: '‹ 较早年度',
        width: 96,
        height: 44,
        visualHeight: 32,
        fontSize: 12,
        color: THEME.chip,
        textColor: olderDisabled ? THEME.textWeak : THEME.text,
        parent: navRow,
        onClick: () => {
          if (olderDisabled) return;
          audioManager.uiSelect();
          handle.close();
          this.annualReportYear = years[index + 1] ?? report.year;
          this.renderAnnualReport();
        },
      }).setPosition(-innerWidth / 2 + 48, 0);
      createButton({
        text: '较新年度 ›',
        width: 96,
        height: 44,
        visualHeight: 32,
        fontSize: 12,
        color: THEME.chip,
        textColor: newerDisabled ? THEME.textWeak : THEME.text,
        parent: navRow,
        onClick: () => {
          if (newerDisabled) return;
          audioManager.uiSelect();
          handle.close();
          this.annualReportYear = years[index - 1] ?? report.year;
          this.renderAnnualReport();
        },
      }).setPosition(innerWidth / 2 - 48, 0);
    }

    if (!report) {
      createLabel({
        text: '首个经营年度尚未结束。\n完成 12 个月结算后可在此查看年报。',
        fontSize: 13,
        color: THEME.textWeak,
        width: innerWidth,
        lineHeight: 20,
        parent: body,
      });
      createButton({
        text: '知道了',
        width: 108,
        height: 44,
        visualHeight: 40,
        parent: handle.footer,
        onClick: () => handle.close(),
      }).setPosition(0, 0);
      return;
    }

    const rows: Array<[string, number, boolean]> = [
      ['营业收入', report.revenueYuan, false],
      ['直接成本', report.directCostYuan, true],
      ['其他运营费', report.otherOperatingCostYuan, true],
      ['售后费用', report.afterSalesCostYuan, true],
      ['固定管理费', report.fixedCostYuan, true],
      ['员工工资', report.payrollYuan, true],
      ['招聘费', report.recruitmentCostYuan, true],
      ['裁员赔偿', report.severanceCostYuan, true],
      ['部门设置费', report.deptSetupCostYuan, true],
      ['事件损益', report.eventCostYuan, true],
      ['折旧', report.depreciationYuan, true],
    ];
    for (const [label, value, cost] of rows) {
      const row = new Node('AnnualRow');
      row.parent = body;
      row.addComponent(UITransform).setContentSize(new Size(innerWidth, 34));
      // 两列固定宽度并留 12 间距：长科目名与大金额不会互相压字。
      createLabel({ text: label, fontSize: 13, align: 'left', color: THEME.textWeak, width: 150, parent: row })
        .setPosition(-63, 0);
      createLabel({
        text: value === 0 ? '¥0' : moneyText(value),
        fontSize: 13,
        align: 'right',
        color: cost && value !== 0 ? THEME.danger : THEME.text,
        width: 114,
        parent: row,
      }).setPosition(81, 0);
    }

    const profitColor = report.profitYuan < 0 ? THEME.danger : THEME.profit;
    const profitCard = createRect({
      width: innerWidth,
      height: 76,
      color: new Color(238, 244, 252),
      radius: 8,
      parent: body,
    });
    createLabel({ text: '本年净利润', fontSize: 12, color: THEME.textWeak, parent: profitCard }).setPosition(0, 18);
    createLabel({
      text: `${report.profitYuan < 0 ? '-' : ''}${moneyText(Math.abs(report.profitYuan))}`,
      fontSize: 22,
      bold: true,
      color: profitColor,
      parent: profitCard,
    }).setPosition(0, -12);

    createLabel({
      text: `期初现金 ${moneyText(report.cashOpenYuan)} → 期末 ${moneyText(report.cashCloseYuan)}\n总资产 ${moneyText(report.assetCloseYuan)}｜期末员工 ${report.headcountClose} 人`,
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 18,
      parent: body,
    });

    const bridge = report.cashBridge;
    if (!bridge) {
      createLabel({
        text: '历史现金流明细未记录；仅保留期初/期末余额，不能从当前存档反推旧年投资或救助。',
        fontSize: 12,
        color: THEME.warning,
        width: innerWidth,
        lineHeight: 18,
        parent: body,
      });
    } else {
      const bridgeRows: Array<[string, number]> = [
        ['已记录月账净现金流', bridge.monthlyLedgerNetCashDeltaYuan],
        ['资本投资现金流', bridge.investmentCashFlowYuan],
        ['救助资本注入', bridge.rescueCapitalYuan],
        ['其他未归因现金流', bridge.unattributedCashFlowYuan],
      ];
      createLabel({ text: '现金桥（收入与现金支出均按实际发生记账）', fontSize: 12, bold: true, color: THEME.text, width: innerWidth, parent: body });
      bridgeRows.forEach(([label, value]) => {
        createLabel({
          text: `${label}：${value < 0 ? '-' : ''}${moneyText(Math.abs(value))}`,
          fontSize: 12,
          color: value < 0 ? THEME.danger : THEME.text,
          width: innerWidth,
          parent: body,
        });
      });
      createLabel({
        text: bridge.attributionComplete
          ? `现金桥差额：${moneyText(report.cashCloseYuan - report.cashOpenYuan - bridge.monthlyLedgerNetCashDeltaYuan - bridge.investmentCashFlowYuan - bridge.rescueCapitalYuan - bridge.unattributedCashFlowYuan)}（${bridge.balanced ? '平衡' : '不平衡'}）`
          : '部分归因：本年含升级前记录，未归因流量保留为差额；不把差额解释为投资。',
        fontSize: 12,
        color: bridge.attributionComplete && bridge.balanced ? THEME.profit : THEME.warning,
        width: innerWidth,
        lineHeight: 18,
        parent: body,
      });
    }

    createButton({
      text: '关闭',
      width: 108,
      height: 44,
      visualHeight: 40,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  // ---------------------------------------------------------------- D04/D05 设置与关闭公司

  private renderSettings(): void {
    const s = this.state();
    // §23.7：固定高度 560 改为“可滚动正文 + 固定操作区”，360×640 也能读到结尾
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '设置',
      width: 330,
      desiredBodyHeight: 430,
      session: {
        semanticKey: `settings:${s.runId}:${this.contextEpoch}`,
        kind: 'notice',
        owner: this.dialogOwner(),
      },
    });
    const body = handle.body;
    const innerWidth = 330 - 56;
    const audio = audioManager.getSettings();

    const section = (text: string): void => {
      createLabel({
        text,
        fontSize: 12,
        bold: true,
        color: THEME.textWeak,
        width: innerWidth,
        align: 'left',
        parent: body,
      });
    };
    const row = (): Node => {
      const node = new Node('SettingsRow');
      node.parent = body;
      node.addComponent(UITransform).setContentSize(new Size(innerWidth, 52));
      return node;
    };
    /** 开关就地更新：同一按钮框换文案与配色，不销毁重开弹窗。 */
    const toggle = (label: string, on: boolean, onChange: (set: (value: boolean) => void) => void): void => {
      const r = row();
      createLabel({ text: label, fontSize: 13, width: innerWidth - 88, align: 'left', parent: r }).setPosition(-44, 0);
      const button = createButton({
        text: on ? '开' : '关',
        width: 64,
        height: 48,
        visualHeight: 32,
        variant: 'toggle',
        color: on ? THEME.secondary : THEME.divider,
        textColor: on ? Color.WHITE : THEME.text,
        parent: r,
        onClick: () => onChange((value) => {
          setButtonLabel(button, value ? '开' : '关');
          setButtonLook(button, value ? THEME.secondary : THEME.divider, value ? Color.WHITE : THEME.text);
        }),
      });
      button.setPosition(innerWidth / 2 - 32, 0);
    };

    section('声音');
    toggle('总开关（关闭后全静音）', audio.masterEnabled, (set) => {
      const a = audioManager.getSettings();
      const next = !a.masterEnabled;
      if (!audioManager.updateSettings({ masterEnabled: next })) {
        this.toast('声音设置保存失败，已恢复原设置');
        return;
      }
      set(next);
      audioManager.uiTap();
    });
    toggle('背景音乐', audio.musicEnabled, (set) => {
      const a = audioManager.getSettings();
      const next = !a.musicEnabled;
      if (!audioManager.updateSettings({ musicEnabled: next })) {
        this.toast('声音设置保存失败，已恢复原设置');
        return;
      }
      set(next);
      audioManager.uiTap();
    });
    toggle('操作音效/提示', audio.sfxEnabled, (set) => {
      const a = audioManager.getSettings();
      const next = !a.sfxEnabled;
      if (!audioManager.updateSettings({ sfxEnabled: next })) {
        this.toast('声音设置保存失败，已恢复原设置');
        return;
      }
      set(next);
      if (next) audioManager.uiTap();
    });
    // §29.7：给玩家一个无需退出设置就能确认“到底有没有声音”的自测入口。
    const listenRow = row();
    createLabel({ text: '试听提示音', fontSize: 13, width: innerWidth - 88, align: 'left', parent: listenRow }).setPosition(-44, 0);
    createButton({
      text: '试听',
      width: 64,
      height: 44,
      visualHeight: 32,
      color: THEME.chip,
      textColor: THEME.primary,
      fontSize: 13,
      parent: listenRow,
      onClick: () => {
        if (!audioManager.getSettings().masterEnabled || !audioManager.getSettings().sfxEnabled) {
          this.toast('音效开关已关闭；先开启“操作音效/提示”');
          return;
        }
        audioManager.uiTap();
        this.toast('已播放试听音，请确认设备音量与开关');
      },
    }).setPosition(innerWidth / 2 - 32, 0);

    section('排行榜');
    toggle('公开榜单同步（平台公开展示）', this.leaderboardConsent && this.leaderboardConfig?.enabled === true, (set) => {
      if (!this.leaderboardConfig?.enabled) {
        this.toast('真实榜单配置尚未就绪（缺少后台榜 ID/白名单）');
        return;
      }
      const next = !this.leaderboardConsent;
      const previous = this.leaderboardConsent;
      this.leaderboardConsent = next;
      this.leaderboardConsentEpoch += 1;
      void this.platform?.set('ceo/leaderboard/consent/v1', next).then(() => {
        set(next);
        this.toast(next ? '已开启公开榜单同步' : '已关闭公开榜单同步');
      }).catch(() => {
        if (this.leaderboardConsent === next) {
          this.leaderboardConsent = previous;
          this.leaderboardConsentEpoch += 1;
          set(previous);
        }
        this.toast('榜单偏好保存失败，原设置不变');
      });
    });
    createLabel({
      text: this.leaderboardConfig?.enabled
        ? '公开榜：已配置；开启后仅提交总资产/完成年限，本地模拟榜仍可离线使用。'
        : '公开榜：未启用；本地模拟榜可离线使用，不冒充在线排名。',
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 18,
      align: 'left',
      parent: body,
    });

    section('云备份');
    createLabel({
      text: `${this.cloudStatusText}\n云备份仅用于玩家自己的跨设备恢复，不提供运营后台查询。`,
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 18,
      align: 'left',
      parent: body,
    });
    const cloudRow = row();
    const cloudItems = layoutActionRow(innerWidth, 2, BUTTON_BASELINE.gap);
    const cloudIds: Array<[string, () => void]> = [
      ['备份到云', () => { void this.backupToCloud().then(() => this.render()); }],
      ['恢复云档', () => { void this.openCloudRestore(); }],
    ];
    cloudIds.forEach(([text, action], index) => {
      const item = cloudItems[index]!;
      createButton({
        text,
        width: item.width,
        height: 48,
        variant: 'secondary',
        color: THEME.divider,
        textColor: THEME.text,
        disabled: !this.cloudProfileBound || this.cloudBusy,
        parent: cloudRow,
        onClick: action,
      }).setPosition(item.x, 0);
    });
    if (this.pendingLeaderboard) {
      createButton({
        text: '补发未成功的公开榜',
        width: innerWidth,
        height: 44,
        variant: 'secondary',
        color: THEME.divider,
        textColor: THEME.text,
        parent: body,
        onClick: () => { void this.retryPendingLeaderboard().then(() => this.render()); },
      });
    }

    section('帮助与合规');
    const helpRow = row();
    const helpItems = layoutActionRow(innerWidth, 2, BUTTON_BASELINE.gap);
    const helpIds: Array<[string, () => void]> = [
      ['操作指引', () => {
        handle.close();
        this.replayTutorial();
      }],
      ['隐私政策', () => {
        const url = getRuntimeConfig().privacyPolicyUrl;
        if (url) this.openPrivacyPolicy(url);
        else this.toast('隐私政策地址将在正式上架前配置');
      }],
    ];
    helpIds.forEach(([text, action], index) => {
      const item = helpItems[index]!;
      createButton({
        text,
        width: item.width,
        height: 48,
        variant: 'secondary',
        color: Color.WHITE,
        textColor: THEME.primary,
        parent: helpRow,
        onClick: action,
      }).setPosition(item.x, 0);
    });
    createLabel({
      text: '关闭公司将永久清除本局进度并重新创业；平台账号与合规记录不受影响。',
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 18,
      align: 'left',
      parent: body,
    });

    const footerItems = layoutActionRow(innerWidth, 2, BUTTON_BASELINE.gap);
    const closeCompany = footerItems[0]!;
    const dismiss = footerItems[1]!;
    createButton({
      text: '关闭公司',
      width: closeCompany.width,
      height: 48,
      variant: 'secondary',
      color: Color.WHITE,
      textColor: THEME.danger,
      parent: handle.footer,
      onClick: () => {
        handle.close();
        this.renderCloseConfirm();
      },
    }).setPosition(closeCompany.x, 0);
    createButton({
      text: '关闭',
      width: dismiss.width,
      height: 48,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(dismiss.x, 0);
  }

  /** 帮助重播（M3-05）：重新展示关键操作说明，不改变业务状态。 */
  private replayTutorial(): void {
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '操作指引',
      width: 320,
      desiredBodyHeight: 300,
      session: { semanticKey: `tutorial:${this.contextEpoch}`, kind: 'notice', owner: this.dialogOwner() },
    });
    createLabel({
      text:
        '公司页：实时现金/收入/利润、时间倍速、扩产与年报。\n' +
        '部门页：创建采购/客服/市场/财务/HR，切自动或手动，招聘员工。\n' +
        '人才页：查看员工详情，可调岗或裁员（有补偿）。\n' +
        '离线：每 40 分钟结 1 个月，最多 36 个月。\n' +
        '现金不足会暂停经营，可领一次 10 万救助。\n' +
        '目标：连续 3 年盈利。',
      fontSize: 13,
      color: THEME.text,
      width: 272,
      lineHeight: 24,
      align: 'left',
      parent: handle.body,
    });
    createButton({
      text: '知道了',
      width: 240,
      height: 48,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  private renderCloseConfirm(): void {
    const s = this.state();
    // 关司预览 token 在开框时固定；确认按钮只有一次意图，连点不重复清档
    let preview = this.facade.beginCloseCompany(Date.now());
    const buildMessage = (): string =>
      `将永久清除本局：\n公司：${s.company?.name ?? ''}\n员工：${s.employees.length} 人\n现金：${moneyText(s.company?.cashYuan ?? 0)}\n已完成年度：${s.annualReports.length}\n\n` +
      '此操作不可撤销，但不会注销你的平台账号。';
    const handle = openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '关闭公司并重来？',
      danger: true,
      message: buildMessage(),
      width: 320,
      desiredBodyHeight: 190,
      confirmText: '永久清除本局',
      busyText: '正在清除…',
      session: { semanticKey: `close-company:${s.runId}:${this.contextEpoch}`, kind: 'confirm', owner: this.dialogOwner() },
      onRefreshPreview: async () => {
        preview = this.facade.beginCloseCompany(Date.now());
        return {
          message: buildMessage(),
          confirmText: '永久清除本局',
          confirmEnabled: this.state().runId === preview.oldRunId,
        };
      },
      onConfirm: async (dialog) => {
        const result = await this.facade.confirmCloseCompany(
          {
            confirmationToken: preview.confirmationToken,
            expiresAtMs: preview.expiresAtMs,
            oldRunId: preview.oldRunId,
          },
          Date.now(),
        );
        if (!result.ok) {
          if (result.code === 'CONFIRMATION_EXPIRED') {
            // §23.5：过期不得自动关框重开；保留原框，手动重新预览后再次确认
            dialog.markExpired('确认已过期（超过 60 秒），本局数据可能已变化；请点“重新预览”后再确认。');
            return;
          }
          if (result.code === 'RUN_CHANGED') {
            dialog.blockSubmit('本局已切换，旧关闭意图失效；请关闭窗口后重新操作。');
            return;
          }
          dialog.fail(result.displayMessage);
          return;
        }
        dialog.succeed();
        // 落盘成功后才推进上下文：旧快照、旧弹窗与迟到回调全部失效
        this.resetCreateStateAfterClose();
        this.exitApplicationContext('context-invalidated');
        this.toast('公司已关闭，开始新的创业');
        this.render();
      },
    });
    if (!handle.closed && this.state().runId !== preview.oldRunId) {
      handle.blockSubmit('本局已切换，当前关闭预览已失效。');
    }
  }

  /** 关司成功后清空创建向导临时选择（平台账号与合规记录不受影响）。 */
  private resetCreateStateAfterClose(): void {
    this.customCompanyName = '';
    this.customCeoName = '';
    this.randomCompanyNames = [];
    this.selectedNameIndex = 0;
    this.nameNonce = 0;
    this.createStep = 'COMPANY';
    this.awaitingEnterCompany = false;
    this.activeTab = 'COMPANY';
  }

  // ---------------------------------------------------------------- 引导与通用控件

  private fullPanel(): Node {
    const panel = createRect({
      name: 'FullPanel',
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      color: new Color(0, 0, 0, 0),
      radius: 0,
      parent: this.pageLayer, // TASK-M3-12-03: PageLayer
    });
    panel.setPosition(0, 0);
    stretchToParent(panel);
    return panel;
  }

  private modalOverlay(transparent = false): Node {
    const overlay = new Node('ModalOverlay');
    overlay.parent = this.modalLayer; // TASK-M3-12-03: ModalLayer 独立持久
    // R24：遮罩覆盖整个可视高度（高屏 >812 时上下不露正文），并吞噬触摸——
    // 弹窗打开时正文滚动与底层按钮不响应（T05），点遮罩不穿透（T02）。
    const viewport = Math.max(DESIGN_HEIGHT, this.shellLayout().viewportHeight);
    overlay.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, viewport));
    overlay.addComponent(BlockInputEvents);
    if (!transparent) {
      const g = overlay.addComponent(Graphics);
      g.fillColor = new Color(0, 0, 0, 130);
      g.rect(-DESIGN_WIDTH / 2, -viewport / 2, DESIGN_WIDTH, viewport);
      g.fill();
    }
    return overlay;
  }

  private toast(message: string): void {
    if (this.toastNode) this.toastNode.destroy();
    const node = createRect({ width: 300, height: 44, color: new Color(39, 50, 68, 235), radius: 8, parent: this.toastLayer });
    node.setPosition(0, -300);
    createLabel({ text: message, fontSize: 13, color: Color.WHITE, width: 284, parent: node }).setPosition(0, 0);
    this.toastNode = node;
    this.scheduleOnce(() => {
      if (node.isValid) node.destroy();
    }, 2.2);
  }
}
