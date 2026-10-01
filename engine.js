'use strict';
const defaults={shape:'H',fabrication:'rolled',weld:'full',d:40,b:40,tw:1.3,tf:2.1,Fy:2400,E:2040000,G:810000,Lx:465,Ly:465,Kx:1,Ky:1,Lb:465,Lz:465,Kz:1,N:100,Mx:10,My:2,Cmx:1,Cmy:1};
function allowable(lambda,Fy,E,box=false){const Cc=Math.sqrt(2*Math.PI**2*E/Fy),m=lambda/Cc;return box?(lambda<=Cc?0.6*Fy*(0.6*m**3-1.14*m*m-0.085*m+1):0.45*Math.PI**2*E/lambda**2):(lambda<Cc?(1-m*m/2)*Fy/(5/3+3*m/8-m**3/8):12*Math.PI**2*E/(23*lambda**2));}
function compute(v){
 const errors=[];const required=['d','tf','Fy','E','Lx','Ly','Kx','Ky'];if(v.shape!=='PIPE')required.push('b');if(v.shape==='H')required.push('tw','Lb','Lz','Kz','G');if(v.shape==='BOX')required.push('Lb');
 for(const k of required)if(!Number.isFinite(v[k])||v[k]<=0)errors.push(k+' 必須為大於零的有效數值');
 for(const k of ['N','Mx','My','Cmx','Cmy'])if(!Number.isFinite(v[k]))errors.push(k+' 不可空白或非數值');
 if(v.N<0)errors.push('本工具限軸壓力 N ≥ 0；軸拉力須另行檢核。');
 for(const k of ['Cmx','Cmy'])if(v[k]<0.2||v[k]>1)errors.push(k+' 須介於 0.2 與 1.0；特殊條件請另行分析。');
 if(!['H','BOX','PIPE'].includes(v.shape))errors.push('不支援的斷面型式');
 if(!['rolled','welded'].includes(v.fabrication)||!['full','partial'].includes(v.weld))errors.push('製造方式無效');
 const d=v.d,b=v.shape==='PIPE'?d:v.b,tf=v.tf,tw=v.shape==='BOX'?tf:v.tw,h=d-2*tf;
 if(h<=0)errors.push('斷面深度 d 必須大於 2tf（圓管為外徑 D > 2t）。');
 if(v.shape==='H'&&b<=tw)errors.push('H 型翼板寬 b 必須大於腹板厚 tw。');
 if(v.shape==='BOX'&&b<=2*tw)errors.push('箱型寬 b 必須大於 2t。');
 if(errors.length)return {errors};
 let A,Ix,Iy,J,Cw=0;
 if(v.shape==='H'){A=2*b*tf+h*tw;Ix=(b*d**3-(b-tw)*h**3)/12;Iy=(2*tf*b**3+h*tw**3)/12;J=(2*b*tf**3+h*tw**3)/3;Cw=tf*b**3*(d-tf)**2/24;}
 else if(v.shape==='BOX'){A=b*d-(b-2*tw)*h;Ix=(b*d**3-(b-2*tw)*h**3)/12;Iy=(d*b**3-h*(b-2*tw)**3)/12;J=4*((b-tw)*(d-tf))**2/(2*(b-tw)/tf+2*(d-tf)/tw);}
 else{A=Math.PI*(d*d-h*h)/4;Ix=Math.PI*(d**4-h**4)/64;Iy=Ix;J=2*Ix;}
 const Sx=2*Ix/d,Sy=2*Iy/b,rx=Math.sqrt(Ix/A),ry=Math.sqrt(Iy/A),lx=v.Kx*v.Lx/rx,ly=v.Ky*v.Ly/ry,Cc=Math.sqrt(2*Math.PI**2*v.E/v.Fy),F=v.Fy/1000,s=Math.sqrt(F),fa=v.N*1000/A;
 const kc=v.shape==='H'&&v.fabrication==='welded'&&h/tw>70?4.05/(h/tw)**0.46:1;
 const local=[],warnings=[],blocks=[];
 function limit(name,value,cap,ref){local.push({name,value,cap,ratio:value/cap,ref});if(value>cap+1e-9)blocks.push(name+' 超出本版非細長肢材適用範圍，須依附錄 1 另行分析。');}
 let compactX,compactY,fbx,fby,Lcx=null,Lcy=null,rT=null,bendingX='',bendingY='';
 if(v.shape==='H'){
  if(v.Fy>4550)blocks.push('H 型鋼 Fy 超過 4,550 kgf/cm²，超出本版第 7.2／7.3 節計算範圍。');
  const lf=b/(2*tf),lp=17/s,lr=25*Math.sqrt(kc/F),lw=h/tw,wp=fa/v.Fy<=0.16?170/s*(1-3.74*fa/v.Fy):68/s;
  limit('翼板 b/(2tf)',lf,lr,'表 4.5-1');limit('腹板 h/tw',lw,(v.N>0?68:260)/s,v.N>0?'表 4.5-1 均勻受壓保守篩選':'表 4.5-1');
  compactX=lf<=lp&&lw<=wp;compactY=compactX;
  Lcx=Math.min(20*b/s,1400/(d/(b*tf)*F));
  let localFx=compactX?0.66*v.Fy:lw<=wp?Math.min(0.66*v.Fy,v.Fy*(0.79-0.0075*lf*Math.sqrt(F/kc))):0.6*v.Fy;
  fby=compactY?0.75*v.Fy:Math.min(0.75*v.Fy,v.Fy*(1.075-0.019*lf*s));
  if(lw>wp)fby=Math.min(fby,0.6*v.Fy);
  bendingY=compactY?'7.3-1':'7.3-2／7.3-3';
  // 規範本文 rT：壓力翼板 + 1/3 受壓腹板（受壓腹板 h/2）。
  rT=Math.sqrt((tf*b**3/12+(h/6)*tw**3/12)/(b*tf+h*tw/6));
  if(v.Lb<=Lcx){fbx=localFx;bendingX=compactX?'7.2-1':lw<=wp?(v.fabrication==='welded'?'7.2-3':'7.2-2'):'7.2-4';}
  else{const slender=v.Lb/rT,lower=Math.sqrt(7160/F),upper=Math.sqrt(35800/F);const f1=slender<lower?0.6*v.Fy:slender<=upper?F*(2/3-F*slender**2/107600)*1000:12000/slender**2*1000;const f2=840/(v.Lb*d/(b*tf))*1000;fbx=Math.min(localFx,0.6*v.Fy,Math.max(f1,f2));bendingX='7.2-6／7.2-7 與 7.2-8；Cb＝1.0';}
  if(v.N>0)warnings.push('H 型腹板採均勻受壓寬厚比上限作保守篩選；未利用彎曲應力梯度放寬。');
 }else if(v.shape==='BOX'){
  const wf=(b-2*tw)/tf,ww=h/tw,lp=(v.weld==='full'?50:43)/s;limit('水平板淨寬／厚度',wf,63/s,'表 4.5-1');limit('垂直板淨寬／厚度',ww,63/s,'表 4.5-1');compactX=compactY=Math.max(wf,ww)<=lp;
  Lcx=84*b/F;Lcy=84*d/F;
  if((v.Mx!==0&&d>6*b)||(v.My!==0&&b>6*d))blocks.push('彎曲方向深寬比超過 6，側向穩定性須合理分析。');
  fbx=(compactX&&d<=6*b&&tf<=2*tw&&v.Lb<=Lcx?0.66:0.6)*v.Fy;
  fby=(compactY&&b<=6*d&&tw<=2*tf&&v.Lb<=Lcy?0.66:0.6)*v.Fy;
  bendingX=fbx>0.6*v.Fy?'7.4-1／7.4-2':'7.4-3（保守採 0.6Fy）';bendingY=fby>0.6*v.Fy?'7.4-1／7.4-2':'7.4-3（保守採 0.6Fy）';
  warnings.push('箱型柱限等厚連續銲接鋼板；Lc 採不利端彎矩比 M₁/M₂＝−1，依規範下限取 84b/Fy。');
 }else{limit('圓管外徑 D/t',d/tf,(v.N>0?232:630)/F,'表 4.5-1');compactX=compactY=d/tf<=145/F;fbx=fby=(compactX?0.66:0.6)*v.Fy;bendingX=bendingY=compactX?'7.4-1':'7.4-3';warnings.push('圓管雙軸彎曲以絕對值線性相加檢核，較合成彎矩法保守。');}
 const Fax=allowable(lx,v.Fy,v.E,v.shape==='BOX'),Fay=allowable(ly,v.Fy,v.E,v.shape==='BOX');
 let Faz=null,Fez=null,lz=null;
 if(v.shape==='H'){Fez=(Math.PI**2*v.E*Cw/(v.Kz*v.Lz)**2+v.G*J)/(Ix+Iy);lz=Math.PI*Math.sqrt(v.E/Fez);Faz=allowable(lz,v.Fy,v.E);}
 const Fa=Math.min(Fax,Fay,Faz??Infinity),control=Fa===Fax?'X 軸撓曲挫屈':Fa===Fay?'Y 軸撓曲挫屈':'純扭轉挫屈',Pa=Fa*A/1000;
 const fbxReq=Math.abs(v.Mx)*100000/Sx,fbyReq=Math.abs(v.My)*100000/Sy,Fex=12*Math.PI**2*v.E/(23*lx**2),Fey=12*Math.PI**2*v.E/(23*ly**2),dx=1-fa/Fex,dy=1-fa/Fey;
 const axial=fa/Fa,bx=fbxReq/fbx,by=fbyReq/fby,simple=axial+bx+by,yieldInteraction=fa/(0.6*v.Fy)+bx+by;
 let amplified=axial+(fbxReq===0?0:dx<=0?Infinity:v.Cmx*bx/dx)+(fbyReq===0?0:dy<=0?Infinity:v.Cmy*by/dy);
 const interaction=axial<=0.15?simple:Math.max(amplified,yieldInteraction),ratio=Math.max(axial,bx,by,interaction);
 if((dx<=0&&fbxReq>0)||(dy<=0&&fbyReq>0))warnings.push('互制式放大分母 ≤ 0：穩定性不成立，判為未通過，禁止使用負分母抵銷需求。');
 const slim=Math.max(lx,ly);if(slim>200)warnings.push('KL/r＞200，超過第 4.4 節建議值；本工具不給予通過結論。');
 const fail=ratio>1+1e-9||slim>200;
 const valid=blocks.length===0;
 const axialCapacityValid=valid&&(v.shape==='H'?h/tw<=68/s:v.shape==='PIPE'?d/tf<=232/F:true);
 if(![A,Ix,Iy,Sx,Sy,rx,ry,lx,ly,Cc,Fa,Pa,fbx,fby,fa,fbxReq,fbyReq,Fex,Fey].every(Number.isFinite))return {errors:['輸入數值超出可計算範圍，請檢查尺寸、單位與材料數值。']};
 return {errors:[],v:{...v,b,tw},A,Ix,Iy,Sx,Sy,J,Cw,rx,ry,h,lx,ly,lz,Cc,kc,local,warnings,blocks,compactX,compactY,Lcx,Lcy,rT,Fax,Fay,Faz,Fez,Fa,Pa,control,fbx,fby,bendingX,bendingY,fa,fbxReq,fbyReq,Fex,Fey,dx,dy,axial,bx,by,simple,amplified,yieldInteraction,interaction,ratio,slim,valid,axialCapacityValid,status:!valid?'pending':fail?'fail':'pass'};
}
if(typeof module!=='undefined')module.exports={compute,allowable,defaults};
