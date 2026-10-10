"""Build an editable, dependency-free OOXML investor deck and HTML preview."""
from pathlib import Path
from xml.sax.saxutils import escape as esc
from zipfile import ZipFile, ZIP_DEFLATED
import html, shutil, json

ROOT = Path(__file__).resolve().parent
W, H = 13.333333, 7.5
C = dict(bg='F4EDE4', paper='FFFBF5', ink='2B1F2E', muted='6F6272', clay='E2683A', rose='D9B4BE', iris='5B4BD1', moss='4F8A5B', dark='1B151E', line='DCCFC3')
slides=[]
def slide(label, title=None, dark=False):
    s=dict(bg=C['dark'] if dark else C['bg'], els=[], notes='', label=label)
    slides.append(s)
    text(s,.55,.27,10,.25,label.upper(),11,'clay',True)
    text(s,11.8,.27,1,.25,f'{len(slides):02d} / 07',11,'muted')
    if title: text(s,.55,.83,12.1,1.2,title,32,'paper' if dark else 'ink',True)
    text(s,.55,7.1,11,.2,'КУБЫШКА   /   liderlar',9,'muted')
    return s
def text(s,x,y,w,h,t,size=20,color='ink',bold=False):
    s['els'].append(dict(kind='text',x=x,y=y,w=w,h=h,t=t,size=size,color=C.get(color,color),bold=bold))
def shape(s,x,y,w,h,color,geom='roundRect'):
    s['els'].append(dict(kind='shape',x=x,y=y,w=w,h=h,color=C.get(color,color),geom=geom))
def pet(s,x,y,k=1):
    shape(s,x+.17*k,y+2.4*k,2.65*k,.25*k,'DCCFC3','ellipse')
    shape(s,x+.3*k,y+.6*k,2.4*k,2*k,'rose','ellipse')
    shape(s,x+.98*k,y+.46*k,1.05*k,.3*k,'B97866','ellipse')
    shape(s,x+1.36*k,y+.27*k,.26*k,.4*k,'B97866','ellipse')
    for xx in [1.02,1.84]:
        shape(s,x+xx*k,y+1.32*k,.39*k,.44*k,'ink','ellipse')
        shape(s,x+(xx+.11)*k,y+1.35*k,.13*k,.13*k,'paper','ellipse')
    for xx in [.71,2.21]: shape(s,x+xx*k,y+1.79*k,.3*k,.13*k,'D98D9C','ellipse')
    shape(s,x+1.46*k,y+1.94*k,.3*k,.13*k,'ink','ellipse')
def img(s,x,y,w,h,name,crop=None):
    shutil.copyfile(ROOT.parent/'.tmp'/name,ROOT/name)
    s['els'].append(dict(kind='image',x=x,y=y,w=w,h=h,name=name,crop=crop or [0,0,0,0]))

s=slide('Питч для инвесторов · 3 минуты')
text(s,.55,1.18,8,.8,'Кубышка',52,'ink',True)
text(s,.6,2.34,7.3,1.35,'Копишь на свою мечту.\nРастишь своего питомца.',32,'ink',True)
text(s,.6,4.04,6.8,.8,'Трекер личных финансов, который превращает накопления в ежедневную привычку.',21,'muted')
shape(s,.6,5.31,4.45,.5,'clay')
text(s,.8,5.42,4.05,.25,'РАБОТАЮЩИЙ ПРОТОТИП',13,'paper',True)
pet(s,8.7,1.8,1.18)
text(s,.6,6.19,11.8,.55,'Команда liderlar\nЁрмухаммедов Аброр · Жураева Робия',14,'muted')
s['notes']='[0:00–0:20] Мы — команда liderlar. Кубышка — трекер личных финансов с питомцем, который растёт вместе с накоплениями. Мы хотим сделать заботу о деньгах ежедневной привычкой: человек видит результат сегодня, даже если до большой цели ещё несколько месяцев. Покажем работающий прототип.'

s=slide('01 · Проблема','До мечты — месяцы.\nОт покупки — радость сейчас.')
text(s,.6,2.38,4,.5,'Для кого начинаем',22,'clay',True)
text(s,.6,3.02,3.8,1.8,'Молодые люди с первым стабильным доходом, которые хотят собрать финансовую подушку или накопить на цель.',22)
for yy,num,tt,body in [(2.48,'01','Учёт требует усилий','Внести расход легко отложить.'),(3.85,'02','Прогресс ощущается поздно','Небольшой взнос теряется на фоне большой цели.'),(5.22,'03','Не хватает повода вернуться','Цифры показывают итог, но не дают ежедневной награды.')]:
    text(s,5.12,yy,.65,.5,num,24,'clay',True)
    text(s,6.0,yy,6.5,.45,tt,23,'ink',True)
    text(s,6.0,yy+.55,6.3,.65,body,19,'muted')
text(s,.6,6.55,11.8,.3,'Стартовый сегмент и проблема — гипотезы для проверки в интервью и пилоте.',12,'muted')
s['notes']='[0:20–0:45] Начинаем с людей, которые получают первый стабильный доход и хотят накопить на подушку или конкретную мечту. Их задача — не просто увидеть расходы, а регулярно возвращаться к своим деньгам. Покупка радует сразу, а результат накопления заметен гораздо позже. Наша гипотеза: эмоциональная обратная связь поможет сократить этот разрыв.'

s=slide('02 · Продукт','Понятный ориентир на день.\nЖивой повод вернуться.',True)
img(s,.6,2.48,8.45,3.79,'stage4-today-dark-final.png',[18600,18710,1550,41660])
text(s,9.45,2.55,3.1,.45,'Бюджет на сегодня',23,'paper',True)
text(s,9.45,3.13,3.05,1.0,'Ориентир с учётом дохода, цели и расходов.',19,'DCCFC3')
text(s,9.45,4.43,3.1,.45,'Отчёт за 10 секунд',23,'paper',True)
text(s,9.45,5.03,3.05,1.1,'Ежедневный отчёт кормит питомца и меняет его настроение.',19,'DCCFC3')
text(s,.6,6.55,11.5,.28,'Реальный экран прототипа · тестовые данные · ручной учёт, без перевода денег',12,'DCCFC3')
s['notes']='[0:45–1:15] Это реальный экран прототипа с тестовыми данными. Пользователь видит, сколько может потратить сегодня с учётом дохода, цели и уже записанных расходов. Короткий отчёт за день кормит питомца и меняет его настроение. Расходы также можно увидеть в часах своей работы. Так абстрактные суммы получают личный смысл. Сейчас деньги учитываются вручную: приложение не хранит и не переводит средства.'

s=slide('03 · Отличие','Накопления становятся видимыми')
pet(s,.7,2.05,1.05)
shape(s,4.4,2.35,8.25,1.05,'paper')
text(s,4.65,2.55,7.7,.6,'Взнос в цель → новый образ питомца',25,'ink',True)
for xx,pct,tt in [(4.65,'15%','Шарф'),(6.63,'45%','Очки'),(8.61,'90%','Корона'),(10.6,'100%','Эволюция')]:
    text(s,xx,3.85,1.9,.58,pct,28,'clay',True)
    text(s,xx,4.53,1.9,.35,tt,17,'muted')
shape(s,.6,5.62,12.05,.97,'ink')
text(s,.87,5.85,11.5,.55,'Снял накопления — костюм ждёт в сундуке. Вернул — снова доступен.',20,'paper')
text(s,.8,5.06,3.1,.3,'Одна цель. Один питомец.',15,'muted')
s['notes']='[1:15–1:40] Главная механика — связь внешнего вида питомца с прогрессом цели. На пятнадцати процентах появляется шарф, дальше открываются другие костюмы, а завершение цели запускает эволюцию. Если снять накопления и опуститься ниже порога, костюм отправится в сундук до восстановления прогресса. Ежедневная забота и накопления работают вместе, а пропуск дня не обнуляет всю историю заботы.'

s=slide('04 · Бизнес-модель · гипотеза','Бесплатная привычка → платная глубина')
shape(s,.6,2.3,5.85,3.48,'paper')
text(s,.88,2.63,5.2,.45,'Бесплатно',28,'ink',True)
text(s,.88,3.42,5.1,1.65,'Учёт доходов и расходов\nЦель и базовый питомец\nЕжедневный отчёт',23)
shape(s,6.7,2.3,5.95,3.48,'ink')
text(s,7.0,2.63,5.2,.45,'Подписка — проверить',26,'paper',True)
text(s,7.0,3.42,5.1,1.65,'Расширенная аналитика\nПерсональные сценарии накопления\nДополнительное оформление',22,'paper')
text(s,.65,6.12,11.8,.6,'Первый канал: студенческие сообщества и авторы о личных финансах.\nЦену, готовность платить и стоимость привлечения проверим на пилоте.',17,'muted')
s['notes']='[1:40–2:05] Модель монетизации пока гипотеза: базовый учёт, цель и питомец остаются бесплатными. За подписку можно предложить расширенную аналитику, сценарии накопления и дополнительное оформление, не продавая прогресс цели. Первых пользователей планируем привлекать через студенческие сообщества и авторов о личных финансах. Цену и готовность платить нужно проверить; подтверждённой выручки пока нет.'

s=slide('05 · Готовность','Основной цикл уже работает')
text(s,.6,2.35,5.7,.45,'Можно показать сегодня',25,'moss',True)
text(s,.6,3.08,5.5,2.1,'Регистрация и знакомство с питомцем\nУчёт операций и бюджет на день\nЕжедневный отчёт и настроение\nЦель, гардероб, сундук и прогноз',21)
text(s,7.03,2.35,5.5,.45,'Дальше по ТЗ',25,'clay',True)
text(s,7.03,3.08,5.5,2.1,'Музей несделанных покупок\nПоиск неиспользуемых подписок\nСравнение корзины «Дешевле рядом»\nПубличный лендинг',21)
shape(s,.6,5.65,12.05,.95,'paper')
text(s,.87,5.91,11.5,.45,'React + TypeScript  /  Express + SQLite  /  56 серверных тестов пройдены',19,'ink',True)
s['notes']='[2:05–2:30] У нас уже работает основной цикл: регистрация, знакомство с питомцем, операции, бюджет на день, ежедневный отчёт и цель с костюмами, сундуком и прогнозом. Серверная логика проверена пятьюдесятью шестью тестами. Следом по техническому заданию идут музей несделанных покупок, подписки и сравнение корзины по магазинам. Эти функции ещё в планах, и мы не выдаём их за готовые.'

s=slide('06 · Следующий шаг','Ищем партнёра для пилота',True)
text(s,.6,2.22,3.2,.94,'100',56,'clay',True)
text(s,.65,3.16,3.6,.45,'пользователей',24,'paper',True)
text(s,.65,3.82,3.55,.6,'4 недели наблюдения',20,'DCCFC3')
text(s,4.7,2.37,7.8,.45,'Проверим три вещи',26,'paper',True)
text(s,4.7,3.14,7.8,1.7,'Возвращаются ли на 7-й и 28-й день?\nРастёт ли регулярность взносов в цель?\nГотовы ли платить за расширенные функции?',22,'paper')
text(s,.65,5.35,11.8,.65,'Нужны доступ к аудитории и экспертиза в росте продукта.',25,'paper',True)
text(s,.65,6.2,11.8,.52,'liderlar  ·  Ёрмухаммедов Аброр  ·  Жураева Робия\nПлан пилота; пользовательские и финансовые метрики ещё не подтверждены.',14,'DCCFC3')
s['notes']='[2:30–3:00] Следующий шаг — пилот на сто пользователей в течение четырёх недель. Измерим возврат на седьмой и двадцать восьмой день, регулярность взносов и готовность платить. Эти данные помогут решить, что развивать и стоит ли масштабировать привлечение. Сейчас ищем партнёра, который поможет с доступом к аудитории и экспертизой в росте. Кубышка: деньги, которые ты не потратил, кого-то кормят. Спасибо.'

NS='http://schemas.openxmlformats.org'
A=f'{NS}/drawingml/2006/main'; P=f'{NS}/presentationml/2006/main'; R=f'{NS}/officeDocument/2006/relationships'
def emu(v):return str(round(v*914400))
def xfrm(e):return f'<a:xfrm><a:off x="{emu(e["x"])}" y="{emu(e["y"])}"/><a:ext cx="{emu(e["w"])}" cy="{emu(e["h"])}"/></a:xfrm>'
def rels(items):return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="{i}" Type="{R}/{t}" Target="{target}"/>' for i,t,target in items)+'</Relationships>'
def paras(t,size,col,bold=False):
    return ''.join(f'<a:p><a:pPr><a:lnSpc><a:spcPct val="115000"/></a:lnSpc></a:pPr><a:r><a:rPr lang="ru-RU" sz="{int(size*100)}" b="{int(bold)}"><a:solidFill><a:srgbClr val="{col}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>{esc(line)}</a:t></a:r><a:endParaRPr lang="ru-RU" sz="{int(size*100)}"/></a:p>' for line in t.split('\n'))
GROUP='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
def xmlslide(s,ix):
    out=[]; rr=[('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),('rId2','notesSlide',f'../notesSlides/notesSlide{ix}.xml')]
    for id,e in enumerate(s['els'],2):
        nv=f'<p:cNvPr id="{id}" name="Element {id}"/>'
        if e['kind']=='image':
            rid=f'rId{id+2}'; rr.append((rid,'image','../media/'+e['name']))
            l,t,r,b=e['crop']
            out.append(f'<p:pic><p:nvPicPr>{nv}<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="{rid}"/><a:srcRect l="{l}" t="{t}" r="{r}" b="{b}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>{xfrm(e)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>')
        else:
            istext=e['kind']=='text'
            fill='<a:noFill/>' if istext else f'<a:solidFill><a:srgbClr val="{e["color"]}"/></a:solidFill>'
            geo='rect' if istext else e['geom']
            body=f'<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/><a:lstStyle/>{paras(e["t"],e["size"],e["color"],e["bold"])}</p:txBody>' if istext else ''
            out.append(f'<p:sp><p:nvSpPr>{nv}<p:cNvSpPr txBox="{int(istext)}"/><p:nvPr/></p:nvSpPr><p:spPr>{xfrm(e)}<a:prstGeom prst="{geo}"><a:avLst/></a:prstGeom>{fill}<a:ln><a:noFill/></a:ln></p:spPr>{body}</p:sp>')
    return f'<p:sld xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="{s["bg"]}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>{GROUP}{"".join(out)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',rels(rr)

files={}
def add(path,body):files[path]=body
add('_rels/.rels',rels([('rId1','officeDocument','ppt/presentation.xml')]))
add('ppt/presentation.xml',f'<p:presentation xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>'+''.join(f'<p:sldId id="{255+i}" r:id="rId{i+2}"/>' for i in range(1,8))+f'</p:sldIdLst><p:sldSz cx="{emu(W)}" cy="{emu(H)}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>')
add('ppt/_rels/presentation.xml.rels',rels([('rId1','slideMaster','slideMasters/slideMaster1.xml'),('rId2','notesMaster','notesMasters/notesMaster1.xml')]+[(f'rId{i+2}','slide',f'slides/slide{i}.xml') for i in range(1,8)]))
cmap='<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
add('ppt/slideMasters/slideMaster1.xml',f'<p:sldMaster xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"><p:cSld><p:spTree>{GROUP}</p:spTree></p:cSld>{cmap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>')
add('ppt/slideMasters/_rels/slideMaster1.xml.rels',rels([('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),('rId2','theme','../theme/theme1.xml')]))
add('ppt/slideLayouts/slideLayout1.xml',f'<p:sldLayout xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>{GROUP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>')
add('ppt/slideLayouts/_rels/slideLayout1.xml.rels',rels([('rId1','slideMaster','../slideMasters/slideMaster1.xml')]))
add('ppt/notesMasters/notesMaster1.xml',f'<p:notesMaster xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"><p:cSld><p:spTree>{GROUP}</p:spTree></p:cSld>{cmap}<p:notesStyle/></p:notesMaster>')
add('ppt/notesMasters/_rels/notesMaster1.xml.rels',rels([('rId1','theme','../theme/theme1.xml')]))
colors={'dk1':C['ink'],'lt1':C['paper'],'dk2':C['muted'],'lt2':C['bg'],'accent1':C['clay'],'accent2':C['iris'],'accent3':C['moss'],'accent4':C['rose'],'accent5':'E7B23C','accent6':'B94E25','hlink':C['iris'],'folHlink':C['clay']}
fill='<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
add('ppt/theme/theme1.xml',f'<a:theme xmlns:a="{A}" name="Kubyshka"><a:themeElements><a:clrScheme name="Clay">'+''.join(f'<a:{k}><a:srgbClr val="{v}"/></a:{k}>' for k,v in colors.items())+'</a:clrScheme><a:fontScheme name="Portable"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Minimal"><a:fillStyleLst>'+fill*3+'</a:fillStyleLst><a:lnStyleLst>'+('<a:ln w="9525">'+fill+'<a:prstDash val="solid"/></a:ln>')*3+'</a:lnStyleLst><a:effectStyleLst>'+('<a:effectStyle><a:effectLst/></a:effectStyle>')*3+'</a:effectStyleLst><a:bgFillStyleLst>'+fill*3+'</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>')
for i,s in enumerate(slides,1):
    sx,sr=xmlslide(s,i); add(f'ppt/slides/slide{i}.xml',sx);add(f'ppt/slides/_rels/slide{i}.xml.rels',sr)
    add(f'ppt/notesSlides/notesSlide{i}.xml',f'<p:notes xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"><p:cSld><p:spTree>{GROUP}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>{paras(s["notes"],14,C["ink"])}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>')
    add(f'ppt/notesSlides/_rels/notesSlide{i}.xml.rels',rels([('rId1','notesMaster','../notesMasters/notesMaster1.xml'),('rId2','slide',f'../slides/slide{i}.xml')]))
types={'presentation':'presentation','slideMasters':'slideMaster','slideLayouts':'slideLayout','slides':'slide','notesSlides':'notesSlide','notesMasters':'notesMaster'}
ov=[]
for f in files:
    if not f.endswith('.xml'):continue
    typ='application/vnd.openxmlformats-officedocument.theme+xml' if '/theme/' in f else 'application/vnd.openxmlformats-officedocument.presentationml.'+('presentation.main' if f=='ppt/presentation.xml' else types[f.split('/')[1]])+'+xml'
    ov.append(f'<Override PartName="/{f}" ContentType="{typ}"/>')
add('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/>'+''.join(ov)+'</Types>')
with ZipFile(ROOT/'Кубышка — liderlar.pptx','w',ZIP_DEFLATED) as z:
    for f,v in files.items():z.writestr(f,'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+v if not v.startswith('<?xml') else v)
    for f in ROOT.glob('*.png'):z.write(f,'ppt/media/'+f.name)

# Same layout, in browser pixels, for a portable preview and print-to-PDF.
pages=[]
for s in slides:
    els=[]
    for e in s['els']:
        st=f'left:{e["x"]*96}px;top:{e["y"]*96}px;width:{e["w"]*96}px;height:{e["h"]*96}px;'
        if e['kind']=='text':els.append(f'<div class="el" style="{st}color:#{e["color"]};font-size:{e["size"]*96/72}px;font-weight:{700 if e["bold"] else 400};">{html.escape(e["t"]).replace(chr(10),"<br>")}</div>')
        elif e['kind']=='shape':els.append(f'<div class="el" style="{st}background:#{e["color"]};border-radius:{"50%" if e["geom"]=="ellipse" else "15px"};"></div>')
        else:
            l,t,r,b=[v/100000 for v in e['crop']]; iw=e['w']*96/(1-l-r);ih=e['h']*96/(1-t-b)
            els.append(f'<div class="el" style="{st}overflow:hidden"><img src="{e["name"]}" style="position:absolute;width:{iw}px;height:{ih}px;left:{-l*iw}px;top:{-t*ih}px"></div>')
    pages.append(f'<section style="background:#{s["bg"]}">'+''.join(els)+'</section>')
(ROOT/'preview.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Кубышка · liderlar</title><style>*{box-sizing:border-box}body{margin:0;background:#999;font-family:Arial,sans-serif}section{position:relative;width:1280px;height:720px;overflow:hidden;margin:0 auto 20px;page-break-after:always}.el{position:absolute;line-height:1.15}@media print{@page{size:13.333333in 7.5in;margin:0}body{background:white}section{margin:0}}</style>'+''.join(pages)+'</html>',encoding='utf-8')
(ROOT/'Текст выступления.md').write_text('# Кубышка — выступление на 3 минуты\n\nКоманда **liderlar**: Ёрмухаммедов Аброр, Жураева Робия.\n\n'+ '\n\n'.join(f'## Слайд {i} · {s["label"]}\n\n{s["notes"]}' for i,s in enumerate(slides,1))+'\n\n## Перед выступлением\n\nПроведите репетицию с таймером. Слайды переключаются вручную. Текст также встроен в заметки докладчика PPTX. Интернет и живая демонстрация для питча не нужны. При двух докладчиках: Аброр — слайды 1–4, Робия — 5–7 (распределение можно поменять).\n\n## Что является предложением, а не фактом из ТЗ\n\nСтартовый сегмент, подписка и её наполнение, каналы привлечения, пилот на 100 человек за 4 недели и запрос партнёру предложены для питча. Цена, выручка, спрос и влияние на накопления ещё не подтверждены. Счётчик 56 тестов относится к серверным тестам текущей реализации. На экране продукта показаны тестовые данные.\n',encoding='utf-8')
print('Created PPTX, preview.html, speaker script')
