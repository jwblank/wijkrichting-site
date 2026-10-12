const state={index:null,municipality:null,enrichment:{}};
const $=id=>document.getElementById(id);
const fmt={integer:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{maximumFractionDigits:0}).format(v),one:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{minimumFractionDigits:1,maximumFractionDigits:1}).format(v),euro:v=>v==null?"–":"€ "+new Intl.NumberFormat("nl-NL",{maximumFractionDigits:0}).format(v),pct:v=>v==null?"–":new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1}).format(v)+"%",date:v=>v?new Date(v).toLocaleDateString("nl-NL",{day:"numeric",month:"short",year:"numeric"}):"–"};
const metricLabels={inwoners:"Inwoners",gemiddelde_woz:"Gemiddelde WOZ",gemiddeld_inkomen:"Gemiddeld inkomen",koopwoningen_pct:"Koopwoningen",huurwoningen_pct:"Huurwoningen",leeftijd_0_15_pct:"0–15 jaar",leeftijd_65_plus_pct:"65+",eenpersoonshuishoudens_pct:"Eenpersoonshuishoudens",huishoudens_met_kinderen_pct:"Huishoudens met kinderen",bevolkingsdichtheid:"Bevolkingsdichtheid",laag_inkomen_pct:"Lage inkomens",bijstand_pct_inwoners:"Bijstand",nationaliteitsdiversiteit:"Nationaliteitsdiversiteit"};

function metricValue(key,v){if(key==="gemiddelde_woz"||key==="gemiddeld_inkomen")return fmt.euro(v);if(key.endsWith("_pct"))return fmt.pct(v);if(key==="inwoners"||key==="bevolkingsdichtheid")return fmt.integer(v);return v==null?"–":fmt.one(v);}

async function load(){
  state.index=await fetch("data/gemeenten.json").then(r=>r.json());
  try{state.enrichment=await fetch("data/enrichment.json").then(r=>r.json());}catch(e){state.enrichment={};}
  $("generatedAt").textContent=fmt.date(state.index.generated_at);
  const sel=$("municipality");
  sel.innerHTML=state.index.municipalities.map(m=>'<option value="'+m.slug+'">'+m.name+'</option>').join("");
  sel.addEventListener("change",()=>loadMunicipality(sel.value));
  await loadMunicipality(sel.value);
}
async function loadMunicipality(slug){
  state.municipality=await fetch("data/"+slug+".json").then(r=>r.json());
  const district=$("district");
  district.innerHTML=state.municipality.wijken.map(w=>'<option value="'+w.wijk_code+'" '+(w.wijk_naam==="Ter Leede"?"selected":"")+'>'+w.wijk_naam+'</option>').join("");
  district.onchange=render;
  populateTrendSelect();
  render();
}
function getWijk(){return state.municipality.wijken.find(w=>w.wijk_code===$("district").value)||state.municipality.wijken[0];}
function populateTrendSelect(){
  const keys=["gemiddelde_woz","inwoners","leeftijd_65_plus_pct","leeftijd_0_15_pct","koopwoningen_pct","gemiddeld_inkomen"];
  $("trendMetric").innerHTML=keys.map(k=>'<option value="'+k+'">'+metricLabels[k]+'</option>').join("");
  $("trendMetric").value="gemiddelde_woz";$("trendMetric").onchange=()=>renderTrend(getWijk());
}
function render(){
  const w=getWijk(),extra=state.enrichment[w.wijk_code]||{};
  $("districtTitle").textContent=w.wijk_naam+", "+w.gemeente;
  $("districtSubtitle").textContent="Structurele wijkdata t/m "+w.latest_year+". De site rekent niets live: alle analyses zijn vooraf berekend.";
  renderFreshness(w,extra);renderKpis(w,extra);renderTrend(w);renderComposition(w,extra);renderPeers(w);renderDirection(w);renderDrivers(w);renderOutcomes(w,extra);renderSources(w,extra);
}
function renderFreshness(w,extra){
  const arr=["Structuur "+w.latest_year,extra.leefbaarheid?.jaar?"Leefbaarheid "+extra.leefbaarheid.jaar:null,extra.criminaliteit?.jaar?"Veiligheid t/m "+extra.criminaliteit.jaar:null].filter(Boolean);
  $("freshness").innerHTML=arr.map(x=>'<span class="pill">'+x+'</span>').join("");
}
function renderKpis(w,extra){
  const m=w.metrics||{};
  const cards=[["Inwoners",fmt.integer(m.inwoners),"CBS "+w.latest_year],["WOZ",fmt.euro(m.gemiddelde_woz),extra.woz_change||"actuele structurele waarde"],["Koopwoningen",fmt.pct(m.koopwoningen_pct),"woningstructuur"],["65+",fmt.pct(m.leeftijd_65_plus_pct),"leeftijdsopbouw"],["Gem. inkomen",fmt.euro(m.gemiddeld_inkomen),"per inwoner"],["Leefbaarheid",extra.leefbaarheid?fmt.one(extra.leefbaarheid.waarde):"–",extra.leefbaarheid?.klasse||"koppeling volgt"]];
  $("kpis").innerHTML=cards.map(x=>'<div class="kpi"><div class="k-label">'+x[0]+'</div><div class="k-value">'+x[1]+'</div><div class="k-sub">'+x[2]+'</div></div>').join("");
}
function renderTrend(w){
  const key=$("trendMetric").value,pts=w.history?.[key]||[];
  $("trendNote").textContent=pts.length?metricLabels[key]+" · "+pts[0].jaar+"–"+pts[pts.length-1].jaar:"Voor deze indicator is nog geen consistente tijdreeks beschikbaar.";
  $("trendChart").innerHTML=pts.length?svgLine(pts,key):'<div class="empty">Geen tijdreeks beschikbaar.</div>';
}
function svgLine(points,key){
  const W=560,H=205,p=34,vals=points.map(d=>d.waarde),min=Math.min(...vals),max=Math.max(...vals),range=(max-min)||1;
  const coords=points.map((d,i)=>({x:p+i*(W-2*p)/Math.max(points.length-1,1),y:H-p-(d.waarde-min)*(H-2*p)/range,jaar:d.jaar,waarde:d.waarde}));
  const poly=coords.map(d=>d.x+","+d.y).join(" ");
  const labels=coords.map(d=>'<text x="'+d.x+'" y="'+(H-8)+'" text-anchor="middle" class="svg-label">'+d.jaar+'</text><text x="'+d.x+'" y="'+(d.y-10)+'" text-anchor="middle" class="svg-value">'+metricValue(key,d.waarde)+'</text><circle cx="'+d.x+'" cy="'+d.y+'" r="4" class="dot"></circle>').join("");
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img"><line x1="'+p+'" y1="'+(H-p)+'" x2="'+(W-p)+'" y2="'+(H-p)+'" class="axis"></line><polyline points="'+poly+'" class="line"></polyline>'+labels+'</svg>';
}
function renderComposition(w,extra){
  const m=w.metrics||{},rows=[["0–15 jaar",m.leeftijd_0_15_pct],["65+",m.leeftijd_65_plus_pct],["Koopwoningen",m.koopwoningen_pct],["Huurwoningen",m.huurwoningen_pct],["Alleenstaand",m.eenpersoonshuishoudens_pct]].filter(x=>x[1]!=null);
  $("composition").innerHTML=rows.map(x=>'<div class="comp-row"><span>'+x[0]+'</span><div class="track"><div class="fill" style="width:'+Math.min(x[1],100)+'%"></div></div><strong>'+fmt.pct(x[1])+'</strong></div>').join("");
  $("compositionNote").textContent=extra.herkomst_buiten_nl!=null?"Herkomst buiten Nederland: "+fmt.pct(extra.herkomst_buiten_nl)+". Herkomst is niet hetzelfde als nationaliteit.":"Herkomst/nationaliteit wordt alleen getoond wanneer de brondefinitie eenduidig is.";
}
function renderPeers(w){
  $("peers").innerHTML=(w.peers||[]).map(p=>'<div class="list-item"><div class="rank">'+p.rank+' / '+fmt.integer(p.van)+'</div><div><div class="name">'+p.wijk_naam+'</div><div class="meta">'+p.gemeente+'</div></div><div class="meta">afstand '+fmt.one(p.technische_afstand)+'</div></div>').join("");
  const f=(w.peer_features||[]).map(x=>x.label).join(", ");$("peerFeatures").textContent=f?"De huidige peerselectie gebruikt: "+f+". Indicatoren worden eerst op vergelijkbare schaal gebracht.":"Methodedetails volgen.";
}
function renderDirection(w){
  const rows=w.direction?.profile_shift||[],future=rows.filter(r=>r.richting_rank!=null).sort((a,b)=>a.richting_rank-b.richting_rank).slice(0,5);
  $("direction").innerHTML=future.map(r=>'<div class="list-item"><div class="rank">'+r.richting_rank+'</div><div><div class="name">'+r.wijk_naam+'</div><div class="meta">'+r.gemeente+'</div></div><div class="status">'+r.status+'</div><div class="meta" style="grid-column:2/4">'+(r.toelichting||"")+'</div></div>').join("");
  const s=w.direction?.summary||{};$("directionStrength").textContent=s.sterkte_label?"Richting: "+s.sterkte_label:"Richting: –";
}
function renderDrivers(w){
  const d=w.direction?.drivers||[];
  $("drivers").innerHTML=d.slice(0,5).map(x=>'<div class="driver"><strong>'+x.label+'</strong><div class="driver-val">'+(x.geprojecteerde_beweging_sd>0?"+":"")+fmt.one(x.geprojecteerde_beweging_sd)+' SD</div><div class="driver-dir">'+x.richting+'</div></div>').join("")||'<div class="empty">Nog geen drivers beschikbaar.</div>';
}
function renderOutcomes(w,extra){
  if(!extra.outcomes){$("outcomes").innerHTML='<div class="empty">De onafhankelijke koppeling met Leefbaarometer en actuele politiedata wordt in de volgende databuild toegevoegd.</div>';return;}
  const o=extra.outcomes;
  $("outcomes").innerHTML='<table class="outcome-table"><thead><tr><th>Uitkomst</th><th>'+w.wijk_naam+'</th><th>Huidige peers</th><th>Richting-peers</th></tr></thead><tbody><tr><td>Leefbaarheid</td><td>'+fmt.one(o.leefbaarheid.wijk)+'</td><td>'+fmt.one(o.leefbaarheid.huidige_peers)+'</td><td>'+fmt.one(o.leefbaarheid.richting_peers)+'</td></tr><tr><td>Misdrijven / 1.000</td><td>'+fmt.one(o.criminaliteit.wijk)+'</td><td>'+fmt.one(o.criminaliteit.huidige_peers)+'</td><td>'+fmt.one(o.criminaliteit.richting_peers)+'</td></tr></tbody></table><p class="note">'+(o.toelichting||"")+'</p>';
}
function renderSources(w,extra){
  const rows=[["Structurele wijkkenmerken","CBS KWB · "+w.latest_year],["Leefbaarheid",extra.leefbaarheid?"Leefbaarometer · "+extra.leefbaarheid.jaar:"nog niet gekoppeld"],["Criminaliteit",extra.criminaliteit?"Politie/CBS · "+extra.criminaliteit.jaar:"nog niet gekoppeld"],["Analyse","vooraf berekend in private engine"]];
  $("sources").innerHTML=rows.map(x=>'<div class="source-row"><span>'+x[0]+'</span><span>'+x[1]+'</span></div>').join("");
}
load().catch(err=>{console.error(err);document.querySelector("main").innerHTML='<div class="card"><h2>Data kon niet worden geladen</h2><p>Controleer of de publieke databuild aanwezig is.</p></div>';});