const state={index:null,municipality:null};
const $=id=>document.getElementById(id);
const fmt={
  integer:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{maximumFractionDigits:0}).format(v),
  one:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{minimumFractionDigits:1,maximumFractionDigits:1}).format(v),
  two:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v),
  euro:v=>v==null?"–":"€ "+new Intl.NumberFormat("nl-NL",{maximumFractionDigits:0}).format(v),
  pct:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1}).format(v)+"%",
  signedPct:v=>v==null?"–":(v>0?"+":"")+new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1}).format(v)+"%",
  date:v=>v?new Date(v).toLocaleDateString("nl-NL",{day:"numeric",month:"short",year:"numeric"}):"–"
};
const metricLabels={
  inwoners:"Inwoners",bevolkingsdichtheid:"Bevolkingsdichtheid",gemiddelde_woz:"Gemiddelde WOZ",
  gemiddeld_inkomen:"Gemiddeld inkomen",leeftijd_0_15_pct:"0–15 jaar",leeftijd_65_plus_pct:"65+",
  eenpersoonshuishoudens_pct:"Eenpersoonshuishoudens",huishoudens_met_kinderen_pct:"Huishoudens met kinderen",
  huurwoningen_pct:"Huurwoningen",koopwoningen_pct:"Koopwoningen",eengezinswoningen_pct:"Eengezinswoningen",
  meergezinswoningen_pct:"Meergezinswoningen",laag_inkomen_pct:"Lage inkomens",hoog_inkomen_pct:"Hoge inkomens",
  bijstand_pct_inwoners:"Bijstand",herkomst_buiten_nederland_pct:"Herkomst buiten Nederland",
  nationaliteitsdiversiteit:"Nationaliteitsdiversiteit"
};
function metricValue(key,v){
  if(key==="gemiddelde_woz"||key==="gemiddeld_inkomen")return fmt.euro(v);
  if(key.endsWith("_pct"))return fmt.pct(v);
  if(key==="inwoners"||key==="bevolkingsdichtheid")return fmt.integer(v);
  return v==null?"–":fmt.one(v);
}
async function load(){
  state.index=await fetch("data/gemeenten.json",{cache:"no-store"}).then(r=>r.json());
  $("generatedAt").textContent=fmt.date(state.index.generated_at);
  const s=$("municipality");
  s.innerHTML=state.index.municipalities.map(m=>'<option value="'+m.slug+'">'+m.name+'</option>').join("");
  s.onchange=()=>loadMunicipality(s.value);
  await loadMunicipality(s.value);
}
async function loadMunicipality(slug){
  state.municipality=await fetch("data/"+slug+".json",{cache:"no-store"}).then(r=>r.json());
  const d=$("district");
  d.innerHTML=state.municipality.wijken.map(w=>'<option value="'+w.wijk_code+'" '+(w.wijk_naam==="Ter Leede"?"selected":"")+'>'+w.wijk_naam+'</option>').join("");
  d.onchange=()=>{populateTrendSelect();render();};
  populateTrendSelect();render();
}
function getWijk(){return state.municipality.wijken.find(w=>w.wijk_code===$("district").value)||state.municipality.wijken[0];}
function populateTrendSelect(){
  const w=getWijk();
  const preferred=["gemiddelde_woz","inwoners","leeftijd_65_plus_pct","leeftijd_0_15_pct","koopwoningen_pct","huurwoningen_pct","eengezinswoningen_pct","gemiddeld_inkomen","herkomst_buiten_nederland_pct"];
  const keys=preferred.filter(k=>(w.history?.[k]||[]).length>1);
  $("trendMetric").innerHTML=keys.map(k=>'<option value="'+k+'">'+metricLabels[k]+'</option>').join("");
  if(keys.includes("gemiddelde_woz"))$("trendMetric").value="gemiddelde_woz";
  $("trendMetric").onchange=()=>renderTrend(w);
}
function render(){
  const w=getWijk();
  $("districtTitle").textContent=w.wijk_naam+", "+w.gemeente;
  $("districtSubtitle").textContent="Structurele wijkdata t/m "+w.latest_year+". Peers en ontwikkelrichting zijn vooraf berekend in de private analysemotor.";
  renderFreshness(w);renderKpis(w);renderTrend(w);renderComposition(w);renderObservations(w);
  renderLiveability(w);renderCrime(w);renderPeers(w);renderDirection(w);renderDrivers(w);
  renderOutcomes(w);renderSources(w);renderAvailability(w);
}
function renderFreshness(w){
  const arr=[
    "Structuur "+w.latest_year,
    w.leefbaarheid?.latest?.jaar?"Leefbaarheid "+w.leefbaarheid.latest.jaar:null,
    w.criminaliteit?.laatste_periode?"Veiligheid t/m "+w.criminaliteit.laatste_periode:null
  ].filter(Boolean);
  $("freshness").innerHTML=arr.map(x=>'<span class="pill">'+x+'</span>').join("");
}
function historyChange(w,key){
  const p=w.history?.[key]||[];if(p.length<2)return null;
  const a=p[0].waarde,b=p[p.length-1].waarde;if(a==null||b==null)return null;
  return {start:p[0].jaar,end:p[p.length-1].jaar,abs:b-a,pct:a!==0?100*(b-a)/a:null};
}
function renderKpis(w){
  const m=w.metrics||{},woz=historyChange(w,"gemiddelde_woz"),age=historyChange(w,"leeftijd_65_plus_pct");
  const crime=w.criminaliteit?.laatste_12m_per_1000;
  const cards=[
    ["Inwoners",fmt.integer(m.inwoners),"CBS "+w.latest_year],
    ["WOZ",fmt.euro(m.gemiddelde_woz),woz?.pct!=null?fmt.signedPct(woz.pct)+" sinds "+woz.start:"laatste beschikbare waarde"],
    ["Herkomst buiten NL",fmt.pct(m.herkomst_buiten_nederland_pct),"herkomst, niet nationaliteit"],
    ["65+",fmt.pct(m.leeftijd_65_plus_pct),age?.abs!=null?(age.abs>0?"+":"")+fmt.one(age.abs)+" pp sinds "+age.start:"leeftijdsopbouw"],
    ["Gem. inkomen",fmt.euro(m.gemiddeld_inkomen),"laatste beschikbare CBS-waarde"],
    ["Misdrijven / 1.000",fmt.one(crime),"rolling 12 maanden"]
  ];
  $("kpis").innerHTML=cards.map(x=>'<div class="kpi"><div class="k-label">'+x[0]+'</div><div class="k-value">'+x[1]+'</div><div class="k-sub">'+x[2]+'</div></div>').join("");
}
function renderTrend(w){
  const key=$("trendMetric").value,pts=w.history?.[key]||[];
  $("trendNote").textContent=pts.length?metricLabels[key]+" · "+pts[0].jaar+"–"+pts[pts.length-1].jaar:"Geen consistente tijdreeks beschikbaar.";
  $("trendChart").innerHTML=pts.length?svgLine(pts,key,false):'<div class="empty">Geen tijdreeks beschikbaar.</div>';
}
function svgLine(points,key,compact){
  const W=560,H=compact?120:220,p=compact?24:36,vals=points.map(d=>Number(d.waarde)).filter(Number.isFinite);
  if(!vals.length)return '<div class="empty">Geen waarden.</div>';
  const min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)*.12||1,lo=min-pad,hi=max+pad,range=hi-lo;
  const coords=points.map((d,i)=>({x:p+i*(W-2*p)/Math.max(points.length-1,1),y:H-p-(d.waarde-lo)*(H-2*p)/range,...d}));
  const poly=coords.map(d=>d.x+","+d.y).join(" ");
  const labels=coords.map(d=>'<text x="'+d.x+'" y="'+(H-6)+'" text-anchor="middle" class="svg-label">'+(d.jaar??d.label??"")+'</text>'+(compact?"":'<text x="'+d.x+'" y="'+(d.y-10)+'" text-anchor="middle" class="svg-value">'+metricValue(key,d.waarde)+'</text>')+'<circle cx="'+d.x+'" cy="'+d.y+'" r="'+(compact?3:4)+'" class="dot"></circle>').join("");
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img"><line x1="'+p+'" y1="'+(H-p)+'" x2="'+(W-p)+'" y2="'+(H-p)+'" class="axis"></line><polyline points="'+poly+'" class="line"></polyline>'+labels+'</svg>';
}
function renderComposition(w){
  const m=w.metrics||{};
  const rows=[
    ["0–15 jaar",m.leeftijd_0_15_pct],["65+",m.leeftijd_65_plus_pct],
    ["Eenpersoonshuishoudens",m.eenpersoonshuishoudens_pct],["Met kinderen",m.huishoudens_met_kinderen_pct],
    ["Koopwoningen",m.koopwoningen_pct],["Eengezinswoningen",m.eengezinswoningen_pct]
  ].filter(x=>x[1]!=null);
  $("composition").innerHTML=rows.map(x=>'<div class="comp-row"><span>'+x[0]+'</span><div class="track"><div class="fill" style="width:'+Math.min(Math.max(x[1],0),100)+'%"></div></div><strong>'+fmt.pct(x[1])+'</strong></div>').join("");
  $("compositionNote").textContent=m.herkomst_buiten_nederland_pct!=null?"Herkomst buiten Nederland: "+fmt.pct(m.herkomst_buiten_nederland_pct)+". Dit is expliciet geen nationaliteitsmaat.":"Herkomst is voor deze wijk/jaargang niet consistent beschikbaar.";
}
function renderObservations(w){
  const o=w.observations||[];
  $("observations").innerHTML=o.length?o.map(x=>'<div class="signal">'+x+'</div>').join(""):'<div class="empty">Onvoldoende consistente trends voor automatische duiding.</div>';
}
function renderLiveability(w){
  const l=w.leefbaarheid||{},latest=l.latest;
  $("liveabilitySummary").innerHTML=latest?fmt.two(latest.waarde)+' <small>'+latest.klasse+'</small>':'–';
  const pts=(l.history||[]).map(x=>({jaar:x.jaar,waarde:x.waarde}));
  $("liveabilityChart").innerHTML=pts.length?svgLine(pts,"leefbaarheid_score",true):'<div class="empty">Geen Leefbaarometerhistorie.</div>';
  if(latest){
    const d=l.trend_2022_2024;
    $("liveabilityNote").textContent="Leefbaarometer "+latest.jaar+(d!=null?" · verandering 2022–2024: "+(d>0?"+":"")+fmt.two(d):"");
  }else $("liveabilityNote").textContent="Geen wijkmatch in de gebruikte Leefbaarometerreeks.";
}
function renderCrime(w){
  const c=w.criminaliteit||{};
  if(c.status!=="ok"){
    $("crimeSummary").textContent="–";$("crimeChart").innerHTML='<div class="empty">Geen actuele wijkreeks beschikbaar.</div>';
    $("crimeCategories").innerHTML="";$("crimeNote").textContent="Bron: Politie/CBS 47022NED.";return;
  }
  $("crimeSummary").innerHTML=fmt.one(c.laatste_12m_per_1000)+' <small>per 1.000 · laatste 12 maanden</small>';
  const pts=(c.monthly||[]).map((x,i)=>({jaar:String(x.maand).padStart(2,"0")+"/"+String(x.jaar).slice(-2),waarde:x.aantal}));
  $("crimeChart").innerHTML=pts.length?svgLine(pts,"inwoners",true):"";
  $("crimeCategories").innerHTML=(c.top_categories||[]).slice(0,4).map(x=>'<div class="category-row"><span>'+x.label+'</span><strong>'+fmt.one(x.per_1000)+'/1.000</strong></div>').join("");
  const parts=[];
  if(c.verandering_pct!=null)parts.push("t.o.v. voorafgaande 12 maanden: "+fmt.signedPct(c.verandering_pct));
  parts.push("geregistreerde misdrijven, niet alle feitelijke criminaliteit");
  $("crimeNote").textContent=parts.join(" · ");
  if(c.kleine_populatie)$("crimeNote").insertAdjacentHTML("afterend",'<div class="warning-box">Kleine wijkpopulatie: aantallen per 1.000 kunnen sterk schommelen en worden niet gebruikt in peer-gemiddelden.</div>');
}
function renderPeers(w){
  $("peers").innerHTML=(w.peers||[]).map(p=>'<div class="list-item"><div class="rank">'+p.rank+' / '+fmt.integer(p.van)+'</div><div><div class="name">'+p.wijk_naam+'</div><div class="meta">'+p.gemeente+'</div></div><div class="meta">afstand '+fmt.two(p.technische_afstand)+'</div></div>').join("");
  const domains=w.peer_domains||{};
  $("peerDomains").innerHTML=Object.entries(domains).map(([d,fs])=>'<div class="domain-row"><strong>'+prettyDomain(d)+'</strong><span>'+fs.map(x=>x.label).join(", ")+'</span></div>').join("")||'<div class="empty">Geen domeindetails.</div>';
}
function prettyDomain(s){return ({demografie:"Demografie",woningstructuur:"Woningstructuur",woningmarkt:"Woningmarkt",sociaaleconomisch:"Sociaaleconomisch",bevolkingssamenstelling:"Bevolkingssamenstelling"})[s]||s;}
function renderDirection(w){
  const rows=w.direction?.profile_shift||[],future=rows.filter(r=>r.richting_rank!=null).sort((a,b)=>a.richting_rank-b.richting_rank).slice(0,5);
  $("direction").innerHTML=future.map(r=>'<div class="list-item"><div class="rank">'+r.richting_rank+'</div><div><div class="name">'+r.wijk_naam+'</div><div class="meta">'+r.gemeente+'</div></div><div class="status">'+r.status+'</div><div class="meta" style="grid-column:2/4">'+(r.toelichting||"")+'</div></div>').join("")||'<div class="empty">Geen robuuste richting beschikbaar.</div>';
}
function renderDrivers(w){
  const d=w.direction?.drivers||[],s=w.direction?.summary||{};
  $("drivers").innerHTML=d.slice(0,5).map(x=>'<div class="driver"><div class="driver-domain">'+(x.domein||"")+'</div><strong>'+x.label+'</strong><div class="driver-val">'+(x.geprojecteerde_beweging_sd>0?"+":"")+fmt.two(x.geprojecteerde_beweging_sd)+' SD</div><div class="driver-dir">'+x.richting+'</div></div>').join("")||'<div class="empty">Geen drivers beschikbaar.</div>';
  $("directionStrength").textContent=s.sterkte_label?"Richting: "+s.sterkte_label:"Richting: –";
  $("directionMeta").textContent=s.recente_periode?"Basis "+s.basisperiode+" · recente trend "+s.recente_periode+" · "+(s.aantal_domeinen||"–")+" domeinen · trendconsistentie "+fmt.pct(s.trendconsistentie_pct):"";
}
function renderOutcomes(w){
  const o=w.outcomes||{},l=o.leefbaarheid||{},c=o.criminaliteit||{};
  $("outcomes").innerHTML='<table class="outcome-table"><thead><tr><th>Uitkomst</th><th>'+w.wijk_naam+'</th><th>Huidige peers</th><th>Richting-peers</th></tr></thead><tbody>'+
    '<tr><td>Leefbaarheid</td><td>'+fmt.two(l.wijk)+'</td><td>'+fmt.two(l.huidige_peers)+' <span class="meta">(n='+fmt.integer(l.huidige_peers_n)+')</span></td><td>'+fmt.two(l.richting_peers)+' <span class="meta">(n='+fmt.integer(l.richting_peers_n)+')</span></td></tr>'+
    '<tr><td>Misdrijven / 1.000</td><td>'+fmt.one(c.wijk)+'</td><td>'+fmt.one(c.huidige_peers)+' <span class="meta">(n='+fmt.integer(c.huidige_peers_n)+')</span></td><td>'+fmt.one(c.richting_peers)+' <span class="meta">(n='+fmt.integer(c.richting_peers_n)+')</span></td></tr>'+
    '</tbody></table><p class="note">Deze verschillen zijn context, geen causaliteit. De richting wordt bepaald zonder leefbaarheid en criminaliteit.</p>';
}
function renderSources(w){
  const s=state.municipality.sources||{};
  const rows=[
    ["Structurele wijkkenmerken",(s.structuur?.name||"CBS KWB")+" · "+(s.structuur?.latest_year||w.latest_year)],
    ["Leefbaarheid",(s.leefbaarheid?.name||"Leefbaarometer")+" · "+(s.leefbaarheid?.latest_year||"–")],
    ["Criminaliteit",(s.criminaliteit?.name||"Politie/CBS")+" · "+(w.criminaliteit?.laatste_periode||"laatste publicatie")],
    ["Analyse","vooraf berekend in private engine"]
  ];
  $("sources").innerHTML=rows.map(x=>'<div class="source-row"><span>'+x[0]+'</span><span>'+x[1]+'</span></div>').join("");
  $("methodSummary").textContent=state.municipality.method?.public_summary||"";
}
function renderAvailability(w){
  const a=state.municipality.availability||{};
  const wanted=["gemiddelde_woz","gemiddeld_inkomen","leeftijd_0_15_pct","leeftijd_65_plus_pct","koopwoningen_pct","eengezinswoningen_pct","herkomst_buiten_nederland_pct","nationaliteitsdiversiteit"];
  const rows=wanted.filter(k=>a[k]).map(k=>'<tr><td>'+a[k].label+'</td><td>'+fmt.integer(a[k].beschikbaar_vanaf)+'</td><td>'+fmt.integer(a[k].laatste_beschikbaar)+'</td></tr>').join("");
  $("availabilityTable").innerHTML='<table class="availability-table"><thead><tr><th>Indicator</th><th>Vanaf</th><th>Laatste jaar</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
load().catch(err=>{console.error(err);document.querySelector("main").innerHTML='<div class="card"><h2>Data kon niet worden geladen</h2><p>Controleer of de publieke databuild aanwezig is.</p></div>';});
