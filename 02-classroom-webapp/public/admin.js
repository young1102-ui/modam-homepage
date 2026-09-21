import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
const $=id=>document.getElementById(id);let auth,rooms=[],editing=null;
function message(id,text,ok=false){$(id).textContent=text;$(id).classList.toggle('ok',ok)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(action,method='GET',data){const token=auth.currentUser&&await auth.currentUser.getIdToken();const r=await fetch('/api?action='+encodeURIComponent(action),{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store'});let j=await r.json();if(!r.ok)throw new Error(j.error||'처리하지 못했습니다.');return j;}
async function load(){const response=await api('rooms');rooms=response.rooms;render();}
function render(){const list=$('roomList');list.replaceChildren();if(!rooms.length){list.textContent='등록된 수업이 없습니다.';return;}
for(const room of rooms){const panel=document.createElement('article');panel.className='room';const title=document.createElement('div');title.className='room-title';title.textContent=room.name;const status=document.createElement('span');status.className='status'+(room.active?' active':'');status.textContent=room.active?'입장 허용':'입장 중지';title.append(status);const url=document.createElement('div');url.className='room-url';url.textContent=room.targetUrl;const actions=document.createElement('div');actions.className='room-actions';const buttons=[['수정',()=>edit(room),'secondary'],[room.active?'입장 중지':'입장 허용',()=>toggle(room),'secondary'],['삭제',()=>remove(room),'danger']];for(const [label,fn,cls] of buttons){const b=document.createElement('button');b.type='button';b.className=cls+' small';b.textContent=label;b.addEventListener('click',fn);actions.append(b);}panel.append(title,url,actions);list.append(panel);}}
function reset(){editing=null;$('roomForm').reset();$('active').checked=true;$('formTitle').textContent='새 수업 등록';$('roomPassword').required=true;$('cancelButton').classList.add('hidden');message('formMessage','');}
function edit(room){editing=room.id;$('name').value=room.name;$('targetUrl').value=room.targetUrl;$('roomPassword').value='';$('roomPassword').required=false;$('active').checked=room.active;$('formTitle').textContent='수업 수정';$('cancelButton').classList.remove('hidden');message('formMessage','비밀번호를 변경하지 않으려면 비워 두세요.');$('name').focus();}
async function toggle(room){try{await api('save','POST',{id:room.id,name:room.name,targetUrl:room.targetUrl,active:!room.active,password:''});await load();}catch(err){message('formMessage',err.message)}}
async function remove(room){if(!confirm('「'+room.name+'」 수업을 삭제할까요?'))return;try{await api('remove','POST',{id:room.id});if(editing===room.id)reset();await load();}catch(err){message('formMessage',err.message)}}
$('cancelButton').addEventListener('click',reset);
$('roomForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('saveButton');button.disabled=true;try{const url=new URL($('targetUrl').value.trim());if(url.protocol!=='https:')throw new Error('https://로 시작하는 주소를 입력하세요.');await api('save','POST',{...(editing?{id:editing}:{}),name:$('name').value.trim(),password:$('roomPassword').value,targetUrl:url.href,active:$('active').checked});reset();message('formMessage','수업 정보를 저장했습니다.',true);await load();}catch(err){message('formMessage',err.message)}finally{button.disabled=false;}});
$('googleLoginButton').addEventListener('click',async ()=>{
  const button=$('googleLoginButton');button.disabled=true;
  message('loginMessage','구글 로그인 창을 열고 있습니다…');
  try {
    const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    await signInWithPopup(auth,provider);
    message('loginMessage','');
  } catch(err) {
    message('loginMessage',err.code==='auth/popup-blocked'?'팝업이 차단되었습니다. 브라우저에서 팝업을 허용하고 다시 시도해 주세요.':err.code==='auth/unauthorized-domain'?'Firebase Authentication → 설정 → 승인된 도메인에 현재 웹사이트 도메인을 추가해 주세요.':'구글 로그인에 실패했습니다. 계정을 확인하고 다시 시도해 주세요.');
  } finally {button.disabled=false;}
});
$('logout').addEventListener('click',()=>signOut(auth));
try {
  const r=await fetch('/api?action=config',{cache:'no-store'});
  const config=await r.json();if(!r.ok)throw Error(config.error||'설정이 없습니다.');
  auth=getAuth(initializeApp(config));
  onAuthStateChanged(auth,async user=>{
    $('dashboard').classList.add('hidden');
    $('loginPanel').classList.toggle('hidden',!!user);
    $('logout').classList.toggle('hidden',!user);
    if(!user){rooms=[];editing=null;return;}
    try {
      await load();
      if(auth.currentUser?.uid===user.uid){$('dashboard').classList.remove('hidden');$('loginPanel').classList.add('hidden');}
    } catch(err) {
      message('loginMessage',err.message.includes('관리자 권한')?'이 구글 계정에는 관리자 권한이 없습니다. 지정한 계정으로 다시 로그인하세요.':err.message);
      $('loginPanel').classList.remove('hidden');
      $('dashboard').classList.add('hidden');
    }
  });
} catch(err){message('loginMessage','Firebase 연결 설정을 확인해 주세요: '+err.message);}
