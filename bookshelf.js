// ═══════════════════════════════════════════════════════════
//  📚 BookShelf Lomos — estante tipo BookTrace para Scriptable
//  Baja la tapa real de cada libro, samplea el color del lomo,
//  y dibuja lomos 3D con título + autor. Dos libros van de frente.
//
//  ▶ PARA ACTUALIZAR (sin tocar código):
//    Abrí este script en Scriptable y TOCALO (play).
//    Se abre un menú para Agregar / Quitar / Poner de frente.
//    La lista se guarda sola y el widget se actualiza.
// ═══════════════════════════════════════════════════════════

// ── Lista inicial (después se edita desde el menú, no acá) ────
const DEFAULT = [
  // Lista de ejemplo — editá todo esto desde el menú del widget (o importá de Goodreads).
  { titulo: "The Hobbit", autor: "J.R.R. Tolkien", face: true },
  { titulo: "Dune", autor: "Frank Herbert" },
  { titulo: "The Name of the Wind", autor: "Patrick Rothfuss" },
  { titulo: "Circe", autor: "Madeline Miller" },
  { titulo: "The Song of Achilles", autor: "Madeline Miller" },
  { titulo: "Project Hail Mary", autor: "Andy Weir" },
  { titulo: "Mexican Gothic", autor: "Silvia Moreno-Garcia" },
  { titulo: "The Night Circus", autor: "Erin Morgenstern" },
  { titulo: "Pride and Prejudice", autor: "Jane Austen", face: true },
  { titulo: "Educated", autor: "Tara Westover" },
];

// ── ESTILO ───────────────────────────────────────────────────
const PLANTA = true;
const COLOR_CARD = "#14141a";
const COLOR_REPISA = "#5f4027";
const ROTAR = true;   // el estante va rotando los libros cada vez que iOS refresca (poné false para dejarlo quieto)

// ── FABLE (opcional): sincroniza solo desde tu lista de Fable ──
//   Dejá en "" para no usar Fable. Para activarlo, poné tu USER_ID
//   y el LIST_ID de tu lista (ej. "Finished"). Cómo conseguirlos:
//   abrí tu lista compartida de Fable en la compu, y están en la URL
//   de la API que carga los libros. (Pedímelos y te ayudo.)
const FABLE_USER_ID = "";
const FABLE_LIST_ID = "";
// ─────────────────────────────────────────────────────────────

// ── AUTOACTUALIZACIÓN ─────────────────────────────────────────
//   El script puede actualizarse solo desde GitHub. Cuando se sube
//   una versión nueva, al abrir este script te avisa y lo reemplaza
//   (sin tocar tu lista, tus tapas ni tu libro actual, que viven
//   en archivos aparte). Subí el número cada vez que cambie el código.
const VERSION = 6;
const RAW_URL = "https://raw.githubusercontent.com/altacaceres-creator/bookshelf-widget/main/bookshelf.js";
// ─────────────────────────────────────────────────────────────


// =========== de acá para abajo no hace falta tocar ===========

const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.cacheDirectory(), "bookshelf_lomos5");
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir);
const listaPath = fm.joinPath(fm.documentsDirectory(), "mi_biblioteca.json");
const libroActualPath = fm.joinPath(fm.documentsDirectory(), "libro_actual.json"); // compartido con "Leyendo ahora"
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]/gi,"_").slice(0,60);}

// Temas del estante
const TEMAS = {
  oscuro:   { card: "#14141a", repisa: "#5f4027", dark: true },
  academia: { card: "#e8dec9", repisa: "#b2874f", dark: false },
};
// A dónde va al tocar el widget
const FABLE_URL = "https://fable.co";

// ── lista guardada (se edita desde el menú) ──
let libros = null;
try { if (fm.fileExists(listaPath)) { const p = JSON.parse(fm.readString(listaPath)); if (Array.isArray(p)) libros = p; } } catch(e) {}
if (libros === null) { libros = DEFAULT.map(x=>Object.assign({},x)); }   // solo la primera vez (lista vacía SÍ se respeta)
function guardar(){ try { fm.writeString(listaPath, JSON.stringify(libros)); } catch(e) {} }
guardar();

// ── configuración de vista (fijo / rotar / por autor) ──
const cfgPath = fm.joinPath(fm.documentsDirectory(), "biblio_config.json");
let cfg = { rotar: ROTAR, modo: "todo", rotarCada: "dia", tema: "oscuro", destacarLeyendo: true, grUrl: "", grAuto: false, grLast: 0, grSync: "merge", fbLast: 0, fbAuto: true, fbUser: "", fbList: "", updCheck: 0, updPend: 0, covers: {}, coversSeeded: false };
try { if (fm.fileExists(cfgPath)) cfg = Object.assign(cfg, JSON.parse(fm.readString(cfgPath))); } catch(e) {}
if (!cfg.covers) cfg.covers = {};
// Fable: guardamos los IDs en la config (no en el código), así la autoactualización no los pisa
if (!cfg.fbUser && FABLE_USER_ID) cfg.fbUser = FABLE_USER_ID;
if (!cfg.fbList && FABLE_LIST_ID) cfg.fbList = FABLE_LIST_ID;
function guardarCfg(){ try { fm.writeString(cfgPath, JSON.stringify(cfg)); } catch(e) {} }
guardarCfg();

// ── tapas elegidas a mano: se guardan aparte y se mantienen aunque sincronices ──
function nslug(t){ return slug(String(t||"").replace(/\s*\([^)]*\)\s*$/,"")); }  // ignora "(Serie, #2)"
function fijarTapa(l){ cfg.covers[nslug(l.titulo)] = l.cover; guardarCfg(); }
function soltarTapa(l){ delete cfg.covers[nslug(l.titulo)]; guardarCfg(); }
function aplicarTapas(list){ const m = cfg.covers||{}; list.forEach(l => { const u = m[nslug(l.titulo)]; if (u) l.cover = u; }); return list; }
// La primera vez, recordá las tapas que pusiste A MANO (links externos),
// para no perderlas al sincronizar. Las automáticas (OpenLibrary/Google/Fable) no se fijan.
if (!cfg.coversSeeded) {
  libros.forEach(l => {
    if (l.cover && !/openlibrary\.org|googleapis\.com|books\.google|fablecdn\.net|cdn\.fable\.co/i.test(l.cover))
      cfg.covers[nslug(l.titulo)] = l.cover;
  });
  cfg.coversSeeded = true; guardarCfg();
}

// capacidad por estante — replica el acomodado del dibujo para saber cuántos entran
function seedW(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return((h>>>0)%100000)/100000;}
function anchoDe(l, bandH){ if (l.face) { const h=Math.round(bandH*0.96); return Math.round(h*0.64); } return Math.round(26 + seedW((l.titulo||"")+"w")*14); }
function capacidad(sel, family){
  const C = { medium:{H:170,shelves:1}, large:{H:360,shelves:2} }[family];
  const PAD=16, GAP=3, BANDGAP=12, W=360, usableW=W-PAD*2;
  const bandH = Math.round((C.H - PAD*2 - BANDGAP*(C.shelves-1))/C.shelves);
  const items = sel.map(l => ({ w: anchoDe(l,bandH), plant:false }));
  if (PLANTA) items.push({ w:34, plant:true });
  const counts=[]; let cur=0, x=0;
  for (const it of items){
    if (x>0 && x+it.w>usableW){ counts.push(cur); cur=0; x=0; if (counts.length>=C.shelves) return counts; }
    if (!it.plant) cur++;
    x+=it.w+GAP;
  }
  if (counts.length<C.shelves) counts.push(cur);
  return counts;
}

// ── Fable: trae tu lista Finished (con las tapas de Fable) ──
async function traerFable(){
  if (!cfg.fbUser || !cfg.fbList) return null;
  const url = "https://api.fable.co/api/v2/users/"+cfg.fbUser+"/book_lists/"+cfg.fbList+"/books?limit=100";
  try {
    const req = new Request(url);
    req.timeoutInterval = 20;
    req.headers = { "User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" };
    const j = await req.loadJSON();
    const arr = j.results || [];
    return arr.map(x => {
      const b = x.book || x;
      const a = (b.authors && b.authors.length) ? b.authors.map(z=>z.name||z).join(", ") : (b.byline || "");
      // tapa de Fable en CHICO (vía el proxy de imágenes) para no reventar la memoria del widget
      let cov = b.cover_image || b.cover_image_small || "";
      if (cov.indexOf("cdn.fable.co") >= 0 && cov.indexOf("img.fablecdn.net") < 0)
        cov = "https://img.fablecdn.net/images/" + cov.replace(/^https?:\/\//,"");
      cov = cov.split("?")[0] + "?w=240";
      return { titulo: b.title, autor: a, cover: cov };
    }).filter(x => x.titulo);
  } catch(e){ return null; }
}
function mergeFable(items){
  // Reemplaza la lista por la de Fable usando SUS tapas. Conserva tus flags
  // (de frente / leyendo). Las tapas que fijaste a mano se reaplican aparte
  // (aplicarTapas), así las lindas de Fable ganan a las automáticas viejas.
  const prev = {}; libros.forEach(l => { prev[slug(l.titulo)] = l; });
  return items.map(it => {
    const n = { titulo: it.titulo, autor: it.autor };
    if (it.cover) n.cover = it.cover;                 // tapa de Fable
    const o = prev[slug(it.titulo)];
    if (o) { if (o.face) n.face = true; if (o.leyendo) n.leyendo = true; }
    return n;
  });
}
async function maybeSyncFable(){
  if (!cfg.fbUser || !cfg.fbList || !cfg.fbAuto) return;
  if (Date.now() - (cfg.fbLast||0) < 20*60*60*1000) return;   // ~1 vez al día
  const items = await traerFable();
  if (items && items.length) { libros = mergeFable(items); guardar(); }
  cfg.fbLast = Date.now(); guardarCfg();
}

function normTitulo(t){
  return String(t||"").replace(/½/g," 1/2").replace(/¼/g," 1/4").replace(/¾/g," 3/4")
    .replace(/&/g," and ").replace(/\s+/g," ").trim();
}
async function coverURL(l){
  const consulta = (normTitulo(l.titulo) + " " + (l.autor||"")).trim();
  // 1) Open Library — búsqueda libre (más tolerante)
  try {
    const j = await new Request("https://openlibrary.org/search.json?q=" + encodeURIComponent(consulta) + "&limit=1&fields=cover_i,isbn").loadJSON();
    const doc = j.docs && j.docs[0];
    if (doc && doc.cover_i) return "https://covers.openlibrary.org/b/id/" + doc.cover_i + "-L.jpg";
    if (doc && doc.isbn && doc.isbn[0]) return "https://covers.openlibrary.org/b/isbn/" + doc.isbn[0] + "-L.jpg";
  } catch(e){}
  // 2) Google Books (fallback)
  try {
    const j2 = await new Request("https://www.googleapis.com/books/v1/volumes?q=" + encodeURIComponent(consulta) + "&maxResults=1").loadJSON();
    const links = j2.items && j2.items[0] && j2.items[0].volumeInfo && j2.items[0].volumeInfo.imageLinks;
    let u = links && (links.thumbnail || links.smallThumbnail);
    if (u) return u.replace("http://","https://").replace("&edge=curl","").replace("zoom=1","zoom=2");
  } catch(e){}
  return null;
}

async function coverB64(l){
  const ruta = fm.joinPath(cacheDir, slug(l.titulo) + ".jpg");
  if (fm.fileExists(ruta)) { const d = fm.read(ruta); if (d) return d.toBase64String(); }
  const u = l.cover || await coverURL(l);
  if (!u) return null;
  try {
    const data = await new Request(u).load();
    if (data) { try { fm.write(ruta, data); } catch(e){} return data.toBase64String(); }
  } catch(e){}
  return null;
}

// JS que corre dentro del WebView: samplea colores y dibuja todo en canvas.
const RENDER_JS = function(){
  var PAL = ["#2f6f6a","#9c3848","#d9a441","#3a5a78","#c9772f","#5b4b8a","#7a9e7e","#a35d3a"];
  function seed(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return((h>>>0)%100000)/100000;}
  function rng(s,a,b){return a+s*(b-a);}
  function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function loadImg(src){return new Promise(function(res){if(!src){res(null);return;}var im=new Image();im.onload=function(){(im.width<8||im.height<8)?res(null):res(im);};im.onerror=function(){res(null);};im.src=src;});}
  function rgba(a,al){return "rgba("+a[0]+","+a[1]+","+a[2]+","+al+")";}
  function sampleCover(im){
    var s=document.createElement("canvas");s.width=30;s.height=45;var sc=s.getContext("2d");
    sc.drawImage(im,0,0,30,45);var d;try{d=sc.getImageData(0,0,30,45).data;}catch(e){return {base:[90,80,74],accent:[150,120,90]};}
    var r=0,g=0,b=0,n=0,x,y,i;
    for(y=0;y<45;y++){for(x=0;x<5;x++){i=(y*30+x)*4;r+=d[i];g+=d[i+1];b+=d[i+2];n++;}}
    var base=[Math.round(r/n),Math.round(g/n),Math.round(b/n)];
    var best=-1,acc=base;
    for(i=0;i<d.length;i+=4){var R=d[i],G=d[i+1],B=d[i+2];var mx=Math.max(R,G,B),mn=Math.min(R,G,B),lum=(mx+mn)/510;
      if(lum<0.22||lum>0.82)continue;var sat=mx===0?0:(mx-mn)/mx;if(sat>best){best=sat;acc=[R,G,B];}}
    return {base:base,accent:acc};
  }
  function vfit(ctx,text,cx,y0,y1,fs,wgt,ink){
    var cy=(y0+y1)/2,avail=(y1-y0)-4;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(-Math.PI/2);
    ctx.font=wgt+" "+fs+"px -apple-system,Helvetica,Arial,sans-serif";
    ctx.fillStyle=ink;ctx.textAlign="center";ctx.textBaseline="middle";
    var t=text;while(ctx.measureText(t).width>avail&&t.length>1){t=t.slice(0,-1);}
    if(t!==text)t=t.slice(0,-1)+"…";ctx.fillText(t,0,0);ctx.restore();
  }
  function spine(ctx,it,x,base){
    var b=it.b,w=it.w,h=it.h,y=base-h,col,ink,inkDim,accent,hasC=!!it.im;
    ctx.fillStyle="rgba(0,0,0,0.28)";ctx.beginPath();ctx.ellipse(x+w/2,base-1,w*0.62,3.5,0,0,Math.PI*2);ctx.fill();
    if(hasC){var sc=sampleCover(it.im);col="rgb("+sc.base[0]+","+sc.base[1]+","+sc.base[2]+")";
      var lum=(sc.base[0]*299+sc.base[1]*587+sc.base[2]*114)/1000/255;
      ink=lum>0.60?"#241f19":"#f7f3ea";inkDim=lum>0.60?"rgba(36,31,25,0.66)":"rgba(247,243,234,0.64)";
      accent=rgba(sc.accent,0.85);}
    else{col=PAL[Math.floor(seed(b.t+"c")*PAL.length)];ink="#f4efe6";inkDim="rgba(247,243,234,0.64)";accent="rgba(255,255,255,0.32)";}
    ctx.fillStyle=col;ctx.fillRect(x,y,w,h);
    var wrap=hasC?Math.round(w*0.22):0;
    if(hasC){ctx.save();ctx.beginPath();ctx.rect(x,y,wrap,h);ctx.clip();
      ctx.drawImage(it.im,0,0,it.im.width*0.16,it.im.height,x,y,wrap,h);ctx.restore();
      ctx.fillStyle="rgba(0,0,0,0.28)";ctx.fillRect(x+wrap-1,y,1.2,h);
      ctx.fillStyle="rgba(255,255,255,0.10)";ctx.fillRect(x+wrap,y,0.8,h);}
    var g=ctx.createLinearGradient(x,0,x+w,0);
    g.addColorStop(0,"rgba(255,255,255,0.20)");g.addColorStop(0.18,"rgba(255,255,255,0.02)");
    g.addColorStop(0.80,"rgba(0,0,0,0.06)");g.addColorStop(1,"rgba(0,0,0,0.32)");
    ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    ctx.fillStyle="rgba(255,255,255,0.12)";ctx.fillRect(x,y,0.8,h);
    ctx.fillStyle="rgba(0,0,0,0.40)";ctx.fillRect(x+w-0.8,y,0.8,h);
    ctx.fillStyle="rgba(0,0,0,0.20)";ctx.fillRect(x,y,w,2);
    var tx0=x+wrap+4,tw=w-wrap-8,cx=x+wrap+(w-wrap)/2;
    ctx.fillStyle=accent;ctx.fillRect(tx0,y+8,tw,1.3);ctx.fillRect(tx0,y+h-9,tw,1.3);
    var tfs=Math.max(7,Math.min(10,(w-wrap)*0.52));
    // autor al pie SOLO si el apellido entra entero (nada de "Bu…")
    var afs=Math.max(6,tfs-2), autor="";
    if(b.a && (w-wrap)>=15){
      var sp=b.a.split(",")[0].trim().split(" ");var sur=sp[sp.length-1];
      ctx.save();ctx.font="500 "+afs+"px -apple-system,Helvetica,Arial,sans-serif";
      var availA=(y+h-10)-(y+h*0.74)-2;
      if(ctx.measureText(sur).width<=availA) autor=sur;
      ctx.restore();
    }
    if(autor){ vfit(ctx,b.t,cx,y+13,y+h*0.70,tfs,"600",ink); vfit(ctx,autor,cx,y+h*0.74,y+h-10,afs,"500",inkDim); }
    else { vfit(ctx,b.t,cx,y+13,y+h-11,tfs,"600",ink); }
    if(b.ley) marcador(ctx,x,y,w,false);
  }
  function marcador(ctx,x,y,w,isFace){
    var rojo="#c0392b";
    if(isFace){
      var bw=12, bx=x+w-bw-8, bh=22, yt=y-1;
      ctx.fillStyle=rojo;ctx.beginPath();
      ctx.moveTo(bx,yt);ctx.lineTo(bx+bw,yt);ctx.lineTo(bx+bw,yt+bh);
      ctx.lineTo(bx+bw/2,yt+bh-5);ctx.lineTo(bx,yt+bh);ctx.closePath();ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.25)";ctx.fillRect(bx,yt,2,bh-4);
    } else {
      ctx.fillStyle=rojo;ctx.fillRect(x,y,w,3);
      ctx.fillStyle="rgba(255,255,255,0.25)";ctx.fillRect(x,y,w,1);
    }
  }
  function facecard(ctx,b,x,y,w,h){
    // tapa "de frente" cuando NO hay portada: fondo lindo + título (así igual se voltea)
    var c0=PAL[Math.floor(seed((b.t||"")+"c")*PAL.length)];
    ctx.fillStyle=c0;ctx.fillRect(x,y,w,h);
    var ig=ctx.createLinearGradient(x,y,x,y+h);
    ig.addColorStop(0,"rgba(255,255,255,0.14)");ig.addColorStop(1,"rgba(0,0,0,0.30)");
    ctx.fillStyle=ig;ctx.fillRect(x,y,w,h);
    ctx.strokeStyle="rgba(255,255,255,0.30)";ctx.lineWidth=1;ctx.strokeRect(x+4.5,y+4.5,w-9,h-9);
    var ink="#f7f3ea",fs=Math.max(8,Math.min(13,w*0.135));
    ctx.fillStyle=ink;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="700 "+fs+"px Georgia,'Times New Roman',serif";
    var words=String(b.t||"").split(" "),lines=[],cur="";
    for(var i=0;i<words.length;i++){var tt=cur?cur+" "+words[i]:words[i];
      if(ctx.measureText(tt).width>w-16&&cur){lines.push(cur);cur=words[i];}else cur=tt;}
    if(cur)lines.push(cur);
    if(lines.length>4){lines=lines.slice(0,4);lines[3]=lines[3].slice(0,-1)+"…";}
    var lh=fs*1.18,total=lines.length*lh,cy=y+h*0.44-total/2+lh/2;
    for(var j=0;j<lines.length;j++)ctx.fillText(lines[j],x+w/2,cy+j*lh);
    if(b.a){var afs=Math.max(7,fs-3);ctx.font="italic "+afs+"px Georgia,serif";
      ctx.fillStyle="rgba(247,243,234,0.82)";var au=b.a.split(",")[0];
      while(ctx.measureText(au).width>w-16&&au.length>1)au=au.slice(0,-1);
      ctx.fillText(au,x+w/2,y+h-afs*1.7);}
  }
  function face(ctx,it,x,base){
    var w=it.w,h=it.h,y=base-h;
    ctx.fillStyle="rgba(0,0,0,0.34)";ctx.beginPath();ctx.ellipse(x+w/2,base-1,w*0.62,4.5,0,0,Math.PI*2);ctx.fill();
    if(it.im){ctx.drawImage(it.im,x,y,w,h);}else{facecard(ctx,it.b,x,y,w,h);}
    ctx.fillStyle="rgba(255,255,255,0.14)";ctx.fillRect(x,y,2,h);
    ctx.fillStyle="rgba(0,0,0,0.16)";ctx.fillRect(x,y,w,2);
    ctx.fillStyle="rgba(222,212,196,0.95)";ctx.fillRect(x+w,y+2,2.5,h-2);
    var fg=ctx.createLinearGradient(x,0,x+w,0);fg.addColorStop(0,"rgba(255,255,255,0.10)");fg.addColorStop(0.2,"rgba(255,255,255,0)");fg.addColorStop(1,"rgba(0,0,0,0.07)");ctx.fillStyle=fg;ctx.fillRect(x,y,w,h);
    if(it.b.ley) marcador(ctx,x,y,w,true);
  }
  function plant(ctx,x,base){
    function el(cx,cy,rx,ry,rot,c){ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    el(x+16,base-42,13,9,0,"#5a8a5e");el(x+6,base-50,6,13,-0.5,"#4e7a52");
    el(x+26,base-50,6,13,0.5,"#6b9e6f");el(x+16,base-58,6,15,0,"#5a8a5e");
    ctx.fillStyle="#c47a4e";ctx.beginPath();ctx.moveTo(x+4,base-32);ctx.lineTo(x+28,base-32);ctx.lineTo(x+25,base-2);ctx.lineTo(x+7,base-2);ctx.closePath();ctx.fill();
    ctx.fillStyle="#d98a5c";ctx.fillRect(x+2,base-34,28,6);
  }
  window.__run=function(BOOKS,W,H,SHELVES,WOOD,CARD,PLANTA,DARK,SCALE){
    SCALE=SCALE||3;var PAD=16,GAP=3,BANDGAP=12;
    return (async function(){
      for(var i=0;i<BOOKS.length;i++){BOOKS[i].im=await loadImg(BOOKS[i].img);}
      var cv=document.getElementById("c");cv.width=W*SCALE;cv.height=H*SCALE;
      var ctx=cv.getContext("2d");ctx.scale(SCALE,SCALE);
      rr(ctx,0,0,W,H,16);ctx.fillStyle=CARD;ctx.fill();ctx.save();rr(ctx,0,0,W,H,16);ctx.clip();
      var sombraFondo = DARK ? 0.20 : 0.10;
      var bgg=ctx.createLinearGradient(0,0,0,H);bgg.addColorStop(0,"rgba(255,255,255,0.05)");bgg.addColorStop(0.55,"rgba(0,0,0,0)");bgg.addColorStop(1,"rgba(0,0,0,"+sombraFondo+")");ctx.fillStyle=bgg;ctx.fillRect(0,0,W,H);
      var usableW=W-PAD*2;var bandH=Math.round((H-PAD*2-BANDGAP*(SHELVES-1))/SHELVES);
      var items=BOOKS.map(function(b){
        if(b.face){var h=Math.round(bandH*0.96);return {b:b,im:b.im,w:Math.round(h*0.64),h:h,face:true};}
        var w=Math.round(rng(seed(b.t+"w"),26,40));var h2=Math.round(rng(seed(b.t+"h"),bandH*0.74,bandH*0.99));
        return {b:b,im:b.im,w:w,h:h2,face:false};
      });
      if(PLANTA)items.push({plant:true,w:34});
      var shelves=[],cur=[],x=0;
      for(var k=0;k<items.length;k++){var it=items[k];
        if(cur.length&&x+it.w>usableW){shelves.push(cur);cur=[];x=0;if(shelves.length>=SHELVES)break;}
        cur.push(it);x+=it.w+GAP;}
      if(cur.length&&shelves.length<SHELVES)shelves.push(cur);
      for(var si=0;si<shelves.length;si++){var sh=shelves[si];
        var top=PAD+si*(bandH+BANDGAP),base=top+bandH;
        ctx.fillStyle="rgba(0,0,0,0.35)";ctx.fillRect(PAD-2,base+8,usableW+4,4);
        var lg=ctx.createLinearGradient(0,base,0,base+9);lg.addColorStop(0,"#7a5636");lg.addColorStop(1,"#452c14");
        ctx.fillStyle=lg;ctx.fillRect(PAD-2,base,usableW+4,9);
        ctx.fillStyle="rgba(255,255,255,0.18)";ctx.fillRect(PAD-2,base,usableW+4,2);
        var tot=0;for(var m=0;m<sh.length;m++)tot+=sh[m].w;tot+=GAP*(sh.length-1);
        var cx=PAD+Math.max(0,(usableW-tot)/2);
        for(var n2=0;n2<sh.length;n2++){var o=sh[n2];
          if(o.plant)plant(ctx,cx,base);else if(o.face)face(ctx,o,cx,base);else spine(ctx,o,cx,base);
          cx+=o.w+GAP;}
      }
      var vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.62);
      vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,"+(DARK?0.22:0.10)+")");
      ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
      ctx.restore();
      return cv.toDataURL("image/png");
    })();
  };
};

function ventanaAutor(arr, max){
  const autores=[], porAutor={};
  arr.forEach(l=>{ const a=((l.autor||"").trim())||"—"; if(!porAutor[a]){porAutor[a]=[];autores.push(a);} porAutor[a].push(l); });
  if(!autores.length) return arr.slice(0,max);
  const idx = Math.floor(Date.now()/(60*60*1000)) % autores.length;   // cambia de autor ~cada hora
  const out=[];
  for(let k=0;k<autores.length && out.length<max;k++){
    const a=autores[(idx+k)%autores.length];
    for(const l of porAutor[a]){ if(out.length<max) out.push(l); }
  }
  return out;
}
function ventana(arr, max){
  if (!cfg.rotar) return arr.slice(0, max);              // fijo
  if (cfg.modo === "autor") return ventanaAutor(arr, max); // rota por autor
  if (arr.length <= max) return arr.slice(0, max);
  // "dia": cambia 1 vez por día (así preview y widget muestran lo mismo todo el día)
  // "rato": cambia cada ~30 min (más vivo, pero puede no coincidir con la preview)
  const diario = (cfg.rotarCada !== "rato");
  const periodo = diario ? 24*60*60*1000 : 30*60*1000;
  const paso = diario ? max : 2;                         // de día: una "página" nueva por jornada
  const off = (Math.floor(Date.now()/periodo)*paso) % arr.length;
  const out = [];
  for (let i=0;i<max;i++) out.push(arr[(off+i)%arr.length]);
  return out;
}

function leerLibroActual(){
  try { if (fm.fileExists(libroActualPath)) { const p = JSON.parse(fm.readString(libroActualPath)); if (p && p.titulo) return p; } } catch(e){}
  return null;
}

async function crearImagen(family){
  const CFG = { medium:{W:360,H:170,shelves:1,max:11}, large:{W:360,H:360,shelves:2,max:22} }[family]||{W:360,H:170,shelves:1,max:11};
  const T = TEMAS[cfg.tema] || TEMAS.oscuro;

  let base = aplicarTapas(libros);
  let destacado = null;
  const act = cfg.destacarLeyendo ? leerLibroActual() : null;
  if (act) {
    destacado = { titulo: act.titulo, autor: act.autor||"", cover: act.cover, face: true, ley: true };
    base = base.filter(l => nslug(l.titulo) !== nslug(act.titulo));   // no duplicar
  }
  let sel = ventana(base, destacado ? CFG.max-1 : CFG.max);
  if (destacado) sel = [destacado].concat(sel);

  const books = [];
  for (const l of sel){
    const b64 = await coverB64(l);
    books.push({ t:l.titulo, a:l.autor||"", face:!!l.face, ley:!!l.ley, img: b64 ? ("data:image/jpeg;base64,"+b64) : null });
  }
  // El grande usa escala 2 (más liviano, para que iOS lo refresque igual de rápido que el mediano)
  const SCALE = (family === "large") ? 2 : 3;
  const wv = new WebView();
  await wv.loadHTML("<canvas id='c'></canvas>", null, new Size(CFG.W, CFG.H), false);
  const bootstrap = "(" + RENDER_JS.toString() + ")();";
  const call = "(function(){window.__run(" + JSON.stringify(books) + "," + CFG.W + "," + CFG.H + "," + CFG.shelves
    + ",'" + T.repisa + "','" + T.card + "'," + (PLANTA?"true":"false") + "," + (T.dark?"true":"false") + "," + SCALE + ")"
    + ".then(function(d){completion(d);}).catch(function(e){completion('ERR:'+String(e));});})();";
  const out = await wv.evaluateJavaScript(bootstrap + call, true);
  if (typeof out !== "string" || out.indexOf("data:image") !== 0) return null;
  return Image.fromData(Data.fromBase64String(out.split(",")[1]));
}

async function crearWidget(){
  const family = config.widgetFamily || "medium";
  const fam = (family === "small") ? "medium" : family;
  await maybeSyncFable();                      // se actualiza solo desde Fable (si está configurado)
  await maybeSyncGoodreads();                 // se actualiza solo desde Goodreads (si está activado)
  const img = await crearImagen(fam);
  const w = new ListWidget();
  w.setPadding(0,0,0,0);
  w.backgroundColor = new Color((TEMAS[cfg.tema]||TEMAS.oscuro).card);
  if (img) w.backgroundImage = img;
  else { const t = w.addText("Tocá el script en Scriptable para configurar"); t.textColor = new Color((TEMAS[cfg.tema]||TEMAS.oscuro).dark?"#ffffff":"#2b241b"); t.font = Font.systemFont(12); }
  w.url = FABLE_URL;                                         // tocar el widget abre Fable
  // Pedile a iOS que refresque seguido, así los cambios (sacar/agregar libros,
  // tapas, rotación) se ven rápido en vez de quedar pegados horas.
  w.refreshAfterDate = new Date(Date.now() + 10*60*1000);   // ~10 min
  return w;
}

// ───────────── MENÚ para actualizar sin código ─────────────
async function agregarLibro(){
  const a = new Alert();
  a.title = "Agregar libro";
  a.message = "Escribí el título (y el autor si querés). Aparecerá al principio del estante.";
  a.addTextField("Título", "");
  a.addTextField("Autor (opcional)", "");
  a.addAction("Agregar");
  a.addCancelAction("Cancelar");
  const r = await a.presentAlert();
  if (r === 0) {
    const t = (a.textFieldValue(0) || "").trim();
    const au = (a.textFieldValue(1) || "").trim();
    if (t) { libros.unshift({ titulo: t, autor: au }); guardar(); }
  }
}

function parseLinea(s){
  s = (s||"").trim();
  if (!s) return null;
  s = s.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "");       // saca viñetas / numeración
  let t = s, a = "";
  const m = s.split(/\s[—–-]\s|\s+by\s+/i);              // "Título - Autor" o "Título by Autor"
  if (m.length >= 2) { t = m[0].trim(); a = m.slice(1).join(" - ").trim(); }
  else if (s.indexOf(",") > 0) { const p = s.split(","); t = p[0].trim(); a = p.slice(1).join(",").trim(); }
  if (!t) return null;
  return { titulo: t, autor: a };
}

async function agregarLista(){
  let txt = "";
  try { txt = Pasteboard.pasteString() || ""; } catch(e) {}
  if (!txt.trim()) {
    const n = new Alert();
    n.title = "Pegar lista";
    n.message = "Primero copiá tu lista (un libro por línea). Ejemplo:\n\nThe Hobbit - J.R.R. Tolkien\nDune\nCirce - Madeline Miller\n\nDespués volvé a tocar esta opción y los agrego todos.";
    n.addAction("Entendido"); await n.presentAlert();
    return;
  }
  let lineas = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if (lineas.length <= 1) lineas = txt.split(/[,;]+/).map(s=>s.trim()).filter(Boolean); // por si pegó todo en una línea
  const nuevos = lineas.map(parseLinea).filter(x => x && x.titulo);
  if (!nuevos.length) {
    const n = new Alert(); n.title = "No encontré libros";
    n.message = "Revisá que haya un libro por línea."; n.addAction("OK"); await n.presentAlert();
    return;
  }
  const a = new Alert();
  a.title = "Agregar " + nuevos.length + " libro" + (nuevos.length>1?"s":"");
  a.message = nuevos.slice(0,10).map(x => "• " + x.titulo).join("\n") + (nuevos.length>10 ? "\n…y "+(nuevos.length-10)+" más" : "");
  a.addAction("Agregar"); a.addCancelAction("Cancelar");
  const r = await a.presentAlert();
  if (r === 0) { libros = nuevos.concat(libros); guardar(); }
}

function gdPick(s, tag){
  const m = s.match(new RegExp("<"+tag+">([\\s\\S]*?)<\\/"+tag+">","i"));
  if (!m) return "";
  let v = m[1].trim().replace(/^<!\[CDATA\[/,"").replace(/\]\]>$/,"").trim();
  v = v.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#0?39;/g,"'").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  return v.trim();
}
function parseGoodreads(xml){
  const out = [];
  const parts = xml.split(/<item>/i).slice(1);
  for (const p of parts){
    const body = p.split(/<\/item>/i)[0];
    const t = gdPick(body, "title");
    const au = gdPick(body, "author_name");
    let cov = gdPick(body, "book_large_image_url") || gdPick(body, "book_medium_image_url") || gdPick(body, "book_image_url");
    if (cov) cov = cov.replace("http://","https://").replace(/\._S[XY]\d+_\./,".");  // intentar tapa más grande
    if (t) out.push(cov ? { titulo: t, autor: au, cover: cov } : { titulo: t, autor: au });
  }
  return out;
}
// Acepta cualquier link de Goodreads (página o RSS) o un número de usuario,
// y arma la URL RSS correcta. Devuelve null si no reconoce nada.
function normalizarGoodreads(input){
  let s = (input||"").trim();
  if (!s) return null;
  // ya es un feed RSS
  if (/\/review\/list_rss\//i.test(s)) return s;
  // número de usuario suelto
  if (/^\d+$/.test(s)) return "https://www.goodreads.com/review/list_rss/" + s + "?shelf=read";
  // sacar el id de usuario de cualquier URL de Goodreads
  let m = s.match(/\/review\/list\/(\d+)/i) || s.match(/\/user\/show\/(\d+)/i) || s.match(/goodreads\.com\/(\d+)/i);
  if (!m) { const any = s.match(/(\d{5,})/); if (any) m = any; }
  if (!m) return null;
  const id = m[1];
  const shelf = (s.match(/[?&]shelf=([^&#]+)/i) || [,"read"])[1];
  return "https://www.goodreads.com/review/list_rss/" + id + "?shelf=" + shelf;
}

async function importarGoodreads(){
  const a = new Alert();
  a.title = "Importar de Goodreads";
  a.message = "Pegá el link de tu estante de Goodreads.\n\nCómo conseguirlo: en goodreads.com entrá a My Books, abrí tu estante (ej. 'Read') y copiá la dirección de esa página (la de la barra del navegador). Yo me encargo del resto.\n(Tu estante tiene que ser público.)";
  a.addTextField("https://www.goodreads.com/review/list/…", "");
  a.addAction("Importar"); a.addCancelAction("Cancelar");
  const r = await a.presentAlert();
  if (r !== 0) return;
  const url = normalizarGoodreads(a.textFieldValue(0));
  if (!url) {
    const n = new Alert(); n.title = "Link no reconocido";
    n.message = "Pegá el link de tu estante de Goodreads (el de la barra del navegador, que contiene tu número de usuario).";
    n.addAction("OK"); await n.presentAlert(); return;
  }
  let xml = "";
  try {
    const req = new Request(url);
    req.headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" };
    xml = await req.loadString();
  } catch(e) {}
  if (!xml || xml.indexOf("<item>") < 0) {
    const n = new Alert(); n.title = "No pude leer el feed";
    n.message = "Revisá que tu estante de Goodreads sea público (Goodreads → Settings → Privacy) y volvé a intentar.";
    n.addAction("OK"); await n.presentAlert(); return;
  }
  const items = parseGoodreads(xml);
  if (!items.length) { const n = new Alert(); n.title = "Sin libros"; n.message = "No encontré libros en ese RSS."; n.addAction("OK"); await n.presentAlert(); return; }
  const nuevos = items.filter(it => !libros.some(l => slug(l.titulo) === slug(it.titulo)));
  const a2 = new Alert();
  a2.title = "Importar de Goodreads";
  a2.message = "Encontré " + items.length + " libros en Goodreads"
    + (libros.length ? " · tu lista tiene " + libros.length + "." : ".")
    + "\n\n• Fusionar: suma los " + nuevos.length + " que te faltan, sin borrar ni duplicar nada."
    + "\n• Reemplazar: deja SOLO los de Goodreads."
    + "\n• Agregar al final: suma todos (puede duplicar).";
  a2.addAction("Fusionar (recomendado)");  // 0
  a2.addAction("Reemplazar mi lista");     // 1
  a2.addAction("Agregar al final");        // 2
  a2.addCancelAction("Cancelar");
  const r2 = await a2.presentSheet();
  if (r2 === 0) { libros = libros.concat(nuevos); cfg.grSync = "merge"; guardar(); }
  else if (r2 === 1) { libros = mergeGoodreads(items); cfg.grSync = "replace"; guardar(); }
  else if (r2 === 2) { libros = libros.concat(items); cfg.grSync = "merge"; guardar(); }
  else return;
  cfg.grUrl = url; cfg.grLast = Date.now(); guardarCfg();
  const a3 = new Alert();
  a3.title = "Sincronizar solo";
  a3.message = "¿Querés que el widget se actualice solo con tu Goodreads, más o menos una vez por día? (Respeta los libros que pongas de frente y las tapas que cambies.)";
  a3.addAction("Sí, sincronizar solo"); a3.addCancelAction("No por ahora");
  const r3 = await a3.presentAlert();
  cfg.grAuto = (r3 === 0); guardarCfg();
}

function mergeGoodreads(items){
  const prev = {}; libros.forEach(l => { prev[slug(l.titulo)] = l; });
  return items.map(it => {
    const n = { titulo: it.titulo, autor: it.autor };
    if (it.cover) n.cover = it.cover;
    const o = prev[slug(it.titulo)];
    if (o) { if (o.face) n.face = true; if (o.cover) n.cover = o.cover; }   // conserva ajustes manuales
    return n;
  });
}
function aplicarGoodreads(items){
  // "merge": agrega solo los que faltan, sin borrar ni duplicar lo tuyo.
  // "replace": deja solo los de Goodreads (conservando face/tapa de los que coinciden).
  if (cfg.grSync === "replace") return mergeGoodreads(items);
  const faltan = items.filter(it => !libros.some(l => slug(l.titulo) === slug(it.titulo)));
  return libros.concat(faltan);
}
function reqGoodreads(url){
  const req = new Request(url);
  req.headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" };
  return req;
}
async function maybeSyncGoodreads(){
  if (!cfg.grAuto || !cfg.grUrl) return;
  if (Date.now() - (cfg.grLast||0) < 20*60*60*1000) return;   // ~1 vez al día
  try {
    const xml = await reqGoodreads(cfg.grUrl).loadString();
    if (xml && xml.indexOf("<item>") >= 0) { const items = parseGoodreads(xml); if (items.length) { libros = aplicarGoodreads(items); guardar(); } }
  } catch(e) {}
  cfg.grLast = Date.now(); guardarCfg();
}
async function syncAhora(){
  if (!cfg.grUrl) return;
  let ok = false;
  try { const xml = await reqGoodreads(cfg.grUrl).loadString(); if (xml && xml.indexOf("<item>")>=0){ const items = parseGoodreads(xml); if (items.length){ libros = aplicarGoodreads(items); guardar(); ok = true; } } } catch(e){}
  cfg.grLast = Date.now(); guardarCfg();
  const n = new Alert();
  n.title = ok ? "Listo" : "No pude sincronizar";
  n.message = ok ? ("Actualicé desde Goodreads: " + libros.length + " libros.") : "Revisá el link RSS o la conexión.";
  n.addAction("OK"); await n.presentAlert();
}

async function vaciarLista(){
  const a = new Alert();
  a.title = "¿Vaciar la lista?";
  a.message = "Quita todos los libros para empezar de cero. (Podés pegar una lista nueva después.)";
  a.addDestructiveAction("Vaciar todo"); a.addCancelAction("Cancelar");
  const r = await a.presentSheet();
  if (r === 0) { libros = []; guardar(); }
}

function ordenarAlfabetico(){
  libros.sort((a,b) => (a.titulo||"").localeCompare((b.titulo||""), "es", {sensitivity:"base"}));
  guardar();
}
function mezclar(){
  for (let i = libros.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    const t = libros[i]; libros[i] = libros[j]; libros[j] = t;
  }
  guardar();
}

function borrarCacheDe(l){ try { const p = fm.joinPath(cacheDir, slug(l.titulo) + ".jpg"); if (fm.fileExists(p)) fm.remove(p); } catch(e){} }

async function pegarURLTapa(l){
  const a = new Alert();
  a.title = "Pegar URL de tapa";
  a.message = "Pegá el link de una imagen (.jpg) de la tapa que quieras.";
  a.addTextField("https://…", l.cover || "");
  a.addAction("Guardar"); a.addCancelAction("Cancelar");
  const r = await a.presentAlert();
  if (r === 0) { const u = (a.textFieldValue(0)||"").trim(); if (u) { l.cover = u; fijarTapa(l); borrarCacheDe(l); guardar(); } }
}

async function elegirEdicion(l){
  let ids = [];
  try {
    const q = "title=" + encodeURIComponent(l.titulo) + (l.autor ? ("&author=" + encodeURIComponent(l.autor)) : "");
    const j = await new Request("https://openlibrary.org/search.json?" + q + "&language=eng&limit=16&fields=cover_i").loadJSON();
    (j.docs||[]).forEach(d => { if (d.cover_i && ids.indexOf(d.cover_i) < 0) ids.push(d.cover_i); });
  } catch(e){}
  ids = ids.slice(0, 12);
  if (!ids.length) { const n = new Alert(); n.title = "Sin resultados"; n.message = "No encontré otras ediciones en inglés para este libro."; n.addAction("OK"); await n.presentAlert(); return; }
  const t = new UITable(); t.showSeparators = true;
  const h = new UITableRow(); h.isHeader = true; h.addText("Elegí una tapa (inglés)", l.titulo); t.addRow(h);
  ids.forEach(id => {
    const row = new UITableRow(); row.height = 130;
    const im = row.addImageAtURL("https://covers.openlibrary.org/b/id/" + id + "-M.jpg");
    im.widthWeight = 100;
    row.onSelect = () => {
      l.cover = "https://covers.openlibrary.org/b/id/" + id + "-L.jpg";
      fijarTapa(l); borrarCacheDe(l); guardar();
      t.removeAllRows(); const d = new UITableRow(); d.addText("✅  Tapa elegida — cerrá para volver"); t.addRow(d); t.reload();
    };
    t.addRow(row);
  });
  await t.present();
}

async function cambiarTapa(l){
  const a = new Alert();
  a.title = "Tapa de " + l.titulo;
  a.message = "¿Cómo querés cambiarla?";
  a.addAction("Elegir otra edición");         // 0
  a.addAction("Pegar URL de una tapa");       // 1
  a.addAction("Volver a la automática");      // 2
  a.addCancelAction("Cancelar");
  const r = await a.presentSheet();
  if (r === 0) await elegirEdicion(l);
  else if (r === 1) await pegarURLTapa(l);
  else if (r === 2) { delete l.cover; soltarTapa(l); borrarCacheDe(l); guardar(); }
}

async function accionesLibro(i){
  const l = libros[i];
  const a = new Alert();
  a.title = l.titulo;
  a.message = l.autor || "";
  a.addAction(l.face ? "Quitar de frente" : "Poner de frente");  // 0
  a.addAction("🖼️  Cambiar tapa");                                // 1
  a.addAction("↑  Subir uno");                                    // 2
  a.addAction("↓  Bajar uno");                                    // 3
  a.addAction("⤒  Mover al principio");                           // 4
  a.addDestructiveAction("Quitar de la lista");                   // 5
  a.addCancelAction("Cancelar");
  const r = await a.presentSheet();
  if (r === 0) { l.face = !l.face; guardar(); }
  else if (r === 1) { await cambiarTapa(l); }
  else if (r === 2 && i > 0) { libros[i] = libros[i-1]; libros[i-1] = l; guardar(); }
  else if (r === 3 && i < libros.length-1) { libros[i] = libros[i+1]; libros[i+1] = l; guardar(); }
  else if (r === 4) { libros.splice(i,1); libros.unshift(l); guardar(); }
  else if (r === 5) { libros.splice(i,1); guardar(); }
}

async function refrescarTapas(){
  try { if (fm.fileExists(cacheDir)) { for (const f of fm.listContents(cacheDir)) fm.remove(fm.joinPath(cacheDir, f)); } } catch(e){}
  const n = new Alert(); n.title = "Listo"; n.message = "Las tapas se vuelven a bajar la próxima vez que se dibuje el widget.";
  n.addAction("OK"); await n.presentAlert();
}

// ───────────── Autoactualización desde GitHub ─────────────
async function versionRemota(){
  if (!RAW_URL) return null;
  try {
    const code = await new Request(RAW_URL).loadString();
    if (!code || !/window\.__run/.test(code)) return null;     // bajó algo raro, no un script válido
    const m = code.match(/const\s+VERSION\s*=\s*(\d+)/);
    return { v: m ? parseInt(m[1],10) : 0, code: code };
  } catch(e){ return null; }
}
async function instalarActualizacion(code, v){
  try {
    fm.writeString(module.filename, code);                     // se reemplaza a sí mismo
    cfg.updPend = 0; guardarCfg();
    const n = new Alert(); n.title = "¡Listo! 🎉";
    n.message = "Actualizado a la v"+v+".\nCerrá y volvé a abrir el script. El widget se redibuja solo (tu lista y tus tapas quedan intactas).";
    n.addAction("OK"); await n.presentAlert(); return true;
  } catch(e){
    const n = new Alert(); n.title = "No pude guardar";
    n.message = "Scriptable no pudo reemplazar el archivo:\n"+e; n.addAction("OK"); await n.presentAlert(); return false;
  }
}
async function buscarActualizacion(){
  const r = await versionRemota();
  if (!r){ const n=new Alert(); n.title="No pude buscar"; n.message="Revisá tu conexión e intentá de nuevo."; n.addAction("OK"); await n.presentAlert(); return; }
  if (r.v <= VERSION){ cfg.updPend = 0; guardarCfg(); const n=new Alert(); n.title="Ya estás al día ✨"; n.message="Tenés la última versión (v"+VERSION+")."; n.addAction("OK"); await n.presentAlert(); return; }
  const a = new Alert();
  a.title = "Nueva versión disponible";
  a.message = "Hay una versión nueva (v"+r.v+", vos tenés v"+VERSION+").\n\nSe actualiza solo el código. Tu lista, tus tapas y tu libro actual no se tocan.";
  a.addAction("Actualizar ahora"); a.addCancelAction("Ahora no");
  if (await a.presentAlert() === 0) await instalarActualizacion(r.code, r.v);
}
// chequeo liviano 1 vez al día (al abrir el menú): deja una marca si hay versión nueva
async function autoChequeoUpdate(){
  if (!RAW_URL) return;
  if (Date.now() - (cfg.updCheck||0) < 24*60*60*1000) return;
  cfg.updCheck = Date.now(); guardarCfg();
  const r = await versionRemota();
  cfg.updPend = (r && r.v > VERSION) ? r.v : 0; guardarCfg();
}

async function menu(){
  const table = new UITable();
  table.showSeparators = true;
  await autoChequeoUpdate();
  function construir(){
    table.removeAllRows();
    const capL = capacidad(ventana(libros,22),"large");
    const capM = capacidad(ventana(libros,11),"medium");
    const estado = cfg.rotar ? (cfg.modo==="autor" ? "rotando por autor" : "rotando") : "fijo";
    let r = new UITableRow(); r.isHeader = true;
    r.addText("📚 Mi biblioteca ("+libros.length+")",
      "Grande: "+(capL[0]||0)+" arriba · "+(capL[1]||0)+" abajo  |  Mediano: "+(capM[0]||0)+"  ·  "+estado);
    table.addRow(r);

    if (cfg.updPend && cfg.updPend > VERSION){
      r = new UITableRow(); r.height = 54;
      let cu = r.addText("🎉  ¡Hay una versión nueva! (v"+cfg.updPend+")", "Tocá para actualizar — no pierdes tu lista ni tus tapas");
      cu.titleColor = Color.green(); cu.titleFont = Font.boldSystemFont(16);
      r.onSelect = async () => { await buscarActualizacion(); construir(); table.reload(); };
      table.addRow(r);
    }

    r = new UITableRow(); r.height = 50;
    let c = r.addText("➕  Agregar libro"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { await agregarLibro(); construir(); table.reload(); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("📋  Pegar lista (varios de una)"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { await agregarLista(); construir(); table.reload(); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("📥  Importar de Goodreads"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { await importarGoodreads(); construir(); table.reload(); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("🔤  Ordenar alfabético"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = () => { ordenarAlfabetico(); construir(); table.reload(); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("🔀  Mezclar"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = () => { mezclar(); construir(); table.reload(); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("⬇️  Buscar actualización", "Trae la última versión del código desde GitHub");
    c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { await buscarActualizacion(); construir(); table.reload(); };
    table.addRow(r);

    if (cfg.fbUser && cfg.fbList){
      r = new UITableRow(); r.height = 50;
      c = r.addText("📘  Sincronizar con Fable ahora"); c.titleFont = Font.semiboldSystemFont(16);
      r.onSelect = async () => {
        const items = await traerFable();
        const n = new Alert();
        if (items && items.length){
          libros = mergeFable(items); cfg.fbLast = Date.now(); guardar(); guardarCfg();
          try { if (fm.fileExists(cacheDir)) { for (const f of fm.listContents(cacheDir)) fm.remove(fm.joinPath(cacheDir, f)); } } catch(e){}  // que bajen las tapas de Fable frescas
          n.title = "Listo"; n.message = "Actualicé desde Fable: " + libros.length + " libros."; }
        else { n.title = "No pude leer Fable"; n.message = "Revisá tu conexión o los IDs de Fable."; }
        n.addAction("OK"); await n.presentAlert(); construir(); table.reload();
      };
      table.addRow(r);
    }

    r = new UITableRow(); r.height = 50;
    c = r.addText("👀  Vista previa (mediano)"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { const img = await crearImagen("medium"); if (img) await QuickLook.present(img); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("👀  Vista previa (grande · 2 estantes)"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { const img = await crearImagen("large"); if (img) await QuickLook.present(img); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("🧹  Refrescar tapas"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { await refrescarTapas(); };
    table.addRow(r);

    r = new UITableRow(); r.height = 50;
    c = r.addText("🗑️  Vaciar lista (empezar de cero)"); c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = async () => { await vaciarLista(); construir(); table.reload(); };
    table.addRow(r);

    // ── Vista del estante: fijo / rotar / por autor ──
    r = new UITableRow(); r.isHeader = true; r.addText("Cómo se muestra el estante"); table.addRow(r);

    r = new UITableRow(); r.height = 54;
    c = r.addText(cfg.rotar ? "🔁  Rotación: ACTIVADA" : "📌  Rotación: FIJO",
      cfg.rotar ? "Muestra distintos libros durante el día — tocá para fijar" : "Siempre muestra los primeros — tocá para que rote");
    c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = () => { cfg.rotar = !cfg.rotar; guardarCfg(); construir(); table.reload(); };
    table.addRow(r);

    if (cfg.rotar) {
      r = new UITableRow(); r.height = 54;
      c = r.addText(cfg.modo==="autor" ? "👤  Rota: por autor" : "📚  Rota: toda la biblioteca",
        cfg.modo==="autor" ? "Cada rato destaca a un autor — tocá para cambiar" : "Va pasando por todos — tocá para rotar por autor");
      c.titleFont = Font.semiboldSystemFont(16);
      r.onSelect = () => { cfg.modo = (cfg.modo==="autor") ? "todo" : "autor"; guardarCfg(); construir(); table.reload(); };
      table.addRow(r);

      if (cfg.modo !== "autor") {
        const diario = (cfg.rotarCada !== "rato");
        r = new UITableRow(); r.height = 54;
        c = r.addText(diario ? "📅  Cambia: cada día" : "⏱️  Cambia: durante el día",
          diario ? "Preview y widget coinciden todo el día — tocá para que cambie seguido" : "Más vivo, pero puede no coincidir con la preview — tocá para 1 vez al día");
        c.titleFont = Font.semiboldSystemFont(16);
        r.onSelect = () => { cfg.rotarCada = diario ? "rato" : "dia"; guardarCfg(); construir(); table.reload(); };
        table.addRow(r);
      }
    }

    r = new UITableRow(); r.height = 54;
    c = r.addText(cfg.tema==="academia" ? "☕  Tema: dark academia (claro)" : "🌙  Tema: oscuro",
      "Tocá para cambiar el look del estante");
    c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = () => { cfg.tema = (cfg.tema==="academia") ? "oscuro" : "academia"; guardarCfg(); construir(); table.reload(); };
    table.addRow(r);

    r = new UITableRow(); r.height = 54;
    c = r.addText(cfg.destacarLeyendo ? "🔖  Destacar “leyendo ahora”: SÍ" : "🔖  Destacar “leyendo ahora”: no",
      cfg.destacarLeyendo ? "Tu libro actual sale de frente con una cintita — se marca en el widget Leyendo ahora" : "Tocá para destacarlo en el estante");
    c.titleFont = Font.semiboldSystemFont(16);
    r.onSelect = () => { cfg.destacarLeyendo = !cfg.destacarLeyendo; guardarCfg(); construir(); table.reload(); };
    table.addRow(r);

    if (cfg.grUrl) {
      r = new UITableRow(); r.isHeader = true; r.addText("Goodreads"); table.addRow(r);

      r = new UITableRow(); r.height = 54;
      c = r.addText(cfg.grAuto ? "🔄  Sincronización: ACTIVADA" : "⏸️  Sincronización: pausada",
        cfg.grAuto ? "Se actualiza solo ~1 vez al día — tocá para pausar" : "Tocá para activar");
      c.titleFont = Font.semiboldSystemFont(16);
      r.onSelect = () => { cfg.grAuto = !cfg.grAuto; if (cfg.grAuto) cfg.grLast = 0; guardarCfg(); construir(); table.reload(); };
      table.addRow(r);

      r = new UITableRow(); r.height = 54;
      c = r.addText("⤵️  Sincronizar ahora"); c.titleFont = Font.semiboldSystemFont(16);
      r.onSelect = async () => { await syncAhora(); construir(); table.reload(); };
      table.addRow(r);
    }

    r = new UITableRow(); r.isHeader = true;
    r.addText("Tus libros (tocá uno para editarlo)", "El orden define los estantes: primero arriba, después abajo");
    table.addRow(r);

    libros.forEach((l, i) => {
      const row = new UITableRow(); row.height = 46;
      const tc = row.addText((l.face ? "⭐ " : "") + l.titulo, l.autor || "");
      tc.widthWeight = 100;
      row.onSelect = async () => { await accionesLibro(i); construir(); table.reload(); };
      table.addRow(row);
    });
  }
  construir();
  await table.present();
  guardar();
}

// ───────────── arranque ─────────────
if (config.runsInWidget) {
  const widget = await crearWidget();
  Script.setWidget(widget);
  Script.complete();
} else {
  await menu();              // tocado dentro de Scriptable → menú para editar
  Script.complete();
}
