#!/usr/bin/env python3
"""Original procedural audio score for '我是CEO' MVP.
All waveform sounds are generated via NumPy (no third-party audio samples or fonts).
Recreate reproducibly: python Tools/generate_original_audio.py
"""
import os, json, math, csv, hashlib, subprocess, pathlib, textwrap
import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

ROOT = pathlib.Path(__file__).resolve().parents[1]
SR = 44100
RNG = np.random.default_rng(20261101)
MP3_ROOT = ROOT / 'CocosDropIn/assets/resources/audio'
WAV_ROOT = ROOT / 'Masters_WAV'

for p in ['bgm', 'jingles', 'sfx']:
    (MP3_ROOT/p).mkdir(parents=True, exist_ok=True)
    (WAV_ROOT/p).mkdir(parents=True, exist_ok=True)

def midi_freq(m): return 440.0 * 2 ** ((float(m)-69)/12)
def midi_note(name):
    # examples 'C#4', 'Eb3'
    import re
    m = re.fullmatch(r'([A-Ga-g])([#b]?)(-?\d+)', name)
    if not m: raise ValueError(name)
    base={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[m.group(1).upper()]
    mod={'#':1,'b':-1,'':0}[m.group(2)]
    return (int(m.group(3))+1)*12+base+mod

def env(t, dur, atk=0.014, rel=0.26, dip=.96):
    attack=np.minimum(1.0, t/max(atk,1e-4))
    release=np.where(t>dur, np.exp(-np.maximum(t-dur,0)/max(rel,1e-5)), 1.0)
    return attack*release

def tone(kind, pitch, dur, vel=1.0):
    f=midi_freq(pitch)
    tails={'keys':0.9,'epiano':1.10,'mallet':0.55,'guitar':0.45,'bass':0.33,'pad':1.6,'bell':1.20,'pluck':0.5,'pluckbright':0.55,'wind':0.7}
    tail=tails[kind]
    n=max(16,int(round((dur+tail)*SR)))
    t=np.arange(n,dtype=np.float64)/SR
    p=2*np.pi*f*t
    if kind=='keys':
        w=np.sin(p)+.22*np.sin(2*p+.1)+.085*np.sin(3*p+.22)+.04*np.sin(4*p)
        body=.6*np.exp(-t/2.0)+.4*np.exp(-t/.24)
        a=env(t,dur,.011,.12)*body
    elif kind=='epiano':
        w=.78*np.sin(p+.018*np.sin(2*np.pi*.9*t))+.21*np.sin(2*p+.27)+.08*np.sin(3*p+.12)+.09*np.sin(p*1.003)
        a=env(t,dur,.027,.31)*(.82*np.exp(-t/4.0)+.18*np.exp(-t/.4))
    elif kind=='mallet':
        w=np.sin(p)+.24*np.sin(3.99*p)+.11*np.sin(8.01*p)
        a=env(t,dur,.002,.09)*np.exp(-t/.24)
    elif kind=='guitar':
        w=(.82*np.sin(p)+.25*np.sin(2*p+.1)+.10*np.sin(3*p+.18)+.04*np.sin(4*p))
        a=env(t,dur,.003,.12)*(.80*np.exp(-t/.62)+.20*np.exp(-t/.18))
    elif kind=='pluck':
        w=.86*np.sin(p)+.27*np.sin(2*p+.5)+.11*np.sin(3*p+.1)
        a=env(t,dur,.003,.16)*np.exp(-t/.36)
    elif kind=='pluckbright':
        w=np.sin(p)+.23*np.sin(2*p)+.22*np.sin(4*p+.3)
        a=env(t,dur,.002,.12)*np.exp(-t/.23)
    elif kind=='bass':
        w=.96*np.sin(p)+.26*np.sin(2*p+.1)+.07*np.sin(3*p)
        a=env(t,dur,.012,.15)*(.76+.24*np.exp(-t/.18))
    elif kind=='pad':
        w=.74*np.sin(p+.02*np.sin(2*np.pi*.25*t))+.19*np.sin(2*p+.2)+.11*np.sin(p*1.003)
        a=env(t,dur,.28,.58)*(.90+.10*np.sin(2*np.pi*.10*t))
    elif kind=='bell':
        w=np.sin(p)+.28*np.sin(2.01*p+.2)+.12*np.sin(3.91*p)+.07*np.sin(5.33*p)
        a=env(t,dur,.003,.21)*(.7*np.exp(-t/.70)+.3*np.exp(-t/.15))
    else: raise ValueError(kind)
    # Normalize relative perceived level with gentle note-scaled factor.
    compensation=np.clip(440.0/max(f,60),.57,1.4)**.08
    return (w*a*vel*compensation).astype(np.float32)

class Song:
    def __init__(self, length, bpm, seed):
        self.duration=float(length)
        self.n=int(round(length*SR))
        self.bpm=bpm
        self.beat=60/bpm
        self.rng=np.random.default_rng(seed)
        self.L=np.zeros(self.n,dtype=np.float32)
        self.R=np.zeros(self.n,dtype=np.float32)
    def put(self, time, arr, gain=1, pan=0):
        j=int(round(time*SR))%self.n
        v=arr*np.float32(gain)
        pan=max(-1.,min(1.,pan))
        l=np.float32(math.sqrt((1-pan)/2)*1.4142)
        r=np.float32(math.sqrt((1+pan)/2)*1.4142)
        n=len(v)
        if n>=self.n:
            v=v[:self.n-1];n=len(v)
        first=min(n,self.n-j)
        self.L[j:j+first]+=v[:first]*l
        self.R[j:j+first]+=v[:first]*r
        if first<n:
            self.L[:n-first]+=v[first:]*l
            self.R[:n-first]+=v[first:]*r
    def note(self, t, pitch, dur, kind, vol, pan=0, humanize=0):
        t=t+self.rng.uniform(-humanize,humanize) if humanize else t
        self.put(t,tone(kind,pitch,dur,vel=vol),1,pan)
    def beat_snd(self, t, kind, vol):
        dur={'kick':.29,'rim':.19,'hat':.105,'brush':.26,'clap':.23,'snap':.15}[kind]
        n=int(dur*SR);tm=np.arange(n,dtype=np.float64)/SR
        phase=2*np.pi*(65*tm+65*.045*(1-np.exp(-tm/.035)))
        if kind=='kick':
            y=np.sin(phase)*np.exp(-tm/0.085)+.25*np.sin(2*np.pi*45*tm)*np.exp(-tm/.13)
            pan=0
        else:
            noise=self.rng.standard_normal(n)
            if kind=='hat':
                sh=noise-np.convolve(noise,np.ones(65)/65,'same')
                y=.45*sh*np.exp(-tm/.032)
                pan=.18
            elif kind=='rim':
                y=(.39*np.sin(2*np.pi*720*tm)+.22*noise)*np.exp(-tm/.039)
                pan=.16
            elif kind=='brush':
                sm=np.convolve(noise,np.ones(23)/23,'same')
                y=(noise-sm)*np.exp(-tm/.12)*.24
                pan=-.08
            elif kind=='clap':
                sh=noise-np.convolve(noise,np.ones(49)/49,'same')
                y=.29*sh*(np.exp(-tm/.045)+.4*np.exp(-np.maximum(tm-.045,0)/.055)*(tm>.045))
                pan=-.2
            else:
                y=(.42*np.sin(2*np.pi*420*tm)+.2*noise)*np.exp(-tm/.024)
                pan=-.16
        a=np.minimum(1,tm/.0017); y=(y*a*vol).astype('float32')
        self.put(t,y,1,pan)
    def render(self, room=.07, delay=.2):
        L=self.L.astype(np.float64)
        R=self.R.astype(np.float64)
        # Circular studio room IR ensures a true repeating cycle with reverb tails crossing boundary.
        # Soft reverb: delay taps rather than samples, no copyrighted material.
        for delay_s,g in [(0.069,.115),(0.132,.088),(0.227,.060),(0.357,.040)]:
            k=int(round(delay_s*SR))
            L+=np.roll(self.R,k)*g
            R+=np.roll(self.L,k+int(.007*SR))*g
        # Contain peak and leave headroom for overlapping SFX
        x=np.stack([L,R],-1).astype(np.float32)
        x=np.tanh(x*.65)*.90
        # Small continuity correction for finite samples; prevents boundary transient.
        jump=x[0]-x[-1]
        k=round(.004*SR)
        x[-k:]+=np.linspace(0,1,k,dtype=np.float32)[:,None]*jump[None,:]
        return x

# compositional helpers
# Each one-bar chord list makes the song 4/4 at a mathematically exact length.
CHORDS1=[
    ('Dmaj9',[50,54,57,61,64]),('Aadd9',[49,52,57,59,64]),
    ('Bm7',[47,50,54,57,61]),('Gmaj9',[43,47,50,54,57]),
    ('Em7',[40,43,47,50,54]),('A7sus',[45,50,52,55,59]),
    ('F#m7',[42,45,49,52,57]),('Gadd9',[43,47,50,52,57])]
CHORDS2=[
    ('Cmaj7',[48,52,55,59,64]),('G6',[43,47,50,52,59]),
    ('Am9',[45,48,52,55,59]),('Fmaj7',[41,45,48,52,57]),
    ('Dm9',[38,41,45,48,52]),('G7',[43,47,50,53,57]),
    ('Em7',[40,43,47,50,55]),('Gadd9',[43,47,50,57,59])]

def start_song():
    s=Song(60,128,12809)
    # Structure 4x8 bars. Every bar is exactly 1.875 s.
    b=s.beat
    assert abs(s.duration-32*4*b)<1e-8
    melody=[(0,74,0.65),(1,76,.45),(1.75,78,.52),(2.6,76,.40),(3.0,73,.67),
            (4,71,.52),(4.75,73,.45),(5.5,74,.78),(6.5,73,.60),(7.35,69,.38)]
    for bar in range(32):
        start=bar*4*b; name,ch=CHORDS1[bar%8]
        section=bar//8
        # low piano chords + soft airy pad
        voicing=[v+12 for v in ch[1:5]]
        for k,p in enumerate(voicing):
            s.note(start+.08+k*.045*b,p,3.45*b,'keys',.12+(0.025 if section in (1,3) else 0),pan=-.2+(k/5)*.35)
        if bar%2==0:
            for k,p in enumerate(ch[1:4]):
                s.note(start,p+12,7.65*b,'pad',.038,pan=-.25+.22*k)
        # 4 to the floor mellow bass, gentle syncopation
        bass=ch[0]
        s.note(start+.01,bass,1.25*b,'bass',.22,pan=0)
        s.note(start+2*b+.05,bass+12,.90*b,'bass',.11,pan=-.08)
        if bar%4 in (1,3): s.note(start+3.5*b,bass+7,.40*b,'bass',.085)
        # soft guitar syncopation, more lively later
        for t,p in [(0,ch[2]+12),(1.5,ch[3]+12),(2.5,ch[1]+12),(3.5,ch[2]+12)]:
            if section==0 and t==3.5 and bar%2==0:continue
            s.note(start+t*b,p,.38*b,'guitar',.115,pan=.42,humanize=.008)
        # mallet arpeggio, distinct signature
        order=[2,3,4,3,1,2,4,3]
        for i in range(8):
            t=start+(i*.5)*b
            if (section==0 and i%2==1) or (section==2 and i in (3,7)):
                continue
            s.note(t,ch[order[(i+bar)%8]]+12,.34*b,'mallet',.09+(i%4==0)*.028,pan=-.45)
        # main melody emerges every second group
        if section in (1,3) and bar%8 in (0,1,4,5):
            mdx=(bar%8)//4
            for dt,p,beats in melody[:5] if bar%8 in (0,4) else melody[5:]:
                tt=start+(dt if dt<4 else dt-4)*b
                s.note(tt,p+(2 if mdx else 0),beats*b,'epiano',.11,pan=.22)
        # restrained percussion, mild busier second half
        if section!=0 or bar>3:
            s.beat_snd(start,'kick',.21)
            s.beat_snd(start+2*b,'kick',.14)
            s.beat_snd(start+b,'rim',.11)
            s.beat_snd(start+3*b,'rim',.105)
        for i in range(8):
            if section==0 and i%2:continue
            s.beat_snd(start+i*.5*b,'hat',.026 if i%2==0 else .017)
        if bar%8==7: s.beat_snd(start+3.5*b,'brush',.045)
    return s.render()

def office_song():
    s=Song(96,100,10033)
    b=s.beat
    assert abs(s.duration-40*4*b)<1e-8
    motif=[(0,67,.53),(.75,69,.50),(1.55,72,.70),(2.7,71,.55),(3.5,69,.30)]
    for bar in range(40):
        start=bar*4*b;name,ch=CHORDS2[bar%8]
        sec=bar//8
        for k,p in enumerate(ch[1:5]):
            s.note(start+(k%2)*.08*b,p+12,3.65*b,'epiano',.11+(sec==2)*.015,pan=-.30+.15*k)
        if bar%2==0:
            for k,p in enumerate(ch[1:4]):
                s.note(start+.05,p+12,7.5*b,'pad',.045,pan=.20-.18*k)
        # bass pulse
        s.note(start+.04,ch[0],1.15*b,'bass',.23)
        s.note(start+2*b+.01,ch[0]+12,.73*b,'bass',.080)
        # gentle plucked eight notes, vary each phrase
        arps=[1,2,3,2,4,2,1,3]
        for i in range(8):
            if sec==0 and i in (3,7): continue
            if sec==4 and i in (0,4) and bar%2: continue
            pitch=ch[arps[(i+bar//2)%8]]+(12 if i in (3,7) else 0)
            s.note(start+i*.5*b,pitch,.32*b,'pluck',.093,pan=.35,humanize=.007)
        if (bar%8 in (1,2,5,6)) and sec in (1,2,4):
            for idx,(t,p,dur) in enumerate(motif):
                s.note(start+t*b,p+({1:0,2:2,4:-2}[sec]),dur*b,'keys',.087,pan=-.24)
        if sec==3:
            for i in (1,4,6):
                s.note(start+(i*.5)*b,ch[(i+1)%4+1]+24,.35*b,'mallet',.05,pan=-.30)
        # atmosphere: very subtle kick + warm rim + tiny shaker
        if bar%2==0 or sec>=2:
            s.beat_snd(start,'kick',.16)
        s.beat_snd(start+2*b,'kick',.10)
        s.beat_snd(start+2*b,'rim',.078)
        for i in (0,2,4,6):
            s.beat_snd(start+i*.5*b,'hat',.024)
        if sec>0:
            for i in (1,5):s.beat_snd(start+i*.5*b,'brush',.014)
        if bar%8==7: s.beat_snd(start+3.5*b,'snap',.045)
    return s.render()

def add_ui_tone(x, start, hz, dur, amp, profile='bell', glide=0):
    n=len(x)
    i=int(round(start*SR))
    m=min(round(dur*SR), n-i)
    if m<=1:return
    t=np.arange(m)/SR
    phase=2*np.pi*(hz*t + (glide*t*t/2))
    if profile=='bell':
        w=(.78*np.sin(phase)+.2*np.sin(2.02*phase)+.09*np.sin(3.8*phase))
        envelope=(1-np.exp(-t/.002))*np.exp(-t/max(.05,dur*.43))
    elif profile=='soft':
        w=.90*np.sin(phase)+.15*np.sin(2*phase)
        envelope=(1-np.exp(-t/.003))*np.exp(-t/max(.02,dur*.38))
    elif profile=='wood':
        w=.65*np.sin(phase)+.26*np.sin(2.4*phase)+.1*np.sin(3.6*phase)
        envelope=(1-np.exp(-t/.001))*np.exp(-t/max(.009,dur*.23))
    elif profile=='whoop':
        w=.8*np.sin(phase)+.2*np.sin(2*phase)
        envelope=np.sin(np.pi*np.minimum(1,t/dur))**.4
    else:raise ValueError(profile)
    fade_n=min(m, int(SR*.012));envelope[-fade_n:]*=np.linspace(1,0,fade_n)
    x[i:i+m]+=w*envelope*amp

def add_noise(x, start, dur, amp=.04, soft=True):
    i=int(start*SR);m=min(int(dur*SR),len(x)-i)
    if m<=1:return
    t=np.arange(m)/SR
    noise=RNG.standard_normal(m)
    # gently bandlimited paper/wood tick texture, no harsh static
    if soft: noise=np.convolve(noise,np.ones(11)/11,mode='same')
    noise=noise * (1-np.exp(-t/.001)) * np.exp(-t/max(.012,dur*.25))
    noise[-min(m,100):]*=np.linspace(1,0,min(m,100))
    x[i:i+m]+=noise*amp

def synth_ui(key, seconds):
    x=np.zeros(int(round(seconds*SR)),dtype=np.float64)
    if key=='JNG_01':
        for tm, hz in [(.05,659.26),(.35,783.99),(.65,987.77),(.99,1318.51)]:
            add_ui_tone(x,tm,hz,.85,.17,'bell')
        add_ui_tone(x,.06,329.63,1.6,.075,'soft')
    elif key=='JNG_02':
        for tm,hz in [(.07,523.25),(.53,440),(.96,392), (1.25,349.23)]:
            add_ui_tone(x,tm,hz,.52,.14,'soft')
        add_ui_tone(x,.09,261.63,1.8,.040,'soft')
    elif key=='JNG_03':
        for tm,hz in [(.09,523.25),(.33,659.26),(.60,783.99),(.88,1046.5),(1.28,1318.5),(1.64,1567.98)]:
            add_ui_tone(x,tm,hz,1.12,.14,'bell')
        for tm in (.1,.6,1.3):add_noise(x,tm,.13,.025)
        add_ui_tone(x,.88,523.25,2.4,.055,'soft')
    elif key=='SFX_01':add_ui_tone(x,0,430,.115,.21,'wood');add_noise(x,0,.046,.020)
    elif key=='SFX_02':
        add_ui_tone(x,.006,660,.17,.18,'bell');add_ui_tone(x,.075,830,.119,.16,'bell')
    elif key=='SFX_03':
        add_ui_tone(x,.006,700,.22,.18,'soft');add_ui_tone(x,.087,950,.20,.18,'bell')
    elif key=='SFX_04':
        add_ui_tone(x,.003,620,.16,.16,'soft',glide=-850)
    elif key=='SFX_05':
        add_ui_tone(x,.003,370,.13,.16,'wood');add_ui_tone(x,.113,335,.14,.14,'wood')
    elif key=='SFX_06':
        for tm,hz in [(.008,750),(.062,910),(.115,1160),(.2,980)]:add_ui_tone(x,tm,hz,.15,.097,'bell')
        add_noise(x,.02,.23,.04)
    elif key=='SFX_07':
        for tm,hz in [(.018,523),(.16,660),(.31,784),(.47,1046)]:add_ui_tone(x,tm,hz,.24,.15,'bell')
    elif key=='SFX_08':
        for tm,hz in [(.01,390),(.12,510),(.28,660),(.44,880),(.58,1046)]:add_ui_tone(x,tm,hz,.27,.12,'wood' if tm<.20 else 'bell')
        add_noise(x,.025,.25,.055)
    elif key=='SFX_09':
        add_ui_tone(x,.015,520,.23,.11,'soft',glide=-430);add_ui_tone(x,.215,350,.20,.08,'soft')
    elif key=='SFX_10':
        add_ui_tone(x,.010,580,.10,.17,'wood');add_ui_tone(x,.11,810,.14,.145,'bell')
    elif key=='SFX_11':
        add_ui_tone(x,.018,294,.28,.14,'soft');add_ui_tone(x,.32,262,.28,.14,'soft')
    else:raise ValueError(key)
    x=np.tanh(x*.95)*.92
    return x.astype('float32')

ASSETS=[
 ('BGM_01','BGM_01_StartupLoop',60,'bgm','创业启程','startup'),
 ('BGM_02','BGM_02_OfficeLoop',96,'bgm','日常经营','operation'),
 ('JNG_01','JNG_01_YearProfit',2.5,'jingles','年度盈利','annual_profit'),
 ('JNG_02','JNG_02_YearLoss',2.5,'jingles','年度亏损','annual_loss'),
 ('JNG_03','JNG_03_ThreeYearGoal',4.0,'jingles','连续三年盈利','three_year_goal'),
 ('SFX_01','SFX_01_UITap',0.12,'sfx','通用按钮点击','ui.tap'),
 ('SFX_02','SFX_02_Select',0.20,'sfx','卡片选择','ui.select'),
 ('SFX_03','SFX_03_Confirm',0.30,'sfx','操作确认','ui.confirm'),
 ('SFX_04','SFX_04_Back',0.18,'sfx','返回与取消','ui.back'),
 ('SFX_05','SFX_05_Invalid',0.27,'sfx','非法操作','ui.invalid'),
 ('SFX_06','SFX_06_RerollName',0.40,'sfx','随机公司名称','company.reroll_name'),
 ('SFX_07','SFX_07_Recruit',0.75,'sfx','招聘成功','employee.recruited'),
 ('SFX_08','SFX_08_CreateDepartment',0.85,'sfx','创建部门','department.created'),
 ('SFX_09','SFX_09_Layoff',0.45,'sfx','裁员完成','employee.laid_off'),
 ('SFX_10','SFX_10_SpeedChange',0.30,'sfx','速度切换','time.speed_changed'),
 ('SFX_11','SFX_11_CashWarning',0.65,'sfx','现金安全警告','finance.cash_crisis_opened')]

def normalize_audio(x, kind):
    # Program peaks comfortably below zero; BGMs are quieter than effects at equal mixer gain.
    peak=np.max(np.abs(x))
    target={'bgm':.51,'jingles':.65,'sfx':.62}[kind]
    if peak>0:x=x*(target/peak)
    return x.astype('float32')

def write_asset(tup,x):
    key,stem,dur,kind,cn,event=tup
    x=normalize_audio(x,kind)
    wav=WAV_ROOT/kind/(stem+'.wav')
    mp3=MP3_ROOT/kind/(stem+'.mp3')
    sf.write(wav,x,SR,subtype='PCM_16')
    ch=2 if x.ndim==2 else 1
    # MP3 use CBR to bound TapTap package footprint; short clips can add encoder padding.
    bitrate=128 if ch==2 else 96
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-ar',str(SR),'-b:a',f'{bitrate}k','-ac',str(ch),str(mp3)],check=True)
    rms=float(np.sqrt(np.mean(x.astype(np.float64)**2)))
    peak=float(np.max(np.abs(x)))
    return {'id':key,'name_cn':cn,'type':kind,'event':event,'duration_expected_s':dur,'channels':ch,'sample_rate':SR,'peak_dbfs':round(20*np.log10(peak),2),'rms_dbfs':round(20*np.log10(rms+1e-12),2),'loop':kind=='bgm','wav_path':str(wav.relative_to(ROOT)),'mp3_path':str(mp3.relative_to(ROOT)),'wav_bytes':wav.stat().st_size,'mp3_bytes':mp3.stat().st_size,'sha256_mp3':hashlib.sha256(mp3.read_bytes()).hexdigest(),'status':'produced'}

def main():
    print('Rendering 60s original startup BGM...',flush=True)
    a=write_asset(ASSETS[0],start_song())
    print('Rendering 96s original office BGM...',flush=True)
    b=write_asset(ASSETS[1],office_song())
    assets=[a,b]
    for it in ASSETS[2:]:
        print('Rendering',it[0],flush=True)
        assets.append(write_asset(it,synth_ui(it[0],it[2])))
    manifest={'game':'我是CEO','version':'1.0','all_original_procedurally_composed':True,'no_third_party_samples':True,'author':'Original procedural composition generated for this user request','platform':'TapTap minigame / Cocos Creator','total_assets':len(assets),'masters':'WAV PCM16 44100Hz','runtime':'MP3 CBR','assets':assets}
    conf=ROOT/'Config';conf.mkdir(exist_ok=True)
    (conf/'audio_asset_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    with (conf/'audio_asset_manifest.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(assets[0].keys()))
        w.writeheader();w.writerows(assets)
    print('DONE produced',len(assets),'assets',flush=True)

if __name__=='__main__':main()
