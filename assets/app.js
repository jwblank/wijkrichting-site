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
function points(w,key){return w.history?.[key]||[]}
function latestPoint(w,key){
  const p=points(w,key); return p.length?p[p.length-1]:null;
}
function firstPoint(w,key){
  const p=points(w,key); return p.length?p[0]:null;
}
function historyChange(w,key){
  const a=firstPoint(w,key),b=latestPoint(w,key);
  if(!a||!b||a.waarde==null||b.waarde==null)return null;
  return {start:a.jaar,end:b.jaar,startValue:a.waarde,endValue:b.waarde,abs:b.waarde-a.waarde,pct:a.waarde!==0?100*(b.waarde-a.waarde)/a.waarde:null};
}
function trim(v){return String(v??"").trim()}
function cleanCrimeLabel(v){return trim(v).replace(/^\d+(?:\.\d+)*\s+/,"")}

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
  populateTrendSelect();renderMunicipalitySignals();render();
}
function getWijk(){return state.municipality.wijken.find(w=>w.wijk_code===$("district").value)||state.municipality.wijken[0];}

function signalBadgeClass(label){
  if(label==="zeer opvallend")return "signal-badge very-high";
  if(label==="opvallend")return "signal-badge high";
  return "signal-badge";
}
function renderMunicipalitySignals(){
  const layer=state.municipality?.signals;
  const box=$("municipalitySignals");
  if(!layer?.rows?.length){
    if(box)box.style.display="none";
    return;
  }
  box.style.display="";
  const rows=layer.rows;
  const top=rows.filter(r=>r.signaal_percentiel>=90).slice(0,6);
  const very=rows.filter(r=>r.signaal_label==="zeer opvallend").length;
  const notable=rows.filter(r=>r.signaal_label==="opvallend").length;
  const attention=rows.filter(r=>r.signaal_label==="aandacht").length;

  const municipalityName=state.municipality?.municipality?.name || $("municipality")?.selectedOptions?.[0]?.textContent || "de gemeente";
  $("signalTitle").textContent="Welke andere wijken in "+municipalityName+" vallen op?";
  $("signalIntro").textContent="Gebruik dit overzicht pas na de wijkanalyse: het laat zien welke andere wijken structureel uitzonderlijk veranderen of weinig historisch precedent hebben.";
  $("signalReference").textContent="Landelijke referentie: n="+fmt.integer(layer.summary?.national_reference_n);
  $("signalStats").innerHTML=
    '<div class="signal-stat"><strong>'+very+'</strong><span>zeer opvallende wijken</span></div>'+
    '<div class="signal-stat"><strong>'+notable+'</strong><span>opvallende wijken</span></div>'+
    '<div class="signal-stat"><strong>'+attention+'</strong><span>extra aandacht</span></div>';

  $("signalRows").innerHTML=(top.length?top:rows.slice(0,6)).map((r,i)=>{
    const safety=r.veiligheidscontext
      ? '<div class="signal-context">'+r.veiligheidscontext.label+' ('+fmt.signedPct(r.veiligheidscontext.verandering_pct)+')</div>'
      : '';
    return '<div class="signal-overview-row" data-code="'+r.wijk_code+'">'+
      '<div><div class="signal-title">'+r.wijk_naam+'</div>'+safety+'</div>'+
      '<div><div class="signal-reason">'+r.primair_signaal+'</div><div class="signal-meter"><div style="width:'+Math.min(r.signaal_percentiel,100)+'%"></div></div></div>'+
      '<div class="signal-rank">landelijk '+fmt.one(r.signaal_percentiel)+'e percentiel</div>'+
      '<div class="'+signalBadgeClass(r.signaal_label)+'">'+r.signaal_label+'</div>'+
    '</div>';
  }).join("");

  document.querySelectorAll(".signal-overview-row").forEach(el=>{
    el.onclick=()=>{
      $("district").value=el.dataset.code;
      populateTrendSelect();
      render();
      document.querySelector("#wijkProfileTop")?.scrollIntoView({behavior:"smooth",block:"start"});
    };
  });

  $("signalMethod").textContent=
    "De signalering combineert niets tot één verborgen score. Per wijk berekenen we drie landelijke percentielen: afwijking van recente ontwikkeling ten opzichte van structurele peers, sterkte van de profielbeweging en gebrek aan historisch precedent. De overzichtsrang is simpelweg het hoogste van die drie. Veiligheid is alleen context en telt niet mee.";
}

function populateTrendSelect(){
  const w=getWijk();
  const preferred=["gemiddelde_woz","inwoners","leeftijd_65_plus_pct","leeftijd_0_15_pct","eenpersoonshuishoudens_pct","huishoudens_met_kinderen_pct","koopwoningen_pct","huurwoningen_pct","gemiddeld_inkomen"];
  const keys=preferred.filter(k=>points(w,k).length>1);
  $("trendMetric").innerHTML=keys.map(k=>'<option value="'+k+'">'+metricLabels[k]+'</option>').join("");
  if(keys.includes("gemiddelde_woz"))$("trendMetric").value="gemiddelde_woz";
  $("trendMetric").onchange=()=>renderTrend(w);
}
function render(){
  document.querySelectorAll(".warning-box.dynamic").forEach(x=>x.remove());
  const w=getWijk();
  $("districtTitle").textContent=w.wijk_naam+", "+trim(w.gemeente);
  $("districtSubtitle").textContent="Je bekijkt nu deze wijk. We starten met de huidige situatie en recente ontwikkeling en bouwen daarna stap voor stap op naar vergelijking, scenario en historische toets.";
  renderFreshness(w);renderKpis(w);renderObservations(w);renderTrend(w);renderComposition(w);
  renderLiveability(w);renderCrime(w);renderPeers(w);renderDirection(w);renderDrivers(w);
  renderHistorical(w);renderOutcomes(w);renderSources(w);renderAvailability(w);
}
function renderFreshness(w){
  const arr=[
    "Wijkprofiel "+w.latest_year,
    w.leefbaarheid?.latest?.jaar?"Leefbaarheid "+w.leefbaarheid.latest.jaar:null,
    w.criminaliteit?.laatste_periode?"Veiligheid t/m "+w.criminaliteit.laatste_periode:null
  ].filter(Boolean);
  $("freshness").innerHTML=arr.map(x=>'<span class="pill">'+x+'</span>').join("");
}
function renderKpis(w){
  const m=w.metrics||{},woz=latestPoint(w,"gemiddelde_woz"),income=latestPoint(w,"gemiddeld_inkomen");
  const age=latestPoint(w,"leeftijd_65_plus_pct"),inh=latestPoint(w,"inwoners"),crime=w.criminaliteit?.laatste_12m_per_1000;
  const koop=latestPoint(w,"koopwoningen_pct"),single=latestPoint(w,"eengezinswoningen_pct");
  const cards=[
    ["Inwoners",fmt.integer(inh?.waarde??m.inwoners),inh?"CBS "+inh.jaar:"CBS "+w.latest_year],
    ["WOZ",fmt.euro(woz?.waarde??m.gemiddelde_woz),woz?"CBS "+woz.jaar:"laatste beschikbare waarde"],
    ["Koopwoningen",fmt.pct(koop?.waarde??m.koopwoningen_pct),single?.waarde!=null?fmt.pct(single.waarde)+" eengezins":"woningstructuur"],
    ["65+",fmt.pct(age?.waarde??m.leeftijd_65_plus_pct),age?"CBS "+age.jaar:"leeftijdsopbouw"],
    ["Gem. inkomen",fmt.euro(income?.waarde??m.gemiddeld_inkomen),income?"CBS "+income.jaar:"niet beschikbaar"],
    ["Misdrijven / 1.000",fmt.one(crime),w.criminaliteit?.laatste_periode?"12 mnd t/m "+w.criminaliteit.laatste_periode:"rolling 12 maanden"]
  ];
  $("kpis").innerHTML=cards.map(x=>'<div class="kpi"><div class="k-label">'+x[0]+'</div><div class="k-value">'+x[1]+'</div><div class="k-sub">'+x[2]+'</div></div>').join("");
}
function buildNarrative(w){
  const out=[];
  const woz=historyChange(w,"gemiddelde_woz");
  const age65=historyChange(w,"leeftijd_65_plus_pct"),age0=historyChange(w,"leeftijd_0_15_pct");
  const single=historyChange(w,"eenpersoonshuishoudens_pct"),kids=historyChange(w,"huishoudens_met_kinderen_pct");
  const pop=historyChange(w,"inwoners");
  const topDriver=w.direction?.drivers?.[0];

  if(woz?.pct!=null && Math.abs(woz.pct)>=10){
    out.push("De gemiddelde WOZ-waarde steeg van "+fmt.euro(woz.startValue)+" in "+woz.start+" naar "+fmt.euro(woz.endValue)+" in "+woz.end+" ("+fmt.signedPct(woz.pct)+").");
  }
  if(age65 && age0 && age65.abs>1 && age0.abs<0){
    out.push("De leeftijdsopbouw verschuift: het aandeel 65+ nam met "+fmt.one(age65.abs)+" procentpunt toe, terwijl 0–15 jaar met "+fmt.one(Math.abs(age0.abs))+" procentpunt afnam.");
  }else if(age65 && Math.abs(age65.abs)>=1){
    out.push("Het aandeel 65+ veranderde sinds "+age65.start+" met "+(age65.abs>0?"+":"")+fmt.one(age65.abs)+" procentpunt.");
  }
  if(single && kids && single.abs>1 && kids.abs<0){
    out.push("Ook de huishoudensstructuur verandert: meer eenpersoonshuishoudens en minder huishoudens met kinderen.");
  }
  if(pop?.pct!=null && Math.abs(pop.pct)>=3){
    out.push("Het aantal inwoners "+(pop.pct>0?"groeide":"daalde")+" sinds "+pop.start+" met "+fmt.one(Math.abs(pop.pct))+"%.");
  }
  if(topDriver){
    const dir=topDriver.richting==="omhoog"?"omhoog":"omlaag";
    out.push("In de ontwikkelrichting weegt "+topDriver.label.toLowerCase()+" momenteel het sterkst mee ("+dir+").");
  }
  return out.slice(0,4);
}
function renderObservations(w){
  const o=buildNarrative(w);
  $("observations").innerHTML=o.length?o.map(x=>'<div class="signal">'+x+'</div>').join(""):'<div class="empty">Voor deze wijk zijn nog te weinig consistente tijdreeksen beschikbaar voor een compacte duiding.</div>';
}
function renderTrend(w){
  const key=$("trendMetric").value,pts=points(w,key);
  $("trendNote").textContent=pts.length?metricLabels[key]+" · "+pts[0].jaar+"–"+pts[pts.length-1].jaar:"Geen consistente tijdreeks beschikbaar.";
  $("trendChart").innerHTML=pts.length?svgLine(pts,key,false):'<div class="empty">Geen tijdreeks beschikbaar.</div>';
}
function svgLine(pointsArr,key,compact){
  const W=560,H=compact?120:220,p=compact?24:36,vals=pointsArr.map(d=>Number(d.waarde)).filter(Number.isFinite);
  if(!vals.length)return '<div class="empty">Geen waarden.</div>';
  const min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)*.12||1,lo=min-pad,hi=max+pad,range=hi-lo;
  const coords=pointsArr.map((d,i)=>({x:p+i*(W-2*p)/Math.max(pointsArr.length-1,1),y:H-p-(d.waarde-lo)*(H-2*p)/range,...d}));
  const poly=coords.map(d=>d.x+","+d.y).join(" ");
  const labels=coords.map(d=>'<text x="'+d.x+'" y="'+(H-6)+'" text-anchor="middle" class="svg-label">'+(d.jaar??d.label??"")+'</text>'+(compact?"":'<text x="'+d.x+'" y="'+(d.y-10)+'" text-anchor="middle" class="svg-value">'+metricValue(key,d.waarde)+'</text>')+'<circle cx="'+d.x+'" cy="'+d.y+'" r="'+(compact?3:4)+'" class="dot"></circle>').join("");
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img"><line x1="'+p+'" y1="'+(H-p)+'" x2="'+(W-p)+'" y2="'+(H-p)+'" class="axis"></line><polyline points="'+poly+'" class="line"></polyline>'+labels+'</svg>';
}
function renderComposition(w){
  const m=w.metrics||{};
  const value=k=>latestPoint(w,k)?.waarde??m[k];
  const rows=[
    ["0–15 jaar",value("leeftijd_0_15_pct")],["65+",value("leeftijd_65_plus_pct")],
    ["Eenpersoonshuishoudens",value("eenpersoonshuishoudens_pct")],["Met kinderen",value("huishoudens_met_kinderen_pct")],
    ["Koopwoningen",value("koopwoningen_pct")],["Eengezinswoningen",value("eengezinswoningen_pct")]
  ].filter(x=>x[1]!=null);
  $("composition").innerHTML=rows.map(x=>'<div class="comp-row"><span>'+x[0]+'</span><div class="track"><div class="fill" style="width:'+Math.min(Math.max(x[1],0),100)+'%"></div></div><strong>'+fmt.pct(x[1])+'</strong></div>').join("");
  const her=value("herkomst_buiten_nederland_pct");
  $("compositionNote").textContent=her!=null?"Herkomst buiten Nederland: "+fmt.pct(her)+". Herkomst is niet hetzelfde als nationaliteit.":"Herkomst/nationaliteit is in de gebruikte tijdreeks niet consistent genoeg beschikbaar en wordt daarom niet ingevuld.";
}
function renderLiveability(w){
  const l=w.leefbaarheid||{},latest=l.latest,pts=(l.history||[]).map(x=>({jaar:x.jaar,waarde:x.waarde}));
  $("liveabilitySummary").innerHTML=latest?fmt.two(latest.waarde)+' <small>'+latest.klasse+'</small>':'–';
  $("liveabilityChart").innerHTML=pts.length?svgLine(pts,"leefbaarheid_score",true):'<div class="empty">Geen Leefbaarometerhistorie.</div>';
  if(latest&&pts.length>1){
    const first=pts[0];
    $("liveabilityNote").textContent="Van "+fmt.two(first.waarde)+" in "+first.jaar+" naar "+fmt.two(latest.waarde)+" in "+latest.jaar+". Leefbaarheid wordt tweejaarlijks gemeten.";
  }else $("liveabilityNote").textContent="Geen consistente wijkreeks beschikbaar.";
}
function renderCrime(w){
  const c=w.criminaliteit||{};
  if(c.status!=="ok"){
    $("crimeSummary").textContent="–";$("crimeChart").innerHTML='<div class="empty">Geen actuele wijkreeks beschikbaar.</div>';
    $("crimeCategories").innerHTML="";$("crimeNote").textContent="Bron: Politie/CBS 47022NED.";return;
  }
  $("crimeSummary").innerHTML=fmt.one(c.laatste_12m_per_1000)+' <small>per 1.000 inwoners</small>';
  const cur=Number(c.laatste_12m_aantal||0),prev=Number(c.vorige_12m_aantal||0),mx=Math.max(cur,prev,1);
  $("crimeChart").innerHTML='<div class="crime-compare">'+
    '<div class="crime-bar-row"><span>Laatste 12 mnd</span><div class="crime-bar-track"><div class="crime-bar-fill" style="width:'+(100*cur/mx)+'%"></div></div><strong>'+fmt.integer(cur)+'</strong></div>'+
    '<div class="crime-bar-row"><span>Vorige 12 mnd</span><div class="crime-bar-track"><div class="crime-bar-fill previous" style="width:'+(100*prev/mx)+'%"></div></div><strong>'+fmt.integer(prev)+'</strong></div>'+
    '</div>';
  $("crimeCategories").innerHTML=(c.top_categories||[]).slice(0,3).map(x=>'<div class="category-row"><span>'+cleanCrimeLabel(x.label)+'</span><strong>'+fmt.integer(x.aantal_12m)+'</strong></div>').join("");
  const delta=cur-prev;
  $("crimeNote").textContent=(delta===0?"Evenveel registraties als in de voorafgaande 12 maanden.":(Math.abs(delta)+" "+(delta>0?"meer":"minder")+" registraties dan in de voorafgaande 12 maanden."))+" Dit zijn politie-registraties, niet alle feitelijke criminaliteit.";
  if(c.kleine_populatie){
    $("crimeNote").insertAdjacentHTML("afterend",'<div class="warning-box dynamic">Kleine wijkpopulatie: cijfers per 1.000 inwoners kunnen sterk schommelen.</div>');
  }else if(cur<30){
    $("crimeNote").insertAdjacentHTML("afterend",'<div class="warning-box dynamic">Het aantal registraties is beperkt. Procentuele veranderingen kunnen daardoor groot lijken; kijk vooral naar de aantallen.</div>');
  }
}
function renderPeers(w){
  $("peers").innerHTML=(w.peers||[]).map(p=>'<div class="list-item"><div class="rank">#'+p.rank+'</div><div><div class="name">'+p.wijk_naam+'</div><div class="meta">'+trim(p.gemeente)+'</div></div><div class="status">'+p.rank+' van '+fmt.integer(p.van)+'</div></div>').join("");
  const domains=w.peer_domains||{};
  $("peerDomains").innerHTML=Object.entries(domains).map(([d,fs])=>'<div class="domain-row"><strong>'+prettyDomain(d)+'</strong><span>'+fs.map(x=>x.label).join(", ")+'</span></div>').join("")||'<div class="empty">Geen domeindetails.</div>';
}
function prettyDomain(s){return ({demografie:"Demografie",woningstructuur:"Woningstructuur",woningmarkt:"Woningmarkt",sociaaleconomisch:"Sociaaleconomisch",bevolkingssamenstelling:"Bevolkingssamenstelling"})[s]||s;}
function renderDirection(w){
  const rows=w.direction?.profile_shift||[],future=rows.filter(r=>r.richting_rank!=null).sort((a,b)=>a.richting_rank-b.richting_rank).slice(0,5);
  $("direction").innerHTML=future.map(r=>'<div class="list-item"><div class="rank">#'+r.richting_rank+'</div><div><div class="name">'+r.wijk_naam+'</div><div class="meta">'+trim(r.gemeente)+'</div></div><div class="status">'+r.status+'</div><div class="meta" style="grid-column:2/4">'+(r.toelichting||"")+'</div></div>').join("")||'<div class="empty">Geen robuuste richting beschikbaar.</div>';
}
function movementLabel(v){
  const a=Math.abs(Number(v)||0);
  if(a>=0.5)return "sterke beweging";
  if(a>=0.2)return "duidelijke beweging";
  if(a>=0.1)return "lichte beweging";
  return "vrijwel stabiel";
}
function renderDrivers(w){
  const d=w.direction?.drivers||[],s=w.direction?.summary||{};
  $("drivers").innerHTML=d.slice(0,5).map(x=>'<div class="driver"><div class="driver-domain">'+(x.domein||"")+'</div><strong>'+x.label+'</strong><div class="driver-val">'+(x.richting==="omhoog"?"↑":"↓")+' '+movementLabel(x.geprojecteerde_beweging_sd)+'</div><div class="driver-dir">'+x.richting+'</div><div class="driver-tech">technisch: '+(x.geprojecteerde_beweging_sd>0?"+":"")+fmt.two(x.geprojecteerde_beweging_sd)+' SD</div></div>').join("")||'<div class="empty">Geen drivers beschikbaar.</div>';
  $("directionStrength").textContent=s.sterkte_label?"Profielbeweging: "+s.sterkte_label:"Profielbeweging: –";
  $("directionMeta").textContent=s.recente_periode?"Scenario bij doorzetten van de structurele trend uit "+s.basisperiode+"; de recente periode "+s.recente_periode+" telt zwaarder mee. Dit onderdeel is geen voorspelling.":"";
}

function signedOne(v){
  if(v==null)return "–";
  return (v>0?"+":"")+fmt.one(v);
}
function historicalValue(item){
  if(!item)return "–";
  const value=item.mediaan_tov_landelijk ?? item.mediaan;
  const suffix=String(item.eenheid||"").includes("procentpunt")?" pp":"%";
  return signedOne(value)+suffix;
}
function historicalRange(item){
  if(!item)return "";
  const p25=item.p25_tov_landelijk ?? item.p25;
  const p75=item.p75_tov_landelijk ?? item.p75;
  const suffix=String(item.eenheid||"").includes("procentpunt")?" pp":"%";
  return "middelste 50%: "+signedOne(p25)+suffix+" tot "+signedOne(p75)+suffix;
}
function renderHistorical(w){
  const h=w.historical||{};
  if(!h.analogs?.length){
    $("historicalIntro").textContent="Voor deze wijk zijn nog onvoldoende stabiele historische trajecten beschikbaar.";
    $("historicalOutcomes").innerHTML='<div class="empty">Geen historische analogieën beschikbaar.</div>';
    $("historicalAnalogs").innerHTML="";
    $("historicalEvidence").innerHTML="";
    $("historicalMethod").innerHTML="";
    return;
  }

  const method=h.method||{};
  const validation=h.validation||{};
  const hold=validation.selected_analogy_holdout||{};
  const profileOnly=validation.profile_only_holdout||{};
  const directionBacktest=state.municipality.method?.historical_validation?.direction_backtest?.overall||{};

  $("historicalIntro").textContent=
    "We zoeken oudere Nederlandse wijksituaties met een vergelijkbare structuur én een vergelijkbare wijk-specifieke ontwikkeling. Algemene landelijke bewegingen, zoals een brede WOZ-stijging, worden eerst uitgefilterd. De cijfers hieronder laten zien hoe die analogieën zich in de twee jaar daarna ontwikkelden ten opzichte van de landelijke beweging.";

  const historicalOutcomes=h.relative_outcomes||h.outcomes||{};
  const keys=["leeftijd_65_plus_pct","leeftijd_0_15_pct","gemiddelde_woz","inwoners"];
  $("historicalOutcomes").innerHTML=keys
    .filter(k=>historicalOutcomes[k])
    .map(k=>{
      const x=historicalOutcomes[k];
      return '<div class="historical-outcome">'+
        '<div class="hist-label">'+x.label+' · t.o.v. landelijk</div>'+
        '<div class="hist-value">'+historicalValue(x)+'</div>'+
        '<div class="hist-range">'+historicalRange(x)+'</div>'+
        '</div>';
    }).join("") || '<div class="empty">Onvoldoende vergelijkbare uitkomsten.</div>';

  const lbm=h.leefbaarheid;
  $("historicalLiveability").textContent=lbm
    ? "Leefbaarheid bij historische analogieën: mediane verandering "+signedOne(lbm.mediaan_delta)+
      " punt; in "+fmt.pct(lbm.stabiel_of_hoger_pct)+" bleef de score ongeveer stabiel of hoger (n="+lbm.n+")."
    : "Leefbaarheid is voor te weinig historische analogieën over beide meetjaren beschikbaar om samen te vatten.";

  $("historicalAnalogs").innerHTML=h.analogs.slice(0,5).map(a=>
    '<div class="list-item">'+
      '<div class="rank">#'+a.rank+'</div>'+
      '<div><div class="name">'+a.wijk_naam+'</div><div class="meta">'+trim(a.gemeente)+'</div></div>'+
      '<div class="status">'+a.anchor_year+' → '+a.future_year+'</div>'+
    '</div>'
  ).join("");

  const gain=validation.traject_meerwaarde_holdout_pct;
  $("historicalEvidence").innerHTML=
    '<div class="evidence-item"><strong>'+fmt.pct(hold.beter_dan_landelijke_trend_pct)+'</strong><span>van de wijken in de onafhankelijke holdout: nauwkeuriger dan simpelweg de landelijke trend volgen</span></div>'+
    '<div class="evidence-item"><strong>'+(gain!=null?(gain>0?"+":"")+fmt.one(gain)+"%":"–")+'</strong><span>verschil in mediane fout ten opzichte van alleen profielmatching; de extra trajectmeerwaarde is dus bescheiden</span></div>'+
    '<div class="evidence-item"><strong>'+fmt.integer(hold.n)+'</strong><span>wijken in de onafhankelijke toets 2022→2024; instellingen zijn eerder gekozen op 2020→2022</span></div>';

  const directionWin=directionBacktest.beter_dan_landelijke_trend_pct;
  $("historicalMethod").innerHTML=
    '<p class="validation-note">De historische analogieën gebruiken een transparante k-nearest-neighbour methode (instance-based machine learning). Eerst blijven alleen de '+fmt.pct((method.profile_gate_pct||0)*100)+' structureel meest vergelijkbare historische toestanden over. Binnen die groep telt profiel '+fmt.pct((method.profile_weight||0)*100)+' en wijk-specifiek traject '+fmt.pct((method.trajectory_weight||0)*100)+'. De uiteindelijke samenvatting gebruikt '+fmt.integer(method.k)+' historische analogieën.</p>'+
    '<div class="validation-callout"><strong>Waarom we de richting-peers niet als voorspelling tonen:</strong> het losse lineaire trendscenario was in de historische backtest slechts in '+fmt.pct(directionWin)+' van de gevallen nauwkeuriger dan een eenvoudige landelijke-trendbenchmark. De richting is daarom nuttig als uitlegbaar scenario, maar niet als bewezen forecast.</div>'+
    '<p class="validation-note">'+(h.caveat||"")+'</p>';

  const modest=hold.beter_dan_landelijke_trend_pct!=null && hold.beter_dan_landelijke_trend_pct<60;
  $("historicalValidationBadge").textContent=modest?"Getoetst · bescheiden signaal":"Out-of-time getoetst";
  $("historicalValidationBadge").className="pill"+(modest?" warn":"");
}

function compareText(current,direction,label){
  if(current==null||direction==null)return null;
  const diff=direction-current;
  if(label==="leefbaarheid"){
    if(Math.abs(diff)<0.03)return "De gemiddelde leefbaarheid van huidige peers en richting-peers ligt vrijwel op hetzelfde niveau.";
    return "Richting-peers hebben gemiddeld een "+(diff>0?"iets hogere":"iets lagere")+" Leefbaarometerscore dan de huidige peers.";
  }
  const rel=current!==0?100*diff/current:null;
  if(rel!=null&&Math.abs(rel)<15)return "De geregistreerde criminaliteit van richting-peers ligt in dezelfde orde van grootte als bij de huidige peers.";
  return "Richting-peers hebben gemiddeld "+(diff>0?"meer":"minder")+" geregistreerde misdrijven per 1.000 inwoners dan de huidige peers.";
}
function renderOutcomes(w){
  const o=w.outcomes||{},l=o.leefbaarheid||{},c=o.criminaliteit||{};
  const texts=[compareText(l.huidige_peers,l.richting_peers,"leefbaarheid"),compareText(c.huidige_peers,c.richting_peers,"criminaliteit")].filter(Boolean);
  $("outcomes").innerHTML='<table class="outcome-table"><thead><tr><th>Uitkomst</th><th>'+w.wijk_naam+'</th><th>Huidige peers</th><th>Richting-peers</th></tr></thead><tbody>'+
    '<tr><td>Leefbaarheid</td><td>'+fmt.two(l.wijk)+'</td><td>'+fmt.two(l.huidige_peers)+' <span class="meta">(n='+fmt.integer(l.huidige_peers_n)+')</span></td><td>'+fmt.two(l.richting_peers)+' <span class="meta">(n='+fmt.integer(l.richting_peers_n)+')</span></td></tr>'+
    '<tr><td>Misdrijven / 1.000</td><td>'+fmt.one(c.wijk)+'</td><td>'+fmt.one(c.huidige_peers)+' <span class="meta">(n='+fmt.integer(c.huidige_peers_n)+')</span></td><td>'+fmt.one(c.richting_peers)+' <span class="meta">(n='+fmt.integer(c.richting_peers_n)+')</span></td></tr>'+
    '</tbody></table>'+(texts.length?'<div class="outcome-interpretation">'+texts.join(" ")+' Dit is context bij de profielrichting, geen voorspeld gevolg.</div>':'')+
    '<p class="note">Leefbaarheid en criminaliteit zijn niet gebruikt om de peers of ontwikkelrichting te bepalen.</p>';
}
function renderSources(w){
  const s=state.municipality.sources||{};
  const rows=[
    ["Structurele wijkkenmerken",(s.structuur?.name||"CBS KWB")+" · t/m "+(s.structuur?.latest_year||w.latest_year)],
    ["Leefbaarheid",(s.leefbaarheid?.name||"Leefbaarometer")+" · "+(s.leefbaarheid?.latest_year||"–")+" · "+(s.leefbaarheid?.frequency||"")],
    ["Criminaliteit",(s.criminaliteit?.name||"Politie/CBS")+" · t/m "+(w.criminaliteit?.laatste_periode||"laatste publicatie")+" · maandelijks"],
    ["Databuild",fmt.date(state.municipality.generated_at)]
  ];
  $("sources").innerHTML=rows.map(x=>'<div class="source-row"><span>'+x[0]+'</span><span>'+x[1]+'</span></div>').join("");
  $("methodSummary").textContent=state.municipality.method?.public_summary||"";
}
function renderAvailability(w){
  const a=state.municipality.availability||{};
  const wanted=["gemiddelde_woz","gemiddeld_inkomen","leeftijd_0_15_pct","leeftijd_65_plus_pct","koopwoningen_pct","eengezinswoningen_pct","herkomst_buiten_nederland_pct","nationaliteitsdiversiteit"];
  const rows=wanted.filter(k=>a[k]).map(k=>'<tr><td>'+a[k].label+'</td><td>'+fmt.integer(a[k].beschikbaar_vanaf)+'</td><td>'+fmt.integer(a[k].laatste_beschikbaar)+'</td></tr>').join("");
  $("availabilityTable").innerHTML='<table class="availability-table"><thead><tr><th>Indicator</th><th>Beschikbaar vanaf</th><th>Laatste jaar</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
load().catch(err=>{console.error(err);document.querySelector("main").innerHTML='<div class="card"><h2>Data kon niet worden geladen</h2><p>De databron kon niet worden gelezen. Probeer de pagina opnieuw te laden.</p></div>';});