"use strict";

(function createPhoneApp() {
  const FILTER_KEY="myphone.phone.recents-filter", TAB_KEY="myphone.phone.last-tab", VIEWED_KEY="myphone.phone.viewed-missed";
  const contacts={
    amber:{name:"Amber",label:"Mobile",initials:"A",photo:"media/messages/amber/IMG_0266.png",message:"amber",photos:true,location:"not-just-coffee-south-blvd"},
    naomi:{name:"Naomi",label:"Mobile",initials:"N",photo:"media/messages/naomi/IMG_0319.png",message:"naomi"},
    noelle:{name:"Noelle",label:"Mobile",initials:"N",message:null},
    selina:{name:"Selina",label:"Mobile",initials:"S",photo:"media/messages/selina/IMG_0318.png",message:"selina"},
    fi:{name:"Fi Entertainment",label:"Management",initials:"FI",message:"fi-ent",mail:"fi-entertainment"},
    ghosts:{name:"Ghosts In Shells",label:"Business",initials:"×",mail:"ghosts-in-shells",website:"https://ghostsinshells.com"},
    chase:{name:"Chase Bank",label:"Financial Services",initials:"C",message:"chase-bank"},
    jimmy:{name:"Jimmy",label:"Mobile",initials:"J"},
    d:{name:"D",label:"Mobile",initials:"D"},
    mom:{name:"Mom",label:"Mobile",initials:"M"},
    dad:{name:"Dad",label:"Mobile",initials:"D"},
    twin:{name:"Twin",label:"Mobile",initials:"T"},
    kalix:{name:"Kalix",label:"Mobile",initials:"K"},
    yt:{name:"Y.T",label:"Mobile",initials:"YT"},
    junior:{name:"Junior",label:"Mobile",initials:"J"},
    unknown:{name:"Unknown Caller",label:"No Caller ID",initials:"?"}
  };
  const calls=[
    {id:"mom",direction:"Incoming",time:"9:18 AM",result:"Answered",date:"Today",duration:"4 minutes, 21 seconds"},
    {id:"noelle",direction:"Incoming",time:"2:43 AM",result:"Missed",date:"Today",missed:true},
    {id:"naomi",direction:"Incoming",time:"1:18 AM",result:"Answered",date:"Today",duration:"6 minutes, 7 seconds"},
    {id:"noelle",direction:"Incoming",time:"12:36 AM",result:"Missed",date:"Today",missed:true},
    {id:"jimmy",direction:"Outgoing",time:"7:46 PM",result:"Answered",date:"Yesterday",duration:"2 minutes, 48 seconds"},
    {id:"selina",direction:"Incoming",time:"2:12 AM",result:"Missed",date:"Yesterday",missed:true},
    {id:"amber",direction:"Incoming",time:"12:48 AM",result:"Answered",date:"Yesterday",duration:"9 minutes, 31 seconds"},
    {id:"noelle",direction:"Incoming",time:"2:26 AM",result:"Missed",date:"Jul 11",missed:true},
    {id:"twin",direction:"Incoming",time:"12:41 AM",result:"Missed",date:"Jul 11",missed:true},
    {id:"amber",direction:"Outgoing",time:"3:27 PM",result:"No Answer",date:"Jul 10"},
    {id:"naomi",direction:"Incoming",time:"1:54 AM",result:"Missed",date:"Jul 10",missed:true},
    {id:"noelle",direction:"Outgoing",time:"12:22 AM",result:"No Answer",date:"Jul 10"},
    {id:"selina",direction:"Incoming",time:"2:37 AM",result:"Answered",date:"Jul 9",duration:"4 minutes, 52 seconds"},
    {id:"kalix",direction:"Outgoing",time:"11:38 PM",result:"Answered",date:"Jul 8",duration:"8 minutes, 13 seconds"},
    {id:"noelle",direction:"Incoming",time:"2:08 AM",result:"Missed",date:"Jul 8",missed:true},
    {id:"amber",direction:"Outgoing",time:"12:31 AM",result:"Answered",date:"Jul 8",duration:"7 minutes, 16 seconds"},
    {id:"d",direction:"Incoming",time:"1:06 PM",result:"Answered",date:"Jul 6",duration:"1 minute, 55 seconds"},
    {id:"naomi",direction:"Incoming",time:"1:47 AM",result:"Missed",date:"Jul 6",missed:true},
    {id:"dad",direction:"Outgoing",time:"10:34 AM",result:"Answered",date:"Jul 4",duration:"5 minutes, 2 seconds"},
    {id:"noelle",direction:"Incoming",time:"12:58 AM",result:"Answered",date:"Jul 3",duration:"12 minutes, 4 seconds"},
    {id:"yt",direction:"Incoming",time:"6:22 PM",result:"Missed",date:"Jul 1",missed:true},
    {id:"selina",direction:"Incoming",time:"2:21 AM",result:"Missed",date:"Jun 30",missed:true},
    {id:"junior",direction:"Outgoing",time:"4:11 PM",result:"Canceled",date:"Jun 28"},
    {id:"amber",direction:"Incoming",time:"1:33 AM",result:"Missed",date:"Jun 28",missed:true},
    {id:"naomi",direction:"Incoming",time:"2:32 PM",result:"Answered",date:"Jun 25",duration:"3 minutes, 12 seconds"},
    {id:"noelle",direction:"Incoming",time:"2:49 AM",result:"Missed",date:"Jun 25",missed:true},
    {id:"jimmy",direction:"Incoming",time:"8:05 PM",result:"Missed",date:"Jun 21",missed:true},
    {id:"naomi",direction:"Outgoing",time:"12:44 AM",result:"Answered",date:"Jun 20",duration:"5 minutes, 38 seconds"},
    {id:"mom",direction:"Outgoing",time:"11:24 AM",result:"Answered",date:"Jun 18",duration:"6 minutes, 17 seconds"},
    {id:"fi",direction:"Incoming",time:"4:18 PM",result:"Answered",date:"Jun 11",duration:"6 minutes, 44 seconds"},
    {id:"twin",direction:"Outgoing",time:"1:14 AM",result:"Answered",date:"Jun 7",duration:"11 minutes, 26 seconds"},
    {id:"selina",direction:"Outgoing",time:"2:11 PM",result:"Canceled",date:"Jun 2"},
    {id:"d",direction:"Incoming",time:"5:43 PM",result:"Missed",date:"May 29",missed:true},
    {id:"kalix",direction:"Incoming",time:"12:08 AM",result:"Answered",date:"May 24",duration:"7 minutes, 9 seconds"},
    {id:"dad",direction:"Incoming",time:"8:52 AM",result:"Answered",date:"May 19",duration:"3 minutes, 33 seconds"},
    {id:"ghosts",direction:"Outgoing",time:"11:10 AM",result:"Answered",date:"May 14",duration:"2 minutes, 8 seconds"},
    {id:"junior",direction:"Incoming",time:"7:36 PM",result:"Missed",date:"May 8",missed:true},
    {id:"yt",direction:"Outgoing",time:"3:49 PM",result:"Answered",date:"May 2",duration:"4 minutes, 46 seconds"},
    {id:"noelle",direction:"Incoming",time:"2:19 PM",result:"Missed",date:"Apr 27",missed:true},
    {id:"mom",direction:"Incoming",time:"10:15 AM",result:"Answered",date:"Apr 21",duration:"9 minutes, 4 seconds"},
    {id:"jimmy",direction:"Outgoing",time:"6:57 PM",result:"No Answer",date:"Apr 16"},
    {id:"twin",direction:"Incoming",time:"11:52 PM",result:"Answered",date:"Apr 10",duration:"13 minutes, 18 seconds"},
    {id:"d",direction:"Outgoing",time:"12:42 PM",result:"Answered",date:"Apr 5",duration:"2 minutes, 29 seconds"},
    {id:"kalix",direction:"Incoming",time:"1:26 AM",result:"Missed",date:"Mar 30",missed:true},
    {id:"dad",direction:"Outgoing",time:"9:31 AM",result:"No Answer",date:"Mar 25"},
    {id:"junior",direction:"Outgoing",time:"5:18 PM",result:"Answered",date:"Mar 20",duration:"5 minutes, 41 seconds"},
    {id:"yt",direction:"Incoming",time:"4:03 PM",result:"Answered",date:"Mar 15",duration:"3 minutes, 7 seconds"},
    {id:"amber",direction:"Incoming",time:"7:28 PM",result:"Missed",date:"Mar 10",missed:true},
    {id:"naomi",direction:"Outgoing",time:"2:54 PM",result:"Answered",date:"Mar 6",duration:"4 minutes, 12 seconds"},
    {id:"chase",direction:"Incoming",time:"9:42 AM",result:"Answered",date:"Mar 3",duration:"1 minute, 37 seconds"},
    {id:"twin",direction:"Outgoing",time:"12:17 AM",result:"No Answer",date:"Mar 1"},
    {id:"kalix",direction:"Incoming",time:"11:43 PM",result:"Answered",date:"Feb 28",duration:"6 minutes, 25 seconds"}
  ];
  let host, activeTab="recents", dialed="", timers=[];
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const viewed=()=>{try{return JSON.parse(localStorage.getItem(VIEWED_KEY))||[]}catch{return[]}};
  function avatar(contact,size="") { return contact.photo?`<img class="phone-avatar ${size}" src="${esc(contact.photo)}" alt="">`:`<span class="phone-avatar phone-initials ${contact===contacts.ghosts?"ghosts":""} ${size}">${esc(contact.initials)}</span>`; }
  const callKey=(call)=>`${call.id}|${call.date}|${call.time}`;
  function syncBadge(){const seen=viewed(),count=calls.filter((call)=>call.missed&&!seen.includes(callKey(call))).length;const allowed=localStorage.getItem("myphone.settings.notifications")!=="0";document.querySelectorAll("[data-phone-unread]").forEach((b)=>{b.hidden=!allowed||count===0;b.textContent=count;});}
  function markViewed(call){if(!call?.missed)return;const key=callKey(call),list=viewed();if(!list.includes(key))localStorage.setItem(VIEWED_KEY,JSON.stringify([...list,key]));syncBadge();}
  function tone(frequency=440,duration=.07){if(localStorage.getItem("myphone.settings.sounds")==="0")return;try{const C=window.AudioContext||window.webkitAudioContext;const ctx=new C(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=frequency;gain.gain.value=.025;osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);osc.onended=()=>ctx.close();}catch{/* silent fallback */}}
  function tabs(){return `<nav class="phone-tabs">${[["favorites","★"],["recents","↻"],["contacts","♙"],["keypad","⊙"]].map(([id,icon])=>`<button type="button" data-phone-tab="${id}" class="${activeTab===id?"active":""}"><i>${icon}</i><span>${id[0].toUpperCase()+id.slice(1)}</span></button>`).join("")}</nav>`;}
  function shell(title,body){return `<section class="phone-screen"><header class="phone-header"><h2>${title}</h2></header><div class="phone-body">${body}</div>${tabs()}</section>`;}
  function recentRow(call){const c=contacts[call.id],index=calls.indexOf(call),danger=call.missed||call.id==="unknown";return `<div class="recent-call ${danger?"missed":""}"><button type="button" data-contact-info="${call.id}" data-call-index="${index}">${avatar(c)}<span><strong>${esc(c.name)}</strong><small>${call.direction==="Outgoing"?"↗":"↙"} ${call.result}</small></span><time>${call.date==="Today"?call.time:call.date}</time></button><button class="call-info-button" type="button" data-contact-info="${call.id}" data-call-index="${index}" aria-label="Information for ${esc(c.name)}">ⓘ</button></div>`;}
  function recents(){const filter=localStorage.getItem(FILTER_KEY)||"all";const list=filter==="missed"?calls.filter((c)=>c.missed):calls;return shell("Recents",`<div class="phone-segment"><button class="${filter==="all"?"active":""}" data-recents-filter="all">All</button><button class="${filter==="missed"?"active":""}" data-recents-filter="missed">Missed</button></div><div class="recent-list">${list.map(recentRow).join("")}</div>`);}
  function favoriteRow(id){const c=contacts[id];return `<article class="favorite-card">${avatar(c)}<span><strong>${c.name}</strong><small>${c.label}</small></span><button type="button" data-call="${id}" aria-label="Call ${c.name}">☎</button>${c.message?`<button type="button" data-message="${c.message}" aria-label="Message ${c.name}">●</button>`:""}</article>`;}
  function favorites(){return shell("Favorites",["ghosts","fi","mom"].map(favoriteRow).join(""));}
  function contactsPage(){const ids=["amber","chase","d","dad","fi","ghosts","jimmy","junior","kalix","mom","naomi","noelle","selina","twin","yt"];let letter="";return shell("Contacts",ids.map((id)=>{const c=contacts[id],next=c.name[0];const heading=next!==letter?(letter=next,`<h3 class="contact-letter">${next}</h3>`):"";return `${heading}<button class="contact-row" type="button" data-contact-info="${id}">${avatar(c)}<span><strong>${c.name}</strong><small>${c.label}</small></span><b>›</b></button>`;}).join(""));}
  function formatNumber(value){const n=value.replace(/\D/g,"").slice(0,10);if(n.length>6)return`(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}`;if(n.length>3)return`(${n.slice(0,3)}) ${n.slice(3)}`;return n;}
  function keypad(){const keys=[["1",""],["2","ABC"],["3","DEF"],["4","GHI"],["5","JKL"],["6","MNO"],["7","PQRS"],["8","TUV"],["9","WXYZ"],["*",""],["0","+"],["#",""]];return shell("Keypad",`<div class="dial-display"><strong>${formatNumber(dialed)||" "}</strong><small>${dialed?"Unknown Number":"Enter a number"}</small></div><div class="phone-keypad">${keys.map(([n,l])=>`<button type="button" data-dial-key="${n}"><strong>${n}</strong><small>${l}</small></button>`).join("")}</div><div class="dial-actions"><button class="dial-delete" data-dial-delete aria-label="Delete digit">⌫</button><button class="dial-call" data-dial-call ${dialed?"":"disabled"} aria-label="Call number">☎</button><span></span></div>`);}
  function renderTab(tab=activeTab){activeTab=tab;localStorage.setItem(TAB_KEY,tab);host.innerHTML=tab==="favorites"?favorites():tab==="contacts"?contactsPage():tab==="keypad"?keypad():recents();bind();document.getElementById("appWindow").scrollTop=0;}
  function actionButton(type,label,id){return `<button type="button" data-${type}="${id}"><i>${type==="message"?"●":type==="call"?"☎":type==="location"?"⌖":type==="photos"?"▧":type==="mail"?"✉":"↗"}</i><span>${label}</span></button>`;}
  function info(id,selectedCall){const c=contacts[id],call=selectedCall||calls.find((item)=>item.id===id);markViewed(call);let actions="";if(c.message)actions+=actionButton("message","Message",c.message);actions+=actionButton("call","Call",id);if(c.location)actions+=actionButton("location","Location",c.location);if(c.photos)actions+=actionButton("photos","Shared Photos",id);if(c.mail)actions+=actionButton("mail","Mail Inquiry",c.mail);if(c.website)actions+=actionButton("website","Website",c.website);host.innerHTML=`<section class="phone-detail"><header><button data-phone-back="recents">‹ Recents</button></header><div class="phone-contact-hero">${avatar(c,"large")}<h2>${c.name}</h2><p>${c.label}</p></div><div class="phone-contact-actions">${actions}</div>${call?`<section class="call-detail-list">${[["Direction",call.direction],["Result",call.result],["Date",call.date],["Time",call.time],...(call.duration?[["Duration",call.duration]]:[])].map(([a,b])=>`<p><span>${a}</span><strong>${b}</strong></p>`).join("")}</section>`:""}</section>`;bind();}
  function clearTimers(){timers.forEach(clearTimeout);timers=[];}
  function callFailure(title,message,id,buttons=""){clearTimers();host.innerHTML=`<section class="call-result"><h2>${title}</h2><p>${message}</p>${buttons||`<button data-contact-info="${id}">Done</button>`}</section>`;bind();}
  function calling(id){const c=contacts[id];if(id==="fi")return callFailure("Business Line","Calls are currently unavailable. Send a message or submit an inquiry through Mail.",id,`<button data-message="fi-ent">Open Messages</button><button data-mail="fi-entertainment">Open Mail</button><button data-contact-info="fi">Cancel</button>`);if(id==="chase")return callFailure("External Call Unavailable","This contact cannot be called from myPhone.",id,`<button data-message="chase-bank">Open Messages</button><button data-contact-info="chase">Done</button>`);if(id==="unknown")return callFailure("Number Unavailable","No return number was provided.",id);if(id==="ghosts")return callFailure("Call Ghosts In Shells?","This will leave myPhone and open your device’s calling application. Standard call and carrier rates may apply. An approved business number is not configured in this project.",id,`<button disabled>Call</button><button data-contact-info="ghosts">Cancel</button>`);
    clearTimers();host.innerHTML=`<section class="calling-screen" data-active-call="${id}"><div class="calling-contact">${avatar(c,"call")}<h2>${c.name}</h2><p data-call-status>Calling…</p></div><div class="call-controls">${[["mute","Mute"],["keypad","Keypad"],["speaker","Speaker"],["disabled","Add Call"],["disabled","Video"],["contacts","Contacts"]].map(([a,b])=>`<button type="button" data-call-control="${a}" ${a==="disabled"?"disabled":""}><i>${a==="mute"?"♩":a==="speaker"?"◖":a==="keypad"?"⌨":a==="contacts"?"♙":"×"}</i><span>${b}</span></button>`).join("")}</div><button class="end-call" type="button" data-end-call="${id}" aria-label="End call">☎</button></section>`;bind();tone(420,.12);const status=host.querySelector("[data-call-status]");timers.push(setTimeout(()=>{if(status)status.textContent="Connecting…";},2000));const delay={amber:7000,naomi:4000,noelle:4000,selina:5000}[id]||4000;timers.push(setTimeout(()=>{if(id==="amber"){status.textContent="No Answer";timers.push(setTimeout(()=>info(id),1100));}else if(id==="selina"){status.textContent="Call Ended";timers.push(setTimeout(()=>info(id),900));}else callFailure("Call Failed",`${c.name} is unavailable.`,id);tone(220,.12);},delay));}
  function callOverlay(type,id){const c=contacts[id];if(type==="contacts")host.querySelector(".calling-screen").insertAdjacentHTML("beforeend",`<div class="call-overlay"><h3>Contacts</h3>${Object.entries(contacts).filter(([key])=>key!=="unknown").map(([,x])=>`<p>${x.name}</p>`).join("")}<button data-hide-overlay>Return to ${c.name}</button></div>`);else host.querySelector(".calling-screen").insertAdjacentHTML("beforeend",`<div class="call-overlay"><h3>Keypad</h3><div class="mini-keypad">${[1,2,3,4,5,6,7,8,9,"*",0,"#"].map(n=>`<button data-call-digit="${n}">${n}</button>`).join("")}</div><button data-hide-overlay>Hide</button></div>`);bind();}
  function switchApp(title,className,open){clearTimers();const content=document.getElementById("appContent");document.getElementById("appTitle").textContent=title;content.className=`app-content ${className}`;open(content);}
  function bind(){host.querySelectorAll("[data-phone-tab]").forEach(b=>b.onclick=()=>renderTab(b.dataset.phoneTab));host.querySelectorAll("[data-recents-filter]").forEach(b=>b.onclick=()=>{localStorage.setItem(FILTER_KEY,b.dataset.recentsFilter);renderTab("recents")});host.querySelectorAll("[data-contact-info]").forEach(b=>b.onclick=()=>info(b.dataset.contactInfo,b.dataset.callIndex===undefined?null:calls[Number(b.dataset.callIndex)]));host.querySelectorAll("[data-phone-back]").forEach(b=>b.onclick=()=>renderTab(b.dataset.phoneBack));host.querySelectorAll("[data-call]").forEach(b=>b.onclick=()=>calling(b.dataset.call));host.querySelectorAll("[data-message]").forEach(b=>b.onclick=()=>switchApp("Messages","connected-app-content",h=>window.MyMessages.openThreadById(h,b.dataset.message)));host.querySelectorAll("[data-location]").forEach(b=>b.onclick=()=>switchApp("Maps","connected-app-content",h=>window.MyMessages.openMaps(h,b.dataset.location)));host.querySelectorAll("[data-photos]").forEach(b=>b.onclick=()=>switchApp("Photos","connected-app-content",h=>window.MyMessages.openPhotos(h)));host.querySelectorAll("[data-mail]").forEach(b=>b.onclick=()=>switchApp("Mail","mail-app-content",h=>window.MyMail.openCampaign(h,b.dataset.mail)));host.querySelectorAll("[data-website]").forEach(b=>b.onclick=()=>window.open(b.dataset.website,"_blank","noopener"));host.querySelectorAll("[data-dial-key]").forEach(b=>b.onclick=()=>{if(dialed.length<10)dialed+=b.dataset.dialKey;tone(350+Number(b.dataset.dialKey||0)*20);renderTab("keypad")});host.querySelector("[data-dial-delete]")?.addEventListener("click",()=>{dialed=dialed.slice(0,-1);renderTab("keypad")});host.querySelector("[data-dial-call]")?.addEventListener("click",()=>callFailure("Unable to Complete Call","This myPhone cannot place calls to unknown numbers.","unknown",`<button data-contact-create>Add to Contacts</button><button data-phone-tab="keypad">Done</button>`));host.querySelector("[data-contact-create]")?.addEventListener("click",()=>callFailure("Contact creation is unavailable in Early Access.","", "unknown",`<button data-phone-tab="keypad">Done</button>`));host.querySelectorAll("[data-call-control]").forEach(b=>b.onclick=()=>{const id=host.querySelector("[data-active-call]")?.dataset.activeCall;if(["mute","speaker"].includes(b.dataset.callControl))b.classList.toggle("active");if(["keypad","contacts"].includes(b.dataset.callControl))callOverlay(b.dataset.callControl,id)});host.querySelector("[data-end-call]")?.addEventListener("click",e=>{clearTimers();tone(210,.1);info(e.currentTarget.dataset.endCall)});host.querySelector("[data-hide-overlay]")?.addEventListener("click",()=>host.querySelector(".call-overlay")?.remove());host.querySelectorAll("[data-call-digit]").forEach(b=>b.onclick=()=>tone(330+Number(b.dataset.callDigit||0)*20));}
  function keyboard(event){if(!host||activeTab!=="keypad"||!document.querySelector(".phone-app-content"))return;if(/^\d$/.test(event.key)&&dialed.length<10){dialed+=event.key;tone(350+Number(event.key)*20);renderTab("keypad")}else if(event.key==="Backspace"){dialed=dialed.slice(0,-1);renderTab("keypad")}else if(event.key==="Escape"){dialed="";renderTab("keypad")}else if(event.key==="Enter"&&dialed)callFailure("Unable to Complete Call","This myPhone cannot place calls to unknown numbers.","unknown");}
  function open(node){host=node;activeTab=localStorage.getItem(TAB_KEY)||"recents";renderTab(activeTab);syncBadge();}
  window.addEventListener("keydown",keyboard);syncBadge();window.MyPhone={open,syncBadge};
})();
