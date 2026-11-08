# 《我是CEO》D1 美术批次交接 v1

交接目录：[CEO_UI_V2_D1_ArtHandoff_v1](./)

参照六张已交样板的角色比例、左侧暖光、蓝白金色板、导航两态轮廓及透明边缘。此目录供开发 Agent 导入，未写入 `assets/resources/`。

## 本批状态

- 已完成 47/47 个 D1 ID 独立运行 PNG 与 manifest 记录。
- B06 的 36 个 ID 保留 Asset Registry 原 `source_key`：OLD-NAV-03~09、ICO-D01~06、OLD-AV-02~24。旧 SVG 已逐项核对，其中导航 7 个、部门 6 个可复用原几何轮廓；交付源稿统一颜色与状态表现。头像按 8 个身份组 × 3 配色保留同一组几何，仅改蓝系衣装色。

### D1-QA-02 头像同身份修正（2026-11-08）

`OLD-AV-02`、`OLD-AV-03` 原为扁平矢量头像，与 `OLD-AV-01` 的轻半写实人物不是同一角色。现改为由 `OLD-AV-01` 运行图派生：`tools/recolor_avatar_variants.py` 只对蓝色衣装像素做 HSV 调色（Color2 亮天蓝、Color3 深海军蓝），皮肤、头发、五官和 alpha 边界逐像素不变，源稿/导出图/预览/台账/运行图同步，`source_key` 与运行 `.meta` UUID 均未变。复核见 `tools/verify_avatar_identity.py`，结果 `evidence/ui-v2-d1-qa-02/avatar-identity-check.json`（衣装外差异 0 像素，44px 缩略三色可分）。`src/old_av_02.svg`、`src/old_av_03.svg` 仅作历史源稿保留。
- 新增运行键使用 ASCII 小写：`ui_v2/scenes/ill_s06`、`ui_v2/business/ico_k03`、`ui_v2/rank/rank_01` 等。
- 招聘区 `ILL-S07`、面试室 `ILL-S15` 都是空镜；人物沿用独立 `CHR-HR01`。`ILL-S08` 低对比留白，`ILL-S09` 桌面元素压在边缘。奖章不含名次文字/奖励值，所有动态文字、金额、图表和按钮由 Cocos 绘制。
- 等待开发 Agent 使用 Creator 导入、确认 SpriteFrame 资源键与 UUID、构建和实屏检查；这不是已完成的工程集成验收。

## 目录

- `png/`：47 张独立运行图；场景 1080×560（S15 1080×600），头像 256×256，图标 192×192，排行贴纸 384×384。
- `src/`：可编辑 SVG；`prompts.json` 保存场景生成约束和角色配色规则。
- `raw/`、`master/`：场景原始生成图及规格化母版。
- `preview/`：每个 ID 的裁切或浅/深底透明预览，以及 360 宽场景和头像小图总览。
- `manifest.json`：asset_id、文件、实测规格、alpha、source/master、运行键、适配规则、预览和复用说明。
- `tools/measure_report.json`：实测尺寸、模式、透明范围及文件字节。

运行键均相对 `assets/resources/`，PNG 扩展名按 Creator 资源导入流程处理。源稿、母版和预览不得随运行图复制进资源包。

小图复核包括 360×160/96 场景裁切、22/24px 图标、头像小尺寸和 40px 排行贴纸，索引见 manifest。
