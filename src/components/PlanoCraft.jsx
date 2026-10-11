import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/customSupabaseClient";

// ─── Utilidades ────────────────────────────────────────────────────────────
const COLORS = ["#4a8eff","#34d399","#fbbf24","#f87171","#a78bfa","#f472b6","#22d3ee","#fb923c","#2dd4bf","#818cf8"];
function polyArea(pts){let a=0;for(let i=0,j=pts.length-1;i<pts.length;j=i++)a+=pts[i].x*pts[j].y-pts[j].x*pts[i].y;return Math.abs(a/2)/10000}
function snap(v){return Math.round(v/10)*10}
function distSeg(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;if(!l2)return Math.hypot(px-x1,py-y1);let t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l2));return Math.hypot(px-(x1+t*dx),py-(y1+t*dy))}
function pip(x,y,pts){let ins=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){if(((pts[i].y>y)!==(pts[j].y>y))&&x<(pts[j].x-pts[i].x)*(y-pts[i].y)/(pts[j].y-pts[i].y)+pts[i].x)ins=!ins}return ins}
let _nid=1;function gid(){return _nid++}

// ─── Modal React (sin prompt()) ────────────────────────────────────────────
function DlgModal({dlg, dlgVals, setDlgVals, onOk, onCancel}){
  if(!dlg) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)"}} onClick={e=>{if(e.target===e.currentTarget)onCancel()}}>
      <div style={{background:"#13161e",border:"1px solid #1f2433",borderRadius:12,padding:24,width:360}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>{dlg.title}</div>
        {dlg.fields.map((f,i)=>(
          <div key={f.key} style={{marginBottom:12}}>
            <label style={{fontSize:11,color:"#6b7a92",display:"block",marginBottom:4}}>{f.label}</label>
            {f.type==="textarea"
              ?<textarea autoFocus={i===0} value={dlgVals[f.key]||""} onChange={e=>setDlgVals(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",height:60,padding:"8px 10px",background:"#0c0e14",border:"1px solid #1f2433",borderRadius:6,color:"#dde3ed",fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical"}}/>
              :<input autoFocus={i===0} value={dlgVals[f.key]||""} onChange={e=>setDlgVals(p=>({...p,[f.key]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){onOk(dlgVals)}}} style={{width:"100%",padding:"8px 10px",background:"#0c0e14",border:"1px solid #1f2433",borderRadius:6,color:"#dde3ed",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            }
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={onCancel} style={{...btnS,flex:1,justifyContent:"center",color:"#6b7a92"}}>Cancelar</button>
          <button onClick={()=>onOk(dlgVals)} style={{...btnS,flex:1,justifyContent:"center",background:"#4a8eff",borderColor:"#4a8eff",color:"#fff"}}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
// Props:
//   planId       — ID del plano en Supabase (para referencia)
//   planNombre   — Nombre del plano (mostrado en el header)
//   initialData  — { walls, rooms, doors, windows, dims, texts }
//   onBack       — función al pulsar "← Volver"
//   onSave       — función(data) llamada con auto-guardado cada 2s
// ──────────────────────────────────────────────────────────────────────────
export default function PlanoCraft({ planId, planNombre, initialData, onBack, onSave }) {
  const cRef=useRef(null), wRef=useRef(null);
  const r=useRef({zoom:1,px:0,py:0,walls:[],rooms:[],doors:[],windows:[],dims:[],texts:[],st:null,si:null,tool:"select",pan:false,ps:null,drag:false,ds:null,dw:null,sd:true,dr:null,sr:null,ms:null,wcs:null,wci:null});
  const hist=useRef([]);

  const[tool,setTool]=useState("select");
  const[walls,setWalls]=useState([]);
  const[rooms,setRooms]=useState([]);
  const[doors,setDoors]=useState([]);
  const[wins,setWins]=useState([]);
  const[dims,setDims]=useState([]);
  const[texts,setTexts]=useState([]);
  const[sType,setSType]=useState(null);
  const[sId,setSId]=useState(null);
  const[zoom,setZoom]=useState(1);
  const[pan,setPan]=useState({x:0,y:0});
  const[mouse,setMouse]=useState({x:0,y:0});
  const[showD,setShowD]=useState(true);
  const[showK,setShowK]=useState(false);
  const[mSel,setMSel]=useState(null);
  const[expR,setExpR]=useState({});
  const[dirty,setDirty]=useState(false);
  const[dlg,setDlg]=useState(null);
  const[dlgVals,setDlgVals]=useState({});
  const[bgImage,setBgImage]=useState(null);    // URL imagen de fondo
  const[showBg,setShowBg]=useState(true);       // toggle visibilidad
  const[bgOpacity,setBgOpacity]=useState(0.35); // opacidad 0-1
  const[bgUploading,setBgUploading]=useState(false);
  const bgImgEl=useRef(null);                   // Image precargada
  const fileInputRef=useRef(null);

  const openDlg=(title,fields,onOk)=>{
    const v={};
    fields.forEach(f=>v[f.key]=f.def||"");
    setDlgVals(v);
    setDlg({title,fields,onOk});
  };
  const closeDlg=()=>setDlg(null);
  const confirmDlg=(vals)=>{if(dlg){dlg.onOk(vals);setDlg(null);}};

  // Cargar datos iniciales
  useEffect(()=>{
    if(!initialData) return;
    const d=initialData;
    setWalls(d.walls||[]);
    setRooms(d.rooms||[]);
    setDoors(d.doors||[]);
    setWins(d.windows||[]);
    setDims(d.dims||[]);
    setTexts(d.texts||[]);
    const ex={};(d.rooms||[]).forEach(rm=>ex[rm.name]=true);
    setExpR(ex);
    // Cargar imagen de fondo si existe
    if(d.bgImage){
      setBgImage(d.bgImage);
      const img=new Image();
      img.crossOrigin="anonymous";
      img.onload=()=>{bgImgEl.current=img;render();};
      img.src=d.bgImage;
    } else {
      setBgImage(null);
      bgImgEl.current=null;
    }
    setDirty(false);
    setTimeout(()=>{
      const c=cRef.current;
      if(!c||!(d.walls||[]).length)return;
      let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
      (d.walls||[]).forEach(w=>{x1=Math.min(x1,w.x1,w.x2);y1=Math.min(y1,w.y1,w.y2);x2=Math.max(x2,w.x1,w.x2);y2=Math.max(y2,w.y1,w.y2)});
      if(!isFinite(x1))return;
      const pw=x2-x1,ph=y2-y1;
      const z=Math.min((c.width-80)/pw,(c.height-80)/ph,2.5);
      setZoom(z);
      setPan({x:(c.width-pw*z)/2-x1*z,y:(c.height-ph*z)/2-y1*z});
    },150);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[planId]);

  useEffect(()=>{const s=r.current;s.zoom=zoom;s.px=pan.x;s.py=pan.y;s.walls=walls;s.rooms=rooms;s.doors=doors;s.windows=wins;s.dims=dims;s.texts=texts;s.st=sType;s.si=sId;s.tool=tool;s.sd=showD;s.ms=mSel;s.showBg=showBg;s.bgOpacity=bgOpacity});

  const markDirty=useCallback(()=>setDirty(true),[]);
  const save=useCallback(()=>{
    const s=r.current;
    hist.current.push(JSON.parse(JSON.stringify({w:s.walls,d:s.doors,n:s.windows,m:s.dims,r:s.rooms,t:s.texts})));
    if(hist.current.length>50)hist.current.shift();
    markDirty();
  },[markDirty]);
  const undo=useCallback(()=>{
    if(!hist.current.length)return;
    const h=hist.current.pop();
    setWalls(h.w);setDoors(h.d);setWins(h.n);setDims(h.m);setRooms(h.r);setTexts(h.t);
    setSType(null);setSId(null);setMSel(null);
    markDirty();
  },[markDirty]);

  // Auto-guardado en Supabase cada 2s cuando hay cambios
  useEffect(()=>{
    if(!dirty)return;
    const t=setTimeout(()=>{
      onSave({walls,rooms,doors,windows:wins,dims,texts,bgImage:bgImage||undefined});
      setDirty(false);
    },2000);
    return()=>clearTimeout(t);
  },[dirty,walls,rooms,doors,wins,dims,texts,onSave]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const render=useCallback(()=>{
    const c=cRef.current;if(!c)return;
    const x=c.getContext("2d");const s=r.current;const W=c.width,H=c.height;
    if(!W||!H||!isFinite(s.zoom))return;
    x.clearRect(0,0,W,H);
    const st2=20*s.zoom,bg=100*s.zoom;
    x.strokeStyle="rgba(74,142,255,.04)";x.lineWidth=.5;x.beginPath();
    for(let i=s.px%st2;i<W;i+=st2){x.moveTo(i,0);x.lineTo(i,H)}
    for(let i=s.py%st2;i<H;i+=st2){x.moveTo(0,i);x.lineTo(W,i)}
    x.stroke();
    x.strokeStyle="rgba(74,142,255,.09)";x.beginPath();
    for(let i=s.px%bg;i<W;i+=bg){x.moveTo(i,0);x.lineTo(i,H)}
    for(let i=s.py%bg;i<H;i+=bg){x.moveTo(0,i);x.lineTo(W,i)}
    x.stroke();
    x.save();x.translate(s.px,s.py);x.scale(s.zoom,s.zoom);
    // Background image (plano manuscrito)
    if(s.showBg&&bgImgEl.current){
      const img=bgImgEl.current;
      x.globalAlpha=s.bgOpacity??0.35;
      x.drawImage(img,0,0);
      x.globalAlpha=1;
    }
    // Rooms fill
    s.rooms.forEach(rm=>{if(!rm.pts||rm.pts.length<3)return;x.beginPath();x.moveTo(rm.pts[0].x,rm.pts[0].y);for(let i=1;i<rm.pts.length;i++)x.lineTo(rm.pts[i].x,rm.pts[i].y);x.closePath();x.fillStyle=rm.color+"1a";x.fill()});
    // Walls
    s.walls.forEach(w=>{const sel=s.st==="wall"&&s.si===w.id;x.beginPath();x.moveTo(w.x1,w.y1);x.lineTo(w.x2,w.y2);x.strokeStyle=sel?"#4a8eff":"#8896ab";x.lineWidth=w.t||8;x.lineCap="round";x.stroke();x.beginPath();x.moveTo(w.x1,w.y1);x.lineTo(w.x2,w.y2);x.strokeStyle=sel?"#1e3a6e":"#1a2030";x.lineWidth=Math.max(1,(w.t||8)-3);x.stroke()});
    // Drawing wall preview
    if(s.dw){x.beginPath();x.moveTo(s.dw.x1,s.dw.y1);x.lineTo(s.dw.x2,s.dw.y2);x.strokeStyle="#4a8eff55";x.lineWidth=8;x.setLineDash([8,5]);x.stroke();x.setLineDash([])}
    // Chain close indicator
    if(s.wcs&&s.wci&&s.wci.length>=1){x.beginPath();x.arc(s.wcs.x,s.wcs.y,10,0,Math.PI*2);x.fillStyle="#34d39933";x.fill();x.beginPath();x.arc(s.wcs.x,s.wcs.y,6,0,Math.PI*2);x.fillStyle="#34d399";x.fill();x.font="bold 9px system-ui";x.fillStyle="#34d399";x.textAlign="center";x.fillText("cerrar",s.wcs.x,s.wcs.y-14)}
    // Room drawing preview
    if(s.dr&&s.dr.pts.length>0){const p=s.dr.pts;x.beginPath();x.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)x.lineTo(p[i].x,p[i].y);if(s.dr.cur)x.lineTo(s.dr.cur.x,s.dr.cur.y);x.strokeStyle="#34d39980";x.lineWidth=2;x.setLineDash([6,4]);x.stroke();x.setLineDash([]);p.forEach((pt,i)=>{x.beginPath();x.arc(pt.x,pt.y,4,0,Math.PI*2);x.fillStyle=i===0?"#34d399":"#6b7a92";x.fill()})}
    // Doors
    s.doors.forEach(d=>{x.save();x.translate(d.x,d.y);x.rotate((d.angle||0)*Math.PI/180);const w=d.w||40;x.beginPath();x.arc(0,0,w,-Math.PI/2,0);x.strokeStyle="#4a8eff";x.lineWidth=1.5;x.stroke();x.beginPath();x.moveTo(0,0);x.lineTo(w,0);x.strokeStyle="#4a8eff";x.lineWidth=2.5;x.stroke();x.restore()});
    // Windows
    s.windows.forEach(w=>{x.save();x.translate(w.x,w.y);x.rotate((w.angle||0)*Math.PI/180);const ww=w.w||50;x.beginPath();x.moveTo(-ww/2,-3);x.lineTo(ww/2,-3);x.moveTo(-ww/2,3);x.lineTo(ww/2,3);x.strokeStyle="#22d3ee";x.lineWidth=1.5;x.stroke();x.beginPath();x.moveTo(-ww/2,0);x.lineTo(ww/2,0);x.strokeStyle="#22d3ee60";x.lineWidth=5;x.stroke();x.restore()});
    // Dims
    if(s.sd){s.walls.forEach(w=>{const d=s.dims.find(dd=>dd.wallId===w.id);if(!d)return;const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.sqrt(dx*dx+dy*dy),ang=Math.atan2(dy,dx),off=d.off||25;const nx=-Math.sin(ang)*off,ny=Math.cos(ang)*off;const sx=w.x1+nx,sy=w.y1+ny,ex=w.x2+nx,ey=w.y2+ny;x.beginPath();x.moveTo(w.x1,w.y1);x.lineTo(sx,sy);x.moveTo(w.x2,w.y2);x.lineTo(ex,ey);x.strokeStyle="#3a4560";x.lineWidth=.7;x.stroke();x.beginPath();x.moveTo(sx,sy);x.lineTo(ex,ey);x.strokeStyle="#5a6a82";x.lineWidth=.9;x.stroke();const mx=(sx+ex)/2,my=(sy+ey)/2,val=d.val||(len/100).toFixed(2);x.save();x.translate(mx,my);let ta=ang;if(ta>Math.PI/2||ta<-Math.PI/2)ta+=Math.PI;x.rotate(ta);x.font="500 10px monospace";const tw=x.measureText(val+" m").width+8;x.fillStyle="#0c0e14";x.fillRect(-tw/2,-14,tw,13);x.fillStyle="#dde3ed";x.textAlign="center";x.textBaseline="bottom";x.fillText(val+" m",0,-3);x.restore()})}
    // Room labels
    s.rooms.forEach(rm=>{if(!rm.pts||rm.pts.length<3)return;const cx=rm.lx??rm.pts.reduce((a,p)=>a+p.x,0)/rm.pts.length;const cy=rm.ly??rm.pts.reduce((a,p)=>a+p.y,0)/rm.pts.length;x.font="bold 13px system-ui";x.fillStyle=rm.color;x.textAlign="center";x.fillText(rm.name,cx,cy-7);x.font="11px monospace";x.fillStyle="#6b7a92";x.fillText(polyArea(rm.pts).toFixed(2)+" m²",cx,cy+8);if(rm.h){x.font="10px monospace";x.fillStyle="#4a5568";x.fillText("h="+rm.h+"m",cx,cy+21)}});
    // Texts
    s.texts.forEach(t=>{x.font=(t.s||12)+"px system-ui";x.fillStyle="#8896ab";x.textAlign="left";x.fillText(t.text,t.x,t.y)});
    // Multi-selection highlight
    if(s.ms){s.ms.wI?.forEach(id=>{const w=s.walls.find(ww=>ww.id===id);if(w){x.beginPath();x.moveTo(w.x1,w.y1);x.lineTo(w.x2,w.y2);x.strokeStyle="#fbbf2466";x.lineWidth=(w.t||8)+6;x.lineCap="round";x.stroke()}})}
    x.restore();
    // Selection rect
    if(s.sr){const rr=s.sr;const sx2=Math.min(rr.x1,rr.x2),sy2=Math.min(rr.y1,rr.y2),sw=Math.abs(rr.x2-rr.x1),sh=Math.abs(rr.y2-rr.y1);x.strokeStyle="#fbbf24";x.lineWidth=1;x.setLineDash([5,3]);x.strokeRect(sx2*s.zoom+s.px,sy2*s.zoom+s.py,sw*s.zoom,sh*s.zoom);x.setLineDash([])}
  },[]);

  useEffect(()=>{
    const h=()=>{const c=cRef.current;const w=wRef.current;if(!c||!w)return;c.width=w.clientWidth;c.height=w.clientHeight;render()};
    h();window.addEventListener("resize",h);const t=setTimeout(h,100);
    return()=>{window.removeEventListener("resize",h);clearTimeout(t)};
  },[render]);
  useEffect(()=>{render()},[walls,rooms,doors,wins,dims,texts,sType,sId,zoom,pan,showD,showBg,bgOpacity,render]);

  const resizeWall=useCallback((id,m)=>{
    const v=parseFloat(m);if(isNaN(v)||v<=0)return;
    save();
    setWalls(p=>p.map(w=>{if(w.id!==id)return w;const a=Math.atan2(w.y2-w.y1,w.x2-w.x1);return{...w,x2:w.x1+Math.cos(a)*v*100,y2:w.y1+Math.sin(a)*v*100}}));
    setDims(p=>p.map(d=>d.wallId===id?{...d,val:v.toFixed(2)}:d));
  },[save]);

  const deleteWall=useCallback(id=>{
    const w=r.current.walls.find(ww=>ww.id===id);if(!w)return;
    save();
    setWalls(p=>p.filter(ww=>ww.id!==id));
    setDims(p=>p.filter(d=>d.wallId!==id));
    setDoors(p=>p.filter(d=>distSeg(d.x,d.y,w.x1,w.y1,w.x2,w.y2)>15));
    setWins(p=>p.filter(ww=>distSeg(ww.x,ww.y,w.x1,w.y1,w.x2,w.y2)>15));
    setSType(null);setSId(null);
  },[save]);

  const finishRoom=useCallback(pts=>{
    openDlg("Nueva estancia",
      [{key:"name",label:"Nombre",def:"Habitación "+(r.current.rooms.length+1)},{key:"h",label:"Altura (m)",def:"2.50"}],
      (v)=>{
        const name=v.name.trim()||"Habitación";
        const h=parseFloat(v.h)||2.50;
        const cx=pts.reduce((a,p)=>a+p.x,0)/pts.length;
        const cy=pts.reduce((a,p)=>a+p.y,0)/pts.length;
        save();
        setRooms(p=>[...p,{name,color:COLORS[p.length%COLORS.length],h,pts,lx:cx,ly:cy}]);
        setExpR(p=>({...p,[name]:true}));
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[save]);

  // ─── Mouse handlers ───────────────────────────────────────────────────────
  const onDown=useCallback(e=>{
    if(dlg)return;
    const c=cRef.current;if(!c)return;
    const rc=c.getBoundingClientRect();
    const mx=e.clientX-rc.left,my=e.clientY-rc.top;
    const s=r.current;
    const w={x:(mx-s.px)/s.zoom,y:(my-s.py)/s.zoom};
    if(s.tool==="move"||e.button===1){s.pan=true;s.ps={x:mx-s.px,y:my-s.py};return}
    if(s.tool==="zoomin"){setZoom(p=>{const n=Math.min(6,p*1.35);const rt=n/p;setPan(pp=>({x:mx-(mx-pp.x)*rt,y:my-(my-pp.y)*rt}));return n});return}
    if(s.tool==="zoomout"){setZoom(p=>{const n=Math.max(.08,p*0.7);const rt=n/p;setPan(pp=>({x:mx-(mx-pp.x)*rt,y:my-(my-pp.y)*rt}));return n});return}
    if(s.tool==="select"){
      let f=false;
      if(s.ms){for(const wl of s.walls){if(s.ms.wI?.includes(wl.id)&&distSeg(w.x,w.y,wl.x1,wl.y1,wl.x2,wl.y2)<12){s.drag=true;s.ds={x:w.x,y:w.y,type:"multi"};f=true;break}}}
      if(!f){for(const rm of s.rooms){if(!rm.pts||rm.pts.length<3)continue;const lx=rm.lx??rm.pts.reduce((a,p)=>a+p.x,0)/rm.pts.length;const ly=rm.ly??rm.pts.reduce((a,p)=>a+p.y,0)/rm.pts.length;if(Math.abs(w.x-lx)<45&&Math.abs(w.y-ly)<22){setSType("label");setSId(rm.name);setMSel(null);s.drag=true;s.ds={x:w.x,y:w.y,olx:lx,oly:ly,type:"label",name:rm.name};f=true;break}}}
      if(!f){for(const wl of s.walls){if(distSeg(w.x,w.y,wl.x1,wl.y1,wl.x2,wl.y2)<12){setSType("wall");setSId(wl.id);setMSel(null);s.drag=true;s.ds={x:w.x,y:w.y,ox1:wl.x1,oy1:wl.y1,ox2:wl.x2,oy2:wl.y2,id:wl.id,type:"wall"};f=true;break}}}
      if(!f){for(const rm of s.rooms){if(rm.pts&&pip(w.x,w.y,rm.pts)){setSType("room");setSId(rm.name);setMSel(null);f=true;break}}}
      if(!f){setSType(null);setSId(null);setMSel(null);s.sr={x1:w.x,y1:w.y,x2:w.x,y2:w.y}}
    }
    if(s.tool==="wall"){
      const sx=snap(w.x),sy=snap(w.y);
      if(!s.dw){if(!s.wcs){s.wcs={x:sx,y:sy};s.wci=[]}s.dw={x1:sx,y1:sy,x2:sx,y2:sy}}
      else{
        const cs=s.wcs;
        const cl=cs&&s.wci&&s.wci.length>=2&&Math.hypot(sx-cs.x,sy-cs.y)<20;
        const ex=cl?cs.x:sx,ey=cl?cs.y:sy;
        save();
        const nw={x1:s.dw.x1,y1:s.dw.y1,x2:ex,y2:ey,t:8,id:gid()};
        const len=Math.sqrt((nw.x2-nw.x1)**2+(nw.y2-nw.y1)**2);
        if(len>5){
          setWalls(p=>[...p,nw]);
          setDims(p=>[...p,{off:25,val:(len/100).toFixed(2),id:gid(),wallId:nw.id}]);
          s.wci.push(nw.id);
        }
        if(cl&&s.wci.length>=3){
          const pts=[{x:cs.x,y:cs.y}];
          for(const cid of s.wci){const cw=[...r.current.walls,nw].find(ww=>ww.id===cid);if(cw&&Math.hypot(cw.x2-cs.x,cw.y2-cs.y)>5)pts.push({x:cw.x2,y:cw.y2})}
          s.wcs=null;s.wci=null;s.dw=null;
          if(pts.length>=3)finishRoom(pts);
        }else{s.dw={x1:ex,y1:ey,x2:ex,y2:ey}}
      }
    }
    if(s.tool==="door"){save();setDoors(p=>[...p,{x:snap(w.x),y:snap(w.y),w:40,angle:0,id:gid()}])}
    if(s.tool==="window"){save();setWins(p=>[...p,{x:snap(w.x),y:snap(w.y),w:50,angle:0,id:gid()}])}
    if(s.tool==="text"){openDlg("Texto",[{key:"t",label:"Texto",def:""}],v=>{if(v.t){save();setTexts(p=>[...p,{x:w.x,y:w.y,text:v.t,s:13}])}})}
    if(s.tool==="room"){
      const sx=snap(w.x),sy=snap(w.y);
      if(!s.dr){s.dr={pts:[{x:sx,y:sy}],cur:null}}
      else{
        const f=s.dr.pts[0];
        if(s.dr.pts.length>=3&&Math.hypot(sx-f.x,sy-f.y)<20){const pts=[...s.dr.pts];s.dr=null;finishRoom(pts)}
        else{s.dr.pts.push({x:sx,y:sy})}
      }
      render();
    }
  },[dlg,finishRoom,save,render,openDlg]);

  const onMove=useCallback(e=>{
    const c=cRef.current;if(!c)return;
    const rc=c.getBoundingClientRect();
    const mx=e.clientX-rc.left,my=e.clientY-rc.top;
    const s=r.current;
    const w={x:(mx-s.px)/s.zoom,y:(my-s.py)/s.zoom};
    setMouse({x:Math.round(w.x),y:Math.round(w.y)});
    if(s.pan){setPan({x:mx-s.ps.x,y:my-s.ps.y});return}
    if(s.dw){
      let sx=snap(w.x),sy=snap(w.y);
      if(e.shiftKey){if(Math.abs(sx-s.dw.x1)>Math.abs(sy-s.dw.y1))sy=s.dw.y1;else sx=s.dw.x1}
      s.dw.x2=sx;s.dw.y2=sy;render();return;
    }
    if(s.dr){s.dr.cur={x:snap(w.x),y:snap(w.y)};render();return}
    if(s.sr){s.sr.x2=w.x;s.sr.y2=w.y;render();return}
    if(s.drag&&s.ds){
      const dx=w.x-s.ds.x,dy=w.y-s.ds.y;
      if(s.ds.type==="label")setRooms(p=>p.map(rm=>rm.name===s.ds.name?{...rm,lx:s.ds.olx+dx,ly:s.ds.oly+dy}:rm));
      else if(s.ds.type==="wall")setWalls(p=>p.map(wl=>wl.id===s.ds.id?{...wl,x1:snap(s.ds.ox1+dx),y1:snap(s.ds.oy1+dy),x2:snap(s.ds.ox2+dx),y2:snap(s.ds.oy2+dy)}:wl));
    }
  },[render]);

  const onDblClick=useCallback(e=>{
    if(dlg)return;
    const c=cRef.current;if(!c)return;
    const rc=c.getBoundingClientRect();
    const mx=e.clientX-rc.left,my=e.clientY-rc.top;
    const s=r.current;
    const w={x:(mx-s.px)/s.zoom,y:(my-s.py)/s.zoom};
    for(const wl of s.walls){
      if(distSeg(w.x,w.y,wl.x1,wl.y1,wl.x2,wl.y2)<15){
        const cur=(Math.sqrt((wl.x2-wl.x1)**2+(wl.y2-wl.y1)**2)/100).toFixed(2);
        openDlg("Medida",[{key:"v",label:"Longitud (m)",def:cur}],v=>{if(!isNaN(parseFloat(v.v))&&parseFloat(v.v)>0)resizeWall(wl.id,v.v)});
        return;
      }
    }
  },[dlg,resizeWall,openDlg]);

  const onUp=useCallback(()=>{
    const s=r.current;
    if(s.sr){
      const rr=s.sr;
      const x1=Math.min(rr.x1,rr.x2),y1=Math.min(rr.y1,rr.y2),x2=Math.max(rr.x1,rr.x2),y2=Math.max(rr.y1,rr.y2);
      if(Math.abs(x2-x1)>5&&Math.abs(y2-y1)>5){
        const ib=(px,py)=>px>=x1&&px<=x2&&py>=y1&&py<=y2;
        const wI=s.walls.filter(w=>ib((w.x1+w.x2)/2,(w.y1+w.y2)/2)).map(w=>w.id);
        if(wI.length){setMSel({wI});setSType("multi");setSId(null)}
      }
      s.sr=null;render();
    }
    s.pan=false;
    if(s.drag&&s.ds)save();
    s.drag=false;s.ds=null;
  },[render,save]);

  const onWheel=useCallback(e=>{
    e.preventDefault();
    const c=cRef.current;if(!c)return;
    const rc=c.getBoundingClientRect();
    const cx=e.clientX-rc.left,cy=e.clientY-rc.top;
    const f=e.deltaY<0?1.1:.9;
    setZoom(p=>{const n=Math.max(.08,Math.min(6,p*f));const rt=n/p;setPan(pp=>({x:cx-(cx-pp.x)*rt,y:cy-(cy-pp.y)*rt}));return n});
  },[]);

  useEffect(()=>{
    const h=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      const k=e.key.toLowerCase();const ct=e.ctrlKey||e.metaKey;
      if(ct&&k==="z"){e.preventDefault();undo();return}
      const m={v:"select",h:"move",w:"wall",d:"door",n:"window",t:"text",r:"room"};
      if(m[k]&&!ct)setTool(m[k]);
      if(k==="escape"){r.current.dw=null;r.current.dr=null;r.current.sr=null;r.current.wcs=null;r.current.wci=null;setMSel(null);render()}
      if((k==="delete"||k==="backspace")&&r.current.st==="wall")deleteWall(r.current.si);
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[render,deleteWall,undo]);

  useEffect(()=>{
    const h=e=>{if(e.ctrlKey||e.metaKey)e.preventDefault()};
    window.addEventListener("wheel",h,{passive:false});
    return()=>window.removeEventListener("wheel",h);
  },[]);

  const uploadBgImage=useCallback(async(file)=>{
    if(!file||!planId)return;
    setBgUploading(true);
    try{
      const ext=file.name.split(".").pop();
      const path=`${planId}_bg.${ext}`;
      const {error:upErr}=await supabase.storage
        .from("proyectos_fotos")
        .upload(`planos/${path}`,file,{upsert:true,contentType:file.type});
      if(upErr)throw upErr;
      const {data:urlData}=supabase.storage
        .from("proyectos_fotos")
        .getPublicUrl(`planos/${path}`);
      const url=urlData.publicUrl;
      setBgImage(url);
      const img=new Image();
      img.crossOrigin="anonymous";
      img.onload=()=>{bgImgEl.current=img;render();markDirty();};
      img.src=url;
    }catch(e){
      alert("Error subiendo imagen: "+e.message);
    }finally{
      setBgUploading(false);
    }
  },[planId,render,markDirty]);

  const removeBgImage=useCallback(()=>{
    setBgImage(null);
    bgImgEl.current=null;
    markDirty();
    render();
  },[markDirty,render]);

  const exportPNG=useCallback(()=>{
    if(!walls.length)return;
    let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
    walls.forEach(w=>{x1=Math.min(x1,w.x1,w.x2);y1=Math.min(y1,w.y1,w.y2);x2=Math.max(x2,w.x1,w.x2);y2=Math.max(y2,w.y1,w.y2)});
    const p=60,sc=2,tc=document.createElement("canvas");
    tc.width=(x2-x1+p*2)*sc;tc.height=(y2-y1+p*2)*sc;
    const tx=tc.getContext("2d");
    tx.fillStyle="#fff";tx.fillRect(0,0,tc.width,tc.height);
    tx.save();tx.translate((-x1+p)*sc,(-y1+p)*sc);tx.scale(sc,sc);
    rooms.forEach(rm=>{if(rm.pts?.length>=3){tx.beginPath();tx.moveTo(rm.pts[0].x,rm.pts[0].y);rm.pts.slice(1).forEach(pt=>tx.lineTo(pt.x,pt.y));tx.closePath();tx.fillStyle=rm.color+"22";tx.fill()}});
    walls.forEach(w=>{tx.beginPath();tx.moveTo(w.x1,w.y1);tx.lineTo(w.x2,w.y2);tx.strokeStyle="#333";tx.lineWidth=w.t||8;tx.lineCap="round";tx.stroke()});
    rooms.forEach(rm=>{if(rm.pts?.length>=3){const cx=rm.pts.reduce((s,pt)=>s+pt.x,0)/rm.pts.length,cy=rm.pts.reduce((s,pt)=>s+pt.y,0)/rm.pts.length;tx.font="bold 13px sans-serif";tx.fillStyle="#333";tx.textAlign="center";tx.fillText(rm.name,cx,cy-4);tx.font="10px monospace";tx.fillStyle="#666";tx.fillText(polyArea(rm.pts).toFixed(2)+" m²",cx,cy+11)}});
    tx.restore();
    const a=document.createElement("a");a.href=tc.toDataURL("image/png");a.download=(planNombre||"plano")+".png";a.click();
  },[walls,rooms,planNombre]);

  const selWall=sType==="wall"?walls.find(w=>w.id===sId):null;
  const selWallLen=selWall?Math.sqrt((selWall.x2-selWall.x1)**2+(selWall.y2-selWall.y1)**2)/100:0;

  return (
    <div style={{background:"#0c0e14",color:"#dde3ed",height:"calc(100vh - 120px)",display:"flex",flexDirection:"column",fontFamily:"system-ui",borderRadius:12,overflow:"hidden",minHeight:500}}>
      {/* Input oculto para subir imagen de fondo - debe estar al nivel raíz */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadBgImage(f);e.target.value="";}}/>
      <DlgModal dlg={dlg} dlgVals={dlgVals} setDlgVals={setDlgVals} onOk={confirmDlg} onCancel={closeDlg}/>

      {/* Header */}
      <div style={{padding:"0 16px",height:44,borderBottom:"1px solid #1f2433",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#13161e",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>{onSave({walls,rooms,doors,windows:wins,dims,texts});onBack()}} style={{...btnS,padding:"4px 8px"}}>← Volver</button>
          <span style={{fontWeight:600,fontSize:14}}>{planNombre||"Plano"}</span>
          {dirty&&<span style={{fontSize:9,color:"#fbbf24"}}>● sin guardar</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>fileInputRef.current?.click()} disabled={bgUploading} style={{...btnS,color:"#34d399",borderColor:"#34d39930"}} title="Subir plano manuscrito de fondo">
            {bgUploading?"⏳":"🖼️"}{bgUploading?" Subiendo...":" Fondo"}
          </button>
          <button onClick={()=>{onSave({walls,rooms,doors,windows:wins,dims,texts,bgImage:bgImage||undefined});setDirty(false)}} style={btnS}>💾 Guardar</button>
          <button onClick={exportPNG} style={{...btnS,background:"#4a8eff",borderColor:"#4a8eff",color:"#fff"}}>PNG</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Toolbar */}
        <div style={{width:showK?160:48,background:"#13161e",borderRight:"1px solid #1f2433",display:"flex",flexDirection:"column",padding:"6px 0",gap:1,flexShrink:0,overflowY:"auto"}}>
          {[{id:"select",ic:"↖",l:"Seleccionar",k:"V"},{id:"move",ic:"✥",l:"Mover",k:"H"},0,{id:"wall",ic:"▬",l:"Pared",k:"W"},{id:"room",ic:"⬡",l:"Habitación",k:"R"},{id:"door",ic:"◨",l:"Puerta",k:"D"},{id:"window",ic:"⊞",l:"Ventana",k:"N"},{id:"text",ic:"T",l:"Texto",k:"T"},0,{id:"zoomin",ic:"🔍+",l:"Zoom +",k:"+"},{id:"zoomout",ic:"🔍−",l:"Zoom −",k:"−"}].map((t,i)=>
            t===0
              ?<div key={i} style={{width:showK?"90%":"24px",height:1,background:"#1f2433",margin:"3px auto"}}/>
              :<button key={t.id} onClick={()=>setTool(t.id)} style={{display:"flex",alignItems:"center",gap:8,height:32,padding:showK?"0 10px":"0",justifyContent:showK?"flex-start":"center",borderRadius:7,border:"none",background:tool===t.id?"rgba(74,142,255,.12)":"transparent",color:tool===t.id?"#4a8eff":"#6b7a92",cursor:"pointer",fontSize:14,width:"100%"}}>
                <span style={{width:20,textAlign:"center"}}>{t.ic}</span>
                {showK&&<span style={{fontSize:11}}>{t.l}</span>}
                {showK&&<span style={{fontSize:9,color:"#4a5568",marginLeft:"auto",background:"#1f2433",padding:"1px 4px",borderRadius:3,fontFamily:"monospace"}}>{t.k}</span>}
              </button>
          )}
          <div style={{width:showK?"90%":"24px",height:1,background:"#1f2433",margin:"3px auto"}}/>
          <label style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#6b7a92"}}>
            <input type="checkbox" checked={showD} onChange={e=>setShowD(e.target.checked)} style={{accentColor:"#4a8eff"}}/>
            {showK?"Cotas":"📏"}
          </label>
          {bgImage&&<>
            <label style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#34d399"}}>
              <input type="checkbox" checked={showBg} onChange={e=>setShowBg(e.target.checked)} style={{accentColor:"#34d399"}}/>
              {showK?"Ver fondo":"🖼️"}
            </label>
            {showBg&&showK&&<div style={{padding:"2px 10px 6px"}}>
              <div style={{fontSize:9,color:"#4a5568",marginBottom:3}}>Opacidad fondo</div>
              <input type="range" min={0.05} max={0.9} step={0.05} value={bgOpacity} onChange={e=>setBgOpacity(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#34d399"}}/>
            </div>}
            {showK&&<button onClick={removeBgImage} style={{display:"flex",alignItems:"center",gap:6,height:26,padding:"0 10px",borderRadius:7,border:"none",background:"transparent",color:"#f87171",cursor:"pointer",fontSize:10,width:"100%"}}>
              <span style={{width:20,textAlign:"center"}}>✕</span><span>Quitar fondo</span>
            </button>}
          </>}
          <button onClick={()=>setShowK(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,height:28,padding:"0 10px",borderRadius:7,border:"none",background:"transparent",color:"#6b7a92",cursor:"pointer",fontSize:11,width:"100%",justifyContent:showK?"flex-start":"center"}}>
            <span style={{width:20,textAlign:"center"}}>⌨</span>
            {showK&&<span>Atajos</span>}
          </button>
          {showK&&<div style={{padding:"6px 10px",borderTop:"1px solid #1f2433"}}>
            {[["V","Seleccionar"],["W","Pared"],["R","Habitación"],["D","Puerta"],["DblClic","Editar"],["Del","Eliminar"],["Esc","Cancelar"],["Ctrl+Z","Deshacer"]].map(([k,d])=>
              <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:10,color:"#6b7a92"}}>{d}</span>
                <span style={{fontSize:9,color:"#4a5568",background:"#1f2433",padding:"0 4px",borderRadius:3,fontFamily:"monospace"}}>{k}</span>
              </div>
            )}
          </div>}
        </div>

        {/* Canvas */}
        <div ref={wRef} style={{flex:1,position:"relative",overflow:"hidden",background:"#0c0e14"}}>
          <canvas
            ref={cRef}
            style={{position:"absolute",top:0,left:0,cursor:tool==="move"?"grab":(tool==="wall"||tool==="room")?"crosshair":tool==="zoomin"?"zoom-in":tool==="zoomout"?"zoom-out":"default"}}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
            onDoubleClick={onDblClick} onWheel={onWheel}
          />
        </div>

        {/* Panel derecho */}
        <div style={{width:250,background:"#13161e",borderLeft:"1px solid #1f2433",flexShrink:0,overflowY:"auto"}}>
          {rooms.length>0&&<div style={ps}>
            <div style={{...pt,display:"flex",justifyContent:"space-between"}}>
              <span>Estancias ({rooms.length})</span>
              <span style={{fontSize:9,color:"#4a5568",cursor:"pointer"}} onClick={()=>{const all=rooms.every(rm=>expR[rm.name]);const n={};rooms.forEach(rm=>n[rm.name]=!all);setExpR(n)}}>{rooms.every(rm=>expR[rm.name])?"Cerrar":"Abrir"}</span>
            </div>
            {rooms.map((rm,i)=>{
              const op=expR[rm.name];
              const sel=(sType==="room"||sType==="label")&&sId===rm.name;
              const ar=rm.pts?polyArea(rm.pts):0;
              return (
                <div key={rm.name+i} style={{marginBottom:4,border:"1px solid "+(sel?"#4a8eff40":"#1f2433"),borderRadius:8,overflow:"hidden"}}>
                  <div onClick={()=>{setExpR(p=>({...p,[rm.name]:!p[rm.name]}));setSType("room");setSId(rm.name)}} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",cursor:"pointer"}}>
                    <span style={{fontSize:10,transform:op?"rotate(90deg)":"",transition:".15s",display:"inline-block",color:"#6b7a92"}}>▶</span>
                    <div style={{width:10,height:10,borderRadius:2,background:rm.color}}/>
                    <span style={{fontSize:12,flex:1,fontWeight:sel?600:400}}>{rm.name}</span>
                    <span style={{fontSize:10,color:"#6b7a92",fontFamily:"monospace"}}>{ar.toFixed(1)}m²</span>
                  </div>
                  {op&&<div style={{padding:"0 10px 10px 28px",fontSize:11}}>
                    <div style={pr}><span style={{...pl,width:50}}>Nombre</span>
                      <input key={"n"+rm.name} defaultValue={rm.name} onKeyDown={e=>{if(e.key==="Enter")e.target.blur()}} onBlur={e=>{const v=e.target.value.trim();if(v&&v!==rm.name){setExpR(p=>{const n={...p};n[v]=n[rm.name];delete n[rm.name];return n});setRooms(p=>p.map(x=>x.name===rm.name?{...x,name:v}:x));if(sId===rm.name)setSId(v);markDirty()}}} style={{...inp,width:80,textAlign:"left"}} onFocus={e=>e.target.select()}/>
                    </div>
                    <div style={pr}><span style={{...pl,width:50}}>Altura</span>
                      <input key={"h"+rm.name} defaultValue={rm.h||2.50} onKeyDown={e=>{if(e.key==="Enter")e.target.blur()}} onBlur={e=>{const v=parseFloat(e.target.value);if(v>0){setRooms(p=>p.map(x=>x.name===rm.name?{...x,h:v}:x));markDirty()}}} style={{...inp,width:45}} onFocus={e=>e.target.select()}/><span style={{fontSize:9,color:"#4a5568"}}>m</span>
                    </div>
                    <div style={{fontSize:10,color:"#6b7a92",margin:"4px 0"}}>🏠{ar.toFixed(2)}m² · ⬆{(ar*( rm.h||2.5)*4).toFixed(2)}m²</div>
                    <div style={{display:"flex",gap:3,marginBottom:6}}>
                      {COLORS.map(c=><div key={c} onClick={()=>{setRooms(p=>p.map(x=>x.name===rm.name?{...x,color:c}:x));markDirty()}} style={{width:14,height:14,borderRadius:3,background:c,cursor:"pointer",border:rm.color===c?"2px solid #fff":"2px solid transparent"}}/>)}
                    </div>
                    <button onClick={()=>{save();setRooms(p=>p.filter(x=>x.name!==rm.name));if(sId===rm.name){setSType(null);setSId(null)}}} style={{background:"none",border:"1px solid #f8717130",borderRadius:5,color:"#f87171",fontSize:10,padding:"3px 8px",cursor:"pointer",width:"100%"}}>Eliminar</button>
                  </div>}
                </div>
              );
            })}
          </div>}

          {selWall&&<div style={ps}>
            <div style={pt}>Pared</div>
            <div style={pr}>
              <span style={pl}>Longitud</span>
              <input key={sId} defaultValue={selWallLen.toFixed(2)} onKeyDown={e=>{if(e.key==="Enter")e.target.blur()}} onBlur={e=>resizeWall(sId,e.target.value)} style={inp} onFocus={e=>e.target.select()}/>
              <span style={{fontSize:10,color:"#4a5568"}}>m</span>
            </div>
            <button onClick={()=>deleteWall(sId)} style={{...btnS,color:"#f87171",fontSize:11,width:"100%",justifyContent:"center",marginTop:6}}>Eliminar</button>
          </div>}

          {(walls.length>0||rooms.length>0)&&<div style={ps}>
            <div style={pt}>Resumen</div>
            <div style={pr}><span style={pl}>🏠 Suelo</span><span style={{fontSize:12,fontFamily:"monospace",marginLeft:"auto",color:"#34d399"}}>{rooms.reduce((s,rm)=>s+(rm.pts?polyArea(rm.pts):0),0).toFixed(2)}m²</span></div>
            <div style={pr}><span style={pl}>🧱 Paredes</span><span style={{fontSize:12,fontFamily:"monospace",marginLeft:"auto",color:"#fbbf24"}}>{walls.reduce((s,w)=>{const l=Math.sqrt((w.x2-w.x1)**2+(w.y2-w.y1)**2)/100;let h=2.5;for(const rm of rooms)if(rm.pts&&pip((w.x1+w.x2)/2,(w.y1+w.y2)/2,rm.pts)){h=rm.h||2.5;break};return s+l*h},0).toFixed(2)}m²</span></div>
            <div style={{height:1,background:"#1f2433",margin:"4px 0"}}/>
            <div style={pr}><span style={pl}>Paredes</span><span style={{marginLeft:"auto"}}>{walls.length}</span></div>
            <div style={pr}><span style={pl}>🚪</span><span style={{marginLeft:"auto"}}>{doors.length}</span></div>
            <div style={pr}><span style={pl}>🪟</span><span style={{marginLeft:"auto"}}>{wins.length}</span></div>
          </div>}
        </div>
      </div>

      {/* Status bar */}
      <div style={{height:24,background:"#13161e",borderTop:"1px solid #1f2433",display:"flex",alignItems:"center",padding:"0 14px",gap:16,fontSize:10,color:"#4a5568",fontFamily:"monospace"}}>
        <span style={{color:"#34d399"}}>●</span>
        <span>{Math.round(zoom*100)}%</span>
        <span>{mouse.x},{mouse.y}</span>
      </div>
    </div>
  );
}

// ─── Estilos base ──────────────────────────────────────────────────────────
const btnS={display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:7,border:"1px solid #1f2433",background:"#1b1f2a",color:"#dde3ed",fontSize:12,fontFamily:"inherit",fontWeight:500,cursor:"pointer"};
const ps={padding:12,borderBottom:"1px solid #1f2433"};
const pt={fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".7px",color:"#6b7a92",marginBottom:8};
const pr={display:"flex",alignItems:"center",gap:6,marginBottom:5};
const pl={fontSize:11,color:"#6b7a92",width:65,flexShrink:0};
const inp={width:70,padding:"4px 7px",background:"#0c0e14",border:"1px solid #1f2433",borderRadius:5,color:"#dde3ed",fontSize:12,fontFamily:"monospace",outline:"none",textAlign:"right"};
