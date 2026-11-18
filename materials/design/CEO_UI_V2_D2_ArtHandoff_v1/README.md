# CEO UI V2 · D2 美术交接包 v1

《我是CEO》UI V2 第二批（D2）美术交付：46 张 PNG、可编辑 SVG 源稿、预览与 Cocos 导入脚本。
D2 只做美术与资源导入，不改 `assets/scripts`，不改 `docs`。

## 批次范围（46 项）

| 类别 | 数量 | asset_id |
| --- | --- | --- |
| 行业图标 | 3 | ICO-I01 电商贸易、ICO-I02 软件科技、ICO-I03 企业服务 |
| 经营图标 | 6 | ICO-K09 设置/音频、ICO-K10 离线、ICO-K12 投资产能、ICO-K13 组织锁定、ICO-K14 财务帮助、ICO-K15 经营倍速 |
| 人物半身 | 3 | CHR-CEO01 CEO、CHR-GUIDE01 新手导师、CHR-ADVISOR01 经营顾问 |
| 品牌 | 1 | BRD-01 |
| 场景插画 | 14 | ILL-S01 / S02 / S03 / S04 / S10 / S12 / S13 / S14 / S18 / S19 / S20 / S21 / S22 / S23 |
| 状态图标 | 10 | STA-03 / 04 / 05 / 06 / 07 / 09 / 10 / 11 / 12 / 13 |
| 广告/票券 | 2 | AD-01 视频角标、AD-02 招聘费券 |
| 徽章/榜单 | 2 | BAD-01 三年盈利奖章、RANK-04 真实榜入口 |
| 事件插图 | 5 | EVT-01 客户需求 / EVT-02 设备维护 / EVT-03 市场景气 / EVT-04 人才事件 / EVT-05 运营成本 |

- 图标/人物/徽章/票券：RGBA 透明背景。
- 场景与事件：RGB 不透明空镜，无人物、无文字、无按钮。
- 人物为半身立绘，透明背景，主体占画面高度 80% 以上。

## 风格

扁平现代商务矢量，蓝白金暖色：

- 主蓝 `#3668B2`，辅绿 `#5D9F8C`，文字深 `#273244`，弱文字 `#697386`
- 危险 `#C75353`，盈利 `#2E9E6B`，警示 `#D9922E`，浅底 `#F5F7FB`，分隔 `#E3E8F0`
- 图标 192 视觉边统一 2px 比例（7–8px @192），无文字烘焙；短屏 360×96 中心裁切仍可辨。

## 目录

```
CEO_UI_V2_D2_ArtHandoff_v1/
├─ src/        46 个可编辑 SVG 源稿（master 同源）
├─ png/        46 张交付 PNG
├─ preview/    场景 360×160 / 360×96 cover 预览；透明资产浅/深底 128px 复核；人物 180px 预览
├─ master/     母版预留目录
├─ tools/      render_svg.py / import_resources.py / verify_delivery.py / measure_report.json / import_uuids.json
├─ manifest.json
└─ README.md
```

`manifest.json` 每项包含：asset_id、name、file、width、height、mode、alpha_min、alpha_max、bytes、source、master、runtime_path、runtime_key、fit、crop_focus、crop_rect、notes、preview。

## 复跑渲染

在仓库根目录：

```powershell
python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/render_svg.py
python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/render_svg.py --only STA-06,EVT-04
python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/render_svg.py --skip-existing
```

- 使用 Playwright Chromium，viewport 等于图片精确像素，`deviceScaleFactor=1`。
- 透明资产 `omit_background=True`；场景统一转 RGB 保存。
- 全量运行会重写 `manifest.json` 与 `tools/measure_report.json`；`--only` 只更新所选预览。

## 导入 Cocos

```powershell
python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/import_resources.py
```

- 按 manifest 的 `file -> runtime_path` 拷贝到 `assets/resources/`。
- 已存在的目录 `.meta` 不覆盖；缺失目录自动生成 `directory` .meta。
- 图片 `.meta` 为 Creator 3.8.8 `image` 格式（`6c48a` texture / `f9941` sprite-frame），UUID 幂等存于 `tools/import_uuids.json`。

## 校验

```powershell
python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/verify_delivery.py
```

校验 46 项齐全、SVG/PNG/预览存在、尺寸与模式匹配、alpha 记录一致、runtime 文件与 png 字节一致、image .meta 存在。
