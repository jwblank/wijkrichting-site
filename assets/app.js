const state={index:null,municipality:null};
const $=id=>document.getElementById(id);

const fmt={
  integer:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{maximumFractionDigits:0}).format(v),
  one:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{minimumFractionDigits:1,maximumFractionDigits:1}).format(v),
  two:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v),
  euro:v=>v==null?"–":"€ "+new Intl.NumberFormat("nl-NL",{maximumFractionDigits:0}).format(v),
  pct:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1}).format(v)+"%",
  signedPct:v=>v==null?"–":(v>0?"+":"")+new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1}).format(v)+"%",
  year:v=>v==null?"–":String(Math.trunc(Number(v))),
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
function latestPoint(w,key){const p=points(w,key);return p.length?p[p.length-1]:null}
function firstPoint(w,key){const p=points(w,key);return p.length?p[0]:null}
function historyChange(w,key){
  const a=firstPoint(w,key),b=latestPoint(w,key);
  if(!a||!b||a.waarde==null||b.waarde==null)return null;
  return {start:a.jaar,end:b.jaar,startValue:a.waarde,endValue:b.waarde,abs:b.waarde-a.waarde,pct:a.waarde!==0?100*(b.waarde-a.waarde)/a.waarde:null};
}
function trim(v){return String(v??"").trim()}
function cleanCrimeLabel(v){return trim(v).replace(/^\d+(?:\.\d+)*\s+/,"")}
function prettyDomain(s){return ({demografie:"Demografie",woningstructuur:"Woningstructuur",woningmarkt:"Woningmarkt",sociaaleconomisch:"Sociaaleconomisch",bevolkingssamenstelling:"Bevolkingssamenstelling"})[s]||s}
function signedOne(v){if(v==null)return "–";return (v>0?"+":"")+fmt.one(v)}

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
  d.onchange=()=>{populateTrendSelect();render();renderMunicipalitySignals();};
  populateTrendSelect();
  render();
  renderMunicipalitySignals();
}

function getWijk(){
  return state.municipality.wijken.find(w=>w.wijk_code===$("district").value)||state.municipality.wijken[0];
}

function populateTrendSelect(){
  const w=getWijk();
  const preferred=["leeftijd_65_plus_pct","huishoudens_met_kinderen_pct","gemiddelde_woz","inwoners","leeftijd_0_15_pct","eenpersoonshuishoudens_pct","koopwoningen_pct","huurwoningen_pct","gemiddeld_inkomen"];
  const keys=preferred.filter(k=>points(w,k).length>1);
  $("trendMetric").innerHTML=keys.map(k=>'<option value="'+k+'">'+metricLabels[k]+'</option>').join("");
  const lead=w.direction?.drivers?.[0]?.indicator;
  $("trendMetric").value=keys.includes(lead)?lead:(keys[0]||"");
  $("trendMetric").onchange=()=>renderTrend(w);
}

function render(){
  document.querySelectorAll(".warning-box.dynamic").forEach(x=>x.remove());
  const w=getWijk();
  $("districtTitle").textContent=w.wijk_naam+", "+trim(w.gemeente);
  $("districtSubtitle").textContent="Actuele positie, structurele ontwikkeling en historische context.";
  renderFreshness(w);
  renderCoreMessage(w);
  renderKpis(w);
  renderTrend(w);
  renderComposition(w);
  renderDrivers(w);
  renderPeers(w);
  renderDirection(w);
  renderHistorical(w);
  renderLiveability(w);
  renderCrime(w);
  renderOutcomes(w);
  renderSources(w);
  renderAvailability(w);
}

function renderFreshness(w){
  const arr=[
    "Wijkprofiel "+fmt.year(w.latest_year),
    w.leefbaarheid?.latest?.jaar?"Leefbaarheid "+fmt.year(w.leefbaarheid.latest.jaar):null,
    w.criminaliteit?.laatste_periode?"Veiligheid t/m "+w.criminaliteit.laatste_periode:null
  ].filter(Boolean);
  $("freshness").innerHTML=arr.map(x=>'<span class="pill">'+x+'</span>').join("");
}

function buildCoreMessage(w){
  const sentences=[];
  const age65=historyChange(w,"leeftijd_65_plus_pct");
  const kids=historyChange(w,"huishoudens_met_kinderen_pct");
  const age0=historyChange(w,"leeftijd_0_15_pct");
  const single=historyChange(w,"eenpersoonshuishoudens_pct");
  const top=w.direction?.drivers?.[0];

  if(age65?.abs>0.5 && kids?.abs<-0.5){
    sentences.push(w.wijk_naam+" verandert vooral door vergrijzing en een afnemend aandeel huishoudens met kinderen.");
  }else if(age65?.abs>0.5 && age0?.abs<-0.5){
    sentences.push(w.wijk_naam+" verandert vooral door vergrijzing en een afnemend aandeel kinderen.");
  }else if(single?.abs>0.75 && kids?.abs<-0.5){
    sentences.push(w.wijk_naam+" verandert vooral door een groeiend aandeel eenpersoonshuishoudens en een afnemend aandeel huishoudens met kinderen.");
  }else if(top){
    const dir=top.richting==="omhoog"?"toename":"afname";
    sentences.push("De belangrijkste structurele beweging in "+w.wijk_naam+" is de "+dir+" van "+top.label.toLowerCase()+".");
  }else{
    sentences.push("Voor "+w.wijk_naam+" is geen dominante structurele verandering vastgesteld.");
  }

  const s=w.signal;
  if(s){
    const p=Number(s.signaal_percentiel);
    if(s.primair_signaal==="afwijkende ontwikkeling t.o.v. peers"){
      sentences.push("De recente ontwikkeling wijkt sterker af van structureel vergelijkbare wijken dan bij "+fmt.one(p)+"% van de landelijke referentiewijken.");
    }else if(s.primair_signaal==="sterke profielbeweging"){
      sentences.push("De omvang van de profielverandering is groter dan bij "+fmt.one(p)+"% van de landelijke referentiewijken.");
    }else if(s.primair_signaal==="weinig historisch precedent"){
      sentences.push("Voor dit ontwikkelpatroon zijn relatief weinig sterke historische vergelijkingsgevallen beschikbaar; de historische zeldzaamheid is groter dan bij "+fmt.one(p)+"% van de landelijke referentiewijken.");
    }
  }

  const rel=w.historical?.relative_outcomes||{};
  const lbm=w.historical?.leefbaarheid;
  const hist=[];
  if(rel.leeftijd_65_plus_pct?.mediaan_tov_landelijk>0.15)hist.push("verdere vergrijzing");
  if(rel.huishoudens_met_kinderen_pct?.mediaan_tov_landelijk<-0.25)hist.push("een verdere afname van huishoudens met kinderen");
  if(rel.leeftijd_0_15_pct?.mediaan_tov_landelijk<-0.25 && !hist.some(x=>x.includes("kinderen")))hist.push("een verdere afname van het aandeel kinderen");

  if(hist.length){
    let sentence="Historisch vergelijkbare trajecten lieten in de twee jaar daarna vooral "+hist.slice(0,2).join(" en ")+" zien";
    if(lbm?.stabiel_of_hoger_pct>=70){
      sentence+=", terwijl de leefbaarheid in "+fmt.one(lbm.stabiel_of_hoger_pct)+"% van de vergelijkbare trajecten ongeveer stabiel bleef of verbeterde";
    }
    sentences.push(sentence+".");
  }else if(lbm?.stabiel_of_hoger_pct>=70){
    sentences.push("Bij historisch vergelijkbare trajecten bleef de leefbaarheid in "+fmt.one(lbm.stabiel_of_hoger_pct)+"% ongeveer stabiel of verbeterde.");
  }

  return sentences.slice(0,3);
}

function renderCoreMessage(w){
  $("coreMessage").textContent=buildCoreMessage(w).join(" ");

  const evidence=[];
  const age65=historyChange(w,"leeftijd_65_plus_pct");
  const kids=historyChange(w,"huishoudens_met_kinderen_pct");
  if(age65){
    evidence.push(["Structurele ontwikkeling","65+ "+signedOne(age65.abs)+" pp sinds "+fmt.year(age65.start)]);
  }
  if(kids){
    evidence.push(["Huishoudens","Met kinderen "+signedOne(kids.abs)+" pp sinds "+fmt.year(kids.start)]);
  }

  const s=w.signal;
  if(s){
    let title="Landelijke vergelijking";
    let value="";
    if(s.primair_signaal==="weinig historisch precedent")value="Minder historisch precedent dan bij "+fmt.one(s.signaal_percentiel)+"%";
    else if(s.primair_signaal==="sterke profielbeweging")value="Sterkere profielbeweging dan bij "+fmt.one(s.signaal_percentiel)+"%";
    else value="Grotere peer-afwijking dan bij "+fmt.one(s.signaal_percentiel)+"%";
    evidence.push([title,value]);
  }

  const n=w.historical?.analogs?.length;
  if(n)evidence.push(["Historische basis",fmt.integer(n)+" best passende historische trajecten"]);

  $("coreEvidence").innerHTML=evidence.slice(0,4).map(x=>
    '<div class="core-evidence-item"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></div>'
  ).join("");
}

function renderKpis(w){
  const m=w.metrics||{},woz=latestPoint(w,"gemiddelde_woz"),income=latestPoint(w,"gemiddeld_inkomen");
  const age=latestPoint(w,"leeftijd_65_plus_pct"),inh=latestPoint(w,"inwoners"),crime=w.criminaliteit?.laatste_12m_per_1000;
  const koop=latestPoint(w,"koopwoningen_pct");
  const cards=[
    ["Inwoners",fmt.integer(inh?.waarde??m.inwoners),inh?"CBS "+fmt.year(inh.jaar):"CBS "+fmt.year(w.latest_year)],
    ["WOZ",fmt.euro(woz?.waarde??m.gemiddelde_woz),woz?"CBS "+fmt.year(woz.jaar):"laatste beschikbare waarde"],
    ["Koopwoningen",fmt.pct(koop?.waarde??m.koopwoningen_pct),"woningstructuur"],
    ["65+",fmt.pct(age?.waarde??m.leeftijd_65_plus_pct),age?"CBS "+fmt.year(age.jaar):"leeftijdsopbouw"],
    ["Gem. inkomen",fmt.euro(income?.waarde??m.gemiddeld_inkomen),income?"CBS "+fmt.year(income.jaar):"niet beschikbaar"],
    ["Misdrijven / 1.000",fmt.one(crime),w.criminaliteit?.laatste_periode?"12 maanden t/m "+w.criminaliteit.laatste_periode:"rolling 12 maanden"]
  ];
  $("kpis").innerHTML=cards.map(x=>'<div class="kpi"><div class="k-label">'+x[0]+'</div><div class="k-value">'+x[1]+'</div><div class="k-sub">'+x[2]+'</div></div>').join("");
}

function renderTrend(w){
  const key=$("trendMetric").value,pts=points(w,key);
  $("trendNote").textContent=pts.length?metricLabels[key]+" · "+fmt.year(pts[0].jaar)+"–"+fmt.year(pts[pts.length-1].jaar):"Geen consistente tijdreeks beschikbaar.";
  $("trendChart").innerHTML=pts.length?svgLine(pts,key,false):'<div class="empty">Geen tijdreeks beschikbaar.</div>';
}

function svgLine(pointsArr,key,compact){
  const W=560,H=compact?120:220,p=compact?24:36,vals=pointsArr.map(d=>Number(d.waarde)).filter(Number.isFinite);
  if(!vals.length)return '<div class="empty">Geen waarden.</div>';
  const min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)*.12||1,lo=min-pad,hi=max+pad,range=hi-lo;
  const coords=pointsArr.map((d,i)=>({x:p+i*(W-2*p)/Math.max(pointsArr.length-1,1),y:H-p-(d.waarde-lo)*(H-2*p)/range,...d}));
  const poly=coords.map(d=>d.x+","+d.y).join(" ");
  const labels=coords.map(d=>'<text x="'+d.x+'" y="'+(H-6)+'" text-anchor="middle" class="svg-label">'+fmt.year(d.jaar??d.label??"")+'</text>'+(compact?"":'<text x="'+d.x+'" y="'+(d.y-10)+'" text-anchor="middle" class="svg-value">'+metricValue(key,d.waarde)+'</text>')+'<circle cx="'+d.x+'" cy="'+d.y+'" r="'+(compact?3:4)+'" class="dot"></circle>').join("");
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
  $("compositionNote").textContent=her!=null?"Herkomst buiten Nederland: "+fmt.pct(her)+". Herkomst en nationaliteit zijn verschillende begrippen.":"Geen consistente historische reeks voor herkomst/nationaliteit beschikbaar.";
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
  $("drivers").innerHTML=d.slice(0,5).map(x=>
    '<div class="driver"><div class="driver-domain">'+prettyDomain(x.domein||"")+'</div><strong>'+x.label+'</strong><div class="driver-val">'+(x.richting==="omhoog"?"↑":"↓")+' '+movementLabel(x.geprojecteerde_beweging_sd)+'</div><div class="driver-dir">'+(x.richting==="omhoog"?"toename":"afname")+'</div><div class="driver-tech">technisch: '+(x.geprojecteerde_beweging_sd>0?"+":"")+fmt.two(x.geprojecteerde_beweging_sd)+' SD</div></div>'
  ).join("")||'<div class="empty">Geen consistente drivers beschikbaar.</div>';
  $("directionStrength").textContent=s.sterkte_label?"Profielbeweging: "+s.sterkte_label:"Profielbeweging: –";
  $("directionMeta").textContent=s.recente_periode?"Het trendscenario gebruikt "+s.basisperiode+"; de recente periode "+s.recente_periode+" telt zwaarder mee. Dit onderdeel is geen voorspelling.":"";
}

function renderPeers(w){
  $("peers").innerHTML=(w.peers||[]).map(p=>
    '<div class="list-item"><div class="rank">#'+p.rank+'</div><div><div class="name">'+p.wijk_naam+'</div><div class="meta">'+trim(p.gemeente)+'</div></div><div class="status">rang '+p.rank+' van '+fmt.integer(p.van)+'</div></div>'
  ).join("");
  const domains=w.peer_domains||{};
  $("peerDomains").innerHTML=Object.entries(domains).map(([d,fs])=>
    '<div class="domain-row"><strong>'+prettyDomain(d)+'</strong><span>'+fs.map(x=>x.label).join(", ")+'</span></div>'
  ).join("")||'<div class="empty">Geen domeindetails beschikbaar.</div>';
}

function directionStatus(status){
  if(status==="blijft referentiepunt")return "Nu én in trendscenario vergelijkbaar";
  if(status==="nieuwe richting")return "Vooral in trendscenario vergelijkbaar";
  if(status==="verdwijnt uit topgroep")return "Vooral nu vergelijkbaar";
  return status||"";
}

function directionExplanation(row){
  if(row.status==="blijft referentiepunt")return "Deze wijk lijkt nu al op de geselecteerde wijk en blijft ook in het trendscenario een sterke vergelijking.";
  if(row.status==="nieuwe richting")return "Deze wijk behoort nu niet tot de beste vergelijkingswijken, maar het profiel wordt meer vergelijkbaar als de recente trend doorzet.";
  return row.toelichting||"";
}

function renderDirection(w){
  const rows=w.direction?.profile_shift||[];
  const future=rows.filter(r=>r.richting_rank!=null).sort((a,b)=>a.richting_rank-b.richting_rank).slice(0,5);
  $("direction").innerHTML=future.map(r=>
    '<div class="list-item"><div class="rank">#'+r.richting_rank+'</div><div><div class="name">'+r.wijk_naam+'</div><div class="meta">'+trim(r.gemeente)+'</div></div><div class="status">'+directionStatus(r.status)+'</div><div class="meta list-explanation">'+directionExplanation(r)+'</div></div>'
  ).join("")||'<div class="empty">Geen robuust trendscenario beschikbaar.</div>';
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
    $("historicalIntro").textContent="Onvoldoende stabiele historische trajecten beschikbaar.";
    $("historicalOutcomes").innerHTML='<div class="empty">Geen historische analogieën beschikbaar.</div>';
    $("historicalAnalogs").innerHTML="";
    $("historicalEvidence").innerHTML="";
    $("historicalMethod").innerHTML="";
    return;
  }

  const method=h.method||{},validation=h.validation||{},hold=validation.selected_analogy_holdout||{};
  const directionBacktest=state.municipality.method?.historical_validation?.direction_backtest?.overall||{};

  $("historicalIntro").textContent=
    "Historische analogieën zijn oudere Nederlandse wijksituaties met een vergelijkbare structuur én een vergelijkbare wijk-specifieke ontwikkeling. Algemene landelijke bewegingen worden vooraf uitgefilterd. De uitkomsten tonen wat in de twee jaar daarna gebeurde ten opzichte van de landelijke ontwikkeling.";

  const outcomes=h.relative_outcomes||h.outcomes||{};
  const keys=["leeftijd_65_plus_pct","leeftijd_0_15_pct","gemiddelde_woz","inwoners"];
  $("historicalOutcomes").innerHTML=keys.filter(k=>outcomes[k]).map(k=>{
    const x=outcomes[k];
    return '<div class="historical-outcome"><div class="hist-label">'+x.label+' · t.o.v. landelijk</div><div class="hist-value">'+historicalValue(x)+'</div><div class="hist-range">'+historicalRange(x)+'</div></div>';
  }).join("")||'<div class="empty">Onvoldoende vergelijkbare uitkomsten.</div>';

  const lbm=h.leefbaarheid;
  $("historicalLiveability").textContent=lbm
    ?"Bij "+fmt.one(lbm.stabiel_of_hoger_pct)+"% van de historische analogieën bleef de Leefbaarometerscore ongeveer stabiel of verbeterde (n="+fmt.integer(lbm.n)+")."
    :"Onvoldoende Leefbaarometerdata voor een historische samenvatting.";

  $("historicalAnalogs").innerHTML=h.analogs.slice(0,5).map(a=>
    '<div class="list-item"><div class="rank">#'+a.rank+'</div><div><div class="name">'+a.wijk_naam+'</div><div class="meta">'+trim(a.gemeente)+'</div></div><div class="status">'+fmt.year(a.anchor_year)+' → '+fmt.year(a.future_year)+'</div></div>'
  ).join("");

  const gain=validation.traject_meerwaarde_holdout_pct;
  $("historicalEvidence").innerHTML=
    '<div class="evidence-item"><strong>'+fmt.pct(hold.beter_dan_landelijke_trend_pct)+'</strong><span>van de wijken in de onafhankelijke toets: nauwkeuriger dan alleen de landelijke trend</span></div>'+
    '<div class="evidence-item"><strong>'+(gain!=null?(gain>0?"+":"")+fmt.one(gain)+"%":"–")+'</strong><span>verschil in mediane fout ten opzichte van alleen profielmatching</span></div>'+
    '<div class="evidence-item"><strong>'+fmt.integer(hold.n)+'</strong><span>wijken in de onafhankelijke toets '+(validation.holdout_period||"2022→2024")+'</span></div>';

  const directionWin=directionBacktest.beter_dan_landelijke_trend_pct;
  $("historicalMethod").innerHTML=
    '<p class="validation-note">De historische analogielaag gebruikt transparante k-nearest-neighbour-analyse. Eerst blijven de '+fmt.pct((method.profile_gate_pct||0)*100)+' structureel meest vergelijkbare historische toestanden over. Binnen die groep tellen profiel en wijk-specifiek traject ieder '+fmt.pct((method.profile_weight||0)*100)+'. De samenvatting gebruikt '+fmt.integer(method.k)+' analogieën.</p>'+
    '<div class="validation-callout"><strong>Beperking trendscenario:</strong> het lineaire trendscenario was in de historische backtest in '+fmt.pct(directionWin)+' van de gevallen nauwkeuriger dan een eenvoudige landelijke-trendbenchmark. Daarom wordt dit uitsluitend als scenario gepresenteerd.</div>'+
    '<p class="validation-note">'+(h.caveat||"Historische analogieën zijn geen causale voorspelling.")+'</p>';

  const modest=hold.beter_dan_landelijke_trend_pct!=null&&hold.beter_dan_landelijke_trend_pct<60;
  $("historicalValidationBadge").textContent=modest?"GETOETST · BESCHEIDEN SIGNAAL":"OUT-OF-TIME GETOETST";
  $("historicalValidationBadge").className="pill"+(modest?" warn":"");
}

function renderLiveability(w){
  const l=w.leefbaarheid||{},latest=l.latest,pts=(l.history||[]).map(x=>({jaar:x.jaar,waarde:x.waarde}));
  $("liveabilitySummary").innerHTML=latest?fmt.two(latest.waarde)+' <small>'+latest.klasse+'</small>':'–';
  $("liveabilityReference").innerHTML=latest
    ?'<strong>Interpretatie via klasse: '+latest.klasse+'.</strong> Leefbaarometer 3.0 gebruikt negen klassen van zeer onvoldoende tot uitstekend. De score is geen 0–10-schaal en heeft zonder klasse geen zelfstandige betekenis. De middelste landelijke score ligt rond 4,11.'
    :"";
  $("liveabilityChart").innerHTML=pts.length?svgLine(pts,"leefbaarheid_score",true):'<div class="empty">Geen Leefbaarometerhistorie.</div>';
  if(latest&&pts.length>1){
    const first=pts[0];
    $("liveabilityNote").textContent="Ontwikkeling: "+fmt.two(first.waarde)+" ("+fmt.year(first.jaar)+") naar "+fmt.two(latest.waarde)+" ("+fmt.year(latest.jaar)+"). Bron: Leefbaarometer 3.0.";
  }else $("liveabilityNote").textContent="Geen consistente wijkreeks beschikbaar.";
}

const months=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
function periodPoint(year,month){return months[month-1]+" "+year}
function previousYearPoint(year,month){return months[month-1]+" "+(year-1)}

function renderCrime(w){
  const c=w.criminaliteit||{};
  if(c.status!=="ok"){
    $("crimeSummary").textContent="–";
    $("crimeChart").innerHTML='<div class="empty">Geen actuele wijkreeks beschikbaar.</div>';
    $("crimeCategories").innerHTML="";
    $("crimeNote").textContent="Bron: Politie/CBS 47022NED.";
    return;
  }

  const cur=Number(c.laatste_12m_aantal||0),prev=Number(c.vorige_12m_aantal||0),mx=Math.max(cur,prev,1);
  const monthly=c.monthly||[];
  const first=monthly[0],last=monthly[monthly.length-1];
  const currentPeriod=first&&last?periodPoint(first.jaar,first.maand)+" – "+periodPoint(last.jaar,last.maand):"meest recente 12 maanden";
  const previousPeriod=first&&last?previousYearPoint(first.jaar,first.maand)+" – "+previousYearPoint(last.jaar,last.maand):"voorafgaande 12 maanden";

  $("crimeSummary").innerHTML=fmt.one(c.laatste_12m_per_1000)+' <small>geregistreerde misdrijven per 1.000 inwoners</small>';
  $("crimeChart").innerHTML='<div class="crime-compare">'+
    '<div class="crime-period"><div><strong>'+currentPeriod+'</strong><span>meest recente 12 maanden</span></div><div class="crime-bar-track"><div class="crime-bar-fill" style="width:'+(100*cur/mx)+'%"></div></div><strong>'+fmt.integer(cur)+' registraties</strong></div>'+
    '<div class="crime-period"><div><strong>'+previousPeriod+'</strong><span>voorafgaande 12 maanden</span></div><div class="crime-bar-track"><div class="crime-bar-fill previous" style="width:'+(100*prev/mx)+'%"></div></div><strong>'+fmt.integer(prev)+' registraties</strong></div>'+
    '</div>';

  $("crimeCategories").innerHTML=(c.top_categories||[]).slice(0,3).map(x=>
    '<div class="category-row"><span>'+cleanCrimeLabel(x.label)+'</span><strong>'+fmt.integer(x.aantal_12m)+'</strong></div>'
  ).join("");

  const delta=cur-prev;
  $("crimeNote").textContent=(delta===0
    ?"Het aantal registraties is gelijk aan de voorafgaande periode."
    :fmt.integer(Math.abs(delta))+" "+(delta>0?"meer":"minder")+" registraties dan in de voorafgaande 12-maandsperiode.")+
    " Dit betreft politieregistraties; niet alle feitelijke criminaliteit wordt geregistreerd.";

  if(c.kleine_populatie){
    $("crimeNote").insertAdjacentHTML("afterend",'<div class="warning-box dynamic">Kleine wijkpopulatie: cijfers per 1.000 inwoners kunnen sterk schommelen.</div>');
  }else if(cur<30){
    $("crimeNote").insertAdjacentHTML("afterend",'<div class="warning-box dynamic">Beperkt aantal registraties: procentuele veranderingen kunnen daardoor groot lijken. De absolute aantallen zijn daarom expliciet weergegeven.</div>');
  }
}

function compareText(current,direction,label){
  if(current==null||direction==null)return null;
  const diff=direction-current;
  if(label==="leefbaarheid"){
    if(Math.abs(diff)<0.03)return "De gemiddelde leefbaarheid van huidige peers en wijken in het trendscenario ligt vrijwel op hetzelfde niveau.";
    return "Wijken in het trendscenario hebben gemiddeld een "+(diff>0?"iets hogere":"iets lagere")+" Leefbaarometerscore dan de huidige peers.";
  }
  const rel=current!==0?100*diff/current:null;
  if(rel!=null&&Math.abs(rel)<15)return "De geregistreerde criminaliteit van beide vergelijkingsgroepen ligt in dezelfde orde van grootte.";
  return "Wijken in het trendscenario hebben gemiddeld "+(diff>0?"meer":"minder")+" geregistreerde misdrijven per 1.000 inwoners dan de huidige peers.";
}

function renderOutcomes(w){
  const o=w.outcomes||{},l=o.leefbaarheid||{},c=o.criminaliteit||{};
  const texts=[compareText(l.huidige_peers,l.richting_peers,"leefbaarheid"),compareText(c.huidige_peers,c.richting_peers,"criminaliteit")].filter(Boolean);
  $("outcomes").innerHTML='<table class="outcome-table"><thead><tr><th>Uitkomst</th><th>'+w.wijk_naam+'</th><th>Huidige peers</th><th>Wijken in trendscenario</th></tr></thead><tbody>'+
    '<tr><td>Leefbaarheid</td><td>'+fmt.two(l.wijk)+'</td><td>'+fmt.two(l.huidige_peers)+' <span class="meta">(n='+fmt.integer(l.huidige_peers_n)+')</span></td><td>'+fmt.two(l.richting_peers)+' <span class="meta">(n='+fmt.integer(l.richting_peers_n)+')</span></td></tr>'+
    '<tr><td>Misdrijven / 1.000</td><td>'+fmt.one(c.wijk)+'</td><td>'+fmt.one(c.huidige_peers)+' <span class="meta">(n='+fmt.integer(c.huidige_peers_n)+')</span></td><td>'+fmt.one(c.richting_peers)+' <span class="meta">(n='+fmt.integer(c.richting_peers_n)+')</span></td></tr>'+
    '</tbody></table>'+(texts.length?'<div class="outcome-interpretation">'+texts.join(" ")+' Dit is context, geen voorspeld gevolg.</div>':'');
}

function signalDescription(r){
  if(r.primair_signaal==="weinig historisch precedent")return "Weinig vergelijkbare historische trajecten";
  if(r.primair_signaal==="sterke profielbeweging")return "Sterke verandering van het wijkprofiel";
  if(r.primair_signaal==="afwijkende ontwikkeling t.o.v. peers")return "Ontwikkeling wijkt af van vergelijkbare wijken";
  return r.primair_signaal||"Structureel signaal";
}
function signalComparison(r){
  const p=Number(r.signaal_percentiel);
  if(r.primair_signaal==="weinig historisch precedent")return "Uitzonderlijker historisch patroon dan bij "+fmt.one(p)+"% van de landelijke referentiewijken";
  if(r.primair_signaal==="sterke profielbeweging")return "Sterkere profielbeweging dan bij "+fmt.one(p)+"% van de landelijke referentiewijken";
  return "Grotere afwijking van peers dan bij "+fmt.one(p)+"% van de landelijke referentiewijken";
}

function renderMunicipalitySignals(){
  const layer=state.municipality?.signals,box=$("municipalitySignals");
  if(!layer?.rows?.length){if(box)box.style.display="none";return}
  box.style.display="";

  const selected=getWijk()?.wijk_code;
  const municipalityName=state.municipality?.municipality?.name||"de gemeente";
  const rows=layer.rows.filter(r=>r.wijk_code!==selected);
  const top=rows.filter(r=>r.signaal_percentiel>=90).slice(0,6);
  const shown=top.length?top:rows.slice(0,6);
  const nHigh=rows.filter(r=>r.signaal_percentiel>=90).length;

  $("signalTitle").textContent="Welke andere wijken in "+municipalityName+" vallen op?";
  $("signalIntro").textContent="Wijken worden alleen getoond wanneer een structurele ontwikkeling, profielbeweging of historische zeldzaamheid landelijk sterk afwijkt. De reden staat per wijk expliciet vermeld.";
  $("signalReference").textContent="Landelijke referentie: "+fmt.integer(layer.summary?.national_reference_n)+" wijken";
  $("signalStats").innerHTML=
    '<div class="signal-stat"><strong>'+fmt.integer(nHigh)+'</strong><span>andere wijken in landelijk top 10%</span></div>'+
    '<div class="signal-stat"><strong>3</strong><span>structurele signalen afzonderlijk beoordeeld</span></div>'+
    '<div class="signal-stat"><strong>0</strong><span>verborgen samengestelde risicoscores</span></div>';

  $("signalRows").innerHTML=shown.map(r=>{
    const safety=r.veiligheidscontext?'<div class="signal-context">Aanvullende context: '+r.veiligheidscontext.label+' ('+fmt.signedPct(r.veiligheidscontext.verandering_pct)+')</div>':'';
    return '<button class="signal-overview-row" type="button" data-code="'+r.wijk_code+'">'+
      '<div><div class="signal-title">'+r.wijk_naam+'</div>'+safety+'</div>'+
      '<div><div class="signal-reason">'+signalDescription(r)+'</div><div class="signal-comparison">'+signalComparison(r)+'</div></div>'+
      '<div class="signal-top">top '+fmt.one(100-r.signaal_percentiel)+'%</div>'+
    '</button>';
  }).join("");

  document.querySelectorAll(".signal-overview-row").forEach(el=>{
    el.onclick=()=>{
      $("district").value=el.dataset.code;
      populateTrendSelect();
      render();
      renderMunicipalitySignals();
      $("#wijkProfileTop")?.scrollIntoView({behavior:"smooth",block:"start"});
    };
  });

  $("signalMethod").textContent=
    "Per wijk worden drie landelijke vergelijkingen afzonderlijk berekend: afwijking van recente ontwikkeling ten opzichte van structureel vergelijkbare wijken, sterkte van de profielbeweging en de mate waarin goede historische vergelijkingsgevallen ontbreken. Een wijk verschijnt hoog in dit overzicht zodra één van deze drie signalen uitzonderlijk is. Veiligheid is alleen aanvullende context en telt niet mee.";
}

function renderSources(w){
  const s=state.municipality.sources||{};
  const rows=[
    ["Structurele wijkkenmerken",(s.structuur?.name||"CBS KWB")+" · t/m "+fmt.year(s.structuur?.latest_year||w.latest_year)],
    ["Leefbaarheid",(s.leefbaarheid?.name||"Leefbaarometer")+" · "+fmt.year(s.leefbaarheid?.latest_year)+" · "+(s.leefbaarheid?.frequency||"")],
    ["Criminaliteit",(s.criminaliteit?.name||"Politie/CBS")+" · t/m "+(w.criminaliteit?.laatste_periode||"laatste publicatie")+" · maandelijks"],
    ["Databuild",fmt.date(state.municipality.generated_at)]
  ];
  $("sources").innerHTML=rows.map(x=>'<div class="source-row"><span>'+x[0]+'</span><span>'+x[1]+'</span></div>').join("");
  $("methodSummary").textContent=state.municipality.method?.public_summary||"";
}

function renderAvailability(){
  const a=state.municipality.availability||{};
  const wanted=["gemiddelde_woz","gemiddeld_inkomen","leeftijd_0_15_pct","leeftijd_65_plus_pct","koopwoningen_pct","eengezinswoningen_pct","herkomst_buiten_nederland_pct","nationaliteitsdiversiteit"];
  const rows=wanted.filter(k=>a[k]).map(k=>'<tr><td>'+a[k].label+'</td><td>'+fmt.year(a[k].beschikbaar_vanaf)+'</td><td>'+fmt.year(a[k].laatste_beschikbaar)+'</td></tr>').join("");
  $("availabilityTable").innerHTML='<table class="availability-table"><thead><tr><th>Indicator</th><th>Beschikbaar vanaf</th><th>Laatste jaar</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

load().catch(err=>{
  console.error(err);
  document.querySelector("main").innerHTML='<div class="card"><h2>Data kon niet worden geladen</h2><p>De databron kon niet worden gelezen. Probeer de pagina opnieuw te laden.</p></div>';
});