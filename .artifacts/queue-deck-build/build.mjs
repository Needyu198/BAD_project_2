import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/apple/Desktop/Backend_Project_2";
const SKILL_DIR = "/Users/apple/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const TMP_DIR = path.join(workspaceDir, ".artifacts/queue-deck-build");
const FINAL_PPTX = path.join(workspaceDir, ".artifacts/output/PawEver_Real_Time_Queue_Proposal_v5.pptx");
const RUNTIME_PYTHON = "/Users/apple/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const { resolvePresentationFont, finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);
const font = resolvePresentationFont();

const C = {
  ink: "#18302B", dark: "#123F38", teal: "#16A085", mint: "#DCF4EC",
  aqua: "#DDF4F5", blue: "#2E6F95", sky: "#E5F0F8", cream: "#FCF7EF",
  gold: "#C98A3D", peach: "#F8E5D2", red: "#C85B55", rose: "#F8E2DF",
  gray: "#66736F", line: "#B6D8CE", white: "#FFFFFF", black: "#101716",
};

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

function addText(slide, text, x, y, w, h, size=24, color=C.ink, bold=false, align="left") {
  const s = slide.shapes.add({ geometry: "textbox", position: { left:x, top:y, width:w, height:h }, fill:"none", line:{fill:"none",width:0} });
  s.text = text;
  s.text.style = { typeface: font, fontSize:size, color, bold, alignment:align, autoFit:"shrinkText" };
  s.text.verticalAlignment = "middle";
  return s;
}

function addBox(slide, x,y,w,h, fill=C.white, stroke=C.line, radius=18, shadow=false) {
  return slide.shapes.add({ geometry:"roundRect", position:{left:x,top:y,width:w,height:h}, fill, line:{style:"solid",fill:stroke,width:1.5}, borderRadius:radius, ...(shadow?{shadow:"2px 5px 14px #18302B/15"}:{}) });
}

function addLine(slide, x,y,w,h, color=C.teal, width=3) {
  return slide.shapes.add({ geometry:"line", position:{left:x,top:y,width:w,height:h}, fill:"none", line:{style:"solid",fill:color,width} });
}

function addArrow(slide, x,y,w,h, color=C.teal) {
  return slide.shapes.add({ geometry:"rightArrow", position:{left:x,top:y,width:w,height:h}, fill:color, line:{fill:color,width:0} });
}

function addCircle(slide, label, x,y,d, fill, size=22, color=C.white) {
  const s=slide.shapes.add({geometry:"ellipse",position:{left:x,top:y,width:d,height:d},fill,line:{fill:"none",width:0}});
  s.text=label; s.text.style={typeface:font,fontSize:size,bold:true,color,alignment:"center",autoFit:"shrinkText"}; s.text.verticalAlignment="middle"; return s;
}

function base(slide, n, title, subtitle="") {
  slide.background.fill = C.cream;
  slide.shapes.add({geometry:"rect",position:{left:0,top:0,width:18,height:720},fill:C.teal,line:{fill:C.teal,width:0}});
  addText(slide, String(n).padStart(2,"0"), 52, 34, 55, 30, 16, C.teal, true);
  addText(slide, title, 52, 64, 1120, 60, 34, C.dark, true);
  if (subtitle) addText(slide, subtitle, 54, 120, 1110, 34, 17, C.gray);
  addLine(slide, 52, 162, 1168, 0, C.line, 1.5);
  addText(slide, "PawEver queue management", 52, 683, 300, 18, 12, C.gray);
  addText(slide, String(n), 1180, 683, 40, 18, 12, C.gray, false, "right");
}

function setNotes(slide, text) { slide.speakerNotes.textFrame.setText(text); slide.speakerNotes.setVisible(true); }

// 1 Cover
{
  const s=presentation.slides.add(); s.background.fill=C.dark;
  s.shapes.add({geometry:"ellipse",position:{left:890,top:-170,width:560,height:560},fill:"#1E5B51",line:{fill:"none",width:0}});
  s.shapes.add({geometry:"ellipse",position:{left:1000,top:350,width:380,height:380},fill:"#0E332E",line:{fill:"none",width:0}});
  addText(s,"REAL-TIME",70,95,600,58,26,"#8EE0C8",true);
  addText(s,"Veterinary Clinic\nQueue Management",70,148,760,160,54,C.white,true);
  addText(s,"WebSocket and Socket.IO",74,327,620,48,24,"#CFEDE4",false);
  addLine(s,74,407,525,0,"#55CBB0",4);
  addText(s,"A live queue that keeps pet owners and clinic staff in sync",74,430,610,70,22,C.white,false);
  addCircle(s,"A001",865,250,118,C.teal,26);
  addCircle(s,"A002",995,353,102,C.gold,16);
  addCircle(s,"A003",1080,185,92,C.blue,15);
  addText(s,"10-minute presentation and live demo",74,632,500,30,16,"#A9D8CC");
  setNotes(s,"Good morning. Today I will present our proposal for a real-time veterinary clinic queue management system. In the current queue experience, pet owners must refresh the page or ask staff for updates. Our proposed change uses WebSocket and Socket.IO so queue changes reach connected owner screens immediately. I will explain the problem, the proposed solution, the technical design, the implementation plan, and then show a short live demonstration.");
}

// 2 Agenda
{
  const s=presentation.slides.add(); base(s,2,"Agenda","Real-time veterinary clinic queue management");
  const agenda=[
    ["01","Clinic queue problem"],
    ["02","Proposed solution"],
    ["03","WebSocket and Socket.IO"],
    ["04","Queue update flow"],
    ["05","System architecture"],
    ["06","Socket.IO event design"],
    ["07","Implementation plan"],
    ["08","Live demonstration and testing"],
  ];
  agenda.forEach((item,i)=>{
    const column=i<4?0:1;
    const row=i%4;
    const x=80+column*595;
    const y=205+row*94;
    addText(s,item[0],x,y,58,44,19,column===0?C.teal:C.blue,true,"center");
    addLine(s,x+70,y+22,54,0,column===0?C.teal:C.blue,2.5);
    addText(s,item[1],x+145,y-1,390,46,23,C.dark,true);
  });
  addBox(s,160,605,960,48,C.mint,"#8ACDBA",14);
  addText(s,"The presentation ends with a runnable proof of automatic queue updates",185,612,910,32,17,C.dark,true,"center");
  setNotes(s,"Here is the presentation agenda. I will begin with the clinic queue problem and our proposed solution. I will then explain WebSocket and Socket.IO, the queue update flow, the system architecture, and the event design. After that, I will cover the implementation plan and finish with a live demonstration and testing.");
}

// 3 Problem
{
  const s=presentation.slides.add(); base(s,3,"Clinic queue problem","The current queue page does not update automatically");
  const img=await fs.readFile(path.join(workspaceDir,"Frontend/images/petowner-dashboard.png"));
  s.images.add({blob:img,contentType:"image/png",alt:"PawEver pet owner dashboard",fit:"cover",crop:{left:.05,top:.08,right:.04,bottom:.08},position:{left:670,top:198,width:520,height:330},geometry:"roundRect",borderRadius:"rounded-2xl"});
  addText(s,"Owners need four answers",70,205,370,34,24,C.dark,true);
  addText(s,"• Which number is being served?\n• How many patients are ahead?\n• Is their turn approaching?\n• Has their appointment been called?",70,248,510,180,21,C.ink,false);
  addText(s,"Current workaround",70,450,250,34,24,C.dark,true);
  addText(s,"Refresh the page repeatedly or ask clinic staff for an update.",70,493,510,88,21,C.ink,false);
  addBox(s,670,550,520,78,C.rose,C.red,16);
  addText(s,"Result: uncertainty, unnecessary waiting, and repeated questions for staff",695,564,470,50,19,C.red,true,"center");
  setNotes(s,"The current queue gives pet owners a number after check-in, but the information does not update automatically. Owners need to know which number staff are serving, how many patients are ahead, whether their turn is approaching, and whether staff have called their appointment. Today they must repeatedly refresh or ask clinic staff. This creates uncertainty, unnecessary waiting, and repeated questions that interrupt clinic work.");
}

// 4 Solution
{
  const s=presentation.slides.add(); base(s,4,"Proposed solution","Staff action triggers an immediate update on every connected owner screen");
  const steps=[
    ["1","Owner checks in","System assigns a queue number",C.teal],
    ["2","Staff calls next","Queue state changes on the server",C.blue],
    ["3","Server broadcasts","Socket.IO sends the update",C.gold],
    ["4","Screen changes","Owners see the new state instantly",C.red],
  ];
  steps.forEach((st,i)=>{
    const x=64+i*300; addCircle(s,st[0],x+78,205,64,st[3],25); addText(s,st[1],x,285,220,35,23,C.dark,true,"center"); addText(s,st[2],x,327,220,75,17,C.gray,false,"center"); if(i<3)addArrow(s,x+225,226,62,24,C.line);
  });
  addBox(s,140,455,1000,125,C.mint,"#8ACDBA",22,true);
  addText(s,"Before",180,478,250,32,22,C.red,true,"center");
  addText(s,"Refresh page or ask staff",165,516,280,38,17,C.ink,false,"center");
  addText(s,"No manual refresh",500,487,280,55,26,C.teal,true,"center");
  addText(s,"After",850,478,250,32,22,C.teal,true,"center");
  addText(s,"Current number, patients ahead, and call status update automatically",820,510,310,55,17,C.ink,false,"center");
  setNotes(s,"Our proposed solution adds a continuous real-time channel. The owner checks in and receives a queue number. When staff click Call Next Patient, the application updates the queue on the server. Socket.IO immediately broadcasts the new queue state to connected owner screens. The interface then shows the current number, patients ahead, and whether the pet has been called. The owner does not press Refresh.");
}

// 5 Technology
{
  const s=presentation.slides.add(); base(s,5,"Technology of interest","Socket.IO manages a persistent real-time channel between browser and server");
  addBox(s,74,205,500,350,C.sky,"#99BCD3",22,true);
  addText(s,"WebSocket",104,235,440,50,30,C.blue,true,"center");
  addText(s,"A persistent, full-duplex connection",115,300,420,38,21,C.ink,false,"center");
  addLine(s,150,380,350,0,C.blue,5);
  addText(s,"Browser and server can exchange messages without creating a new HTTP request for every update.",115,411,420,96,19,C.gray,false,"center");
  addBox(s,706,205,500,350,C.mint,"#86CBB8",22,true);
  addText(s,"Socket.IO",736,235,440,50,30,C.teal,true,"center");
  addText(s,"The real-time library used by PawEver",747,300,420,38,21,C.ink,false,"center");
  addText(s,"Real-time event communication\nAutomatic connection handling\nBroadcasting to many users\nRooms for clinic departments\nReconnection support",770,352,375,180,20,C.ink,false,"center");
  addArrow(s,594,348,92,32,C.gold);
  addText(s,"uses",609,310,60,24,16,C.gold,true,"center");
  setNotes(s,"WebSocket provides continuous two-way communication between a client and server. The connection stays open, so the server can send a queue change as soon as it happens. Socket.IO simplifies this work. It provides real-time events, automatic connection handling, broadcasting to multiple users, rooms that can separate clinic departments, and reconnection support. Our first proof can use one shared queue room. Department-specific rooms are part of the proposed extension.");
}

// 6 Update flow
{
  const s=presentation.slides.add(); base(s,6,"Queue update flow","One staff action reaches every connected pet-owner screen");
  const xs=[70,300,535,780,1015]; const names=["Clinic staff","Application API","PostgreSQL","Socket.IO","Owner screens"]; const fills=[C.peach,C.sky,C.mint,"#EAE4F7",C.aqua]; const strokes=[C.gold,C.blue,C.teal,"#8067AD","#4FA7A8"];
  names.forEach((name,i)=>{addBox(s,xs[i],205,190,72,fills[i],strokes[i],15); addText(s,name,xs[i]+10,218,170,45,19,C.dark,true,"center"); if(i<4)addArrow(s,xs[i]+194,226,31,20,C.line);});
  const rows=[
    ["1","Click Call Next Patient","Staff sends an HTTP request"],
    ["2","Validate and advance","Server completes the old turn and calls the next"],
    ["3","Save new queue state","Database stores current number and statuses"],
    ["4","Broadcast queue update","Socket.IO sends an event to connected clients"],
    ["5","Update the interface","Each owner screen displays the new information"],
  ];
  rows.forEach((r,i)=>{const y=325+i*58; addCircle(s,r[0],75,y,38,i===3?"#8067AD":C.teal,16); addText(s,r[1],130,y-2,315,40,19,C.dark,true); addText(s,r[2],460,y-2,690,40,18,C.gray);});
  setNotes(s,"The key flow begins when staff click Call Next Patient. The browser sends the action to the application API. The server validates the staff account, completes the previous turn, and advances the next waiting entry. PostgreSQL saves the new state. Socket.IO then broadcasts a queue update. Every connected owner screen handles that event and updates the displayed current number, patient count, and status without a manual refresh.");
}

// 7 Architecture
{
  const s=presentation.slides.add(); base(s,7,"System architecture","Users, client portals, clinic services, live queue updates, and persistent storage");
  const architectureImage=await fs.readFile(path.join(TMP_DIR,"system-architecture-reference.png"));
  s.shapes.add({geometry:"rect",position:{left:52,top:190,width:1176,height:330},fill:C.white,line:{style:"solid",fill:C.line,width:1.5},shadow:"1px 4px 12px #18302B/12"});
  s.images.add({blob:architectureImage,contentType:"image/png",alt:"Veterinary clinic system architecture showing users, client applications, application API, clinic services, live queue updates, and clinic database",fit:"contain",position:{left:60,top:198,width:1160,height:314}});
  addLine(s,155,556,970,0,C.teal,3);
  addText(s,"Pet owners, doctors, and clinic staff use dedicated portals connected to one application API.",130,570,1020,32,20,C.dark,true,"center");
  addText(s,"Queue changes pass through clinic services, update the database, and reach connected owner screens through the live queue channel.",115,608,1050,43,17,C.gray,false,"center");
  setNotes(s,"This architecture begins with three users: pet owners, doctors, and clinic staff. Each role uses a dedicated client portal. The portals send requests to one application API, which validates the request and coordinates clinic operations. Accounts and pet data, consultations and medical records, billing, and the visit queue sit inside the clinic services layer. When clinic staff change the visit queue, the server saves the new state in the clinic database. The live queue update channel then notifies connected pet-owner screens so their queue status changes without a manual refresh. Socket.IO provides that persistent channel and can broadcast each queue event to every client in the relevant clinic or department room.");
}

// 8 Event design
{
  const s=presentation.slides.add(); base(s,8,"Socket.IO event design","The proposed event carries the queue information needed by the owner screen");
  addBox(s,70,205,540,355,"#152824","#152824",20,true);
  addText(s,"queue:update",100,226,480,38,23,"#83DEC5",true);
  addText(s,'{\n  "department": "general",\n  "currentQueueNumber": "A014",\n  "patientsAhead": 2,\n  "status": "WAITING",\n  "updatedAt": "..."\n}',105,275,460,225,20,"#F4F8F6",false);
  addText(s,"Sent after check-in, call-next, or cancellation",105,510,460,30,16,"#A9C8BF");
  addText(s,"Design decisions",690,205,430,38,27,C.dark,true);
  const ds=[
    ["Broadcast","Send to all clients in the correct room"],
    ["Privacy","Exclude unnecessary owner and pet details"],
    ["Recovery","Reconnect and resynchronize after disconnection"],
    ["Consistency","Emit only after the database update succeeds"],
  ];
  ds.forEach((d,i)=>{const y=270+i*82; addCircle(s,String(i+1),690,y,38,[C.teal,C.blue,C.gold,C.red][i],16); addText(s,d[0],745,y-5,180,26,19,C.dark,true); addText(s,d[1],745,y+24,425,42,16,C.gray);});
  addBox(s,690,610,475,42,C.mint,"#8ACDBA",12); addText(s,"Prototype today: queue:updated signal followed by a fresh REST snapshot",705,615,445,30,14,C.dark,true,"center");
  setNotes(s,"This slide shows the proposed event contract. The event can include the department, current queue number, patients ahead, status, and update time. The server sends it after check-in, call-next, or cancellation. It broadcasts to the appropriate room, excludes unnecessary personal details, reconnects after network loss, and emits only after the database update succeeds. Our runnable prototype currently sends a smaller queue updated signal and then fetches a fresh REST snapshot. That prototype proves the live channel while the proposal defines the richer final event.");
}

// 9 Implementation
{
  const s=presentation.slides.add(); base(s,9,"Implementation plan and runnable proof","The prototype proves live delivery; the proposal adds richer events and department rooms");
  const items=[
    ["01","Queue state","Keep ordered WAITING, SERVING, and COMPLETED entries"],
    ["02","Socket server","Attach Socket.IO and create queue rooms"],
    ["03","Event contract","Broadcast current number, count, and status"],
    ["04","Owner screen","Update immediately and resync after reconnect"],
  ];
  items.forEach((it,i)=>{const y=205+i*92; addText(s,it[0],72,y,55,36,18,C.teal,true); addLine(s,132,y+18,52,0,C.line,2); addText(s,it[1],202,y,190,36,22,C.dark,true); addText(s,it[2],405,y,340,42,18,C.gray);});
  addBox(s,775,190,410,400,"#152824","#152824",20,true);
  addText(s,"RUNNABLE PROOF",810,215,340,30,17,"#83DEC5",true);
  addText(s,"Backend",810,266,150,28,19,C.white,true);
  addText(s,"npm run db:migrate\nnpm run dev",810,300,330,66,18,"#EAF4F0");
  addText(s,"Frontend",810,390,150,28,19,C.white,true);
  addText(s,"npm run dev",810,424,330,34,18,"#EAF4F0");
  addText(s,"Verification",810,500,150,28,19,C.white,true);
  addText(s,"npm run build\nqueue integration test",810,534,330,58,18,"#EAF4F0");
  addBox(s,75,605,1075,45,C.mint,"#8ACDBA",12); addText(s,"Runnable proof demonstrates check-in, call-next, cancellation, reconnection, and live screen refresh",95,612,1035,28,16,C.dark,true,"center");
  setNotes(s,"The implementation plan starts with reliable queue states, then attaches Socket.IO, defines the event contract, and updates the owner interface. The current runnable proof already demonstrates the key behavior: check-in, call-next, cancellation, automatic reconnection, and screen updates without a manual refresh. The next proposal step is to include the richer queue payload and introduce rooms for separate clinics or departments.");
}

// 10 Demo
{
  const s=presentation.slides.add(); base(s,10,"Live demonstration and testing","Two browser windows show the same queue changing in real time");
  addBox(s,65,195,545,410,C.peach,C.gold,20,true); addText(s,"PET OWNER WINDOW",95,218,485,30,18,C.gold,true,"center");
  addText(s,"1  Select a registered pet\n\n2  Click Check In\n\n3  Read queue number and patients ahead\n\n4  Keep this screen open without refreshing",110,280,455,255,22,C.ink,false);
  addBox(s,670,195,545,410,C.sky,C.blue,20,true); addText(s,"STAFF WINDOW",700,218,485,30,18,C.blue,true,"center");
  addText(s,"1  Confirm the waiting entry appears\n\n2  Click Call Next Patient\n\n3  Watch the owner screen change automatically\n\n4  Test reconnection and cancellation",715,280,455,255,22,C.ink,false);
  addBox(s,210,625,860,40,C.mint,"#8ACDBA",12); addText(s,"Proof point: the owner page changes while no one presses Refresh",230,631,820,27,17,C.dark,true,"center");
  setNotes(s,"For the live demonstration, I will open the pet-owner and staff pages in separate windows. The owner checks in a registered pet and receives a queue number. I leave that screen open without pressing Refresh. On the staff page, I confirm the waiting entry and click Call Next Patient. The owner screen changes automatically to show the new current number and status. I can briefly disconnect and reconnect to show Socket.IO recovery, then check in another pet and cancel it. The main proof is visible: a staff action changes every connected owner screen without manual refresh.");
}

// 11 Thanks
{
  const s=presentation.slides.add(); s.background.fill=C.dark;
  addText(s,"THANK YOU",100,130,1080,80,52,C.white,true,"center");
  addText(s,"Real-time queue visibility for pet owners and clinic staff",180,235,920,46,24,"#CFEDE4",false,"center");
  addLine(s,420,318,440,0,"#55CBB0",4);
  const points=[["Staff action","changes the queue"],["Socket.IO","broadcasts the update"],["Owner screen","changes without refresh"]];
  points.forEach((p,i)=>{const x=155+i*330; addCircle(s,String(i+1),x+108,382,62,[C.blue,C.gold,C.teal][i],22); addText(s,p[0],x,462,278,34,22,C.white,true,"center"); addText(s,p[1],x,502,278,50,17,"#B9D7CF",false,"center");});
  addText(s,"Questions?",100,630,1080,45,27,"#8EE0C8",true,"center");
  setNotes(s,"To conclude, our proposal connects one staff action to every relevant pet-owner screen. The server updates the queue, Socket.IO broadcasts the change, and the owner interface changes without a refresh. This reduces uncertainty for owners and repeated questions for clinic staff. Thank you. I am happy to answer any questions.");
}

await fs.mkdir(TMP_DIR,{recursive:true});
const draft=path.join(TMP_DIR,"candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(draft);

const result=await finalizePresentation({
  explicitTotalSlideCount:11,
  requiredNativeTableOwnerSlides:[],
  requiredNativeChartOwnerSlides:[],
  workspaceDir,
  candidatePath:draft,
  finalPath:FINAL_PPTX,
  pythonExecutable:RUNTIME_PYTHON,
  integrityValidatorPath:path.join(SKILL_DIR,"container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath:path.join(SKILL_DIR,"container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs:["--expected-slide-size-emu","12192000,6858000","--validate-heading-fit"],
  fontPolicy:{basis:"design",families:[font]},
  verifyArtifactToolImport:true,
  receiptPath:path.join(TMP_DIR,"validation-v5.json"),
});
console.log(JSON.stringify({font,finalPath:FINAL_PPTX,result},null,2));
