var ze=Object.defineProperty;var Ye=(r,e,n)=>e in r?ze(r,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):r[e]=n;var b=(r,e,n)=>Ye(r,typeof e!="symbol"?e+"":e,n);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))s(t);new MutationObserver(t=>{for(const o of t)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&s(i)}).observe(document,{childList:!0,subtree:!0});function n(t){const o={};return t.integrity&&(o.integrity=t.integrity),t.referrerPolicy&&(o.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?o.credentials="include":t.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(t){if(t.ep)return;t.ep=!0;const o=n(t);fetch(t.href,o)}})();const Ce=["#000000","#FF0000","#FFFF00","#00FF00","#00FFFF","#0000FF","#FF00FF","#FFFFFF","#808080","#C0C0C0","#FF0000","#FF7F7F","#CC0000","#CC6666","#990000","#994C4C","#7F0000","#7F3F3F","#4C0000","#4C2626","#FF3F00","#FF9F7F","#CC3300","#CC7F66","#992600","#995F4C","#7F1F00","#7F4F3F","#4C1300","#4C2F26","#FF7F00","#FFBF7F","#CC6600","#CC9966","#994C00","#99734C","#7F3F00","#7F5F3F","#4C2600","#4C3926","#FFBF00","#FFDF7F","#CC9900","#CCB266","#997300","#99864C","#7F5F00","#7F6F3F","#4C3900","#4C4326","#FFFF00","#FFFF7F","#CCCC00","#CCCC66","#999900","#99994C","#7F7F00","#7F7F3F","#4C4C00","#4C4C26","#BFFF00","#DFFF7F","#99CC00","#B2CC66","#739900","#86994C","#5F7F00","#6F7F3F","#394C00","#434C26","#7FFF00","#BFFF7F","#66CC00","#99CC66","#4C9900","#73994C","#3F7F00","#5F7F3F","#264C00","#394C26","#3FFF00","#9FFF7F","#33CC00","#7FCC66","#269900","#5F994C","#1F7F00","#4F7F3F","#134C00","#2F4C26","#00FF00","#7FFF7F","#00CC00","#66CC66","#009900","#4C994C","#007F00","#3F7F3F","#004C00","#264C26","#00FF3F","#7FFF9F","#00CC33","#66CC7F","#009926","#4C995F","#007F1F","#3F7F4F","#004C13","#264C2F","#00FF7F","#7FFFBF","#00CC66","#66CC99","#00994C","#4C9973","#007F3F","#3F7F5F","#004C26","#264C39","#00FFBF","#7FFFDF","#00CC99","#66CCB2","#009973","#4C9986","#007F5F","#3F7F6F","#004C39","#264C43","#00FFFF","#7FFFFF","#00CCCC","#66CCCC","#009999","#4C9999","#007F7F","#3F7F7F","#004C4C","#264C4C","#00BFFF","#7FDFFF","#0099CC","#66B2CC","#007399","#4C8699","#005F7F","#3F6F7F","#00394C","#26434C","#007FFF","#7FBFFF","#0066CC","#6699CC","#004C99","#4C7399","#003F7F","#3F5F7F","#00264C","#26394C","#003FFF","#7F9FFF","#0033CC","#667FCC","#002699","#4C5F99","#001F7F","#3F4F7F","#00134C","#262F4C","#0000FF","#7F7FFF","#0000CC","#6666CC","#000099","#4C4C99","#00007F","#3F3F7F","#00004C","#26264C","#3F00FF","#9F7FFF","#3300CC","#7F66CC","#260099","#5F4C99","#1F007F","#4F3F7F","#13004C","#2F264C","#7F00FF","#BF7FFF","#6600CC","#9966CC","#4C0099","#734C99","#3F007F","#5F3F7F","#26004C","#39264C","#BF00FF","#DF7FFF","#9900CC","#B266CC","#730099","#864C99","#5F007F","#6F3F7F","#39004C","#43264C","#FF00FF","#FF7FFF","#CC00CC","#CC66CC","#990099","#994C99","#7F007F","#7F3F7F","#4C004C","#4C264C","#FF00BF","#FF7FDF","#CC0099","#CC66B2","#990073","#994C86","#7F005F","#7F3F6F","#4C0039","#4C2643","#FF007F","#FF7FBF","#CC0066","#CC6699","#99004C","#994C73","#7F003F","#7F3F5F","#4C0026","#4C2639","#FF003F","#FF7F9F","#CC0033","#CC667F","#990026","#994C5F","#7F001F","#7F3F4F","#4C0013","#4C262F","#333333","#5B5B5B","#848484","#ADADAD","#D6D6D6","#FFFFFF"];function k(r,e="#FFFFFF"){if(r==null)return e;const n=Math.abs(r);return n>=0&&n<Ce.length?Ce[n]:e}function q(r,e,n){const s=a=>(a%360+360)%360,t=s(r),o=s(e),i=s(n);return Math.abs(o-i)<1e-6?!0:o<i?t>=o&&t<=i:t>=o||t<=i}function we(){return{minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function A(r,e,n){isNaN(e)||isNaN(n)||(e<r.minX&&(r.minX=e),n<r.minY&&(r.minY=n),e>r.maxX&&(r.maxX=e),n>r.maxY&&(r.maxY=n))}function Se(r){const e=we();switch(r.type){case"LINE":{const n=r;A(e,n.start.x,n.start.y),A(e,n.end.x,n.end.y);break}case"CIRCLE":{const n=r;A(e,n.center.x-n.radius,n.center.y-n.radius),A(e,n.center.x+n.radius,n.center.y+n.radius);break}case"ARC":{const n=r,s=Math.PI/180,t=n.startAngle*s,o=n.endAngle*s;A(e,n.center.x+n.radius*Math.cos(t),n.center.y+n.radius*Math.sin(t)),A(e,n.center.x+n.radius*Math.cos(o),n.center.y+n.radius*Math.sin(o)),q(0,n.startAngle,n.endAngle)&&A(e,n.center.x+n.radius,n.center.y),q(90,n.startAngle,n.endAngle)&&A(e,n.center.x,n.center.y+n.radius),q(180,n.startAngle,n.endAngle)&&A(e,n.center.x-n.radius,n.center.y),q(270,n.startAngle,n.endAngle)&&A(e,n.center.x,n.center.y-n.radius);break}case"LWPOLYLINE":case"POLYLINE":{const n=r,s=n.vertices,t=s.length;if(t===0)break;for(let o=0;o<t;o++){const i=s[o];if(A(e,i.x,i.y),i.bulge&&Math.abs(i.bulge)>1e-6){const a=o+1<t?o+1:n.isClosed?0:-1;if(a>=0){const l=s[a],f=Ae(i,l,i.bulge,16);for(const p of f)A(e,p.x,p.y)}}}break}case"ELLIPSE":{const n=r,s=n.center.x,t=n.center.y,o=n.majorAxisEndPoint.x,i=n.majorAxisEndPoint.y,a=n.axisRatio,l=Math.sqrt(o*o+Math.pow(-i*a,2)),f=Math.sqrt(i*i+Math.pow(o*a,2));A(e,s-l,t-f),A(e,s+l,t+f);break}case"TEXT":case"MTEXT":{const n=r,s=n.position.x,t=n.position.y,o=n.height||2.5,a=(n.text?n.text.length:1)*o*.65,l=(n.rotation||0)*Math.PI/180,f=Math.cos(l),p=Math.sin(l),h=[{x:0,y:0},{x:a,y:0},{x:a,y:o},{x:0,y:o}];for(const m of h){const y=m.x*f-m.y*p+s,u=m.x*p+m.y*f+t;A(e,y,u)}break}case"SPLINE":{const n=r;for(const s of n.controlPoints)A(e,s.x,s.y);break}case"SOLID":case"3DFACE":{const n=r;for(const s of n.points)A(e,s.x,s.y);break}}return e}function Me(r){const e=we();for(const n of r)n.bbox||(n.bbox=Se(n)),isFinite(n.bbox.minX)&&isFinite(n.bbox.minY)&&(A(e,n.bbox.minX,n.bbox.minY),A(e,n.bbox.maxX,n.bbox.maxY));return!isFinite(e.minX)||!isFinite(e.minY)?{minX:-100,minY:-100,maxX:100,maxY:100}:(Math.abs(e.maxX-e.minX)<1e-4&&(e.minX-=10,e.maxX+=10),Math.abs(e.maxY-e.minY)<1e-4&&(e.minY-=10,e.maxY+=10),e)}function Xe(r,e,n){if(e&&isFinite(e.minX)&&isFinite(e.maxX)&&isFinite(e.minY)&&isFinite(e.maxY)&&e.maxX-e.minX>1&&e.maxY-e.minY>1)return{minX:e.minX,minY:e.minY,maxX:e.maxX,maxY:e.maxY};const s=n||Me(r),t=r.length;if(t<50)return{...s};const o=Math.min(t,2e3),i=Math.max(1,Math.floor(t/o)),a=[],l=[];for(let g=0;g<t;g+=i){const c=r[g].bbox;c&&isFinite(c.minX)&&isFinite(c.maxX)&&(a.push((c.minX+c.maxX)/2),l.push((c.minY+c.maxY)/2))}if(a.length<10)return{...s};a.sort((g,c)=>g-c),l.sort((g,c)=>g-c);const f=a[Math.floor(a.length*.02)],p=a[Math.floor(a.length*.98)],h=l[Math.floor(l.length*.02)],m=l[Math.floor(l.length*.98)],y=Math.max((p-f)*.05,50),u=Math.max((m-h)*.05,50);return{minX:Math.max(s.minX,f-y),minY:Math.max(s.minY,h-u),maxX:Math.min(s.maxX,p+y),maxY:Math.min(s.maxY,m+u)}}class R{constructor(e=1,n=0,s=0,t=1,o=0,i=0){b(this,"a");b(this,"b");b(this,"c");b(this,"d");b(this,"tx");b(this,"ty");this.a=e,this.b=n,this.c=s,this.d=t,this.tx=o,this.ty=i}static identity(){return new R(1,0,0,1,0,0)}static translation(e,n){return new R(1,0,0,1,e,n)}static rotation(e){const n=e*Math.PI/180,s=Math.cos(n),t=Math.sin(n);return new R(s,t,-t,s,0,0)}static scale(e,n){return new R(e,0,0,n,0,0)}multiply(e){return new R(this.a*e.a+this.c*e.b,this.b*e.a+this.d*e.b,this.a*e.c+this.c*e.d,this.b*e.c+this.d*e.d,this.a*e.tx+this.c*e.ty+this.tx,this.b*e.tx+this.d*e.ty+this.ty)}transformPoint(e){return{x:this.a*e.x+this.c*e.y+this.tx,y:this.b*e.x+this.d*e.y+this.ty}}transformVector(e){return{x:this.a*e.x+this.c*e.y,y:this.b*e.x+this.d*e.y}}determinant(){return this.a*this.d-this.c*this.b}}function ce(r){if(!r)return"";let e=r;return e=e.replace(/\\P/g,`
`),e=e.replace(/\\X/g,`
`),e=e.replace(/\\A[0-2];/g,""),e=e.replace(/\\C\d+;/g,""),e=e.replace(/\\c\d+;/g,""),e=e.replace(/\\f[^;]+;/g,""),e=e.replace(/\\F[^;]+;/g,""),e=e.replace(/\\H[^;]+;/g,""),e=e.replace(/\\W[^;]+;/g,""),e=e.replace(/\\T[^;]+;/g,""),e=e.replace(/\\Q[^;]+;/g,""),e=e.replace(/\\[LloO]/g,""),e=e.replace(/\\S([^;^]+)\^([^;]*);/g,"$1/$2"),e=e.replace(/\\S([^;]+);/g,"$1"),e=e.replace(/[{}]/g,""),e=e.replace(/\\\\/g,"\\"),e.trim()}function Ae(r,e,n,s=8){if(!n||Math.abs(n)<1e-6)return[e];const t=e.x-r.x,o=e.y-r.y,i=Math.hypot(t,o);if(i<1e-6)return[e];const a=4*Math.atan(n),l=Math.abs(i/(2*Math.sin(a/2))),f=(r.x+e.x)/2,p=(r.y+e.y)/2,h=-o/i,m=t/i,y=i/2/Math.tan(a/2),u=f+h*y,g=p+m*y,c=Math.atan2(r.y-g,r.x-u);let d=Math.atan2(e.y-g,e.x-u);n>0&&d<c?d+=2*Math.PI:n<0&&d>c&&(d-=2*Math.PI);const F=Math.max(4,Math.min(64,Math.ceil(Math.abs(a)/(Math.PI/s)))),I=[];for(let L=1;L<=F;L++){const T=L/F,w=c+T*(d-c);I.push({x:u+l*Math.cos(w),y:g+l*Math.sin(w)})}return I}class $e{parse(e,n="drawing.dxf"){const s=this.tokenize(e),t=new Map,o=new Map,i=[];t.set("0",{name:"0",color:"#FFFFFF",colorIndex:7,visible:!0,entityCount:0});let a=0;const l=s.length;let f,p;for(;a<l;){const u=s[a];if(u.code===0&&u.value==="SECTION"){if(a++,a<l&&s[a].code===2){const g=s[a].value;if(a++,g==="HEADER"){const c=this.parseHeader(s,a);f=c.headerExtents,c.version&&(p=c.version),a=c.nextIndex}else if(g==="TABLES")a=this.parseTables(s,a,t);else if(g==="BLOCKS")a=this.parseBlocks(s,a,o);else if(g==="ENTITIES")a=this.parseEntitiesSection(s,a,i);else{for(;a<l&&!(s[a].code===0&&s[a].value==="ENDSEC");)a++;a<l&&a++}}}else a++}const h=[];for(const u of i)if(u.type==="INSERT"){const g=this.expandInsert(u,o,0);for(let c=0;c<g.length;c++)h.push(g[c])}else if(u.type==="DIMENSION"){const g=u;if(g.blockName&&o.has(g.blockName)){const c=o.get(g.blockName),d={type:"INSERT",layer:g.layer,blockName:g.blockName,position:{x:c.basePoint.x||0,y:c.basePoint.y||0,z:c.basePoint.z||0},scale:{x:1,y:1,z:1},rotation:0,color:g.color,colorIndex:g.colorIndex},F=this.expandInsert(d,o,0);for(let I=0;I<F.length;I++)h.push(F[I])}else h.push(u)}else h.push(u);for(const u of h){u.bbox=Se(u);const g=u.layer||"0";let c=t.get(g);c||(c={name:g,color:u.color||"#FFFFFF",colorIndex:u.colorIndex??7,visible:!0,entityCount:0},t.set(g,c)),c.entityCount=(c.entityCount||0)+1,u.color||(u.color=c.color)}const m=Me(h),y=Xe(h,f,m);return{layers:t,blocks:o,entities:h,boundingBox:m,headerExtents:f,focusBoundingBox:y,fileName:n,version:p}}tokenize(e){const n=[];let s=0;const t=e.length;let o=null;for(;s<t;){let i=e.indexOf(`
`,s);i===-1&&(i=t);let a=i;a>s&&e.charCodeAt(a-1)===13&&a--;let l=s;for(;l<a&&e.charCodeAt(l)<=32;)l++;for(;a>l&&e.charCodeAt(a-1)<=32;)a--;if(a>l){const f=e.substring(l,a);if(o===null){const p=parseInt(f,10);isNaN(p)||(o=p)}else n.push({code:o,value:f}),o=null}s=i+1}return n}parseHeader(e,n){let s=n;const t=e.length;let o=null,i=null,a;for(;s<t;){const f=e[s];if(f.code===0&&f.value==="ENDSEC")return{headerExtents:o&&i&&isFinite(o.x)&&isFinite(i.x)&&i.x>o.x&&i.y>o.y?{minX:o.x,minY:o.y,maxX:i.x,maxY:i.y}:void 0,version:a,nextIndex:s+1};if(f.code===9){const p=f.value;if(s++,p==="$EXTMIN"){for(o={x:0,y:0,z:0};s<t&&e[s].code!==9&&e[s].code!==0;)e[s].code===10?o.x=parseFloat(e[s].value):e[s].code===20?o.y=parseFloat(e[s].value):e[s].code===30&&(o.z=parseFloat(e[s].value)),s++;continue}else if(p==="$EXTMAX"){for(i={x:0,y:0,z:0};s<t&&e[s].code!==9&&e[s].code!==0;)e[s].code===10?i.x=parseFloat(e[s].value):e[s].code===20?i.y=parseFloat(e[s].value):e[s].code===30&&(i.z=parseFloat(e[s].value)),s++;continue}else if(p==="$ACADVER"){s<t&&e[s].code===1&&(a=e[s].value,s++);continue}}s++}return{headerExtents:o&&i&&isFinite(o.x)&&isFinite(i.x)&&i.x>o.x&&i.y>o.y?{minX:o.x,minY:o.y,maxX:i.x,maxY:i.y}:void 0,version:a,nextIndex:s}}parseTables(e,n,s){let t=n;const o=e.length;for(;t<o;){const i=e[t];if(i.code===0&&i.value==="ENDSEC")return t+1;if(i.code===0&&i.value==="TABLE"&&(t++,t<o&&e[t].code===2)){const a=e[t].value;if(t++,a==="LAYER"){t=this.parseLayerTable(e,t,s);continue}}t++}return t}parseLayerTable(e,n,s){let t=n;const o=e.length;for(;t<o;){const i=e[t];if(i.code===0&&i.value==="ENDTAB")return t+1;if(i.code===0&&i.value==="LAYER"){t++;let a="",l=7,f=!1,p=!1,h="CONTINUOUS";for(;t<o&&e[t].code!==0;){const{code:m,value:y}=e[t];if(m===2)a=y;else if(m===62){const u=parseInt(y,10);u<0?(p=!0,l=Math.abs(u)):l=u}else m===70?(parseInt(y,10)&1)!==0&&(f=!0):m===6&&(h=y);t++}a&&s.set(a,{name:a,color:k(l),colorIndex:l,visible:!f&&!p,lineType:h,entityCount:0})}else t++}return t}parseBlocks(e,n,s){let t=n;const o=e.length;for(;t<o;){const i=e[t];if(i.code===0&&i.value==="ENDSEC")return t+1;if(i.code===0&&i.value==="BLOCK"){t++;let a="";const l={x:0,y:0,z:0},f=[];for(;t<o&&e[t].code!==0;){const{code:p,value:h}=e[t];p===2?a=h:p===10?l.x=parseFloat(h):p===20?l.y=parseFloat(h):p===30&&(l.z=parseFloat(h)),t++}for(;t<o&&!(e[t].code===0&&e[t].value==="ENDBLK");)if(e[t].code===0){const{entity:p,nextIndex:h}=this.parseEntity(e,t);if(Array.isArray(p))for(let m=0;m<p.length;m++)f.push(p[m]);else p&&f.push(p);t=h}else t++;t<o&&e[t].code===0&&e[t].value==="ENDBLK"&&t++,a&&s.set(a,{name:a,basePoint:l,entities:f})}else t++}return t}parseEntitiesSection(e,n,s){let t=n;const o=e.length;for(;t<o;){const i=e[t];if(i.code===0&&i.value==="ENDSEC")return t+1;if(i.code===0){const{entity:a,nextIndex:l}=this.parseEntity(e,t);if(Array.isArray(a))for(let f=0;f<a.length;f++)s.push(a[f]);else a&&s.push(a);t=l}else t++}return t}parseEntity(e,n){const s=e[n].value.toUpperCase();let t=n+1;const o=e.length;let i="0",a="",l,f;switch(s){case"LINE":{const p={x:0,y:0,z:0},h={x:0,y:0,z:0};for(;t<o&&e[t].code!==0;){const{code:y,value:u}=e[t];y===8?i=u:y===5?a=u:y===62?l=parseInt(u,10):y===6?f=u:y===10?p.x=parseFloat(u):y===20?p.y=parseFloat(u):y===30?p.z=parseFloat(u):y===11?h.x=parseFloat(u):y===21?h.y=parseFloat(u):y===31&&(h.z=parseFloat(u)),t++}return{entity:{type:"LINE",layer:i,handle:a,start:p,end:h,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"CIRCLE":{const p={x:0,y:0,z:0};let h=0;for(;t<o&&e[t].code!==0;){const{code:y,value:u}=e[t];y===8?i=u:y===5?a=u:y===62?l=parseInt(u,10):y===6?f=u:y===10?p.x=parseFloat(u):y===20?p.y=parseFloat(u):y===30?p.z=parseFloat(u):y===40&&(h=parseFloat(u)),t++}return{entity:{type:"CIRCLE",layer:i,handle:a,center:p,radius:h,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"ARC":{const p={x:0,y:0,z:0};let h=0,m=0,y=360;for(;t<o&&e[t].code!==0;){const{code:g,value:c}=e[t];g===8?i=c:g===5?a=c:g===62?l=parseInt(c,10):g===6?f=c:g===10?p.x=parseFloat(c):g===20?p.y=parseFloat(c):g===30?p.z=parseFloat(c):g===40?h=parseFloat(c):g===50?m=parseFloat(c):g===51&&(y=parseFloat(c)),t++}return{entity:{type:"ARC",layer:i,handle:a,center:p,radius:h,startAngle:m,endAngle:y,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"LWPOLYLINE":{const p=[];let h=!1,m=null;for(;t<o&&e[t].code!==0;){const{code:u,value:g}=e[t];u===8?i=g:u===5?a=g:u===62?l=parseInt(g,10):u===6?f=g:u===70?h=(parseInt(g,10)&1)===1:u===10?(m={x:parseFloat(g),y:0},p.push(m)):u===20?m&&(m.y=parseFloat(g)):u===42&&m&&(m.bulge=parseFloat(g)),t++}return{entity:{type:"LWPOLYLINE",layer:i,handle:a,vertices:p,isClosed:h,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"POLYLINE":{let p=!1,h=0;for(;t<o&&e[t].code!==0;){const{code:d,value:F}=e[t];d===8?i=F:d===5?a=F:d===62?l=parseInt(F,10):d===6?f=F:d===70&&(h=parseInt(F,10),p=(h&1)===1),t++}const m=(h&64)===64,y=[];for(;t<o&&!(e[t].code===0&&e[t].value==="SEQEND");)if(e[t].code===0&&e[t].value==="VERTEX"){t++;let d=0,F=0,I=0,L=0,T,w,N,M,x;for(;t<o&&e[t].code!==0;){const{code:C,value:E}=e[t];C===10?d=parseFloat(E):C===20?F=parseFloat(E):C===30?I=parseFloat(E):C===70?L=parseInt(E,10):C===42?T=parseFloat(E):C===71?w=parseInt(E,10):C===72?N=parseInt(E,10):C===73?M=parseInt(E,10):C===74&&(x=parseInt(E,10)),t++}y.push({x:d,y:F,z:I,flags:L,bulge:T,f1:w,f2:N,f3:M,f4:x})}else t++;if(t<o&&e[t].code===0&&e[t].value==="SEQEND"&&t++,m){const d=[],F=[];for(const I of y)if(!(I.f1!==void 0||I.f2!==void 0||I.f3!==void 0))d.push({x:I.x,y:I.y,z:I.z});else{const T=[I.f1,I.f2,I.f3,I.f4].filter(w=>w!==void 0&&w!==0);for(let w=0;w<T.length;w++){const N=(w+1)%T.length,M=Math.abs(T[w])-1,x=Math.abs(T[N])-1;M>=0&&M<d.length&&x>=0&&x<d.length&&M!==x&&F.push({type:"LINE",layer:i,handle:a,start:d[M],end:d[x],colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f})}}return{entity:F.length>0?F:null,nextIndex:t}}const u=(h&4)===4,g=[];for(const d of y)u&&(d.flags&16)===16||g.push({x:d.x,y:d.y,bulge:d.bulge});return{entity:{type:"POLYLINE",layer:i,handle:a,vertices:g,isClosed:p,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"TEXT":{let p="";const h={x:0,y:0,z:0};let m=2.5,y=0,u=0,g=0;for(;t<o&&e[t].code!==0;){const{code:d,value:F}=e[t];d===8?i=F:d===5?a=F:d===62?l=parseInt(F,10):d===6?f=F:d===1?p=F:d===10?h.x=parseFloat(F):d===20?h.y=parseFloat(F):d===30?h.z=parseFloat(F):d===40?m=parseFloat(F):d===50?y=parseFloat(F):d===72?u=parseInt(F,10):d===73&&(g=parseInt(F,10)),t++}return{entity:{type:"TEXT",layer:i,handle:a,text:p,position:h,height:m,rotation:y,halign:u,valign:g,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"ATTRIB":case"ATTDEF":{let p="";const h={x:0,y:0,z:0};let m=2.5,y=0,u=0,g=0;for(;t<o&&e[t].code!==0;){const{code:d,value:F}=e[t];d===8?i=F:d===5?a=F:d===62?l=parseInt(F,10):d===6?f=F:d===1?p=F:d===10?h.x=parseFloat(F):d===20?h.y=parseFloat(F):d===30?h.z=parseFloat(F):d===40?m=parseFloat(F):d===50?y=parseFloat(F):d===72?u=parseInt(F,10):(d===74||d===73)&&(g=parseInt(F,10)),t++}return{entity:{type:"TEXT",layer:i,handle:a,text:ce(p),position:h,height:m,rotation:y,halign:u,valign:g,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"MTEXT":{let p=[];const h={x:0,y:0,z:0};let m=2.5,y=0,u=1;for(;t<o&&e[t].code!==0;){const{code:d,value:F}=e[t];d===8?i=F:d===5?a=F:d===62?l=parseInt(F,10):d===6?f=F:d===1||d===3?p.push(F):d===10?h.x=parseFloat(F):d===20?h.y=parseFloat(F):d===30?h.z=parseFloat(F):d===40?m=parseFloat(F):d===50?y=parseFloat(F):d===71&&(u=parseInt(F,10)),t++}const g=p.join("");return{entity:{type:"MTEXT",layer:i,handle:a,text:ce(g),position:h,height:m,rotation:y,attachmentPoint:u,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"INSERT":{let p="";const h={x:0,y:0,z:0},m={x:1,y:1,z:1};let y=0,u;for(;t<o&&e[t].code!==0;){const{code:c,value:d}=e[t];c===8?i=d:c===5?a=d:c===62?l=parseInt(d,10):c===6?f=d:c===2?p=d:c===10?h.x=parseFloat(d):c===20?h.y=parseFloat(d):c===30?h.z=parseFloat(d):c===41?m.x=parseFloat(d):c===42?m.y=parseFloat(d):c===43?m.z=parseFloat(d):c===50?y=parseFloat(d):c===210?(u=u||{x:0,y:0,z:1},u.x=parseFloat(d)):c===220?(u=u||{x:0,y:0,z:1},u.y=parseFloat(d)):c===230&&(u=u||{x:0,y:0,z:1},u.z=parseFloat(d)),t++}return{entity:{type:"INSERT",layer:i,handle:a,blockName:p,position:h,scale:m,rotation:y,extrusion:u,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"ELLIPSE":{const p={x:0,y:0,z:0},h={x:1,y:0,z:0};let m=1,y=0,u=2*Math.PI;for(;t<o&&e[t].code!==0;){const{code:c,value:d}=e[t];c===8?i=d:c===5?a=d:c===62?l=parseInt(d,10):c===6?f=d:c===10?p.x=parseFloat(d):c===20?p.y=parseFloat(d):c===30?p.z=parseFloat(d):c===11?h.x=parseFloat(d):c===21?h.y=parseFloat(d):c===31?h.z=parseFloat(d):c===40?m=parseFloat(d):c===41?y=parseFloat(d):c===42&&(u=parseFloat(d)),t++}return{entity:{type:"ELLIPSE",layer:i,handle:a,center:p,majorAxisEndPoint:h,axisRatio:m,startAngle:y,endAngle:u,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"DIMENSION":{let p="",h="";const m={x:0,y:0,z:0},y={x:0,y:0,z:0},u={x:0,y:0,z:0};for(;t<o&&e[t].code!==0;){const{code:c,value:d}=e[t];c===8?i=d:c===5?a=d:c===62?l=parseInt(d,10):c===6?f=d:c===2?p=d:c===1?h=d:c===10?m.x=parseFloat(d):c===20?m.y=parseFloat(d):c===11?y.x=parseFloat(d):c===21?y.y=parseFloat(d):c===13?u.x=parseFloat(d):c===23&&(u.y=parseFloat(d)),t++}return{entity:{type:"DIMENSION",layer:i,handle:a,blockName:p,text:ce(h),defPoint1:m,defPoint2:y,defPoint3:u,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"SPLINE":{const p=[];let h=3,m=!1,y=null;for(;t<o&&e[t].code!==0;){const{code:g,value:c}=e[t];g===8?i=c:g===5?a=c:g===62?l=parseInt(c,10):g===6?f=c:g===71?h=parseInt(c,10):g===70?m=(parseInt(c,10)&1)===1:g===10?(y={x:parseFloat(c),y:0,z:0},p.push(y)):g===20?y&&(y.y=parseFloat(c)):g===30&&y&&(y.z=parseFloat(c)),t++}return{entity:{type:"SPLINE",layer:i,handle:a,controlPoints:p,degree:h,isClosed:m,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}case"SOLID":case"3DFACE":{const p={x:0,y:0,z:0},h={x:0,y:0,z:0},m={x:0,y:0,z:0},y={x:0,y:0,z:0};let u=!1;for(;t<o&&e[t].code!==0;){const{code:d,value:F}=e[t];d===8?i=F:d===5?a=F:d===62?l=parseInt(F,10):d===6?f=F:d===10?p.x=parseFloat(F):d===20?p.y=parseFloat(F):d===30?p.z=parseFloat(F):d===11?h.x=parseFloat(F):d===21?h.y=parseFloat(F):d===31?h.z=parseFloat(F):d===12?m.x=parseFloat(F):d===22?m.y=parseFloat(F):d===32?m.z=parseFloat(F):d===13?(y.x=parseFloat(F),u=!0):d===23?(y.y=parseFloat(F),u=!0):d===33&&(y.z=parseFloat(F),u=!0),t++}const g=s==="SOLID"?[p,h,u?y:m,m]:[p,h,m,...u&&(y.x!==m.x||y.y!==m.y)?[y]:[]];return{entity:{type:s==="SOLID"?"SOLID":"3DFACE",layer:i,handle:a,points:g,colorIndex:l,color:l!==void 0?k(l):void 0,lineType:f},nextIndex:t}}default:{for(;t<o&&e[t].code!==0;)t++;return{entity:null,nextIndex:t}}}}expandInsert(e,n,s,t=new Set,o=R.identity()){if(s>8||t.has(e.blockName))return[];const i=n.get(e.blockName);if(!i||!i.entities.length)return[];const a=new Set(t);a.add(e.blockName);const l=i.basePoint.x||0,f=i.basePoint.y||0;let p=e.scale.x??1,h=e.scale.y??1;const m=e.rotation||0,y=e.position.x,u=e.position.y;e.extrusion&&e.extrusion.z!==void 0&&e.extrusion.z<0&&(p=-p);const g=R.translation(y,u).multiply(R.rotation(m)).multiply(R.scale(p,h)).multiply(R.translation(-l,-f)),c=o.multiply(g),F=c.determinant()<0,I=Math.sqrt((c.a*c.a+c.b*c.b+c.c*c.c+c.d*c.d)/2),L=[];for(const T of i.entities){const w=T.layer==="0"?e.layer:T.layer,N=T.colorIndex===0?e.color:T.color,M=T.colorIndex===0?e.colorIndex:T.colorIndex;switch(T.type){case"LINE":{const x=T,C=c.transformPoint(x.start),E=c.transformPoint(x.end);L.push({...x,layer:w,color:N,colorIndex:M,start:{x:C.x,y:C.y,z:x.start.z},end:{x:E.x,y:E.y,z:x.end.z}});break}case"CIRCLE":{const x=T,C=c.transformPoint(x.center);L.push({...x,layer:w,color:N,colorIndex:M,center:{x:C.x,y:C.y,z:x.center.z},radius:x.radius*I});break}case"ARC":{const x=T,C=c.transformPoint(x.center),E=Math.PI/180,S=c.transformVector({x:Math.cos(x.startAngle*E),y:Math.sin(x.startAngle*E)}),B=c.transformVector({x:Math.cos(x.endAngle*E),y:Math.sin(x.endAngle*E)});let W=(Math.atan2(S.y,S.x)*180/Math.PI+360)%360,$=(Math.atan2(B.y,B.x)*180/Math.PI+360)%360;if(F){const Oe=W;W=$,$=Oe}L.push({...x,layer:w,color:N,colorIndex:M,center:{x:C.x,y:C.y,z:x.center.z},radius:x.radius*I,startAngle:W,endAngle:$});break}case"LWPOLYLINE":case"POLYLINE":{const x=T,C=x.vertices.map(E=>{const S=c.transformPoint(E);return{x:S.x,y:S.y,bulge:F&&E.bulge?-E.bulge:E.bulge}});L.push({...x,layer:w,color:N,colorIndex:M,vertices:C});break}case"TEXT":{const x=T,C=c.transformPoint(x.position),E=(x.rotation||0)*Math.PI/180,S=c.transformVector({x:Math.cos(E),y:Math.sin(E)}),B=(Math.atan2(S.y,S.x)*180/Math.PI+360)%360;L.push({...x,layer:w,color:N,colorIndex:M,position:{x:C.x,y:C.y,z:x.position.z},height:x.height*I,rotation:B});break}case"MTEXT":{const x=T,C=c.transformPoint(x.position),E=(x.rotation||0)*Math.PI/180,S=c.transformVector({x:Math.cos(E),y:Math.sin(E)}),B=(Math.atan2(S.y,S.x)*180/Math.PI+360)%360;L.push({...x,layer:w,color:N,colorIndex:M,position:{x:C.x,y:C.y,z:x.position.z},height:x.height*I,rotation:B});break}case"ELLIPSE":{const x=T,C=c.transformPoint(x.center),E=c.transformVector(x.majorAxisEndPoint);L.push({...x,layer:w,color:N,colorIndex:M,center:{x:C.x,y:C.y,z:x.center.z},majorAxisEndPoint:{x:E.x,y:E.y,z:0}});break}case"SOLID":case"3DFACE":{const x=T,C=x.points.map(E=>{const S=c.transformPoint(E);return{x:S.x,y:S.y,z:E.z}});L.push({...x,layer:w,color:N,colorIndex:M,points:C});break}case"SPLINE":{const x=T,C=x.controlPoints.map(E=>{const S=c.transformPoint(E);return{x:S.x,y:S.y,z:E.z}});L.push({...x,layer:w,color:N,colorIndex:M,controlPoints:C});break}case"INSERT":{const x=T,C=x.layer==="0"?w:x.layer,E=x.colorIndex===0?N:x.color,S=x.colorIndex===0?M:x.colorIndex,B={...x,layer:C,color:E,colorIndex:S},W=this.expandInsert(B,n,s+1,a,c);for(let $=0;$<W.length;$++)L.push(W[$]);break}case"DIMENSION":{const x=T;if(x.blockName&&n.has(x.blockName)){const C=n.get(x.blockName),E={type:"INSERT",layer:x.layer==="0"?w:x.layer,blockName:x.blockName,position:{x:C.basePoint.x||0,y:C.basePoint.y||0,z:C.basePoint.z||0},scale:{x:1,y:1,z:1},rotation:0,color:N,colorIndex:M},S=this.expandInsert(E,n,s+1,a,c);for(let B=0;B<S.length;B++)L.push(S[B])}break}}}return L}}let D,U=null,Ne=0;function Fe(){return(U===null||U.byteLength===0)&&(U=new Uint8Array(D.memory.buffer)),U}function We(r,e){return Ue(r>>>0,e)}function _e(r,e){const n=e(r.length*1,1)>>>0;return Fe().set(r,n/1),Ne=r.length,n}function He(r){const e=D.__wbindgen_externrefs.get(r);return D.__externref_table_dealloc(r),e}let J=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});J.decode();const qe=2146435072;let de=0;function Ue(r,e){return de+=e,de>=qe&&(J=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}),J.decode(),de=e),J.decode(Fe().subarray(r,r+e))}function Ge(){return{"./dwgdxf_bg.js":{__wbindgen_cast_0000000000000001:function(e,n){return We(e,n)},__wbindgen_init_externref_table:function(){const e=D.__wbindgen_externrefs,n=e.grow(4);e.set(0,void 0),e.set(n+0,void 0),e.set(n+1,null),e.set(n+2,!0),e.set(n+3,!1)}}}}function Z(r,e){return D=r.exports,U=null,D.__wbindgen_start(),D}async function Ve(r){if(D!==void 0)return D;const e=Ge();if(typeof Response<"u"&&r instanceof Response){if(typeof WebAssembly.instantiateStreaming=="function")try{const o=await WebAssembly.instantiateStreaming(r,e);return Z(o.instance,o.module)}catch(o){console.warn("WebAssembly.instantiateStreaming 失败，回退至 arrayBuffer 模式:",o)}const s=await r.arrayBuffer(),t=await WebAssembly.instantiate(s,e);return Z(t.instance,t.module)}if(r instanceof WebAssembly.Module){const s=new WebAssembly.Instance(r,e);return Z(s)}const n=await WebAssembly.instantiate(r,e);return Z(n.instance,n.module)}function je(){return D!==void 0}function Ke(r){if(!D)throw new Error("WebAssembly DWG 引擎尚未初始化");const e=_e(r,D.__wbindgen_malloc),n=Ne,s=D.convertDwgToDxf(e,n);if(s[3])throw He(s[2]);const t=Fe().subarray(s[0]>>>0,(s[0]>>>0)+s[1]).slice();return D.__wbindgen_free(s[0],s[1]*1,1),t}async function Ze(r){const e=[];if(typeof document<"u"&&document.baseURI)try{const t=new URL("wasm/dwgdxf_bg.wasm",document.baseURI).href;e.push(t)}catch{}if(typeof window<"u"&&window.location?.href)try{const t=window.location.pathname.split("/");t.pop();const o=t.join("/")||"",i=window.location.origin;e.push(`${i}${o}/wasm/dwgdxf_bg.wasm`)}catch{}e.push("./wasm/dwgdxf_bg.wasm"),e.push("/cad-viewer/wasm/dwgdxf_bg.wasm"),e.push("https://cdn.jsdelivr.net/npm/dwgdxf@2.0.1/dist/wasm/dwgdxf_bg.wasm"),e.push("https://unpkg.com/dwgdxf@2.0.1/dist/wasm/dwgdxf_bg.wasm");const n=Array.from(new Set(e));let s=null;for(const t of n)try{if(r){const i=t.startsWith("http")&&typeof window<"u"&&!t.includes(window.location.host);r(`正在载入 WASM 引擎 (${i?"CDN":"本地"})...`)}const o=await fetch(t,{mode:"cors"});if(o.ok){const i=await o.arrayBuffer();if(i&&i.byteLength>0)return i}}catch(o){s=o}throw new Error(`无法载入 WebAssembly 引擎二进制文件: ${s instanceof Error?s.message:String(s)}`)}function Qe(r){const e=r instanceof Uint8Array?r:new Uint8Array(r);if(e.length<6)return{versionCode:"INVALID",versionName:"文件过小或无效 (小于 6 字节)",isSupported:!1};let n="";for(let o=0;o<6;o++)n+=String.fromCharCode(e[o]);const t={AC1032:{name:"AutoCAD 2018 - 2026",supported:!0},AC1027:{name:"AutoCAD 2013 - 2017",supported:!0},AC1024:{name:"AutoCAD 2010 - 2012",supported:!0},AC1021:{name:"AutoCAD 2007 - 2009",supported:!0},AC1018:{name:"AutoCAD 2004 - 2006",supported:!0},AC1015:{name:"AutoCAD 2000 - 2002",supported:!0},AC1014:{name:"AutoCAD Release 14",supported:!0},AC1012:{name:"AutoCAD Release 13",supported:!0},AC1009:{name:"AutoCAD Release 11/12 (旧于 R13)",supported:!1},AC1006:{name:"AutoCAD Release 10 (旧于 R13)",supported:!1}}[n];return t?{versionCode:n,versionName:t.name,isSupported:t.supported}:{versionCode:n,versionName:`非标准或未知 DWG 版本 (${n})`,isSupported:!1}}const Q=()=>new Promise(r=>setTimeout(r,30));async function Je(r,e){if(!je()){e&&(e("正在载入 WebAssembly 解码引擎..."),await Q());const t=await Ze(e);e&&(e("正在编译与初始化 WebAssembly 引擎..."),await Q()),await Ve(t)}e&&(e("正在解码 DWG 二进制图元..."),await Q());const n=r instanceof Uint8Array?r:new Uint8Array(r);let s;try{s=Ke(n)}catch(t){const o=t instanceof Error?t.message:String(t);let i=o;throw o.includes("IO error")||o.includes("failed to fill")?i=`二进制数据解析截断 (${o})：图纸包含天正建筑 (TArch) 等专有代理对象或未内嵌的外部参照`:(o.includes("unreachable")||o.includes("memory")||o.includes("RangeError"))&&(i=`WebAssembly 引擎内存溢出 (${o})：图纸实体量过大，超出手机浏览器内存配额`),new Error(i)}e&&(e("DWG 解码完成，正在准备图纸几何..."),await Q());try{return new TextDecoder("utf-8").decode(s)}catch{try{return new TextDecoder("gbk").decode(s)}catch{return new TextDecoder("ascii").decode(s)}}}class et{constructor(e){b(this,"canvas");b(this,"ctx");b(this,"doc",null);b(this,"camera",{centerX:0,centerY:0,zoom:1});b(this,"options",{theme:"DARK",showCrosshair:!0,showSnap:!0});b(this,"selectedEntity",null);b(this,"hoveredEntity",null);b(this,"cursorWorld",{x:0,y:0});b(this,"cursorScreen",{x:0,y:0});b(this,"activeSnap",null);b(this,"measureEngine",null);b(this,"dpr",1);b(this,"animationFrameId",null);this.canvas=e;const n=e.getContext("2d",{alpha:!1});if(!n)throw new Error("Canvas 2D rendering context not supported");this.ctx=n,this.updateSize()}updateSize(){const e=this.canvas.getBoundingClientRect();this.dpr=window.devicePixelRatio||1,this.canvas.width=Math.max(1,Math.floor(e.width*this.dpr)),this.canvas.height=Math.max(1,Math.floor(e.height*this.dpr)),this.requestRender()}setDocument(e){this.doc=e,this.selectedEntity=null,this.hoveredEntity=null,e?this.fitToView():(this.camera={centerX:0,centerY:0,zoom:1},this.requestRender())}getDocument(){return this.doc}fitToFocus(){if(!this.doc)return;const e=this.doc.focusBoundingBox||this.doc.headerExtents||this.doc.boundingBox;this.applyBoundingBoxToCamera(e)}fitToFull(){this.doc&&this.applyBoundingBoxToCamera(this.doc.boundingBox)}fitToView(){this.fitToFocus()}applyBoundingBoxToCamera(e){const n=e.maxX-e.minX,s=e.maxY-e.minY;if(n<=0||s<=0)return;this.camera.centerX=(e.minX+e.maxX)/2,this.camera.centerY=(e.minY+e.maxY)/2;const t=this.canvas.width/this.dpr,o=this.canvas.height/this.dpr,i=.92,a=t*i/n,l=o*i/s;this.camera.zoom=Math.min(a,l),this.requestRender()}worldToScreen(e,n){const s=this.canvas.width/this.dpr,t=this.canvas.height/this.dpr;return{x:(e-this.camera.centerX)*this.camera.zoom+s/2,y:t/2-(n-this.camera.centerY)*this.camera.zoom}}screenToWorld(e,n){const s=this.canvas.width/this.dpr,t=this.canvas.height/this.dpr;return{x:(e-s/2)/this.camera.zoom+this.camera.centerX,y:this.camera.centerY-(n-t/2)/this.camera.zoom}}requestRender(){this.animationFrameId===null&&(this.animationFrameId=requestAnimationFrame(()=>{this.animationFrameId=null,this.render()}))}render(){const e=this.ctx,n=this.canvas.width,s=this.canvas.height;e.save(),e.scale(this.dpr,this.dpr);const t=n/this.dpr,o=s/this.dpr,i=this.options.theme==="DARK";if(e.fillStyle=i?"#181A1F":"#F5F6F8",e.fillRect(0,0,t,o),this.drawOriginAndAxes(e,t,o,i),!this.doc){this.drawEmptyState(e,t,o,i),e.restore();return}this.drawEntities(e,i),this.hoveredEntity&&this.hoveredEntity!==this.selectedEntity&&this.highlightEntity(e,this.hoveredEntity,"#00E5FF",1.5),this.selectedEntity&&this.highlightEntity(e,this.selectedEntity,"#FFD700",2.5),this.measureEngine&&this.drawMeasurements(e,i),this.options.showSnap&&this.activeSnap&&this.drawSnapIndicator(e,this.activeSnap),this.options.showCrosshair&&this.drawCrosshair(e,t,o,i),e.restore()}drawEmptyState(e,n,s,t){e.save(),e.textAlign="center",e.textBaseline="middle",e.font='bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',e.fillStyle=t?"rgba(255, 255, 255, 0.45)":"rgba(0, 0, 0, 0.45)",e.fillText("📐 未加载 CAD 图纸",n/2,s/2-14),e.font='13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',e.fillStyle=t?"rgba(255, 255, 255, 0.25)":"rgba(0, 0, 0, 0.3)",e.fillText("点击顶部「📂 打开图纸」或直接将 .dwg / .dxf 拖拽至此处查看",n/2,s/2+16),e.restore()}drawOriginAndAxes(e,n,s,t){const o=this.worldToScreen(0,0);e.save(),e.strokeStyle=t?"rgba(255, 255, 255, 0.08)":"rgba(0, 0, 0, 0.08)",e.lineWidth=1,e.setLineDash([4,4]),e.beginPath(),e.moveTo(0,o.y),e.lineTo(n,o.y),e.stroke(),e.beginPath(),e.moveTo(o.x,0),e.lineTo(o.x,s),e.stroke(),e.setLineDash([]),e.lineWidth=2,e.strokeStyle="#FF4444",e.beginPath(),e.moveTo(o.x,o.y),e.lineTo(o.x+30,o.y),e.stroke(),e.strokeStyle="#44FF44",e.beginPath(),e.moveTo(o.x,o.y),e.lineTo(o.x,o.y-30),e.stroke(),e.restore()}drawEntities(e,n){if(!this.doc)return;e.save(),e.lineCap="round",e.lineJoin="round";const s=n?"#FFFFFF":"#111111",t=this.canvas.width/this.dpr,o=this.canvas.height/this.dpr,i=t/2/this.camera.zoom,a=o/2/this.camera.zoom,l=this.camera.centerX-i,f=this.camera.centerX+i,p=this.camera.centerY-a,h=this.camera.centerY+a,m=this.camera.zoom,y=new Map,u=[];for(let g=0;g<this.doc.entities.length;g++){const c=this.doc.entities[g],d=this.doc.layers.get(c.layer);if(d&&!d.visible)continue;const F=c.bbox;if(F&&(F.maxX<l||F.minX>f||F.maxY<p||F.minY>h||Math.hypot(F.maxX-F.minX,F.maxY-F.minY)*m<.08))continue;let I=c.color||(d?d.color:s);if(!n&&(I.toUpperCase()==="#FFFFFF"||I.toUpperCase()==="#FFF")&&(I="#111111"),c.type==="LINE"){let L=y.get(I);L||(L=[],y.set(I,L)),L.push(c)}else u.push(c)}e.lineWidth=1.2;for(const[g,c]of y){e.strokeStyle=g,e.beginPath();for(let d=0;d<c.length;d++){const F=c[d],I=this.worldToScreen(F.start.x,F.start.y),L=this.worldToScreen(F.end.x,F.end.y);e.moveTo(I.x,I.y),e.lineTo(L.x,L.y)}e.stroke()}for(let g=0;g<u.length;g++){const c=u[g],d=this.doc.layers.get(c.layer);let F=c.color||(d?d.color:s);!n&&(F.toUpperCase()==="#FFFFFF"||F.toUpperCase()==="#FFF")&&(F="#111111"),e.strokeStyle=F,e.fillStyle=F,e.lineWidth=1.2,this.renderSingleEntityGeometry(e,c)}e.restore()}renderSingleEntityGeometry(e,n){switch(n.type){case"LINE":{const s=n,t=this.worldToScreen(s.start.x,s.start.y),o=this.worldToScreen(s.end.x,s.end.y);e.beginPath(),e.moveTo(t.x,t.y),e.lineTo(o.x,o.y),e.stroke();break}case"CIRCLE":{const s=n,t=this.worldToScreen(s.center.x,s.center.y),o=s.radius*this.camera.zoom;o>.5&&(e.beginPath(),e.arc(t.x,t.y,o,0,2*Math.PI),e.stroke());break}case"ARC":{const s=n,t=this.worldToScreen(s.center.x,s.center.y),o=s.radius*this.camera.zoom;if(o>.5){const i=Math.PI/180,a=-s.startAngle*i,l=-s.endAngle*i;e.beginPath(),e.arc(t.x,t.y,o,a,l,!0),e.stroke()}break}case"LWPOLYLINE":case"POLYLINE":{const s=n,t=s.vertices;if(t.length<2)break;e.beginPath();const o=this.worldToScreen(t[0].x,t[0].y);e.moveTo(o.x,o.y);for(let i=0;i<t.length;i++){const a=t[i],l=i+1<t.length?i+1:s.isClosed?0:-1;if(l<0)break;const f=t[l];if(a.bulge&&Math.abs(a.bulge)>1e-6){const p=Ae(a,f,a.bulge,16);for(const h of p){const m=this.worldToScreen(h.x,h.y);e.lineTo(m.x,m.y)}}else{const p=this.worldToScreen(f.x,f.y);e.lineTo(p.x,p.y)}}s.isClosed&&e.closePath(),e.stroke();break}case"ELLIPSE":{const s=n,t=this.worldToScreen(s.center.x,s.center.y),o=s.majorAxisEndPoint.x*this.camera.zoom,i=-s.majorAxisEndPoint.y*this.camera.zoom,a=Math.hypot(o,i),l=a*s.axisRatio,f=Math.atan2(i,o);a>.5&&(e.save(),e.translate(t.x,t.y),e.rotate(f),e.beginPath(),e.ellipse(0,0,a,l,0,0,2*Math.PI),e.stroke(),e.restore());break}case"TEXT":case"MTEXT":{const s=n,t=s.text;if(!t)break;const o=this.worldToScreen(s.position.x,s.position.y),i=Math.max(1,s.height*this.camera.zoom);if(i<4)break;e.save(),e.font=`${i}px "Menlo", "Consolas", sans-serif`,e.textBaseline="bottom",e.translate(o.x,o.y),e.rotate(-s.rotation*Math.PI/180),t.split(`
`).forEach((l,f)=>{e.fillText(l,0,f*i*1.2)}),e.restore();break}case"SPLINE":{const s=n;if(s.controlPoints.length<2)break;e.beginPath();const t=this.worldToScreen(s.controlPoints[0].x,s.controlPoints[0].y);e.moveTo(t.x,t.y);for(let o=1;o<s.controlPoints.length;o++){const i=this.worldToScreen(s.controlPoints[o].x,s.controlPoints[o].y);e.lineTo(i.x,i.y)}s.isClosed&&e.closePath(),e.stroke();break}case"SOLID":case"3DFACE":{const s=n;if(s.points.length<3)break;e.beginPath();const t=this.worldToScreen(s.points[0].x,s.points[0].y);e.moveTo(t.x,t.y);for(let o=1;o<s.points.length;o++){const i=this.worldToScreen(s.points[o].x,s.points[o].y);e.lineTo(i.x,i.y)}e.closePath(),e.stroke();break}}}highlightEntity(e,n,s,t){e.save(),e.strokeStyle=s,e.fillStyle=s,e.lineWidth=t,e.shadowColor=s,e.shadowBlur=6,this.renderSingleEntityGeometry(e,n),e.restore()}drawCrosshair(e,n,s,t){const o=this.cursorScreen.x,i=this.cursorScreen.y;e.save(),e.strokeStyle=t?"rgba(255, 255, 255, 0.45)":"rgba(0, 0, 0, 0.45)",e.lineWidth=1,e.beginPath(),e.moveTo(0,i),e.lineTo(n,i),e.moveTo(o,0),e.lineTo(o,s),e.stroke();const a=8;e.strokeRect(o-a/2,i-a/2,a,a),e.restore()}drawSnapIndicator(e,n){const s=this.worldToScreen(n.point.x,n.point.y);e.save(),e.strokeStyle="#00FF66",e.lineWidth=2;const t=7;n.type==="ENDPOINT"?e.strokeRect(s.x-t,s.y-t,t*2,t*2):n.type==="MIDPOINT"?(e.beginPath(),e.moveTo(s.x,s.y-t),e.lineTo(s.x-t,s.y+t),e.lineTo(s.x+t,s.y+t),e.closePath(),e.stroke()):n.type==="CENTER"&&(e.beginPath(),e.arc(s.x,s.y,t,0,2*Math.PI),e.stroke()),e.restore()}drawMeasurements(e,n){if(this.measureEngine){e.save();for(const s of this.measureEngine.measurements)if(s.type==="DISTANCE"){const t=this.worldToScreen(s.p1.x,s.p1.y),o=this.worldToScreen(s.p2.x,s.p2.y);e.strokeStyle=s.color,e.lineWidth=2,e.beginPath(),e.moveTo(t.x,t.y),e.lineTo(o.x,o.y),e.stroke(),e.fillStyle=s.color,e.beginPath(),e.arc(t.x,t.y,4,0,2*Math.PI),e.arc(o.x,o.y,4,0,2*Math.PI),e.fill();const i=(t.x+o.x)/2,a=(t.y+o.y)/2,l=`L: ${s.distance.toFixed(2)} (ΔX: ${s.deltaX.toFixed(2)}, ΔY: ${s.deltaY.toFixed(2)})`;e.font='12px "Menlo", monospace';const f=e.measureText(l).width;e.fillStyle=n?"rgba(0, 0, 0, 0.8)":"rgba(255, 255, 255, 0.85)",e.fillRect(i-f/2-4,a-18,f+8,20),e.strokeStyle=s.color,e.strokeRect(i-f/2-4,a-18,f+8,20),e.fillStyle=s.color,e.textAlign="center",e.textBaseline="middle",e.fillText(l,i,a-8)}else if(s.type==="ANGLE"){const t=this.worldToScreen(s.p1.x,s.p1.y),o=this.worldToScreen(s.vertex.x,s.vertex.y),i=this.worldToScreen(s.p2.x,s.p2.y);e.strokeStyle=s.color,e.lineWidth=1.5,e.beginPath(),e.moveTo(t.x,t.y),e.lineTo(o.x,o.y),e.lineTo(i.x,i.y),e.stroke();const a=`∠ ${s.angleDeg.toFixed(1)}°`;e.font='12px "Menlo", monospace';const l=e.measureText(a).width;e.fillStyle=n?"rgba(0, 0, 0, 0.8)":"rgba(255, 255, 255, 0.85)",e.fillRect(o.x-l/2-4,o.y-24,l+8,20),e.fillStyle=s.color,e.textAlign="center",e.textBaseline="middle",e.fillText(a,o.x,o.y-14)}if(this.measureEngine.activePoints.length>0){const s=this.measureEngine.activePoints;e.strokeStyle="#00FFCC",e.lineWidth=1.5,e.setLineDash([4,4]),e.beginPath();const t=this.worldToScreen(s[0].x,s[0].y);e.moveTo(t.x,t.y);for(let o=1;o<s.length;o++){const i=this.worldToScreen(s[o].x,s[o].y);e.lineTo(i.x,i.y)}e.lineTo(this.cursorScreen.x,this.cursorScreen.y),e.stroke()}e.restore()}}pickEntity(e){if(!this.doc)return null;const n=8/this.camera.zoom,s=e.x,t=e.y;for(let o=this.doc.entities.length-1;o>=0;o--){const i=this.doc.entities[o],a=this.doc.layers.get(i.layer);if(a&&!a.visible)continue;const l=i.bbox;if(!(l&&(s<l.minX-n||s>l.maxX+n||t<l.minY-n||t>l.maxY+n))&&this.isPointNearEntity(e,i,n))return i}return null}isPointNearEntity(e,n,s){switch(n.type){case"LINE":{const t=n;return this.distanceToSegment(e,t.start,t.end)<=s}case"CIRCLE":{const t=n,o=Math.hypot(e.x-t.center.x,e.y-t.center.y);return Math.abs(o-t.radius)<=s}case"ARC":{const t=n,o=Math.hypot(e.x-t.center.x,e.y-t.center.y);if(Math.abs(o-t.radius)>s)return!1;const i=Math.atan2(e.y-t.center.y,e.x-t.center.x)*180/Math.PI;return q(i,t.startAngle,t.endAngle)}case"LWPOLYLINE":case"POLYLINE":{const t=n,o=t.vertices;for(let i=0;i<o.length;i++){const a=i+1<o.length?i+1:t.isClosed?0:-1;if(a<0)break;if(this.distanceToSegment(e,o[i],o[a])<=s)return!0}return!1}case"TEXT":case"MTEXT":{const t=n;return Math.hypot(e.x-t.position.x,e.y-t.position.y)<=Math.max(t.height*2,s*2)}case"SOLID":case"3DFACE":{const t=n;for(let o=0;o<t.points.length;o++){const i=(o+1)%t.points.length;if(this.distanceToSegment(e,t.points[o],t.points[i])<=s)return!0}return!1}default:return!1}}distanceToSegment(e,n,s){const t=s.x-n.x,o=s.y-n.y,i=t*t+o*o;if(i<1e-6)return Math.hypot(e.x-n.x,e.y-n.y);const a=Math.max(0,Math.min(1,((e.x-n.x)*t+(e.y-n.y)*o)/i)),l=n.x+a*t,f=n.y+a*o;return Math.hypot(e.x-l,e.y-f)}}class tt{constructor(e,n,s={}){b(this,"renderer");b(this,"canvas");b(this,"callbacks");b(this,"isDragging",!1);b(this,"isSpacePressed",!1);b(this,"lastMousePos",{x:0,y:0});b(this,"dragStartPos",{x:0,y:0});b(this,"hasMovedSignificantly",!1);b(this,"touchStartPos",{x:0,y:0});b(this,"lastTouchPos",{x:0,y:0});b(this,"touchHasMoved",!1);b(this,"pinchStartDist",0);b(this,"pinchStartZoom",1);b(this,"pinchStartWorldMid",{x:0,y:0});this.renderer=e,this.canvas=n,this.callbacks=s,this.initEvents()}initEvents(){const e=this.canvas;e.addEventListener("wheel",this.onWheel.bind(this),{passive:!1}),e.addEventListener("mousedown",this.onMouseDown.bind(this)),window.addEventListener("mousemove",this.onMouseMove.bind(this)),window.addEventListener("mouseup",this.onMouseUp.bind(this)),e.addEventListener("dblclick",this.onDblClick.bind(this)),e.addEventListener("contextmenu",n=>n.preventDefault()),e.addEventListener("touchstart",this.onTouchStart.bind(this),{passive:!1}),e.addEventListener("touchmove",this.onTouchMove.bind(this),{passive:!1}),e.addEventListener("touchend",this.onTouchEnd.bind(this),{passive:!1}),e.addEventListener("touchcancel",this.onTouchEnd.bind(this),{passive:!1}),window.addEventListener("keydown",n=>{n.code==="Space"&&!this.isSpacePressed&&(this.isSpacePressed=!0,this.canvas.style.cursor="grab")}),window.addEventListener("keyup",n=>{n.code==="Space"&&(this.isSpacePressed=!1,this.canvas.style.cursor="crosshair")}),e.addEventListener("gesturestart",n=>n.preventDefault()),e.addEventListener("gesturechange",n=>n.preventDefault())}onWheel(e){e.preventDefault();const n=this.canvas.getBoundingClientRect(),s=e.clientX-n.left,t=e.clientY-n.top,o=this.renderer.screenToWorld(s,t),i=e.deltaY<0?1.15:1/1.15,a=this.renderer.camera.zoom,l=Math.max(1e-5,Math.min(1e6,a*i)),f=n.width,p=n.height;this.renderer.camera.zoom=l,this.renderer.camera.centerX=o.x-(s-f/2)/l,this.renderer.camera.centerY=o.y+(t-p/2)/l,this.updateCursor(e),this.renderer.requestRender()}onMouseDown(e){const n=this.canvas.getBoundingClientRect(),s=e.clientX-n.left,t=e.clientY-n.top;this.lastMousePos={x:s,y:t},this.dragStartPos={x:s,y:t},this.hasMovedSignificantly=!1,(e.button===1||this.isSpacePressed||e.button===0&&this.renderer.measureEngine?.currentMode==="NONE")&&(this.isDragging=!0,this.canvas.style.cursor="grabbing")}onMouseMove(e){const n=this.canvas.getBoundingClientRect(),s=e.clientX-n.left,t=e.clientY-n.top;if(this.isDragging){const o=s-this.lastMousePos.x,i=t-this.lastMousePos.y;Math.hypot(s-this.dragStartPos.x,t-this.dragStartPos.y)>3&&(this.hasMovedSignificantly=!0),this.renderer.camera.centerX-=o/this.renderer.camera.zoom,this.renderer.camera.centerY+=i/this.renderer.camera.zoom,this.lastMousePos={x:s,y:t},this.renderer.requestRender()}this.updateCursor(e)}onMouseUp(e){const n=this.canvas.getBoundingClientRect(),s=e.clientX-n.left,t=e.clientY-n.top;this.isDragging&&(this.isDragging=!1,this.canvas.style.cursor="crosshair"),!this.hasMovedSignificantly&&s>=0&&s<=n.width&&t>=0&&t<=n.height&&this.triggerClickAction(e.button)}onDblClick(e){e.preventDefault(),this.renderer.fitToView()}onTouchStart(e){if(e.touches.length===1){const n=this.canvas.getBoundingClientRect(),s=e.touches[0],t=s.clientX-n.left,o=s.clientY-n.top;this.touchStartPos={x:t,y:o},this.lastTouchPos={x:t,y:o},this.touchHasMoved=!1,this.updateCursorScreen(t,o)}else if(e.touches.length===2){const n=this.canvas.getBoundingClientRect(),s=e.touches[0],t=e.touches[1],o=s.clientX-n.left,i=s.clientY-n.top,a=t.clientX-n.left,l=t.clientY-n.top;this.pinchStartDist=Math.hypot(a-o,l-i),this.pinchStartZoom=this.renderer.camera.zoom;const f=(o+a)/2,p=(i+l)/2;this.pinchStartWorldMid=this.renderer.screenToWorld(f,p),this.touchHasMoved=!0}}onTouchMove(e){e.preventDefault();const n=this.canvas.getBoundingClientRect();if(e.touches.length===1){const s=e.touches[0],t=s.clientX-n.left,o=s.clientY-n.top,i=t-this.lastTouchPos.x,a=o-this.lastTouchPos.y;Math.hypot(t-this.touchStartPos.x,o-this.touchStartPos.y)>6&&(this.touchHasMoved=!0),this.renderer.camera.centerX-=i/this.renderer.camera.zoom,this.renderer.camera.centerY+=a/this.renderer.camera.zoom,this.lastTouchPos={x:t,y:o},this.updateCursorScreen(t,o),this.renderer.requestRender()}else if(e.touches.length===2){const s=e.touches[0],t=e.touches[1],o=s.clientX-n.left,i=s.clientY-n.top,a=t.clientX-n.left,l=t.clientY-n.top,f=Math.hypot(a-o,l-i);if(this.pinchStartDist>0){const p=f/this.pinchStartDist,h=Math.max(1e-5,Math.min(1e6,this.pinchStartZoom*p)),m=(o+a)/2,y=(i+l)/2,u=n.width,g=n.height;this.renderer.camera.zoom=h,this.renderer.camera.centerX=this.pinchStartWorldMid.x-(m-u/2)/h,this.renderer.camera.centerY=this.pinchStartWorldMid.y+(y-g/2)/h,this.updateCursorScreen(m,y),this.renderer.requestRender()}}}onTouchEnd(e){if(e.touches.length===0)this.touchHasMoved||(this.updateCursorScreen(this.touchStartPos.x,this.touchStartPos.y),this.triggerClickAction(0)),this.pinchStartDist=0;else if(e.touches.length===1){const n=this.canvas.getBoundingClientRect(),s=e.touches[0];this.lastTouchPos={x:s.clientX-n.left,y:s.clientY-n.top}}}updateCursor(e){const n=this.canvas.getBoundingClientRect(),s=e.clientX-n.left,t=e.clientY-n.top;this.updateCursorScreen(s,t)}updateCursorScreen(e,n){this.renderer.cursorScreen={x:e,y:n};const s=this.renderer.screenToWorld(e,n);if(this.isDragging){this.renderer.activeSnap=null,this.renderer.hoveredEntity=null,this.renderer.cursorWorld=s,this.callbacks.onCursorMove&&this.callbacks.onCursorMove(s,{x:e,y:n});return}let t=s;if(this.renderer.options.showSnap&&this.renderer.getDocument()){const o=12/this.renderer.camera.zoom,i=this.renderer.measureEngine?.findSnapPoint(s,this.renderer.getDocument().entities,o)??null;this.renderer.activeSnap=i,i&&(t=i.point)}else this.renderer.activeSnap=null;this.renderer.cursorWorld=t,this.renderer.measureEngine?.currentMode==="NONE"?this.renderer.hoveredEntity=this.renderer.pickEntity(t):this.renderer.hoveredEntity=null,this.renderer.requestRender(),this.callbacks.onCursorMove&&this.callbacks.onCursorMove(t,{x:e,y:n})}triggerClickAction(e){const n=this.renderer.cursorWorld;if(this.renderer.measureEngine&&this.renderer.measureEngine.currentMode!=="NONE"){const s=this.renderer.measureEngine.addPoint(n);this.renderer.requestRender(),s&&this.callbacks.onMeasurementAdded&&this.callbacks.onMeasurementAdded();return}if(e===0){const s=this.renderer.pickEntity(n);this.renderer.selectedEntity=s,this.renderer.requestRender(),this.callbacks.onEntitySelected&&this.callbacks.onEntitySelected(s)}}}class nt{constructor(){b(this,"measurements",[]);b(this,"activePoints",[]);b(this,"currentMode","NONE")}setMode(e){this.currentMode=e,this.activePoints=[]}clear(){this.measurements=[],this.activePoints=[]}addPoint(e){if(this.currentMode==="NONE")return null;if(this.activePoints.push({...e}),this.currentMode==="DISTANCE"&&this.activePoints.length===2){const[n,s]=this.activePoints,t=s.x-n.x,o=s.y-n.y,i=Math.hypot(t,o),a={id:`dist_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,type:"DISTANCE",p1:n,p2:s,distance:i,deltaX:Math.abs(t),deltaY:Math.abs(o),color:"#00FFAA"};return this.measurements.push(a),this.activePoints=[],a}if(this.currentMode==="ANGLE"&&this.activePoints.length===3){const[n,s,t]=this.activePoints,o=n.x-s.x,i=n.y-s.y,a=t.x-s.x,l=t.y-s.y,f=o*a+i*l,p=Math.hypot(o,i),h=Math.hypot(a,l);let m=0;if(p>1e-6&&h>1e-6){const u=Math.max(-1,Math.min(1,f/(p*h)));m=Math.acos(u)*180/Math.PI}const y={id:`angle_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,type:"ANGLE",p1:n,vertex:s,p2:t,angleDeg:m,color:"#FFCC00"};return this.measurements.push(y),this.activePoints=[],y}return null}findSnapPoint(e,n,s){let t=null,o=s;const i=(f,p)=>{const h=Math.hypot(f.x-e.x,f.y-e.y);h<o&&(o=h,t={point:f,type:p,distance:h})},a=e.x,l=e.y;for(const f of n){const p=f.bbox;if(!(p&&(a<p.minX-s||a>p.maxX+s||l<p.minY-s||l>p.maxY+s)))switch(f.type){case"LINE":{const h=f;i({x:h.start.x,y:h.start.y},"ENDPOINT"),i({x:h.end.x,y:h.end.y},"ENDPOINT"),i({x:(h.start.x+h.end.x)/2,y:(h.start.y+h.end.y)/2},"MIDPOINT");break}case"CIRCLE":{const h=f;i({x:h.center.x,y:h.center.y},"CENTER");break}case"ARC":{const h=f;i({x:h.center.x,y:h.center.y},"CENTER");const m=Math.PI/180;i({x:h.center.x+h.radius*Math.cos(h.startAngle*m),y:h.center.y+h.radius*Math.sin(h.startAngle*m)},"ENDPOINT"),i({x:h.center.x+h.radius*Math.cos(h.endAngle*m),y:h.center.y+h.radius*Math.sin(h.endAngle*m)},"ENDPOINT");break}case"LWPOLYLINE":{const m=f.vertices;for(let y=0;y<m.length;y++)i({x:m[y].x,y:m[y].y},"ENDPOINT"),y+1<m.length&&i({x:(m[y].x+m[y+1].x)/2,y:(m[y].y+m[y+1].y)/2},"MIDPOINT");break}}}return t}}const Pe=`
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
0
62
7
70
0
0
LAYER
2
OUTLINE
62
7
70
0
0
LAYER
2
CENTERLINE
62
4
70
0
0
LAYER
2
BOLTS
62
2
70
0
0
LAYER
2
ANNOTATION
62
3
70
0
0
ENDTAB
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
2
BOLT_HOLE
10
0.0
20
0.0
30
0.0
0
CIRCLE
8
BOLTS
10
0.0
20
0.0
30
0.0
40
12.0
0
CIRCLE
8
BOLTS
10
0.0
20
0.0
30
0.0
40
6.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
CIRCLE
8
OUTLINE
10
0.0
20
0.0
30
0.0
40
150.0
0
CIRCLE
8
OUTLINE
10
0.0
20
0.0
30
0.0
40
50.0
0
CIRCLE
8
CENTERLINE
10
0.0
20
0.0
30
0.0
40
105.0
0
LINE
8
CENTERLINE
10
-170.0
20
0.0
30
0.0
11
170.0
21
0.0
31
0.0
0
LINE
8
CENTERLINE
10
0.0
20
-170.0
30
0.0
11
0.0
21
170.0
31
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
105.0
20
0.0
30
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
0.0
20
105.0
30
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
-105.0
20
0.0
30
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
0.0
20
-105.0
30
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
74.246
20
74.246
30
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
-74.246
20
74.246
30
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
-74.246
20
-74.246
30
0.0
0
INSERT
8
BOLTS
2
BOLT_HOLE
10
74.246
20
-74.246
30
0.0
0
TEXT
8
ANNOTATION
10
-120.0
20
180.0
30
0.0
40
12.0
1
FLANGE ASSEMBLY PCD 210mm (8-M12)
0
TEXT
8
ANNOTATION
10
-80.0
20
-195.0
30
0.0
40
8.0
1
MATERIAL: 304 STAINLESS STEEL
0
ENDSEC
0
EOF
`.trim(),st=`
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
WALLS
62
4
70
0
0
LAYER
2
DOORS
62
2
70
0
0
LAYER
2
WINDOWS
62
3
70
0
0
LAYER
2
FURNITURE
62
6
70
0
0
LAYER
2
TEXTS
62
7
70
0
0
ENDTAB
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
2
SWING_DOOR_900
10
0.0
20
0.0
30
0.0
0
LINE
8
DOORS
10
0.0
20
0.0
30
0.0
11
0.0
21
90.0
31
0.0
0
ARC
8
DOORS
10
0.0
20
0.0
30
0.0
40
90.0
50
0.0
51
90.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
WALLS
90
5
70
1
10
0.0
20
0.0
10
600.0
20
0.0
10
600.0
20
500.0
10
0.0
20
500.0
10
0.0
20
0.0
0
LINE
8
WALLS
10
300.0
20
0.0
30
0.0
11
300.0
21
350.0
31
0.0
0
INSERT
8
DOORS
2
SWING_DOOR_900
10
210.0
20
0.0
30
0.0
41
1.0
42
1.0
50
0.0
0
LINE
8
WINDOWS
10
50.0
20
500.0
30
0.0
11
250.0
21
500.0
31
0.0
0
LINE
8
WINDOWS
10
50.0
20
510.0
30
0.0
11
250.0
21
510.0
31
0.0
0
LWPOLYLINE
8
FURNITURE
90
4
70
1
10
50.0
20
250.0
10
190.0
20
250.0
10
190.0
20
340.0
10
50.0
20
340.0
0
TEXT
8
TEXTS
10
80.0
20
150.0
30
0.0
40
18.0
1
MASTER BEDROOM
0
TEXT
8
TEXTS
10
360.0
20
200.0
30
0.0
40
18.0
1
LIVING ROOM
0
ENDSEC
0
EOF
`.trim(),ot=`
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
PROFILE
62
1
70
0
0
LAYER
2
REFERENCE
62
5
70
0
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
PROFILE
90
4
70
1
10
0.0
20
0.0
42
-0.4142
10
100.0
20
0.0
42
1.0
10
100.0
20
100.0
42
-0.4142
10
0.0
20
100.0
0
CIRCLE
8
REFERENCE
10
50.0
20
50.0
30
0.0
40
20.0
0
ELLIPSE
8
PROFILE
10
50.0
20
50.0
30
0.0
11
40.0
21
0.0
31
0.0
40
0.6
41
0.0
42
6.2831853
0
TEXT
8
PROFILE
10
-20.0
20
120.0
30
0.0
40
10.0
1
BULGE POLYLINE WITH ELLIPSE CORE
0
ENDSEC
0
EOF
`.trim(),it=new $e,Y=new nt,ge=document.getElementById("cad-canvas"),se=document.getElementById("file-input"),rt=document.getElementById("btn-open-file"),j=document.getElementById("btn-close-file"),pe=document.getElementById("sample-select"),at=document.getElementById("btn-fit-focus"),lt=document.getElementById("btn-fit-full"),ct=document.getElementById("btn-fit-view"),dt=document.getElementById("btn-zoom-in"),ht=document.getElementById("btn-zoom-out"),pt=document.getElementById("btn-zoom-reset"),oe=document.getElementById("btn-tool-select"),ue=document.getElementById("btn-tool-dist"),fe=document.getElementById("btn-tool-angle"),ut=document.getElementById("btn-tool-clear"),be=document.getElementById("btn-toggle-crosshair"),Ie=document.getElementById("btn-toggle-snap"),ft=document.getElementById("btn-toggle-theme"),mt=document.getElementById("btn-dwg-help"),yt=document.getElementById("btn-export-png"),ee=document.getElementById("btn-fullscreen"),te=document.getElementById("layers-list-container"),ke=document.getElementById("layer-total-count"),O=document.getElementById("layer-search-input"),X=document.getElementById("btn-clear-layer-search"),Ft=document.getElementById("btn-layers-show-all"),gt=document.getElementById("btn-layers-hide-all"),Le=document.getElementById("inspector-container"),Te=document.getElementById("measure-list-container"),xt=document.getElementById("measure-count"),De=document.getElementById("coord-display"),ie=document.getElementById("zoom-level-display"),xe=document.getElementById("doc-summary-display"),P=document.getElementById("status-message"),ve=document.getElementById("drop-overlay"),G=document.getElementById("dwg-modal"),vt=document.getElementById("btn-close-modal"),V=document.getElementById("error-modal"),Et=document.getElementById("error-modal-body"),Ct=document.getElementById("btn-close-error-modal"),he=document.getElementById("btn-copy-error");let ne="";function bt(r,e,n){const s=(r.size/1048576).toFixed(2),t=(r.size/1024).toFixed(1),o=r.size>1024*1024?`${s} MB`:`${t} KB`,i=e?`${e.versionName} [${e.versionCode}]`:"未知版本";ne=`[CAD Viewer DWG 解析诊断报告]
图纸名称: ${r.name}
文件体积: ${o} (${r.size} 字节)
版本识别: ${i}
浏览器代理: ${navigator.userAgent}
报错信息: ${n}
发生时间: ${new Date().toLocaleString()}`,Et.innerHTML=`
    <div style="background: rgba(255, 82, 82, 0.12); border-left: 3px solid #ff5252; padding: 10px 12px; margin-bottom: 12px; border-radius: 4px;">
      <div style="font-weight: 600; color: #ff5252; margin-bottom: 4px;">⚠️ 解码引擎中断原因：</div>
      <div style="word-break: break-all; font-family: monospace; font-size: 12px; color: var(--text-color);">${n}</div>
    </div>

    <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-muted); line-height: 1.8;">
      <div>📁 <strong>图纸名称：</strong>${r.name}</div>
      <div>📦 <strong>文件体积：</strong>${o}</div>
      <div>🏷 <strong>DWG 版本：</strong>${i}</div>
    </div>

    <div style="border-top: 1px solid var(--border-color); padding-top: 10px;">
      <div style="font-weight: 600; margin-bottom: 6px; color: var(--accent);">💡 常见诊断与排查途径：</div>
      <ol style="margin: 0; padding-left: 18px; color: var(--text-color); font-size: 12px; line-height: 1.7;">
        <li><strong>天正/插件代理对象 (最常见)：</strong>如果施工图纸使用了“天正建筑 (TArch)”等 ObjectARX 插件绘制，纯前端标准引擎无法直接读取专有代理门窗/墙体。请在 CAD 中输入 <code>TXPOUT</code>（天正整图导出为标准 T3 格式）另存后打开。</li>
        <li><strong>高版本或超大图纸：</strong>若包含超复杂 3D 实体或图纸超过 10MB，可在 Mac 电脑端使用系统级自由软件命令行转换：<br><code style="background: rgba(255,255,255,0.08); padding: 2px 5px; border-radius: 3px; user-select: all;">./scripts/dwg-convert.sh "${r.name}"</code></li>
        <li><strong>导出为 DXF 格式：</strong>在 AutoCAD、中望或浩辰中将图纸「另存为」 <strong>AutoCAD 2004/2000 DXF</strong>，可 100% 顺畅秒开。</li>
      </ol>
    </div>
  `,V.classList.add("active")}Ct.addEventListener("click",()=>{V.classList.remove("active")});V.addEventListener("click",r=>{r.target===V&&V.classList.remove("active")});he.addEventListener("click",()=>{ne&&navigator.clipboard.writeText(ne).then(()=>{he.textContent="✅ 已复制诊断信息",setTimeout(()=>{he.textContent="📋 复制诊断日志"},2e3)}).catch(()=>{alert(`复制失败，请手动长按复制：

`+ne)})});const It=document.getElementById("btn-mobile-layers"),Lt=document.getElementById("btn-mobile-inspector"),Tt=document.getElementById("btn-close-layers-drawer"),wt=document.getElementById("btn-close-inspector-drawer"),me=document.getElementById("left-layers-panel"),ye=document.getElementById("right-inspector-panel"),re=document.getElementById("mobile-backdrop");function K(){me?.classList.remove("mobile-open"),ye?.classList.remove("mobile-open"),re?.classList.remove("active")}It?.addEventListener("click",()=>{const r=me?.classList.contains("mobile-open");K(),r||(me?.classList.add("mobile-open"),re?.classList.add("active"))});Lt?.addEventListener("click",()=>{const r=ye?.classList.contains("mobile-open");K(),r||(ye?.classList.add("mobile-open"),re?.classList.add("active"))});Tt?.addEventListener("click",K);wt?.addEventListener("click",K);re?.addEventListener("click",K);const v=new et(ge);v.measureEngine=Y;new tt(v,ge,{onCursorMove:r=>{De.textContent=`X: ${r.x.toFixed(2)} mm  Y: ${r.y.toFixed(2)} mm`,ie.textContent=`缩放: ${(v.camera.zoom*100).toFixed(0)}%`},onEntitySelected:r=>{Ee(r)},onMeasurementAdded:()=>{ae()}});window.addEventListener("resize",()=>{v.updateSize()});function _(r,e){try{P.textContent="正在解析 DXF...";const n=performance.now(),s=it.parse(r,e),t=(performance.now()-n).toFixed(1);v.setDocument(s),H(s),Ee(null),Y.clear(),ae(),O&&(O.value=""),X&&(X.style.display="none"),j&&(j.style.display="inline-flex"),P.textContent=`就绪 (解析耗时 ${t}ms)`,xe.textContent=`${e} | 图层: ${s.layers.size} | 实体: ${s.entities.length}`,ie.textContent=`缩放: ${(v.camera.zoom*100).toFixed(0)}%`}catch(n){const s=n instanceof Error?n.message:String(n);alert(`解析 DXF 失败: ${s}`),P.textContent="解析出错"}}function Be(){v.setDocument(null),Ee(null),Y.clear(),ae(),O&&(O.value=""),X&&(X.style.display="none"),ke.textContent="0",te.innerHTML=`
    <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 20px;">
      未加载图纸
    </div>
  `,P.textContent="已关闭图纸",xe.textContent="未加载图纸",De.textContent="X: 0.00 mm  Y: 0.00 mm",ie.textContent="缩放: 100%",j&&(j.style.display="none"),pe.value="",se.value=""}function H(r,e=""){const n=e.trim().toLowerCase();ke.textContent=r.layers.size.toString(),te.innerHTML="";let s=0;r.layers.forEach(t=>{if(n&&!t.name.toLowerCase().includes(n))return;s++;const o=document.createElement("div");o.className="layer-item";const i=document.createElement("div");i.className="layer-info";const a=document.createElement("div");a.className="layer-color-pill",a.style.backgroundColor=t.color,a.title=`颜色: ${t.color} (ACI: ${t.colorIndex})`;const l=document.createElement("span");l.textContent=t.name,l.title=t.name,i.appendChild(a),i.appendChild(l);const f=document.createElement("div");f.style.display="flex",f.style.alignItems="center",f.style.gap="5px";const p=document.createElement("span");p.className="layer-count-badge",p.textContent=(t.entityCount||0).toString();const h=document.createElement("button");h.className="layer-solo-btn",h.textContent="仅看",h.title=`只显示图层「${t.name}」，隐藏其他所有图层`,h.addEventListener("click",y=>{y.stopPropagation(),r.layers.forEach(u=>{u.visible=u.name===t.name}),H(r,O?.value||""),v.requestRender()});const m=document.createElement("button");m.className=`layer-toggle-btn ${t.visible?"visible":""}`,m.textContent=t.visible?"👁":"🚫",m.title=t.visible?"点击隐藏图层":"点击显示图层",m.addEventListener("click",y=>{y.stopPropagation(),t.visible=!t.visible,m.className=`layer-toggle-btn ${t.visible?"visible":""}`,m.textContent=t.visible?"👁":"🚫",v.requestRender()}),f.appendChild(p),f.appendChild(h),f.appendChild(m),o.appendChild(i),o.appendChild(f),te.appendChild(o)}),s===0&&r.layers.size>0&&(te.innerHTML=`
      <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 20px;">
        未找到匹配「${e}」的图层
      </div>
    `)}function Ee(r){if(!r){Le.innerHTML=`
      <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 20px;">
        点击图纸中的实体以查看属性
      </div>
    `;return}let e=`
    <div class="prop-group">
      <div class="prop-group-title">基本属性</div>
      <div class="prop-row"><span class="prop-key">类型</span><span class="prop-val">${r.type}</span></div>
      <div class="prop-row"><span class="prop-key">图层</span><span class="prop-val">${r.layer}</span></div>
      <div class="prop-row"><span class="prop-key">颜色</span><span class="prop-val">${r.color||"ByLayer"}</span></div>
      ${r.handle?`<div class="prop-row"><span class="prop-key">句柄</span><span class="prop-val">${r.handle}</span></div>`:""}
    </div>
  `;switch(e+='<div class="prop-group"><div class="prop-group-title">几何参数</div>',r.type){case"LINE":{const n=r,s=n.end.x-n.start.x,t=n.end.y-n.start.y,o=Math.hypot(s,t);e+=`
        <div class="prop-row"><span class="prop-key">起点</span><span class="prop-val">(${n.start.x.toFixed(2)}, ${n.start.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">终点</span><span class="prop-val">(${n.end.x.toFixed(2)}, ${n.end.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">长度</span><span class="prop-val">${o.toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">角度</span><span class="prop-val">${(Math.atan2(t,s)*180/Math.PI).toFixed(1)}°</span></div>
      `;break}case"CIRCLE":{const n=r;e+=`
        <div class="prop-row"><span class="prop-key">圆心</span><span class="prop-val">(${n.center.x.toFixed(2)}, ${n.center.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">半径</span><span class="prop-val">${n.radius.toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">直径</span><span class="prop-val">${(n.radius*2).toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">周长</span><span class="prop-val">${(2*Math.PI*n.radius).toFixed(2)} mm</span></div>
      `;break}case"ARC":{const n=r;e+=`
        <div class="prop-row"><span class="prop-key">圆心</span><span class="prop-val">(${n.center.x.toFixed(2)}, ${n.center.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">半径</span><span class="prop-val">${n.radius.toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">起始角</span><span class="prop-val">${n.startAngle.toFixed(1)}°</span></div>
        <div class="prop-row"><span class="prop-key">终止角</span><span class="prop-val">${n.endAngle.toFixed(1)}°</span></div>
      `;break}case"LWPOLYLINE":case"POLYLINE":{const n=r;e+=`
        <div class="prop-row"><span class="prop-key">顶点数</span><span class="prop-val">${n.vertices.length}</span></div>
        <div class="prop-row"><span class="prop-key">闭合</span><span class="prop-val">${n.isClosed?"是":"否"}</span></div>
      `;break}case"TEXT":case"MTEXT":{const n=r;e+=`
        <div class="prop-row"><span class="prop-key">内容</span><span class="prop-val" title="${n.text}">${n.text}</span></div>
        <div class="prop-row"><span class="prop-key">字高</span><span class="prop-val">${n.height.toFixed(2)}</span></div>
        <div class="prop-row"><span class="prop-key">位置</span><span class="prop-val">(${n.position.x.toFixed(2)}, ${n.position.y.toFixed(2)})</span></div>
      `;break}}e+="</div>",Le.innerHTML=e}function ae(){const r=Y.measurements;if(xt.textContent=r.length.toString(),r.length===0){Te.innerHTML=`
      <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 10px;">
        暂无测量数据
      </div>
    `;return}let e="";r.forEach((n,s)=>{n.type==="DISTANCE"?e+=`
        <div style="font-size: 11px; padding: 4px; margin-bottom: 4px; background: rgba(0,255,170,0.08); border-left: 3px solid ${n.color}; border-radius: 2px;">
          <strong>#${s+1} 距离: ${n.distance.toFixed(2)} mm</strong><br>
          <span style="color: var(--text-muted); font-size: 10px;">ΔX: ${n.deltaX.toFixed(2)} | ΔY: ${n.deltaY.toFixed(2)}</span>
        </div>
      `:n.type==="ANGLE"&&(e+=`
        <div style="font-size: 11px; padding: 4px; margin-bottom: 4px; background: rgba(255,204,0,0.08); border-left: 3px solid ${n.color}; border-radius: 2px;">
          <strong>#${s+1} 夹角: ${n.angleDeg.toFixed(1)}°</strong>
        </div>
      `)}),Te.innerHTML=e}function le(r){[oe,ue,fe].forEach(e=>e.classList.remove("active")),r.classList.add("active")}rt.addEventListener("click",()=>se.click());j?.addEventListener("click",Be);async function Re(r){const e=r.name,n=e.toLowerCase();if(n.endsWith(".dxf")){const s=new FileReader;s.onload=()=>{typeof s.result=="string"&&_(s.result,e)},s.readAsText(r)}else if(n.endsWith(".dwg")){let s=null;try{P.textContent="正在读取 DWG 文件数据...";const t=await r.arrayBuffer();s=Qe(t),console.log("检测到 DWG 文件:",e,"版本:",s);const o=await Je(t,i=>{P.textContent=i});_(o,e)}catch(t){const o=t instanceof Error?t.message:String(t);console.error("DWG 解码失败:",t),bt(r,s,o),P.textContent="DWG 解码中断 (已展开诊断详情)"}}else alert("请选择或拖入 .dxf 或 .dwg 格式图纸文件。")}se.addEventListener("change",r=>{const e=r.target.files?.[0];e&&(Re(e),se.value="")});pe.addEventListener("change",()=>{const r=pe.value;r==="FLANGE"?_(Pe,"mechanical-flange-pcd210.dxf"):r==="ARCH"?_(st,"architectural-floor-plan.dxf"):r==="BULGE"&&_(ot,"bulge-curved-profile.dxf")});const z=()=>{ie.textContent=`缩放: ${(v.camera.zoom*100).toFixed(0)}%`};at?.addEventListener("click",()=>{v.fitToFocus(),z(),P.textContent="已聚焦图纸主体核心区域"});lt?.addEventListener("click",()=>{v.fitToFull(),z(),P.textContent="已自适应显示全图范围（含外部参照）"});ct?.addEventListener("click",()=>{v.fitToView(),z()});dt.addEventListener("click",()=>{v.camera.zoom*=1.25,v.requestRender(),z()});ht.addEventListener("click",()=>{v.camera.zoom/=1.25,v.requestRender(),z()});pt.addEventListener("click",()=>{v.camera.zoom=1,v.requestRender(),z()});window.addEventListener("keydown",r=>{r.target instanceof HTMLInputElement||r.target instanceof HTMLTextAreaElement||r.target instanceof HTMLSelectElement||(r.key==="Escape"?Y.currentMode!=="NONE"?(le(oe),Y.setMode("NONE"),P.textContent="已退出测量模式",v.requestRender()):v.getDocument()&&Be():r.key==="f"||r.key==="F"?(v.fitToFocus(),z(),P.textContent="已聚焦主体 (F)"):r.key==="a"||r.key==="A"?(v.fitToFull(),z(),P.textContent="已自适应全图 (A)"):r.key==="+"||r.key==="="?(v.camera.zoom*=1.25,v.requestRender(),z()):(r.key==="-"||r.key==="_")&&(v.camera.zoom/=1.25,v.requestRender(),z()))});oe.addEventListener("click",()=>{le(oe),Y.setMode("NONE"),P.textContent="实体拾取模式：点击实体查看属性",v.requestRender()});ue.addEventListener("click",()=>{le(ue),Y.setMode("DISTANCE"),P.textContent="测距模式：请依次点击起点与终点",v.requestRender()});fe.addEventListener("click",()=>{le(fe),Y.setMode("ANGLE"),P.textContent="测角模式：请依次点击射线端点1、顶点、射线端点2",v.requestRender()});ut.addEventListener("click",()=>{Y.clear(),ae(),v.requestRender()});be.addEventListener("click",()=>{v.options.showCrosshair=!v.options.showCrosshair,be.classList.toggle("active",v.options.showCrosshair),v.requestRender()});Ie.addEventListener("click",()=>{v.options.showSnap=!v.options.showSnap,Ie.classList.toggle("active",v.options.showSnap),v.requestRender()});ft.addEventListener("click",()=>{v.options.theme=v.options.theme==="DARK"?"LIGHT":"DARK",v.requestRender()});mt.addEventListener("click",()=>{G.classList.add("active")});vt.addEventListener("click",()=>{G.classList.remove("active")});G.addEventListener("click",r=>{r.target===G&&G.classList.remove("active")});Ft.addEventListener("click",()=>{const r=v.getDocument();r&&(r.layers.forEach(e=>e.visible=!0),H(r,O?.value||""),v.requestRender())});gt.addEventListener("click",()=>{const r=v.getDocument();r&&(r.layers.forEach(e=>e.visible=!1),H(r,O?.value||""),v.requestRender())});O?.addEventListener("input",()=>{const r=v.getDocument(),e=O.value;X&&(X.style.display=e?"inline-block":"none"),r&&H(r,e)});X?.addEventListener("click",()=>{if(O){O.value="",X.style.display="none";const r=v.getDocument();r&&H(r,"")}});ee?.addEventListener("click",()=>{document.fullscreenElement?document.exitFullscreen().catch(()=>{}):document.documentElement.requestFullscreen().catch(r=>{console.warn("全屏请求被阻止或不支持:",r)})});document.addEventListener("fullscreenchange",()=>{ee&&(ee.textContent=document.fullscreenElement?"🗗 退出全屏":"⛶ 全屏",ee.classList.toggle("active",!!document.fullscreenElement)),setTimeout(()=>v.updateSize(),80)});yt?.addEventListener("click",()=>{if(!v.getDocument()){alert("请先打开或载入 CAD 图纸后再导出图片。");return}try{const r=ge.toDataURL("image/png"),e=document.createElement("a"),n=xe.textContent?.split("|")[0]?.trim()||"cad-drawing";e.download=`${n.replace(/\.[^/.]+$/,"")}-view.png`,e.href=r,document.body.appendChild(e),e.click(),document.body.removeChild(e),P.textContent="已导出当前视图图片 (PNG)"}catch(r){const e=r instanceof Error?r.message:String(r);alert(`导出图片失败: ${e}`)}});window.addEventListener("dragover",r=>{r.preventDefault(),ve.classList.add("active")});window.addEventListener("dragleave",r=>{(r.clientX<=0||r.clientY<=0||r.clientX>=window.innerWidth||r.clientY>=window.innerHeight)&&ve.classList.remove("active")});window.addEventListener("drop",r=>{r.preventDefault(),ve.classList.remove("active");const e=r.dataTransfer?.files?.[0];e&&Re(e)});_(Pe,"mechanical-flange-pcd210.dxf");"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").then(r=>{console.log("PWA ServiceWorker registered with scope:",r.scope),r.update().catch(()=>{})}).catch(r=>{console.warn("PWA ServiceWorker registration failed:",r)})});
//# sourceMappingURL=index-B0OqBdvc.js.map
