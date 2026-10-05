import numpy as np, json, subprocess
rng=np.random.default_rng(1)
Q=[f"{y}Q{k}" for y in (2024,2025,2026) for k in (1,2,3,4)][:10]
D=list(range(1,21)); stateOf={d:f"S{(d-1)//5}" for d in D}
S=sorted(set(stateOf.values()))
a={d:rng.normal(12,0.3) for d in D}; th={q:0.01*i for i,q in enumerate(Q)}
eta={(s,q):(0 if q==Q[0] else rng.normal(0,0.02)) for s in S for q in Q}
rows=[]
for _ in range(6000):
    d=int(rng.choice(D)); q=Q[rng.integers(10)]; L=rng.random()<0.4; x=rng.normal(4.7,0.3)
    y=a[d]+0.8*x-0.1*L+th[q]+eta[(stateOf[d],q)]+rng.normal(0,0.2)-0.8*4.7
    rows.append((d,'L' if L else 'F',q,x,y))
import collections
g=collections.defaultdict(list)
for r in rows: g[r[:3]].append(r[3:])
cs=[]
for k,v in sorted(g.items()):
    v=np.array(v); n=len(v); mx,my=v.mean(0); sxx=((v[:,0]-mx)**2).sum(); sxy=((v[:,0]-mx)*(v[:,1]-my)).sum(); syy=((v[:,1]-my)**2).sum()
    cs.append(f"{k[0]};{k[1]};{k[2]};{n};{mx:.5f};{my:.5f};{sxx:.5f};{sxy:.5f};{syy:.5f}")
LAM=30.0
js=f"const {{hedonic}}=require('../hedonic.js');const r=hedonic({json.dumps(' '.join(cs))},{json.dumps({str(k):v for k,v in stateOf.items()})},{LAM});console.log(JSON.stringify(r))"
r=json.loads(subprocess.run(['node','-e',js],capture_output=True,text=True).stdout)
# direct ridge OLS
cols=[f"d{d}" for d in D]+['L','x']+[f"t{q}" for q in Q[1:]]+[f"e{s}{q}" for s in S for q in Q[1:]]
ix={c:i for i,c in enumerate(cols)}
X=np.zeros((len(rows),len(cols))); y=np.zeros(len(rows))
for i,(d,te,q,x,yy) in enumerate(rows):
    X[i,ix[f"d{d}"]]=1; X[i,ix['L']]=te=='L'; X[i,ix['x']]=x; y[i]=yy
    if q!=Q[0]: X[i,ix[f"t{q}"]]=1; X[i,ix[f"e{stateOf[d]}{q}"]]=1
pen=np.zeros(len(cols)); pen[[ix[c] for c in cols if c.startswith('e')]]=LAM
b=np.linalg.solve(X.T@X+np.diag(pen),X.T@y)
print('slope js',r['slope'],'np',round(b[ix['x']],4),'lease',r['lease'],round(b[ix['L']],4),'r2',r['r2'])
mx=0
for s_,q,v,se,n in r['rows']:
    if s_=='ALL' or q==Q[0]: continue
    ref=b[ix[f"t{q}"]]+b[ix[f"e{s_}{q}"]]; mx=max(mx,abs(ref-v))
print('max abs diff state index',mx)
print('truth vs est S0 last q', th[Q[-1]]+eta[('S0',Q[-1])], [x for x in r['rows'] if x[0]=='S0' and x[1]==Q[-1]])
import sys; sys.path.insert(0,'..')
from train_price_index import hedonic as hpy
cells=[(int(a[0]),a[1],a[2],int(a[3]),*map(float,a[4:])) for a in (c.split(';') for c in cs)]
rp=hpy(cells,stateOf,LAM)
mx=0
for s_,q,v,se,n in r['rows']:
    i=rp['Q'].index(q); vp,sep,npp=rp['series'][s_][i]; mx=max(mx,abs(vp-v),abs(sep-se)); assert n==npp
print('py vs js max diff',mx, 'slope', rp['slope'])
