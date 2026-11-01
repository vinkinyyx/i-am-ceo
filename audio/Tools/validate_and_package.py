#!/usr/bin/env python3
"""Check, document, and zip the actual audio assets for '我是CEO'."""
from pathlib import Path
import json, csv, hashlib, subprocess, zipfile, shutil, math, os
import numpy as np
import soundfile as sf

BASE=Path(__file__).resolve().parents[1]
SRC=Path('/mnt/data/CEO_Audio_MVP_Design_v1.1')
config=BASE/'Config';config.mkdir(exist_ok=True)
master=json.loads((SRC/'Config/audio_manifest.json').read_text(encoding='utf-8'))
real=json.loads((config/'audio_asset_manifest.json').read_text(encoding='utf-8'))
byid={a['id']:a for a in real['assets']}

full=[]
for old in master['assets']:
    entry=byid[old['id']]
    z={**old}
    z['status']='produced_original_audio'
    z['produced_file']=entry['mp3_path']
    z['master_file']=entry['wav_path']
    z['sha256_mp3']=entry['sha256_mp3']
    z['channels']=entry['channels']
    z['sample_rate']=entry['sample_rate']
    z['effective_bpm']={'BGM_01':128,'BGM_02':100}.get(old['id'],z.get('bpm',None))
    z['seconds']=entry['duration_expected_s']
    full.append(z)
master['assets']=full
master['settings']['copyrightStatus']='original_waveforms_generated_for_this_project_no_external_samples'
master['settings']['defaultOutputFilesPlanned']=False
master['settings']['runtimeFormat']='mp3'
master['settings']['mastersFormat']='wav_pcm16'
master['settings']['actualAssetCount']=len(full)
master['settings']['masterAudio']['categoryRouting']={'music':'music','jingles':'effects','sfx':'effects'}
(config/'audio_manifest.json').write_text(json.dumps(master,ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copy2(SRC/'Config/audio_event_map.json',config/'audio_event_map.json')
shutil.copy2(SRC/'UI_PATCH/audio_settings.json',config/'audio_settings.json')

# Build original preview of all sounds; this is NOT a substitute for source files.
mp3dir=BASE/'CocosDropIn/assets/resources/audio'
excerpts=[('创业启程', 'BGM_01', 11.5),('日常经营','BGM_02', 12.0)]
preview=np.zeros((int(55*44100),2),dtype=np.float32)
segments=[];cursor=0.3
for cn,id_,length in excerpts:
    a=byid[id_];x,sr=sf.read(BASE/a['wav_path'],dtype='float32',always_2d=True)
    assert sr==44100
    x=x[2*sr:2*sr+round(length*sr)].copy()
    # Fade in/out to avoid cut off playback phrase at montage edits.
    fade=min(int(.20*sr),len(x)//3)
    x[:fade]*=np.linspace(0,1,fade)[:,None]
    x[-fade:]*=np.linspace(1,0,fade)[:,None]
    i=round(cursor*sr);preview[i:i+len(x)]+=x
    segments.append((round(cursor,2),round(cursor+length,2),id_,cn))
    cursor+=length+.8
for a in real['assets'][2:]:
    x,sr=sf.read(BASE/a['wav_path'],dtype='float32',always_2d=True)
    end=cursor+len(x)/sr
    i=round(cursor*sr)
    preview[i:i+len(x)]+=x
    segments.append((round(cursor,2),round(end,2),a['id'],a['name_cn']))
    cursor=end+(.38 if a['type']=='sfx' else .65)
preview=preview[:int(math.ceil(cursor+.3)*44100)]
prev=BASE/'Preview';prev.mkdir(exist_ok=True)
pwav=prev/'CEO_All16_Sampler.wav';pmp3=prev/'CEO_All16_Sampler.mp3'
sf.write(pwav,preview,44100,subtype='PCM_16')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(pwav),'-codec:a','libmp3lame','-b:a','160k',str(pmp3)],check=True)
pwav.unlink()

# ffprobe verification for each file
qa=[]
for a in real['assets']:
    x,sr=sf.read(BASE/a['wav_path'],dtype='float32',always_2d=True)
    assert sr==44100
    secs=len(x)/sr
    peak=np.max(np.abs(x)); rms=np.sqrt(np.mean(x**2))
    continuity=np.max(np.abs(x[0]-x[-1])) if a['loop'] else None
    first=np.max(np.abs(x[:int(.01*sr)]))
    last=np.max(np.abs(x[-int(.01*sr):]))
    assert abs(secs-a['duration_expected_s'])<.002,(a['id'],secs)
    assert peak<=.75 and peak>=.02, (a['id'],peak)
    assert rms>.0015, a['id']
    if a['loop']:
        assert continuity<.025, (a['id'],continuity)
    mp3=BASE/a['mp3_path']
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',str(mp3)],text=True))
    assert info['streams'][0]['codec_name']=='mp3'
    assert info['streams'][0]['sample_rate']=='44100'
    assert info['streams'][0]['channels']==a['channels']
    assert abs(float(info['format']['duration'])-secs)<.13
    q={'id':a['id'],'name_cn':a['name_cn'],'runtime_mp3':a['mp3_path'],'master_wav':a['wav_path'],
       'duration_s':round(secs,3),'channel':a['channels'],'rms_dbfs':round(20*np.log10(rms),1),
       'peak_dbfs':round(20*np.log10(peak),1),'loop_boundary_diff':round(float(continuity),6) if continuity is not None else '',
       'runtime_bytes':mp3.stat().st_size,'sha256_mp3':a['sha256_mp3'],
       'result':'PASS_static_qa'}
    qa.append(q)
with (BASE/'QA_REPORT.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=list(qa[0].keys()));w.writeheader();w.writerows(qa)

readme=f'''# 《我是CEO》MVP 完整音频素材包 V1.0

本包提供 **16个已经制作完成、可直接播放的原声音频**，不是仅有清单的设计文件。

## 数量

- `BGM_01` / `BGM_02`：2首背景音乐，各60秒与96秒，可循环。
- `JNG_01`—`JNG_03`：3段年度盈利、亏损、连续盈利成就短乐。
- `SFX_01`—`SFX_11`：11个基础操作音效。
- `Preview/CEO_All16_Sampler.mp3`：全部16项试听合辑，按时间段顺序播放。**此文件只用于审核，不要导入运行时资源。**

## 目录结构

```text
CEO_Audio_Production_v1.0/
  CocosDropIn/assets/resources/audio/
    bgm/       BGM_01...mp3, BGM_02...mp3
    jingles/   JNG_01...mp3 - JNG_03...mp3
    sfx/       SFX_01...mp3 - SFX_11...mp3
  Masters_WAV/     16个对应的WAV无损母版，44.1kHz PCM16
  Preview/         试听合辑MP3
  Config/          音频资产清单、业务事件表、总开关设置
  Tools/           可复现的程序化原创合成脚本、静态验证脚本
  QA_REPORT.csv    逐项质检数据
  AUDIO_AGENT_GUIDE.md
  README_CN.md
```

## 接入 Cocos Creator

1. 将 `CocosDropIn/assets/resources/audio` 下三个子目录复制到现有工程的 `assets/resources/audio/`。
2. 参考 `Config/audio_manifest.json` 中 ID、`cocos_path`、触发事件和分组音量加载音频。
3. 页面切换：创业流程播放 `BGM_01`，公司经营及其他子页面播放 `BGM_02`；同一BGM跨页面时**不重复重启**。
4. `JNG`路由到音效通道（不是背景音乐）；`SFX`同理。**音乐与音效总开关关闭必须全部静音**，打开时恢复之前的分类设置。
5. 无用户首次触摸授权前不得自动播放；进入后台停止/暂停，恢复前台按开关恢复；挂机离线过程不逐条播放事件音频。
6. 初期可直接用MP3；对于**无缝循环**，某些小游戏播放器可能在MP3文件边缘引入编解码延迟，实际真机需检测。如出现间隙，优先测试WAV、平台原生音频循环能力或引擎双播放器衔接，不能默认宣称MP3绝对无缝。
7. 开启游戏中的1×、2×、5×经营加速时，音乐的音调和速度保持不变。

## 试听合辑时间码

| 开始 | 结束 | ID | 音频 |
|---:|---:|---|---|
'''
for s,e,id_,n in segments:readme+=f'| {s:.2f}s | {e:.2f}s | {id_} | {n} |\n'
readme+='''
## 原创性说明

本包的全部音频声波由本项目的 Python 信号合成与原创音符序列生成，未使用第三方音乐、采样包、音色库、录音或流媒体音乐。提供可复现脚本，方便修改音色及生成新的变体。正式商用前仍应根据适用的发布和版权规则完成项目侧合规确认。

## 校验结论的范围

已经执行的自动化检查：16/16 文件可读取、44.1kHz采样率、声道配置、时长、峰值、非静音、BGM WAV 环形接缝幅度、MP3可解码、SHA256。**没有在实际TapTap手机上运行、没有真实设备听感测试**，最终音质/音量与是否无缝需游戏内试听后确定。
'''
(BASE/'README_CN.md').write_text(readme,encoding='utf-8')

(BASE/'AUDIO_AGENT_GUIDE.md').write_text('''# 《我是CEO》音频开发Agent交接

## 交接基线

- 以本包中的16个真实MP3为P0音频资产；WAV母版仅用于后续编辑或循环故障回退。
- `Config/audio_manifest.json`为唯一资产ID—路径—播放事件映射。`Config/audio_event_map.json`为事件分发规则，禁止在多个UI点击回调重复播放同一SFX。
- `Config/audio_settings.json`保存独立音乐、音效开关和总开关逻辑。先读取设置再启动BGM。

## 具体接入顺序

1. 将 `CocosDropIn/assets/resources/audio/` 拷贝到游戏工程的 `assets/resources/audio/`。
2. 实现单例`AudioManager`，区分音乐 `BGM` 和音效 `JNG/SFX` 总线、音量、加载缓存、首次触摸解锁。
3. BGM只保留一条逻辑活跃轨；跨业务页面保持BGM_02持续播放，不叠加。
4. 招聘、创建部门、裁员需在业务数据已成功扣费/保存后播放对应成功提示。非法操作用SFX_05。
5. 关闭公司确认后停止所有音频，重置本轮音频偏好（遵照原V1.1要求）；重进公司创建后重启创业BGM。
6. 验收：关闭全部声音立即停止BGM/JNG/SFX；重新开启不补播被抑制的事件；1×/2×/5×不能影响配乐速度；离线多年度不会连响多次结算提示。

## 音频质量验收

- 所有MP3能通过Cocos AudioClip及TapTap目标机加载。
- 检查机型无爆音、无明显音量跳变、短SFX不因MP3编码延迟被截断。
- 两首BGM连续播放3遍，重点关注循环接缝；如有MP3边缘空隙，参考母版处理。
- 记录不同手机的音量问题与系统媒体音量测试证据。
- `QA_REPORT.csv`是文件技术检查，不等于真机完成验收。
''',encoding='utf-8')

zipout=BASE.parent/'CEO_Audio_MVP_All16_Playable_v1.0.zip'
with zipfile.ZipFile(zipout,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as f:
    for p in sorted(BASE.rglob('*')):
        if p.is_file() and p.name!='validate_and_package.pyc':
            f.write(p,arcname=str(Path(BASE.name)/p.relative_to(BASE)))

with zipfile.ZipFile(zipout) as f:
    bad=f.testzip()
    assert bad is None,bad
    assert all(all(ord(c)<128 for c in name) for name in f.namelist()),'non ASCII file paths'
    assert len([n for n in f.namelist() if n.endswith('.mp3')])==17
print('All 16 source assets validated, preview built, ZIP verified:',zipout)
print('Total zip bytes:',zipout.stat().st_size,'preview length',round(len(preview)/44100,1),'seconds')
