from pathlib import Path
import re
p=Path(__file__).parent
s=(p/'index.html').read_text(encoding='utf-8')
def js(m):
 path=m.group(1).split('?')[0]
 return '<script>'+ (p/path).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>'
s=re.sub(r'<script src="([^"]+)"></script>',js,s)
s=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(p/m.group(1).split('?')[0]).read_text(encoding='utf-8')+'</style>',s)
(p/'steel-column-offline.html').write_text(s,encoding='utf-8')
