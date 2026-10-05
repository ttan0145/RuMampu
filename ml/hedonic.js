// Cell-level exact hedonic regression (time-dummy, fixed effects) from per-cell sufficient statistics.
// Model per property type:
//   ln(price) = a[district] + g*leasehold + b*ln(size) + theta[q] + eta[state,q] + e
//   theta[Q1]=0, eta[s,Q1]=0, ridge penalty LAMBDA*eta^2 (shrinks sparse states to the national trend)
// Input cell string: "d;te;q;n;mls;mlp;sxx;sxy;syy d;te;..." (within-cell centred stats)
function hedonic(cellStr, stateOf, LAMBDA){
  const cells=cellStr.trim().split(' ').map(s=>{const a=s.split(';');return{d:+a[0],te:a[1],q:a[2],n:+a[3],x:+a[4],y:+a[5],sxx:+a[6],sxy:+a[7],syy:+a[8]}});
  const Q=[...new Set(cells.map(c=>c.q))].sort(), D=[...new Set(cells.map(c=>c.d))].sort((a,b)=>a-b);
  const S=[...new Set(cells.map(c=>stateOf[c.d]))].sort();
  const hasL=cells.some(c=>c.te==='L')&&cells.some(c=>c.te==='F');
  // parameter index
  let p=0; const iD={}; D.forEach(d=>iD[d]=p++); const iL=hasL?p++:-1; const iB=p++;
  const iT={}; Q.slice(1).forEach(q=>iT[q]=p++); const iE={}; S.forEach(s=>Q.slice(1).forEach(q=>iE[s+'|'+q]=p++));
  const P=p; const A=Array.from({length:P},()=>new Float64Array(P)); const bv=new Float64Array(P);
  let N=0, yy=0;
  for(const c of cells){
    const s=stateOf[c.d]; const idx=[iD[c.d]]; if(hasL&&c.te==='L')idx.push(iL);
    if(c.q!==Q[0]){idx.push(iT[c.q]); idx.push(iE[s+'|'+c.q]);}
    const n=c.n, sx=n*c.x, sy=n*c.y, sxx=c.sxx+n*c.x*c.x, sxy=c.sxy+n*c.x*c.y;
    for(const j of idx){ for(const k of idx) A[j][k]+=n; A[j][iB]+=sx; A[iB][j]+=sx; bv[j]+=sy; }
    A[iB][iB]+=sxx; bv[iB]+=sxy; N+=n; yy+=c.syy+n*c.y*c.y;
  }
  for(const k in iE) A[iE[k]][iE[k]]+=LAMBDA;
  const inv=invert(A); const beta=new Float64Array(P);
  for(let i=0;i<P;i++){let s=0; for(let j=0;j<P;j++) s+=inv[i][j]*bv[j]; beta[i]=s;}
  // RSS = y'y - 2b'X'y + b'X'Xb  (X'X without ridge)
  let bXy=0, bAb=0; for(const k in iE) A[iE[k]][iE[k]]-=LAMBDA;
  for(let i=0;i<P;i++){bXy+=beta[i]*bv[i]; let s=0; for(let j=0;j<P;j++) s+=A[i][j]*beta[j]; bAb+=beta[i]*s;}
  const rss=yy-2*bXy+bAb, sig2=rss/(N-P);
  let ybar=0; for(const c of cells) ybar+=c.n*c.y; ybar/=N; const r2=1-rss/(yy-N*ybar*ybar);
  // state-quarter log index = theta[q]+eta[s,q]; variance via inv
  const nsq={}; for(const c of cells){const k=stateOf[c.d]+'|'+c.q; nsq[k]=(nsq[k]||0)+c.n;}
  const nq={}; for(const c of cells){nq[c.q]=(nq[c.q]||0)+c.n;}
  const out=[];
  for(const q of Q){
    const th=q===Q[0]?0:beta[iT[q]], thv=q===Q[0]?0:sig2*inv[iT[q]][iT[q]];
    out.push(['ALL',q,+th.toFixed(5),+Math.sqrt(thv).toFixed(5),nq[q]||0]);
    for(const s of S){
      if(q===Q[0]){out.push([s,q,0,0,nsq[s+'|'+q]||0]);continue;}
      const a=iT[q], e=iE[s+'|'+q]; const v=sig2*(inv[a][a]+inv[e][e]+2*inv[a][e]);
      out.push([s,q,+(beta[a]+beta[e]).toFixed(5),+Math.sqrt(Math.max(v,0)).toFixed(5),nsq[s+'|'+q]||0]);
    }
  }
  return {N,P,r2:+r2.toFixed(4),sigma:+Math.sqrt(sig2).toFixed(4),slope:+beta[iB].toFixed(4),lease:hasL?+beta[iL].toFixed(4):null,Q,rows:out};
}
function invert(M){ // Gauss-Jordan with partial pivoting
  const n=M.length; const a=M.map(r=>Float64Array.from(r)); const I=Array.from({length:n},(_,i)=>{const r=new Float64Array(n); r[i]=1; return r;});
  for(let c=0;c<n;c++){
    let piv=c; for(let r=c+1;r<n;r++) if(Math.abs(a[r][c])>Math.abs(a[piv][c])) piv=r;
    [a[c],a[piv]]=[a[piv],a[c]]; [I[c],I[piv]]=[I[piv],I[c]];
    const d=a[c][c]; if(Math.abs(d)<1e-12) throw new Error('singular at '+c);
    for(let j=0;j<n;j++){a[c][j]/=d; I[c][j]/=d;}
    for(let r=0;r<n;r++){ if(r===c) continue; const f=a[r][c]; if(f===0) continue;
      const ar=a[r], ac=a[c], Ir=I[r], Ic=I[c]; for(let j=0;j<n;j++){ar[j]-=f*ac[j]; Ir[j]-=f*Ic[j];} }
  }
  return I;
}
if(typeof module!=='undefined') module.exports={hedonic};
