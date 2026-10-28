import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name!=='/'&&name!=='/index.html'&&!/^\/src\/[a-z]+\.(js|css)$/.test(name)){res.writeHead(404);res.end('Not found');return}const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',({'html':'text/html','css':'text/css','js':'text/javascript','json':'application/json'})[file.split('.').pop()]||'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end('Not found')}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Satary running on port '+(process.env.PORT||3000)));
