import concurrent.futures,datetime,json,pathlib,urllib.parse,urllib.request
from bs4 import BeautifulSoup
old=json.load(open('docs/research/search-results.json'))
queries=[r['query'] for r in old]
# Add exact source discovery and intent distinctions to the initial research.
queries += ['御代田町 葬祭費 国民健康保険','小諸市 葬祭費 国民健康保険','立科町 葬祭費 国民健康保険','富岡市 火葬場 かぶら聖苑','上田市 火葬場 大星斎場 依田窪斎場','家族葬 病院 遺体搬送 長野','葬儀 生活改善方式 佐久 小諸','樹木葬 合祀 取り出し 契約 国民生活センター','互助会 解約 手数料 国民生活センター','死亡届 法務省 7日','火葬 24時間 墓地 埋葬 法律','協会けんぽ 埋葬料 5万円']
def collect(pair):
 i,q=pair;url='https://search.yahoo.co.jp/search?'+urllib.parse.urlencode({'p':q,'ei':'UTF-8'})
 try:
  raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read();pathlib.Path('.local/research/yahoo-'+str(i)+'.html').write_bytes(raw)
  s=BeautifulSoup(raw,'html.parser');results=[]
  for li in s.select('ol li'):
   a=li.find('a',href=True)
   if not a or not a['href'].startswith('https://'):continue
   snip=li.find('div')
   results.append({'title':a.get_text(' ',strip=True),'url':a['href'],'snippet':snip.get_text(' ',strip=True)[:350] if snip else ''})
  return {'query':q,'engine':'Yahoo! JAPAN','retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results[:10],'status':'ok' if results else 'no-results-or-challenge'}
 except Exception as e:return {'query':q,'engine':'Yahoo! JAPAN','status':'error','error':str(e),'results':[]}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:data=list(pool.map(collect,enumerate(queries)))
pathlib.Path('docs/research/yahoo-results.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
print(json.dumps({'queries':len(data),'successful':sum(bool(x['results']) for x in data)}))
for r in data:
 if any(k in r['query'] for k in ['葬祭費','火葬場','国民生活','法務省','協会けんぽ','法律']):
  print(r['query'],r['status'])
  for t in r['results']:
   if any(s in t['url'] for s in ['lg.jp','nagano.jp','kouiki','kokusen','gov','kyoukaikenpo','areasaku']): print(t['title'],t['url'],t['snippet'])
