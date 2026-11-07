"""Fetch RSS directly from publishers. No keys, proxies, scraping, or invented headlines."""
import concurrent.futures, datetime, email.utils, html, json, re, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
SOURCES=[
 ('Federal Reserve','https://www.federalreserve.gov/feeds/press_monetary.xml','https://www.federalreserve.gov/newsevents.htm',6),
 ('BLS','https://www.bls.gov/feed/bls_latest.rss','https://www.bls.gov/bls/newsrels.htm',6),
 ('BEA','https://apps.bea.gov/rss/rss.xml','https://www.bea.gov/news',6),
 ('BBC Business','https://feeds.bbci.co.uk/news/business/rss.xml','https://www.bbc.com/news/business',1),
]
def clean(value,limit):
 return ' '.join(html.unescape(re.sub('<[^>]+>',' ',value or '')).split())[:limit]
def fetch(source):
 name,url,homepage,limit=source
 try:
  request=urllib.request.Request(url,headers={'User-Agent':'SataryPractice/1.0 RSS reader (+https://raminsatary.github.io/Satary/)'})
  with urllib.request.urlopen(request,timeout=20) as response: raw=response.read(2_000_001)
  if len(raw)>2_000_000: raise ValueError('Feed exceeded size limit')
  root=ET.fromstring(raw);items=[]
  for node in root.findall('.//item')[:limit]:
   link=(node.findtext('link') or '').strip()
   if not link.startswith('https://'): continue
   date=None
   try: date=email.utils.parsedate_to_datetime(node.findtext('pubDate') or '').astimezone(datetime.timezone.utc).isoformat()
   except (ValueError,TypeError): pass
   title=clean(node.findtext('title'),200)
   if name=='BBC Business': title=' '.join(title.split()[:18])
   items.append({'source':name,'title':title,'summary':clean(node.findtext('description'),360) if name!='BBC Business' else '', 'url':link,'publishedAt':date})
  if not items: raise ValueError('No RSS items returned')
  return {'name':name,'url':homepage,'status':'ok','count':len(items)},items
 except Exception as exc: return {'name':name,'url':homepage,'status':'unavailable','error':str(exc)[:140]},[]
def main():
 output={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':[],'items':[]}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for source,items in pool.map(fetch,SOURCES):output['sources'].append(source);output['items'].extend(items)
 if not output['items']: raise RuntimeError('All sources failed; existing snapshot is preserved.')
 output['items'].sort(key=lambda x:x['publishedAt'] or '',reverse=True)
 Path('data').mkdir(exist_ok=True);Path('data/briefing.json').write_text(json.dumps(output,indent=2),encoding='utf-8')
 print(json.dumps({'generatedAt':output['generatedAt'],'sources':output['sources'],'items':len(output['items'])}))
if __name__=='__main__':main()
