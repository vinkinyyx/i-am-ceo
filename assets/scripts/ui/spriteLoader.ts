import {
  Graphics,
  isValid,
  Label,
  Mask,
  Node,
  Rect,
  resources,
  Size,
  Sprite,
  SpriteFrame,
  UITransform,
} from 'cc';
import { THEME } from './theme';

/**
 * UI V2 图片加载（总览 §30.4）：
 * - 同一资源键合并在途请求并复用帧；失败缓存 null，避免一帧一重试。
 * - 应用帧前校验节点有效性与当前绑定 ID，列表复用/切页/重开不会回填错对象。
 * - 装饰 Sprite 不截获点击；加载前后占位尺寸稳定。
 */

const frameCache = new Map<string, Promise<SpriteFrame | null>>();
const failedKeys = new Set<string>();

/** 加载 resources 下的 SpriteFrame（键不带扩展名，内部补 /spriteFrame）。 */
export function loadUiSprite(key: string): Promise<SpriteFrame | null> {
  const hit = frameCache.get(key);
  if (hit) return hit;
  const pending = new Promise<SpriteFrame | null>((resolve) => {
    resources.load(`${key}/spriteFrame`, SpriteFrame, (error, frame) => {
      if (error || !frame) {
        if (!failedKeys.has(key)) {
          failedKeys.add(key);
          console.warn(`[ui-v2] sprite unavailable: ${key}`);
        }
        resolve(null);
        return;
      }
      resolve(frame);
    });
  });
  frameCache.set(key, pending);
  return pending;
}

const BIND_FIELD = '__uiV2SpriteBind';
let bindSeq = 0;

type BindableNode = Node & { [BIND_FIELD]?: string };

/** 先清旧帧再换绑；返回本次绑定令牌（用于测试诊断）。 */
export function attachUiSprite(node: Node, key: string, onApplied?: (ok: boolean) => void): string {
  const target = node as BindableNode;
  const token = `${key}#${(bindSeq += 1)}`;
  target[BIND_FIELD] = token;
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  // 默认 TRIMMED 会把节点撑到纹理原尺寸；装饰图标必须跟随 UITransform 设定尺寸
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = null;
  void loadUiSprite(key).then((frame) => {
    if (!isValid(node, true) || target[BIND_FIELD] !== token) return;
    if (!frame) {
      onApplied?.(false);
      return;
    }
    sprite.spriteFrame = frame;
    onApplied?.(true);
  });
  return token;
}

// ---------------------------------------------------------------- 头像（§30.4 头像身份）

/**
 * avatarId → 运行键映射。avatar_01..24 → OLD-AV-01..24（§30.4 顺序映射，D1 已全量导入）。
 * 未登记或缺图时走中性回退，不为美术重新抽取 RNG。
 */
const AVATAR_KEYS: Record<string, string> = {
  avatar_01: 'ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color1',
  avatar_02: 'ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color2',
  avatar_03: 'ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color3',
  avatar_04: 'ui/avatars/EmployeeAvatar_02_Female_ShoulderHair_Color1',
  avatar_05: 'ui/avatars/EmployeeAvatar_02_Female_ShoulderHair_Color2',
  avatar_06: 'ui/avatars/EmployeeAvatar_02_Female_ShoulderHair_Color3',
  avatar_07: 'ui/avatars/EmployeeAvatar_03_Male_CurlyHair_Color1',
  avatar_08: 'ui/avatars/EmployeeAvatar_03_Male_CurlyHair_Color2',
  avatar_09: 'ui/avatars/EmployeeAvatar_03_Male_CurlyHair_Color3',
  avatar_10: 'ui/avatars/EmployeeAvatar_04_Female_ShortHair_Color1',
  avatar_11: 'ui/avatars/EmployeeAvatar_04_Female_ShortHair_Color2',
  avatar_12: 'ui/avatars/EmployeeAvatar_04_Female_ShortHair_Color3',
  avatar_13: 'ui/avatars/EmployeeAvatar_05_Male_Glasses_Color1',
  avatar_14: 'ui/avatars/EmployeeAvatar_05_Male_Glasses_Color2',
  avatar_15: 'ui/avatars/EmployeeAvatar_05_Male_Glasses_Color3',
  avatar_16: 'ui/avatars/EmployeeAvatar_06_Female_Ponytail_Color1',
  avatar_17: 'ui/avatars/EmployeeAvatar_06_Female_Ponytail_Color2',
  avatar_18: 'ui/avatars/EmployeeAvatar_06_Female_Ponytail_Color3',
  avatar_19: 'ui/avatars/EmployeeAvatar_07_Male_SlickedHair_Color1',
  avatar_20: 'ui/avatars/EmployeeAvatar_07_Male_SlickedHair_Color2',
  avatar_21: 'ui/avatars/EmployeeAvatar_07_Male_SlickedHair_Color3',
  avatar_22: 'ui/avatars/EmployeeAvatar_08_Female_LongHair_Color1',
  avatar_23: 'ui/avatars/EmployeeAvatar_08_Female_LongHair_Color2',
  avatar_24: 'ui/avatars/EmployeeAvatar_08_Female_LongHair_Color3',
};

export function avatarKeyFor(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return AVATAR_KEYS[avatarId] ?? null;
}

export interface AvatarSlot {
  root: Node;
  /** 当前绑定的 avatarId（诊断用） */
  boundTo: string | null;
}

/** 创建头像槽：中性回退（圆形浅底 + 名字首字），加载成功后换成真实头像。 */
export function createAvatarSlot(parent: Node, size: number, name = 'AvatarSlot'): AvatarSlot {
  const root = new Node(name);
  root.parent = parent;
  root.addComponent(UITransform).setContentSize(new Size(size, size));

  const fallback = new Node('AvatarFallback');
  fallback.parent = root;
  fallback.addComponent(UITransform).setContentSize(new Size(size, size));
  const g = fallback.addComponent(Graphics);
  g.fillColor = THEME.primarySoft;
  g.circle(0, 0, size / 2);
  g.fill();
  const initial = createAvatarInitial(fallback, size);

  const image = new Node('AvatarImage');
  image.parent = root;
  const imageTr = image.addComponent(UITransform);
  imageTr.setContentSize(new Size(size, size));
  image.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;

  (root as unknown as Record<string, unknown>).__avatarFallback = fallback;
  (root as unknown as Record<string, unknown>).__avatarInitial = initial;
  const slot: AvatarSlot = { root, boundTo: null };
  setAvatarImage(slot, null, '');
  return slot;
}

function createAvatarInitial(parent: Node, size: number): Label {
  const node = new Node('AvatarInitial');
  node.parent = parent;
  const tr = node.addComponent(UITransform);
  tr.setContentSize(new Size(size, size));
  const label = node.addComponent(Label);
  label.fontSize = Math.max(12, Math.round(size * 0.42));
  label.color = THEME.primary;
  return label;
}

/**
 * 绑定头像：avatarId 有登记键时异步加载真实头像，否则保持中性首字回退。
 * 列表复用时先清旧帧，旧请求回调按绑定令牌丢弃。
 */
export function setAvatarImage(slot: AvatarSlot, avatarId: string | null | undefined, displayName: string): void {
  const root = slot.root;
  const fallback = (root as unknown as Record<string, unknown>).__avatarFallback as Node | undefined;
  const initial = (root as unknown as Record<string, unknown>).__avatarInitial as Label | undefined;
  const image = root.getChildByName('AvatarImage');
  if (!fallback || !initial || !image) return;
  slot.boundTo = avatarId ?? null;
  const key = avatarKeyFor(avatarId);
  const firstChar = displayName.trim().charAt(0);
  initial.string = firstChar || '员';
  if (!key) {
    // 无登记键：仅使旧在途请求失效并清帧，保持中性回退，不发起新加载
    (image as BindableNode)[BIND_FIELD] = `cleared#${(bindSeq += 1)}`;
    image.getComponent(Sprite)!.spriteFrame = null;
    image.active = false;
    fallback.active = true;
    return;
  }
  fallback.active = true;
  image.active = true;
  attachUiSprite(image, key, (ok) => {
    if (!isValid(root, true)) return;
    if (ok) fallback.active = false;
  });
}

// ---------------------------------------------------------------- 场景横幅（背景 cover + 人物 contain）

export interface SceneBannerOptions {
  /** 场景图键；null 表示尚未交付，仅绘制卡片底板 */
  sceneKey: string | null;
  /** 透明人物键；null 表示纯场景 */
  charKey?: string | null;
  /** 场景裁切焦点（0..1，相对源图，fy 从顶部计） */
  focus?: [number, number];
  /** 人物高度占容器高度比例 */
  charHeightRatio?: number;
  /** 人物中心 X 相对容器宽的比例（0.5=居中） */
  charXRatio?: number;
  /** 底板圆角 */
  radius?: number;
}

/**
 * 两层横幅：底板 Graphics（圆角、稳定占位）+ Mask 裁切场景（cover + 焦点）+ 人物（contain 贴底右侧）。
 * 全部装饰节点不挂 Button/BlockInputEvents，不占用触区。
 */
export function attachSceneBanner(container: Node, opts: SceneBannerOptions): void {
  const tr = container.getComponent(UITransform);
  if (!tr) return;
  const width = tr.width;
  const height = tr.height;
  const radius = opts.radius ?? 8;

  const base = new Node('BannerBase');
  base.parent = container;
  base.addComponent(UITransform).setContentSize(new Size(width, height));
  const g = base.addComponent(Graphics);
  g.fillColor = THEME.primarySoft;
  g.roundRect(-width / 2, -height / 2, width, height, radius);
  g.fill();

  const clip = new Node('BannerClip');
  clip.parent = container;
  clip.addComponent(UITransform).setContentSize(new Size(width, height));
  // 与 BodyView 相同模式：GRAPHICS_RECT 无 Graphics 时按节点矩形裁切
  const mask = clip.addComponent(Mask);
  mask.type = Mask.Type.GRAPHICS_RECT;

  if (opts.sceneKey) {
    const scene = new Node('BannerScene');
    scene.parent = clip;
    scene.addComponent(UITransform);
    const sprite = scene.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const focus = opts.focus ?? [0.5, 0.5];
    void loadUiSprite(opts.sceneKey).then((frame) => {
      if (!isValid(container, true) || !isValid(scene, true) || !frame) return;
      sprite.spriteFrame = frame;
      const sw = frame.originalSize.width;
      const sh = frame.originalSize.height;
      if (sw <= 0 || sh <= 0) return;
      const scale = Math.max(width / sw, height / sh);
      const sceneTr = scene.getComponent(UITransform)!;
      sceneTr.setContentSize(new Size(sw * scale, sh * scale));
      // 可见窗中心对齐焦点（焦点 fy 从源图顶部计）；焦点不可达时贴边
      const vw = width / scale;
      const vh = height / scale;
      const cx = vw >= sw ? sw / 2 : Math.min(Math.max(focus[0] * sw, vw / 2), sw - vw / 2);
      const cyTop = vh >= sh ? sh / 2 : Math.min(Math.max(focus[1] * sh, vh / 2), sh - vh / 2);
      scene.setPosition((sw / 2 - cx) * scale, (cyTop - sh / 2) * scale, 0);
    });
  }

  const charKey = opts.charKey ?? null;
  if (charKey) {
    const figure = new Node('BannerFigure');
    figure.parent = clip;
    figure.addComponent(UITransform);
    const sprite = figure.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    void loadUiSprite(charKey).then((frame) => {
      if (!isValid(container, true) || !isValid(figure, true) || !frame) return;
      sprite.spriteFrame = frame;
      const cw = frame.originalSize.width;
      const ch = frame.originalSize.height;
      if (cw <= 0 || ch <= 0) return;
      const ratio = opts.charHeightRatio ?? 0.94;
      const charH = height * ratio;
      const scale = charH / ch;
      figure.getComponent(UITransform)!.setContentSize(new Size(cw * scale, charH));
      const xRatio = opts.charXRatio ?? 0.62;
      figure.setPosition((xRatio - 0.5) * width, -height / 2 + charH / 2, 0);
    });
  }
}

// ---------------------------------------------------------------- 排行奖章（§30.5 UI-08）

/**
 * RANK-01 金银铜共用一张 384×384 透明图，子图矩形来自 D1 manifest child_frames_px（左上角原点）。
 * 名次数字仍由原生 Label 渲染，奖章只是贴纸。
 */
export type RankMedal = 'gold' | 'silver' | 'bronze';

const RANK_MEDAL_KEY = 'ui_v2/rank/rank_01';
/** 本人定位标记（蓝白罗盘徽章） */
export const RANK_SELF_KEY = 'ui_v2/rank/rank_02';
/** 小型奖杯徽章（本地榜题头等装饰） */
export const RANK_TROPHY_KEY = 'ui_v2/rank/rank_03';

const RANK_MEDAL_FRAMES: Record<RankMedal, { x: number; y: number; w: number; h: number }> = {
  gold: { x: 124, y: 41, w: 136, h: 159 },
  silver: { x: 36, y: 198, w: 128, h: 127 },
  bronze: { x: 220, y: 198, w: 128, h: 127 },
};

/** 按名次取奖章：1 金、2 银、3 铜，其余 null（调用方只画名次 Label）。 */
export function rankMedalFor(rank: number): RankMedal | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

/** 把 RANK-01 的对应子帧贴到节点；加载失败隐藏节点，不影响名次 Label。 */
export function attachRankMedal(node: Node, medal: RankMedal, onApplied?: (ok: boolean) => void): void {
  const target = node as BindableNode;
  const token = `rank:${medal}#${(bindSeq += 1)}`;
  target[BIND_FIELD] = token;
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = null;
  void loadUiSprite(RANK_MEDAL_KEY).then((frame) => {
    if (!isValid(node, true) || target[BIND_FIELD] !== token) return;
    if (!frame || !frame.texture) {
      onApplied?.(false);
      return;
    }
    const r = RANK_MEDAL_FRAMES[medal];
    const sub = new SpriteFrame();
    sub.texture = frame.texture;
    sub.rect = new Rect(r.x, r.y, r.w, r.h);
    sprite.spriteFrame = sub;
    onApplied?.(true);
  });
}
