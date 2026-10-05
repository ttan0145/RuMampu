import pandas as pd, numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, json
ix=pd.read_csv('out/price_index_state_type.csv'); lk=pd.read_csv('out/price_scenarios_lookup.csv'); bs=pd.read_csv('out/backtest_summary.csv',index_col=0)
meta=json.load(open('out/model_meta.json'))
Q=list(ix.quarter.unique()); T=len(Q)
types=['all_types','terrace','condo','semi_detached','low_cost_house','detached','low_cost_flat','flat','cluster','townhouse']
fig,axs=plt.subplots(2,5,figsize=(18,7.2),sharey=True)
for ax,t in zip(axs.flat,types):
    g=ix[(ix.type==t)&(ix.state=='ALL')]; y=100*np.exp(g.y.values); se=g.se.values
    x=np.arange(T); ax.errorbar(x,y,yerr=100*1.28*se*np.exp(g.y.values),fmt='o-',color='#1f5f8b',ms=4,lw=1.6,capsize=2)
    if True:
        l=lk[(lk.property_type==t)&(lk.state_code=='ALL')].sort_values('years')
        # anchor fan on smoothed level: use last point of fitted trend
        base=l.level_index_now.iloc[0]; ax.plot([T-1],[base],'D',color='#d17a00',ms=5); xs=[T-1]+[T-1+4*k for k in (1,2,3)]
        lo=[base]+list(base*(1+l.growth_low)); mid=[base]+list(base*(1+l.growth_mid)); hi=[base]+list(base*(1+l.growth_high))
        ax.fill_between(xs,lo,hi,color='#f0a202',alpha=.25,lw=0); ax.plot(xs,mid,'--',color='#d17a00',lw=1.6)
    ax.set_title(t.replace('_',' '),fontsize=11); ax.axhline(100,color='#999',lw=.6)
    tk=[i for i,q in enumerate(Q) if q.endswith('Q1')][::2]+[T-1+12]; ax.set_xticks(tk); ax.set_xticklabels([Q[i][2:] if i<T else str(int(Q[-1][:4])+3)[2:]+Q[-1][4:] for i in tk],fontsize=8)
    ax.grid(alpha=.25)
axs[0,0].set_ylabel('Hedonic index ('+Q[0]+' = 100)'); axs[1,0].set_ylabel('Hedonic index ('+Q[0]+' = 100)')
fig.suptitle('Malaysia quality-adjusted house price index by type (NAPIC open data, '+Q[0]+'-'+Q[-1]+')  |  dashed = central scenario, band = 80% range (what-if, not a valuation)',fontsize=11.5)
fig.tight_layout(rect=[0,0,1,.95]); fig.savefig('out/index_and_scenarios.png',dpi=130)

fig,ax=plt.subplots(figsize=(8,4.2))
m=bs.index.tolist(); cols=['1','2','3','4']
for i,c in enumerate(cols): ax.bar(np.arange(len(m))+i*0.2-0.3,bs[c]*100,0.2,label=f'h = {c} quarter'+('s' if c!='1' else ''))
ax.axhline(1.64,color='k',ls=':',lw=1); ax.text(len(m)-0.6,1.72,'index noise floor',fontsize=8,ha='right')
ax.set_xticks(range(len(m))); ax.set_xticklabels([x.replace('_',' ') for x in m]); ax.set_ylabel('Weighted RMSE (log %)')
ax.set_title('Rolling-origin backtest (origins 2025Q2-2026Q1, 145 state x type series)'); ax.legend(fontsize=8); ax.grid(axis='y',alpha=.25)
fig.tight_layout(); fig.savefig('out/backtest.png',dpi=130)
