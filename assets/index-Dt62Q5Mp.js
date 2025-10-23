const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/LoginPage-BvXrlKzF.js","assets/markdown-vendor-CHUou9Sa.js","assets/react-vendor-9esfqqE9.js","assets/index-C-GWJ8ez.js","assets/crypto-DgWI3rvl.js","assets/device-C8OUsEf4.js","assets/crypto-vendor-DLELI0UM.js","assets/index-DmPTVDsj.js","assets/zustand-vendor-CzPTHOhB.js","assets/RegisterPage-B7pYcIBJ.js","assets/NotesPage-C9jK8LRD.js","assets/Toast-ClRAtSG1.js","assets/NotesPage-B3pgEpGO.css","assets/AdminInviteCodesPage-DWzlldIt.js"])))=>i.map(i=>d[i]);
var U=Object.defineProperty;var $=(n,e,t)=>e in n?U(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var w=(n,e,t)=>$(n,typeof e!="symbol"?e+"":e,t);import{j as m}from"./markdown-vendor-CHUou9Sa.js";import{a as z,r as k,b as H,d as T,N as b,R as M,B as J}from"./react-vendor-9esfqqE9.js";import{c as j}from"./zustand-vendor-CzPTHOhB.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const d of r.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&o(d)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function o(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();var A={},N=z;A.createRoot=N.createRoot,A.hydrateRoot=N.hydrateRoot;const G="modulepreload",F=function(n){return"/AnyNote/"+n},R={},E=function(e,t,o){let s=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const d=document.querySelector("meta[property=csp-nonce]"),c=(d==null?void 0:d.nonce)||(d==null?void 0:d.getAttribute("nonce"));s=Promise.allSettled(t.map(h=>{if(h=F(h),h in R)return;R[h]=!0;const u=h.endsWith(".css"),_=u?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${h}"]${_}`))return;const f=document.createElement("link");if(f.rel=u?"stylesheet":G,u||(f.as="script"),f.crossOrigin="",f.href=h,c&&f.setAttribute("nonce",c),document.head.appendChild(f),u)return new Promise((p,y)=>{f.addEventListener("load",p),f.addEventListener("error",()=>y(new Error(`Unable to preload CSS for ${h}`)))})}))}function r(d){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=d,window.dispatchEvent(c),!c.defaultPrevented)throw d}return s.then(d=>{for(const c of d||[])c.status==="rejected"&&r(c.reason);return e().catch(r)})},B={};function W(n,e){let t;try{t=n()}catch{return}return{getItem:s=>{var r;const d=h=>h===null?null:JSON.parse(h,void 0),c=(r=t.getItem(s))!=null?r:null;return c instanceof Promise?c.then(d):d(c)},setItem:(s,r)=>t.setItem(s,JSON.stringify(r,void 0)),removeItem:s=>t.removeItem(s)}}const P=n=>e=>{try{const t=n(e);return t instanceof Promise?t:{then(o){return P(o)(t)},catch(o){return this}}}catch(t){return{then(o){return this},catch(o){return P(o)(t)}}}},K=(n,e)=>(t,o,s)=>{let r={getStorage:()=>localStorage,serialize:JSON.stringify,deserialize:JSON.parse,partialize:i=>i,version:0,merge:(i,g)=>({...g,...i}),...e},d=!1;const c=new Set,h=new Set;let u;try{u=r.getStorage()}catch{}if(!u)return n((...i)=>{console.warn(`[zustand persist middleware] Unable to update item '${r.name}', the given storage is currently unavailable.`),t(...i)},o,s);const _=P(r.serialize),f=()=>{const i=r.partialize({...o()});let g;const a=_({state:i,version:r.version}).then(v=>u.setItem(r.name,v)).catch(v=>{g=v});if(g)throw g;return a},p=s.setState;s.setState=(i,g)=>{p(i,g),f()};const y=n((...i)=>{t(...i),f()},o,s);let S;const l=()=>{var i;if(!u)return;d=!1,c.forEach(a=>a(o()));const g=((i=r.onRehydrateStorage)==null?void 0:i.call(r,o()))||void 0;return P(u.getItem.bind(u))(r.name).then(a=>{if(a)return r.deserialize(a)}).then(a=>{if(a)if(typeof a.version=="number"&&a.version!==r.version){if(r.migrate)return r.migrate(a.state,a.version);console.error("State loaded from storage couldn't be migrated since no migrate function was provided")}else return a.state}).then(a=>{var v;return S=r.merge(a,(v=o())!=null?v:y),t(S,!0),f()}).then(()=>{g==null||g(S,void 0),d=!0,h.forEach(a=>a(S))}).catch(a=>{g==null||g(void 0,a)})};return s.persist={setOptions:i=>{r={...r,...i},i.getStorage&&(u=i.getStorage())},clearStorage:()=>{u==null||u.removeItem(r.name)},getOptions:()=>r,rehydrate:()=>l(),hasHydrated:()=>d,onHydrate:i=>(c.add(i),()=>{c.delete(i)}),onFinishHydration:i=>(h.add(i),()=>{h.delete(i)})},l(),S||y},X=(n,e)=>(t,o,s)=>{let r={storage:W(()=>localStorage),partialize:l=>l,version:0,merge:(l,i)=>({...i,...l}),...e},d=!1;const c=new Set,h=new Set;let u=r.storage;if(!u)return n((...l)=>{console.warn(`[zustand persist middleware] Unable to update item '${r.name}', the given storage is currently unavailable.`),t(...l)},o,s);const _=()=>{const l=r.partialize({...o()});return u.setItem(r.name,{state:l,version:r.version})},f=s.setState;s.setState=(l,i)=>{f(l,i),_()};const p=n((...l)=>{t(...l),_()},o,s);s.getInitialState=()=>p;let y;const S=()=>{var l,i;if(!u)return;d=!1,c.forEach(a=>{var v;return a((v=o())!=null?v:p)});const g=((i=r.onRehydrateStorage)==null?void 0:i.call(r,(l=o())!=null?l:p))||void 0;return P(u.getItem.bind(u))(r.name).then(a=>{if(a)if(typeof a.version=="number"&&a.version!==r.version){if(r.migrate)return[!0,r.migrate(a.state,a.version)];console.error("State loaded from storage couldn't be migrated since no migrate function was provided")}else return[!1,a.state];return[!1,void 0]}).then(a=>{var v;const[C,q]=a;if(y=r.merge(q,(v=o())!=null?v:p),t(y,!0),C)return _()}).then(()=>{g==null||g(y,void 0),y=o(),d=!0,h.forEach(a=>a(y))}).catch(a=>{g==null||g(void 0,a)})};return s.persist={setOptions:l=>{r={...r,...l},l.storage&&(u=l.storage)},clearStorage:()=>{u==null||u.removeItem(r.name)},getOptions:()=>r,rehydrate:()=>S(),hasHydrated:()=>d,onHydrate:l=>(c.add(l),()=>{c.delete(l)}),onFinishHydration:l=>(h.add(l),()=>{h.delete(l)})},r.skipHydration||S(),y||p},V=(n,e)=>"getStorage"in e||"serialize"in e||"deserialize"in e?((B?"production":void 0)!=="production"&&console.warn("[DEPRECATED] `getStorage`, `serialize` and `deserialize` options are deprecated. Use `storage` option instead."),K(n,e)):X(n,e),L=V,Z="https://whynote.aydoz.com/api";class Q{constructor(e=Z){w(this,"baseUrl");w(this,"token",null);w(this,"refreshToken",null);w(this,"tokenExpiresAt",null);w(this,"onUnauthorized",null);w(this,"isRefreshing",!1);w(this,"refreshPromise",null);this.baseUrl=e}setToken(e,t){this.token=e,this.tokenExpiresAt=t||null}setRefreshToken(e){this.refreshToken=e}setUnauthorizedHandler(e){this.onUnauthorized=e}isTokenExpiringSoon(){if(!this.tokenExpiresAt)return!1;const e=Date.now(),t=60*1e3;return e+t>=this.tokenExpiresAt}async refreshAccessToken(){return this.isRefreshing&&this.refreshPromise?this.refreshPromise:this.refreshToken?(this.isRefreshing=!0,this.refreshPromise=(async()=>{var e;try{const t=await fetch(`${this.baseUrl}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refresh_token:this.refreshToken})});if(!t.ok)return console.error("[API] 刷新 Token 失败:",t.status),!1;const o=await t.json();if(o.success&&((e=o.data)!=null&&e.token)){const s=Date.now()+(o.data.expires_in||900)*1e3;this.setToken(o.data.token,s);const{useAuthStore:r}=await E(async()=>{const{useAuthStore:d}=await Promise.resolve().then(()=>Y);return{useAuthStore:d}},void 0);return r.getState().setToken(o.data.token,o.data.expires_in),console.log("[API] Token 刷新成功"),!0}return!1}catch(t){return console.error("[API] 刷新 Token 异常:",t),!1}finally{this.isRefreshing=!1,this.refreshPromise=null}})(),this.refreshPromise):(console.warn("[API] 无法刷新 Token：缺少 refresh_token"),!1)}async request(e,t={},o=3e4){var d;this.isTokenExpiringSoon()&&!e.includes("/auth/refresh")&&(console.log("[API] Token 即将过期，自动刷新..."),await this.refreshAccessToken());let s="zh-CN";try{const{useSettingsStore:c}=await E(async()=>{const{useSettingsStore:h}=await Promise.resolve().then(()=>re);return{useSettingsStore:h}},void 0);s=c.getState().language}catch{console.warn("[API] 无法获取语言设置，使用默认语言")}const r={"Content-Type":"application/json","Accept-Language":s,...t.headers};this.token&&(r.Authorization=`Bearer ${this.token}`);try{const c=new AbortController,h=setTimeout(()=>c.abort(),o),u=await fetch(`${this.baseUrl}${e}`,{...t,headers:r,signal:c.signal});if(clearTimeout(h),u.status===401&&!e.includes("/auth/refresh")&&(console.log("[API] 收到 401 错误，尝试刷新 Token..."),await this.refreshAccessToken()))return console.log("[API] Token 刷新成功，重新发起请求"),this.request(e,t,o);if(u.status===401){let f="UNAUTHORIZED",p="会话已失效，请重新登录";try{const y=await u.json();(d=y.error)!=null&&d.code&&(f=y.error.code,p=y.error.message||p)}catch{}return this.onUnauthorized&&this.onUnauthorized(f),{success:!1,error:{code:f,message:p}}}return await u.json()}catch(c){return c.name==="AbortError"?{success:!1,error:{code:"TIMEOUT",message:"请求超时，请检查网络连接后重试"}}:{success:!1,error:{code:"NETWORK_ERROR",message:c.message||"网络请求失败"}}}}async getSalt(e){return this.request("/auth/salt",{method:"POST",body:JSON.stringify({email:e})})}async register(e,t,o,s,r){return this.request("/auth/register",{method:"POST",body:JSON.stringify({email:e,auth_hash:t,salt:o,invite_code:s,turnstile_token:r})})}async login(e,t,o,s,r){return this.request("/auth/login",{method:"POST",body:JSON.stringify({email:e,auth_hash:t,device_id:o,device_name:s,turnstile_token:r})})}async getNotesCount(){return this.request("/notes/count")}async getNotes(e=50,t=0){const o=new URLSearchParams({limit:e.toString(),offset:t.toString()});return this.request(`/notes?${o}`)}async getNote(e){return this.request(`/notes/${e}`)}async createNote(e){return this.request("/notes",{method:"POST",body:JSON.stringify(e)})}async updateNote(e,t){return this.request(`/notes/${e}`,{method:"PUT",body:JSON.stringify(t)})}async deleteNote(e){return this.request(`/notes/${e}`,{method:"DELETE"})}async getPasswordsCount(){return this.request("/passwords/count")}async getPasswords(e=50,t=0){const o=new URLSearchParams({limit:e.toString(),offset:t.toString()});return this.request(`/passwords?${o}`)}async createPassword(e){return this.request("/passwords",{method:"POST",body:JSON.stringify(e)})}async updatePassword(e,t){return this.request(`/passwords/${e}`,{method:"PUT",body:JSON.stringify(t)})}async deletePassword(e){return this.request(`/passwords/${e}`,{method:"DELETE"})}async getSessions(){return this.request("/sessions",{method:"GET"})}async revokeSession(e){return this.request(`/sessions/${e}`,{method:"DELETE"})}async logout(){return this.request("/auth/logout",{method:"POST"})}async heartbeat(){return this.request("/auth/heartbeat",{method:"GET"})}async updateNickname(e,t){return this.request("/users/nickname",{method:"PUT",body:JSON.stringify({encrypted_nickname:e,nickname_iv:t})})}async verifyAdminPassword(e){return this.request("/admin/verify",{method:"POST",body:JSON.stringify({password:e})})}async createInviteCode(e){return this.request("/admin/invite-codes",{method:"POST",body:JSON.stringify(e)})}async getInviteCodes(e=100,t=0){return this.request(`/admin/invite-codes?limit=${e}&offset=${t}`,{method:"GET"})}async updateInviteCode(e,t){return this.request(`/admin/invite-codes/${e}`,{method:"PUT",body:JSON.stringify(t)})}async deleteInviteCode(e){return this.request(`/admin/invite-codes/${e}`,{method:"DELETE"})}async getUsers(){return this.request("/admin/users",{method:"GET"})}async deleteUser(e){return this.request(`/admin/users/${e}`,{method:"DELETE"})}async getAdminStats(e){return this.request("/admin/stats",{method:"GET",headers:{"X-Admin-Password":e}})}async cleanupData(e){return this.request("/admin/cleanup",{method:"POST",body:JSON.stringify({password:e})})}}const D=new Q,x=j()(L(n=>({isAuthenticated:!1,user:null,token:null,refreshToken:null,tokenExpiresAt:null,login:(e,t,o,s)=>{const r=s?Date.now()+s*1e3:null;n({isAuthenticated:!0,user:e,token:t,refreshToken:o||null,tokenExpiresAt:r})},logout:()=>{n({isAuthenticated:!1,user:null,token:null,refreshToken:null,tokenExpiresAt:null}),localStorage.removeItem("anynote-auth-storage")},setToken:(e,t)=>{const o=t?Date.now()+t*1e3:null;n({token:e,tokenExpiresAt:o})},updateUserNickname:e=>{n(t=>({user:t.user?{...t.user,encrypted_nickname:(e==null?void 0:e.encrypted_nickname)||void 0,nickname_iv:(e==null?void 0:e.nickname_iv)||void 0}:null}))}}),{name:"anynote-auth-storage",onRehydrateStorage:()=>n=>{n!=null&&n.token&&D.setToken(n.token,n.tokenExpiresAt),n!=null&&n.refreshToken&&D.setRefreshToken(n.refreshToken)}})),Y=Object.freeze(Object.defineProperty({__proto__:null,useAuthStore:x},Symbol.toStringTag,{value:"Module"})),ee=()=>typeof window>"u"||window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",I=n=>{if(typeof window>"u")return;const e=n==="dark"?"#1e293b":"#3b82f6";let t=document.querySelector('meta[name="theme-color"]');t||(t=document.createElement("meta"),t.setAttribute("name","theme-color"),document.head.appendChild(t)),t.setAttribute("content",e)},te=()=>typeof window>"u"||(navigator.language||"zh-CN").startsWith("zh")?"zh-CN":"en-US",O=j()(L((n,e)=>({theme:ee(),language:te(),itemsPerPage:25,setTheme:t=>{n({theme:t}),t==="dark"?document.documentElement.classList.add("dark"):document.documentElement.classList.remove("dark"),I(t)},setLanguage:t=>{n({language:t})},setItemsPerPage:t=>{n({itemsPerPage:t})},getResolvedTheme:()=>{const{theme:t}=e();return t},getResolvedLanguage:()=>{const{language:t}=e();return t}}),{name:"anynote-settings-storage",onRehydrateStorage:()=>n=>{n&&(n.theme==="dark"?document.documentElement.classList.add("dark"):document.documentElement.classList.remove("dark"),I(n.theme))}})),re=Object.freeze(Object.defineProperty({__proto__:null,useSettingsStore:O},Symbol.toStringTag,{value:"Module"}));function se(){return m.jsx("div",{className:"min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900",children:m.jsxs("div",{className:"flex flex-col items-center gap-4",children:[m.jsx("div",{className:"w-12 h-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"}),m.jsx("p",{className:"text-gray-600 dark:text-gray-400 text-sm",children:"正在加载..."})]})})}const ne={id:"demo-user-id",user_id:"demo-user-id",email:"demo@anynote.app",encrypted_nickname:"",nickname_iv:""},ye="演示用户",oe="demo-jwt-token-for-display-only",pe=[{id:"demo-note-1",user_id:"demo-user-id",title:"欢迎使用 AnyNote 📝",encrypted_content:`# 欢迎使用 AnyNote

这是一个**端到端加密**的笔记与密码管理器。

## 主要特性

- ✅ **零知识加密**：主密码永不上传服务器
- ✅ **Markdown 支持**：支持 GitHub 风格 Markdown (GFM)
- ✅ **密码管理**：安全存储网站账号密码
- ✅ **自动保存**：5 分钟防抖自动保存
- ✅ **深色模式**：支持浅色/深色/跟随系统
- ✅ **国际化**：支持中英文切换

## 开始使用

1. 点击左侧"新建笔记"创建新笔记
2. 使用 Markdown 语法编辑内容
3. 切换到"密码"标签页管理密码
4. 点击右上角设置图标自定义主题

## Markdown 示例

### 代码高亮

\`\`\`javascript
function hello() {
  console.log("Hello, AnyNote!");
}
\`\`\`

### 表格

| 功能 | 状态 |
|------|------|
| 笔记编辑 | ✅ |
| 密码管理 | ✅ |
| 数据导出 | ✅ |

### 数学公式（KaTeX）

行内公式：$E = mc^2$

显示公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

---

**这是一个 Demo 演示版本，所有数据仅存储在浏览器本地，不会上传到服务器。**`,iv:"demo-iv-1",created_at:Date.now()-864e5*2,updated_at:Date.now()-864e5*1,version:1,tags:["教程","欢迎"]},{id:"demo-note-2",user_id:"demo-user-id",title:"技术笔记 - React Hooks",encrypted_content:`# React Hooks 最佳实践

## useState 基础用法

\`\`\`tsx
const [count, setCount] = useState(0);

// 函数式更新（推荐）
setCount(prev => prev + 1);
\`\`\`

## useEffect 依赖项

\`\`\`tsx
useEffect(() => {
  // 副作用逻辑
  return () => {
    // 清理逻辑
  };
}, [dependency]); // 依赖项数组
\`\`\`

## useMemo 性能优化

\`\`\`tsx
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);
\`\`\`

## 自定义 Hook

\`\`\`tsx
function useLocalStorage(key: string, initialValue: string) {
  const [value, setValue] = useState(() => {
    return localStorage.getItem(key) || initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
\`\`\`

---

**标签**：React, JavaScript, 前端开发`,iv:"demo-iv-2",created_at:Date.now()-864e5*7,updated_at:Date.now()-864e5*3,version:1,tags:["React","前端","技术"]},{id:"demo-note-3",user_id:"demo-user-id",title:"会议记录 - 产品规划",encrypted_content:`# 产品规划会议记录

**日期**：2025-10-20
**参与者**：产品团队、技术团队

## 讨论议题

1. **移动端优化**
   - 响应式布局改进
   - PWA 功能增强
   - 触摸手势支持

2. **安全性提升**
   - 双因素认证（2FA）
   - 设备管理功能
   - 自动锁屏机制

3. **功能扩展**
   - Markdown 导入导出
   - 笔记标签系统
   - 搜索功能优化

## 待办事项

- [ ] UI/UX 设计稿（下周三前）
- [ ] 技术方案评审（下周五）
- [ ] 原型开发（两周内）

## 下次会议

**时间**：2025-10-27 14:00
**地点**：会议室 A

---

**备注**：本次会议达成共识，优先实现移动端优化和安全性提升。`,iv:"demo-iv-3",created_at:Date.now()-864e5*1,updated_at:Date.now()-36e5,version:1,tags:["会议","产品"]}],ve=[{id:"demo-password-1",user_id:"demo-user-id",encrypted_site:"GitHub",encrypted_username:"demo@example.com",encrypted_password:"MySecurePassword123!",encrypted_notes:"GitHub 主账号，用于开源项目开发",iv:"demo-iv-pw-1",created_at:Date.now()-864e5*30,updated_at:Date.now()-864e5*5,version:1},{id:"demo-password-2",user_id:"demo-user-id",encrypted_site:"Gmail",encrypted_username:"myemail@gmail.com",encrypted_password:"EmailPassword456@",encrypted_notes:"主邮箱账号，启用了双因素认证",iv:"demo-iv-pw-2",created_at:Date.now()-864e5*60,updated_at:Date.now()-864e5*10,version:1},{id:"demo-password-3",user_id:"demo-user-id",encrypted_site:"Cloudflare",encrypted_username:"admin@mydomain.com",encrypted_password:"CloudflareToken789#",encrypted_notes:"Cloudflare 账号，用于管理 Workers 和 Pages",iv:"demo-iv-pw-3",created_at:Date.now()-864e5*15,updated_at:Date.now()-864e5*2,version:1}],_e=[{id:"demo-session-1",device_name:'MacBook Pro 16"',device_type:"desktop",browser_name:"Chrome",os_name:"macOS 15",ip_address:"203.0.113.12",location:"Beijing · CN",is_active:!0,is_current:!0,created_at:Date.now()-864e5*7,last_active:Date.now()},{id:"demo-session-2",device_name:"iPhone 16 Pro",device_type:"mobile",browser_name:"Safari",os_name:"iOS 18",ip_address:"198.51.100.8",location:"Shanghai · CN",is_active:!0,is_current:!1,created_at:Date.now()-864e5*3,last_active:Date.now()-36e5*2},{id:"demo-session-3",device_name:"iPad Air",device_type:"tablet",browser_name:"Safari",os_name:"iPadOS 18",ip_address:"192.0.2.15",location:"Shenzhen · CN",is_active:!0,is_current:!1,created_at:Date.now()-864e5*10,last_active:Date.now()-864e5}],Se=()=>!0,we={"zh-CN":"🎭 Demo 演示模式：所有数据仅用于展示，不会保存到服务器","en-US":"🎭 Demo Mode: All data is for display only and will not be saved to the server"},ae=k.lazy(()=>E(()=>import("./LoginPage-BvXrlKzF.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8]))),ie=k.lazy(()=>E(()=>import("./RegisterPage-B7pYcIBJ.js"),__vite__mapDeps([9,1,2,3,4,7,8]))),de=k.lazy(()=>E(()=>import("./NotesPage-C9jK8LRD.js"),__vite__mapDeps([10,1,2,4,5,6,7,11,8,12]))),ce=k.lazy(()=>E(()=>import("./AdminInviteCodesPage-DWzlldIt.js"),__vite__mapDeps([13,1,2,3,7,11,8])));function ue(){const n=x(s=>s.isAuthenticated),e=x(s=>s.login),t=O(s=>s.theme),o=O(s=>s.setTheme);return k.useEffect(()=>{n||(console.log("🎭 Demo 模式已启用，自动登录..."),e(ne,oe))},[n,e]),k.useEffect(()=>{o(t)},[]),m.jsx("div",{className:"min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden max-w-full",children:m.jsx(k.Suspense,{fallback:m.jsx(se,{}),children:m.jsxs(H,{children:[m.jsx(T,{path:"/login",element:n?m.jsx(b,{to:"/notes",replace:!0}):m.jsx(ae,{})}),m.jsx(T,{path:"/register",element:n?m.jsx(b,{to:"/notes",replace:!0}):m.jsx(ie,{})}),m.jsx(T,{path:"/notes",element:n?m.jsx(de,{}):m.jsx(b,{to:"/login",replace:!0})}),m.jsx(T,{path:"/admin",element:n?m.jsx(ce,{}):m.jsx(b,{to:"/login",replace:!0})}),m.jsx(T,{path:"/",element:m.jsx(b,{to:n?"/notes":"/login",replace:!0})})]})})})}typeof window<"u"&&(window.__REACT_DEVTOOLS_GLOBAL_HOOK__={isDisabled:!0,supportsFiber:!0,inject:()=>{},onCommitFiberRoot:()=>{},onCommitFiberUnmount:()=>{}});const le="/AnyNote";A.createRoot(document.getElementById("root")).render(m.jsx(M.StrictMode,{children:m.jsx(J,{basename:le,future:{v7_startTransition:!0,v7_relativeSplatPath:!0},children:m.jsx(ue,{})})}));export{we as D,E as _,O as a,D as b,ve as c,pe as d,ye as e,_e as f,Se as i,x as u};
//# sourceMappingURL=index-Dt62Q5Mp.js.map
