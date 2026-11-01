from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np, os, math, subprocess, wave
from pathlib import Path

OUT=Path('/mnt/data/CEO_TapTap_Animated_Promo_v1')
W,H,FPS,DURATION=720,1280,24,26
NAVY='#16355e'; BLUE='#2d69b9'; DEEP='#102d56'; GREEN='#2dbb8b'; TEAL='#18aabd'; GOLD='#ffca64'; MUTED='#6b819e'; WHITE='#ffffff'; DARK='#233653'
font_reg='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
font_bold='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
F={}
for sz in [17,18,20,22,24,25,26,28,30,32,34,36,38,40,42,44,46,48,52,56,60,64,70,72,80,88]:
    F[(sz,False)]=ImageFont.truetype(font_reg,sz)
    F[(sz,True)]=ImageFont.truetype(font_bold,sz)

def clamp(v,a=0,b=1):return max(a,min(b,v))
def outback(x):
    x=clamp(x); c1=1.70158;c3=c1+1
    return 1+c3*(x-1)**3+c1*(x-1)**2

def ease(x):
    x=clamp(x);return x*x*(3-2*x)
def lerp(a,b,t):return a+(b-a)*t

def rr(d,rect,r,fill,outline=None,width=1):
    d.rounded_rectangle(tuple(map(int,rect)),radius=int(r),fill=fill,outline=outline,width=width)

def txt(d,at,s,size=32,col=DARK,bold=False,anchor='la',stroke=0,stroke_fill=None):
    if (size,bold) not in F:F[(size,bold)]=ImageFont.truetype(font_bold if bold else font_reg,size)
    d.text((int(at[0]),int(at[1])),str(s),font=F[(size,bold)],fill=col,anchor=anchor,stroke_width=stroke,stroke_fill=stroke_fill)

def card(d,box,r=26,fill='#ffffff',shadow=True,outline=None):
    x,y,x2,y2=map(int,box)
    if shadow:rr(d,(x+1,y+7,x2+1,y2+7),r,'#d5e4f5')
    rr(d,(x,y,x2,y2),r,fill,outline,2 if outline else 1)

def pill(d,box,label,bg='#e8f2ff',fg=BLUE,size=24):
    rr(d,box,22,bg)
    txt(d,((box[0]+box[2])/2,(box[1]+box[3])/2),label,size,fg,True,'mm')

def dot(d,x,y,r,col):d.ellipse((int(x-r),int(y-r),int(x+r),int(y+r)),fill=col)

def arrow(d,xy,width=11,color=GREEN):
    pts=[(int(x),int(y)) for x,y in xy]
    if len(pts)>1:
        d.line(pts,fill=color,width=width,joint='curve')
        p0=pts[-2];p1=pts[-1];an=math.atan2(p1[1]-p0[1],p1[0]-p0[0]);a=22
        d.polygon((p1,(p1[0]-a*math.cos(an-.55),p1[1]-a*math.sin(an-.55)),(p1[0]-a*math.cos(an+.55),p1[1]-a*math.sin(an+.55))),fill=color)

def draw_logo(d,x=360,y=95,scale=1):
    txt(d,(x,y),'我是CEO',int(70*scale),NAVY,True,'mm',stroke=3,stroke_fill='#fff')
    for i,h in enumerate([10,19,28,42]):
        xx=x+133*scale+i*17*scale
        rr(d,(xx,y-48*scale-h*scale,xx+12*scale,y-48*scale),3,TEAL)

def building(d,x,y,w,h,color,windows=True):
    if h<5:return
    x,y,w,h=map(int,[x,y,w,h]);rr(d,(x,y-h,x+w,y),9,color)
    d.polygon([(x+10,y-h),(x+24,y-h-14),(x+w-3,y-h-14),(x+w-3,y-h)],fill='#dceeff')
    if windows:
        for j in range(2,max(2,h//42)):
            for i in range(2,max(3,w//34)):
                wx=x+6+i*(w-12)/max(3,w//34); wy=y-h+6+j*30
                if wy<y-14 and wy>y-h+12: rr(d,(wx,wy,wx+11,wy+18),2,'#ddf5ff')

def backdrop(t,night=False):
    # precomputed smooth gradient
    base=bg_night.copy() if night else bg_day.copy()
    d=ImageDraw.Draw(base)
    # soft drifting clouds, multiple layers
    for i in range(10):
        x=(i*139+int(t*13*(1+.2*(i%3))))%(W+290)-140;y=170+i%5*135
        cl='#344e80' if night else '#ecf6ff'
        d.ellipse((x,y,x+180,y+56),fill=cl)
        d.ellipse((x+24,y-28,x+118,y+40),fill=cl)
    # parallax skyline, flat original shapes
    for i in range(13):
        x=i*78-45-int(t*5)%78; bh=125+(i*39%140)
        building(d,x,H-150,76,bh,'#8bbde1' if not night else '#3b5682',windows=False)
    for i in range(8):
        x=i*117-45-int(t*9)%117; bh=160+(i*43%150)
        building(d,x,H-103,90,bh,'#5a98cf' if not night else '#284877',windows=True)
    # ground
    d.rectangle((0,H-135,W,H), fill='#d8eaf7' if not night else '#17345f')
    d.line((0,H-137,W,H-137),fill='#86c4e5',width=5)
    return base

def person(d,x,y,s=1,walk=0,skin='#f6c4a5',jacket='#2e64a9',gender=0,arm_raise=0):
    # original rigged full-body person using procedural limb motion
    x=float(x);y=float(y)
    def P(xx,yy):return int(x+xx*s),int(y+yy*s)
    bob=math.sin(walk*2.5)*3 if walk else 0
    body_y=bob
    # shadow
    d.ellipse((P(-58,5)[0],P(0,5)[1],P(58,12)[0],P(0,15)[1]), fill='#b1c7de')
    # legs animated
    swing=math.sin(walk)*20 if walk else 0
    d.line([P(-17,-111),P(-18+swing,-55),P(-24+swing*1.2,0)],fill='#203c68',width=int(22*s))
    d.line([P(17,-111),P(16-swing,-55),P(25-swing*1.2,0)],fill='#1b3459',width=int(22*s))
    d.ellipse((P(-38+swing,-7),P(-10+swing,4)),fill='#112d54')
    d.ellipse((P(12-swing,-7),P(40-swing,4)),fill='#112d54')
    # body jacket & shirt
    d.polygon([P(-42,-226+body_y),P(38,-226+body_y),P(41,-100),P(-40,-100)],fill=jacket)
    d.polygon([P(-16,-221+body_y),P(12,-221+body_y),P(7,-149),P(-11,-149)],fill='#f8fcff')
    d.polygon([P(0,-216),P(8,-205),P(2,-147),P(-6,-205)],fill='#1d91c6')
    # arms swing
    al=math.sin(walk)*18 if walk else 0
    d.line([P(-37,-216+body_y),P(-58-al,-166),P(-45-al,-120)],fill=jacket,width=int(21*s))
    if arm_raise:
        d.line([P(35,-216+body_y),P(62,-250),P(83,-272)],fill=jacket,width=int(21*s))
        dot(d,*P(83,-276),12*s,skin)
    else:
        d.line([P(35,-214+body_y),P(56+al,-159),P(40+al,-124)],fill=jacket,width=int(21*s))
    # head and neck
    rr(d,(*P(-8,-246+body_y),*P(9,-219+body_y)),5,skin)
    d.ellipse((*P(-35,-309+body_y),*P(36,-231+body_y)),fill=skin)
    # side hair swoop + eyes
    d.pieslice((*P(-36,-317+body_y),*P(39,-258+body_y)),start=175,end=365,fill='#263955')
    d.ellipse((*P(-20,-278+body_y),*P(-14,-272+body_y)),fill='#1b2c4a')
    d.ellipse((*P(13,-278+body_y),*P(19,-272+body_y)),fill='#1b2c4a')
    d.arc((*P(-12,-264+body_y),*P(14,-250+body_y)),start=3,end=160,fill='#b66a69',width=max(1,int(2*s)))

def page_header(d,title,tag='动画演示',t=0):
    d.rectangle((0,0,W,114),fill=DEEP)
    txt(d,(38,58),title,44,WHITE,True,'lm')
    txt(d,(682,58),tag,20,'#a7d9fb',False,'rm')
    d.line([(0,113),(W,113)],fill='#66b9e3',width=3)

def bottom_note(d):
    txt(d,(360,1242),'概念宣传动画 · 非实机录屏',19,'#6483a3',False,'mm')

# make backgrounds with numpy gradients
YY=np.linspace(0,1,H,dtype=np.float32)[:,None]
XX=np.zeros((1,W),dtype=np.float32)
def mkbg(top,bottom):
    out=np.zeros((H,W,3),dtype=np.uint8)
    for k in range(3):out[:,:,k]=np.clip((1-YY)*top[k]+YY*bottom[k],0,255).astype('uint8')
    return Image.fromarray(out,'RGB')
bg_day=mkbg((233,246,255),(239,248,255))
bg_night=mkbg((17,47,86),(66,104,145))

ROOT=(OUT/'SourceAvatars').parent if (OUT/'SourceAvatars').exists() else Path('/mnt/data/CEO_UI_DevHandoff_B01-B06_v1.5/CocosDropIn/assets/resources/ui')
Av=[]
for pat in ['EmployeeAvatar_01_Male_ShortHair_Color1.png','EmployeeAvatar_02_Female_ShoulderHair_Color1.png','EmployeeAvatar_05_Male_Glasses_Color1.png']:
    im=Image.open(ROOT/'SourceAvatars'/pat if (ROOT/'SourceAvatars'/pat).exists() else ROOT/'avatars'/pat).convert('RGBA'); im.thumbnail((100,100)); Av.append(im)

def paste_avatar(frame,index,x,y,size=95):
    im=Av[index].resize((size,size),Image.Resampling.LANCZOS)
    frame.paste(im,(int(x),int(y)),im)

def progress(d,x,y,w,f,fill=GREEN):
    rr(d,(x,y,x+w,y+18),9,'#dce8f4')
    if f>.002:rr(d,(x,y,x+w*clamp(f),y+18),9,fill)

def scene(t):
    # output with continuous activity across all frames
    if t<3.3:
        im=backdrop(t)
        d=ImageDraw.Draw(im)
        a=ease(t/1.5)
        # animated building growing as if under construction
        for i,(x,hh,cc) in enumerate([(87,230,'#347eaf'),(244,310,'#408dc6'),(405,430,'#2463ad'),(542,275,'#6db5c7')]):
            h=hh*ease((t-.35-i*.19)/1.5)
            building(d,x,925,130,h,cc,True)
        d.rectangle((0,1020,W,1122),fill='#cee5f3')
        d.line((0,1020,W,1020),fill='#86bbd6',width=5)
        for k in range(12): d.line((k*70,1052,k*70+38,1052),fill='#a5cfdf',width=3)
        # drawing building advancement particles
        for i in range(10):
            x=(i*101+t*55)%W; y=220+(i*73)%600
            dot(d,x,y,3,'#b6e4ef')
        person(d,lerp(920,345,ease(t/2.4)),1012,1.22,walk=t*9 if t<2 else 0,arm_raise=t>2.3)
        draw_logo(d,360,164,1.05)
        txt(d,(360,305),'从一间小公司开始',43,NAVY,True,'mm')
        # progress underline moves dynamically
        d.line((146,350,146+430*ease(t/2.3),350),fill=GREEN,width=8)
        txt(d,(360,1162),'亲手经营第一家公司',34,NAVY,True,'mm')
    elif t<6.7:
        l=t-3.3
        im=backdrop(t);d=ImageDraw.Draw(im);page_header(d,'创立公司',t=t)
        card(d,(32,154,688,1058),32)
        txt(d,(68,201),'给公司起个名字',38,NAVY,True)
        txt(d,(68,267),'公司名称',25,MUTED)
        rr(d,(60,312,662,390),16,'#eaf4fe',BLUE,3)
        name='星辰未来贸易有限公司'; nc=int(len(name)*clamp(l/1.65))
        txt(d,(85,352),name[:nc] + ('|' if int(t*4)%2 else ''),31,NAVY,True,'lm')
        txt(d,(68,466),'选择主营业务',30,NAVY,True)
        active=int((l*1.4))%3
        options=[('电商贸易','#eaf5ff','购销业务'),('软件科技','#e9fbf5','技术服务'),('企业服务','#fff8e9','专业咨询')]
        for i,(label,col,desc) in enumerate(options):
            x=58+i*211; y=529+int((1-ease((l-.45-i*.18)/.55))*60)
            outline=BLUE if i==active else '#d8e7f4'
            card(d,(x,y,x+191,y+216),24,col,True,outline)
            # icon center
            dot(d,x+95,y+60,30,BLUE if i==0 else (GREEN if i==1 else '#e4a643'))
            txt(d,(x+95,y+60),['购','科','企'][i],29,WHITE,True,'mm')
            txt(d,(x+95,y+125),label,25,NAVY,True,'mm')
            txt(d,(x+95,y+170),desc,21,MUTED,False,'mm')
        txt(d,(67,846),'起始资金',27,MUTED)
        txt(d,(649,846),'¥300,000',36,BLUE,True,'rm')
        pill(d,(112,918,609,991),'开始你的创业旅程',BLUE,WHITE,31)
        txt(d,(360,1122),'自主命名 · 选择业务 · 开始经营',25,BLUE,True,'mm')
        bottom_note(d)
    elif t<10.5:
        l=t-6.7;im=backdrop(t);d=ImageDraw.Draw(im);page_header(d,'招募你的第一批员工',t=t)
        txt(d,(38,176),'比较能力、潜力与工资',30,NAVY,True)
        txt(d,(38,222),'在不同候选人中做出选择',23,MUTED)
        candidates=[('张明宇','市场专员',72,88,'6,000'),('李思然','运营专员',68,92,'7,000'),('王浩然','业务专员',75,80,'5,500')]
        for i,(n,job,ability,potential,salary) in enumerate(candidates):
            slide=(1-ease((l-.10-i*.28)/.56))*560
            y=282+i*219
            selected= (i==0 and l>1.1) or (i==2 and l>2.35)
            card(d,(38+slide,y,684+slide,y+196),24,'#f1f8ff' if selected else WHITE,True,BLUE if selected else '#d9e6f4')
            if slide<500:
                # overlay avatar paste after all card geometry; paste each once
                paste_avatar(im,i,57+slide,y+21,103)
                d=ImageDraw.Draw(im)
            txt(d,(178+slide,y+42),n,32,NAVY,True)
            txt(d,(178+slide,y+88),job,23,BLUE)
            txt(d,(178+slide,y+147),f'能力 {ability}   潜力 {potential}',23,MUTED)
            txt(d,(656+slide,y+146),f'¥{salary}/月',23,BLUE,True,'ra')
            if selected:
                dot(d,642+slide,y+39,20,BLUE)
                txt(d,(642+slide,y+39),'✓',24,WHITE,True,'mm')
        count=int(l>1.1)+int(l>2.35)
        card(d,(48,984,673,1127),23,'#e7f3ff')
        txt(d,(78,1028),f'已选择 {count}/2 人',31,BLUE,True)
        fee='11,500' if count==2 else ('6,000' if count==1 else '0')
        txt(d,(633,1080),f'招聘费 ¥{fee}',29,NAVY,True,'ra')
        bottom_note(d)
    elif t<14.6:
        l=t-10.5;im=backdrop(t);d=ImageDraw.Draw(im);page_header(d,'设立部门 · 提高效率',t=t)
        # animated office backdrop
        card(d,(28,162,694,489),28,'#e7f6ff')
        # central office building showing new floors
        n=2+int(clamp(l/3.4)*3)
        for i in range(n):
            building(d,245+i*38,470,88,125+i*13,['#347eae','#4a91bf','#2f6fa7','#438ac8','#4c9ccc'][i],True)
        for i in range(3):
            x=75+int(l*55+i*151)%570
            dot(d,x,463,7,'#56b594')
        txt(d,(358,220),'公司正在壮大',40,NAVY,True,'mm')
        options=[('主营业务','创造营收','业'),('人力资源','改善招聘','人'),('采购部门','优化成本','采'),('客服部门','减少流失','客')]
        centers=[(210,604),(505,604),(210,867),(505,867)]
        for i,((name,desc,ic),(cx,cy)) in enumerate(zip(options,centers)):
            p=ease((l-i*.65)/.7)
            if p<=0:continue
            ss=.82+.18*outback(p)
            w=245*ss; h=194*ss
            card(d,(cx-w/2,cy-h/2,cx+w/2,cy+h/2),24,WHITE,True,BLUE if i==0 else None)
            dot(d,cx,cy-45,28,[BLUE,GREEN,'#ffa851','#64a9d9'][i])
            txt(d,(cx,cy-45),ic,24,WHITE,True,'mm')
            txt(d,(cx,cy+5),name,27,NAVY,True,'mm')
            txt(d,(cx,cy+44),desc,21,MUTED,False,'mm')
            if p>.65:
                dot(d,cx+98,cy-66,16,GREEN);txt(d,(cx+98,cy-66),'✓',19,WHITE,True,'mm')
        # animated collaboration line between dept cards
        if l>2.5:
            frac=ease((l-2.5)/1.2)
            d.line((345,600,345+35*frac,600),fill=GREEN,width=6)
            d.line((355,700,355,700+83*frac),fill=GREEN,width=6)
        pill(d,(125,1123,595,1195),f'已建立 {1+int(l>.7)+int(l>1.35)+int(l>2.0)} 个部门',BLUE,WHITE,29)
        bottom_note(d)
    elif t<18.8:
        l=t-14.6;im=backdrop(t);d=ImageDraw.Draw(im);page_header(d,'自动经营 · 收入增长',t=t)
        card(d,(28,160,695,411),28)
        txt(d,(67,210),'第 3 年 · 经营进度',30,NAVY,True)
        progress(d,66,267,578,((l*.7)%1),BLUE)
        pill(d,(77,324,247,385),'自动经营中', '#e8f9f3','#168763',22)
        txt(d,(653,355),'5× 加速',27,BLUE,True,'rm')
        card(d,(28,453,695,1006),28)
        txt(d,(65,492),'年度营收趋势',37,NAVY,True)
        base=925
        d.line((80,base,655,base),fill='#a9bfd8',width=3)
        vals=[80,120,160,220,250]
        p=ease(l/3.2)
        for i,v in enumerate(vals):
            x=98+i*113
            b=(v/260)*180*clamp(p*5-i)
            rr(d,(x,base-b,x+66,base),8,('#67c3dc' if i<3 else BLUE))
            txt(d,(x+32,base+23),f'第{i+1}年',20,MUTED,False,'mt')
            if b>50:txt(d,(x+33,base-b-24),f'{v}万',20,BLUE,True,'mm')
        profit=int(3.8+lerp(0,34.5,ease(l/3.6)))
        txt(d,(80,616),f'利润 +{profit:.1f} 万',43,GREEN,True)
        txt(d,(80,695),'员工与部门共同影响收益',22,MUTED)
        card(d,(48,1052,675,1166),25,'#e2f4ef')
        txt(d,(80,1108),'经营状态',27,NAVY,True,'lm')
        txt(d,(639,1108),'持续盈利  ▲',30,'#16866a',True,'rm')
        bottom_note(d)
    elif t<22.1:
        l=t-18.8;im=backdrop(t,night=True);d=ImageDraw.Draw(im)
        d.rectangle((0,0,W,114),fill='#562f4f')
        txt(d,(38,59),'突发市场波动！',44,WHITE,True,'lm')
        card(d,(28,165,692,1020),30,'#fffaf9')
        # red graph falling with smoothly drawn movement
        txt(d,(66,230),'订单需求突然下降',39,'#ae4251',True)
        d.line((85,557,643,557),fill='#e4cbd2',width=3)
        pts=[(92,342),(185,371),(277,346),(364,431),(451,417),(555,527),(626,541)]
        cut=1+int(clamp(l/1.3)*(len(pts)-1))
        if cut>=2:arrow(d,pts[:cut],11,'#e65b6a')
        for x,y in pts[:cut]:dot(d,x,y,6,'#e65b6a')
        txt(d,(66,634),'本年预计利润',27,MUTED)
        p=ease((l-.4)/1.2)
        txt(d,(653,645),f'−{7.6*p:.1f} 万',44,'#cb4656',True,'rm')
        txt(d,(66,725),'当前现金',27,MUTED)
        txt(d,(653,725),f'{30-7.6*p:.1f} 万',35,NAVY,True,'rm')
        d.line((63,779,657,779),fill='#e2e8f0',width=2)
        txt(d,(66,827),'CEO做出经营调整',31,NAVY,True)
        pill(d,(67,876,335,950),'控制部门费用', '#e2f5ef','#158268',23)
        pill(d,(350,876,654,950),'暂停非必要招聘', '#e2f5ef','#158268',23)
        txt(d,(357,1096),'亏损不等于破产',40,WHITE,True,'mm')
        txt(d,(357,1161),'保留现金，准备下一年',24,'#d6e8f5',False,'mm')
    elif t<24.5:
        l=t-22.1;im=backdrop(t);d=ImageDraw.Draw(im);page_header(d,'调整策略 · 重新盈利',t=t)
        card(d,(38,169,684,766),30)
        txt(d,(360,218),'经营正在恢复',41,NAVY,True,'mm')
        d.line((72,660,657,660),fill='#bad0e3',width=3)
        pts=[(95,582),(165,612),(230,566),(305,514),(382,480),(467,408),(558,356),(630,284)]
        n=max(2,round(ease(l/1.6)*(len(pts)-1))+1)
        arrow(d,pts[:n],11,GREEN)
        for x,y in pts[:n]:dot(d,x,y,8,TEAL)
        txt(d,(77,694),'预计年度利润',25,MUTED)
        val=lerp(-7.6,12.4,ease(l/1.6))
        txt(d,(641,704),f'{"+" if val>=0 else "−"}{abs(val):.1f}万',39,GREEN if val>=0 else '#d04e5d',True,'rm')
        card(d,(38,813,684,1024),28,'#e6f5fc')
        txt(d,(77,864),'企业总资产排名',31,NAVY,True)
        txt(d,(360,937),f'第 {int(5-2*ease(l/1.8))} 名',56,BLUE,True,'mm')
        pill(d,(145,1072,576,1150),'连续盈利，稳步成长',BLUE,WHITE,29)
        bottom_note(d)
    else:
        l=t-24.5;im=backdrop(t)
        d=ImageDraw.Draw(im)
        # same city keeps moving, final brand emergence with character
        for i,(x,hh) in enumerate([(79,275),(245,400),(435,340),(555,280)]):building(d,x,875,124,hh,'#3779b8',True)
        person(d,300+math.sin(l*4)*4,1044,1.05,walk=0,arm_raise=True)
        draw_logo(d,360,191,1.2)
        txt(d,(360,363),'从第一家公司开始',46,NAVY,True,'mm')
        d.line((177,402,542,402),fill=GREEN,width=8)
        txt(d,(360,1141),'创业 · 招聘 · 经营 · 成长',28,NAVY,True,'mm')
        bottom_note(d)
    return im

def make_audio():
    import scipy.signal as sig
    SR=32000; dur=DURATION;N=int(SR*dur)
    audio=np.zeros(N,dtype=np.float32)
    # original simple upbeat synth loop; original composition generated for this project
    bpm=114; beat=60/bpm
    chords=[(261.63,329.63,392.0,493.88),(220.,261.63,329.63,392.0),(174.61,220.,261.63,349.23),(196.,246.94,293.66,392.)]
    def put_tone(start,duration,freq,amp=.04):
        a=int(start*SR); b=min(N,a+int(duration*SR))
        if a>=N or b<=a:return
        tt=np.arange(b-a,dtype=np.float32)/SR
        env=np.minimum(1,tt/.025)*np.exp(-tt/max(.1,duration*.67))
        tone=np.sin(2*np.pi*freq*tt)+.24*np.sin(4*np.pi*freq*tt)
        audio[a:b]+= (tone*env*amp).astype(np.float32)
    def put_perc(start,typ='kick',amp=.06):
        a=int(start*SR);b=min(N,a+int(.19*SR))
        if a>=N or b<=a:return
        tt=np.arange(b-a,dtype=np.float32)/SR
        if typ=='kick':
            s=np.sin(2*np.pi*(85*tt-55*tt*tt))*np.exp(-tt*33)
        elif typ=='hat':
            rg=np.random.default_rng(520+int(start*SR));s=rg.standard_normal(len(tt))*np.exp(-tt*70)*.4
        else:
            rg=np.random.default_rng(892+int(start*SR));s=rg.standard_normal(len(tt))*np.exp(-tt*26)*.65
        audio[a:b]+= (s*amp).astype(np.float32)
    for i in range(int(DURATION/(beat*4))+1):
        chord=chords[i%4]
        base=i*beat*4
        for j in range(8):
            k=chord[[0,1,2,1,3,2,1,2][j]]
            put_tone(base+j*beat/2,.26,k,amp=.033)
        for j in range(4):
            st=base+j*beat
            put_perc(st,'kick',.13)
            put_perc(st+beat/2,'hat',.08)
            if j%2==1:put_perc(st,'snare',.055)
    # short click/fx synchronous with screen actions
    for sec in [3.7,4.4,5.3,7.2,8.0,8.9,9.7,10.7,11.6,12.4,13.3,15.1,16.4,17.4,19.0,21.4,22.2,23.4,24.6]:
        put_tone(sec,.12,650,.075)
        put_tone(sec+.035,.13,930,.045)
    audio=np.tanh(audio*1.1)
    # fade both ends
    fade=min(int(.7*SR),N//8)
    audio[:fade]*=np.linspace(0,1,fade)
    audio[-fade:]*=np.linspace(1,0,fade)
    path=str(OUT/'original_music.wav')
    with wave.open(path,'wb') as wf:
        wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(SR)
        wf.writeframes((np.int16(audio*28000)).tobytes())
    return path

if __name__=='__main__':
    import sys,time
    start=__import__('time').time()
    audiopath=make_audio()
    outfile=str(OUT/'CEO_Animated_Promo_9x16_720x1280_26s.mp4')
    cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(FPS),'-i','pipe:0','-i',audiopath,'-c:v','libx264','-preset','ultrafast','-crf','21','-pix_fmt','yuv420p','-r',str(FPS),'-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',outfile]
    ff=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    secs=[0,4.4,8.6,12.4,16.4,20.,22.8,25.2]
    ss=[]
    for i in range(FPS*DURATION):
        t=i/FPS
        im=scene(t)
        # Cinematic flash cut: each scene is in continuous motion; avoid slide-like crossfade.
        bounds=[3.3,6.7,10.5,14.6,18.8,22.1,24.5]
        pulse=max([max(0,1-abs(t-b)/.16) for b in bounds])
        if pulse>0:
            flash=Image.new('RGB',(W,H),'#d7f6ff')
            im=Image.blend(im,flash,.68*pulse)
        if any(abs(t-x)<1/(FPS*2) for x in secs):
            fn=OUT/f'keyframe_{len(ss)+1:02d}.jpg'
            im.save(fn,quality=90)
            ss.append(fn)
        try:ff.stdin.write(im.tobytes())
        except BrokenPipeError:
            err=ff.stderr.read().decode();print(err);raise
        if i%96==0:print('render',i,'/',FPS*DURATION,'time',round(__import__('time').time()-start,1),flush=True)
    ff.stdin.close(); code=ff.wait();err=ff.stderr.read().decode()
    if code:raise RuntimeError(err)
    print('video saved',outfile,os.path.getsize(outfile),'sec',__import__('time').time()-start)
