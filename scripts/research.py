"""Read-only research collector. No credentials or claimed search volumes."""
import concurrent.futures,datetime,json,pathlib,time,urllib.parse,urllib.request
from bs4 import BeautifulSoup
ROOT=pathlib.Path('.local/research'); ROOT.mkdir(parents=True,exist_ok=True)
regions=['佐久市','上田市','小諸市','軽井沢町','御代田町','立科町','安中市','富岡市']
queries=[r+' '+k for r in regions for k in ['家族葬 葬儀','樹木葬 お墓','病院 搬送','葬祭費 公式','火葬場 公式']]
queries += ['家族葬 費用 内訳','互助会 解約 国民生活センター','墓じまい 改葬 公式','死亡届 火葬許可 公式','近くの葬儀社 長野 群馬','一日葬 直葬 違い']
def collect(pair):
 i,q=pair;url='https://html.duckduckgo.com/html/?'+urllib.parse.urlencode({'q':q,'kl':'jp-jp'})
 try:
  raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
  (ROOT/('serp-'+str(i)+'.html')).write_bytes(raw)
  soup=BeautifulSoup(raw,'html.parser'); results=[]
  for item in soup.select('.result'):
   a=item.select_one('.result__a');snippet=item.select_one('.result__snippet')
   if not a: continue
   href=a.get('href','');target=urllib.parse.parse_qs(urllib.parse.urlsplit(href).query).get('uddg',[href])[0]
   results.append({'title':a.get_text(' ',strip=True),'url':target,'snippet':snippet.get_text(' ',strip=True) if snippet else ''})
  return {'query':q,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'status':'ok' if results else 'no-results-or-challenge'}
 except Exception as e:return {'query':q,'status':'error','error':str(e),'results':[]}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 data=list(pool.map(collect,enumerate(queries)))
pathlib.Path('docs/research/search-results.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
for d in data:print(json.dumps({'query':d['query'],'status':d['status'],'top':[(x['title'],x['url']) for x in d['results'][:3]]},ensure_ascii=False))
